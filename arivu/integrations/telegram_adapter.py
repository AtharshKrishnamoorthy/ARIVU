"""
arivu.integrations.telegram
───────────────────────────────────
Telegram bot integration for arivu.

Features:
  - NL queries via text messages
  - /start, /help, /ref
  resh, /approve, /reject commands
  - Inline thumbs up/down buttons for RLHF feedback
  - Admin approval gate with inline approve/reject buttons
  - Voice message support (speech → text via SpeechRecognition)
  - Image message support (OCR via pytesseract)

Setup:
    export TELEGRAM_BOT_TOKEN=your_token_here

Usage:
    from arivu import Arivu
    from arivu.integrations.telegram import TelegramIntegration

    db = Arivu.connect(host=..., mode="user")
    bot = TelegramIntegration(db, token="YOUR_TOKEN")
    bot.start()   # blocking

Requires:
    pip install python-telegram-bot>=20.0
    pip install SpeechRecognition pydub        # for voice support
    pip install pytesseract Pillow             # for image support
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from .base import BaseIntegration
from ..connection.core import Arivu

logger = logging.getLogger("arivu.integrations.telegram")


class TelegramIntegration(BaseIntegration):
    """
    Telegram bot adapter for arivu.

    Every Telegram user gets their own persistent session in the
    memory layer — keyed as "telegram:{user_id}".
    """

    def __init__(
        self,
        db: ARIVU,
        token: Optional[str] = None,
        admin_user_ids: Optional[list[int]] = None,
    ) -> None:
        super().__init__(db)
        self.token = token or os.environ["TELEGRAM_BOT_TOKEN"]
        self.admin_user_ids = set(admin_user_ids or [])
        self._app = None
        self._bot = None

    @property
    def bot(self):
        if self._app:
            return self._app.bot
        if not self._bot:
            from telegram import Bot
            self._bot = Bot(token=self.token)
        return self._bot

    # ─────────────────────────────────────────
    # Lifecycle
    # ─────────────────────────────────────────

    def start(self) -> None:
        """Build and start the Telegram Application (blocking)."""
        self._app = self._build_app()
        logger.info(f"Telegram bot starting...")
        self._app.run_polling(drop_pending_updates=True)

    def stop(self) -> None:
        if self._app:
            self._app.stop()
            logger.info("Telegram bot stopped.")

    # ─────────────────────────────────────────
    # Send helpers
    # ─────────────────────────────────────────

    async def _send_message_async(self, chat_id: int, text: str, reply_markup=None) -> None:
        try:
            await self.bot.send_message(
                chat_id=chat_id,
                text=text,
                parse_mode="Markdown",
                reply_markup=reply_markup,
            )
        except Exception as e:
            if "Can't parse entities" in str(e) or "parse" in str(e).lower():
                logger.warning(f"[telegram] markdown parse failed, falling back to plain text: {e}")
                await self.bot.send_message(
                    chat_id=chat_id,
                    text=text,
                    reply_markup=reply_markup,
                )
            else:
                raise e

    async def _reply_text_safe(self, update, text: str, reply_markup=None) -> None:
        if update.message:
            try:
                await update.message.reply_text(
                    text,
                    parse_mode="Markdown",
                    reply_markup=reply_markup,
                )
            except Exception as e:
                if "Can't parse entities" in str(e) or "parse" in str(e).lower():
                    logger.warning(f"[telegram] reply markdown parse failed, falling back to plain text: {e}")
                    await update.message.reply_text(
                        text,
                        reply_markup=reply_markup,
                    )
                else:
                    raise e
        else:
            chat_id = update.effective_chat.id
            await self._send_message_async(chat_id=chat_id, text=text, reply_markup=reply_markup)

    def send_message(self, user_id: str, text: str) -> None:
        """
        Synchronous send — used by BaseIntegration.handle_query() and
        handle_approve/handle_reject.

        Uses fire-and-forget dispatch when inside a running event loop
        (avoids deadlocks in voice/photo/callback handlers), otherwise
        runs directly for non-async contexts.
        """
        import asyncio
        coro = self._send_message_async(chat_id=int(user_id), text=text)
        try:
            loop = asyncio.get_running_loop()
            future = asyncio.ensure_future(coro, loop=loop)
            future.add_done_callback(
                lambda f: logger.error(f"[telegram] send_message failed: {f.exception()}")
                if f.exception() else None
            )
        except RuntimeError:
            asyncio.run(coro)

    def send_approval_request(
        self,
        user_id: str,
        sql: str,
        question: str,
        session_id: str,
    ) -> None:
        """Send destructive SQL to admin with inline approve/reject buttons."""
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup

        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton(
                    "✅ Approve",
                    callback_data=f"approve:{session_id}",
                ),
                InlineKeyboardButton(
                    "❌ Reject",
                    callback_data=f"reject:{session_id}",
                ),
            ]
        ])
        text = self.format_approval_message(sql, question)

        import asyncio
        for admin_id in self.admin_user_ids:
            coro = self._send_message_async(chat_id=admin_id, text=text, reply_markup=keyboard)
            try:
                loop = asyncio.get_running_loop()
                asyncio.ensure_future(coro, loop=loop)
            except RuntimeError:
                asyncio.run(coro)

    # ─────────────────────────────────────────
    # App builder
    # ─────────────────────────────────────────

    def _build_app(self):
        from telegram.ext import (
            Application,
            CommandHandler,
            MessageHandler,
            CallbackQueryHandler,
            filters,
        )

        app = (
            Application.builder()
            .token(self.token)
            .build()
        )

        # Commands
        app.add_handler(CommandHandler("start",   self._cmd_start))
        app.add_handler(CommandHandler("help",    self._cmd_help))
        app.add_handler(CommandHandler("refresh", self._cmd_refresh))
        app.add_handler(CommandHandler("approve", self._cmd_approve))
        app.add_handler(CommandHandler("reject",  self._cmd_reject))

        # Message types
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self._handle_text))
        app.add_handler(MessageHandler(filters.VOICE,  self._handle_voice))
        app.add_handler(MessageHandler(filters.PHOTO,  self._handle_photo))


        # RLHF reaction callbacks
        app.add_handler(CallbackQueryHandler(self._handle_rlhf,     pattern=r"^rlhf:"))

        # Inline button callbacks (approve/reject)
        app.add_handler(CallbackQueryHandler(self._handle_callback, pattern=r"^(approve|reject):"))

        return app

    # ─────────────────────────────────────────
    # Command handlers
    # ─────────────────────────────────────────

    async def _cmd_start(self, update, context) -> None:
        user = update.effective_user
        await update.message.reply_text(
            f"👋 Hi {user.first_name}! I'm your Arivu assistant.\n\n"
            f"Just ask me anything about your database in plain English.\n\n"
            f"*Examples:*\n"
            f"• Show me the top 10 customers by spend\n"
            f"• How many orders were placed this week?\n"
            f"• What's the average order value by category?\n\n"
            f"Type /help for more commands.",
            parse_mode="Markdown",
        )

    async def _cmd_help(self, update, context) -> None:
        await update.message.reply_text(
            "*ARIVU Commands*\n\n"
            "/start   — Introduction\n"
            "/help    — This message\n"
            "/refresh — Force schema refresh\n"
            "/approve — Approve a pending admin operation\n"
            "/reject  — Reject a pending admin operation\n\n"
            "*Query types supported:*\n"
            "• Text messages — natural language questions\n"
            "• Voice messages — speak your question\n"
            "• Images — send a screenshot with text",
            parse_mode="Markdown",
        )

    async def _cmd_refresh(self, update, context) -> None:
        await update.message.reply_text("🔄 Refreshing database schema...")
        try:
            self.db.refresh_schema()
            await update.message.reply_text("✅ Schema refreshed successfully.")
        except Exception as exc:
            await update.message.reply_text(f"⚠️ Schema refresh failed: {exc}")

    async def _cmd_approve(self, update, context) -> None:
        """Handle /approve {session_id} command."""
        user_id = str(update.effective_user.id)
        if not self._is_admin(user_id):
            await update.message.reply_text("❌ You don't have admin permissions.")
            return

        args = context.args
        if not args:
            await update.message.reply_text("Usage: /approve {session_id}")
            return

        session_id = args[0]
        self.handle_approve(user_id, session_id)

    async def _cmd_reject(self, update, context) -> None:
        """Handle /reject {session_id} command."""
        user_id = str(update.effective_user.id)
        if not self._is_admin(user_id):
            await update.message.reply_text("❌ You don't have admin permissions.")
            return

        args = context.args
        if not args:
            await update.message.reply_text("Usage: /reject {session_id}")
            return

        session_id = args[0]
        self.handle_reject(user_id, session_id)

    # ─────────────────────────────────────────
    # Message handlers
    # ─────────────────────────────────────────

    async def _handle_text(self, update, context) -> None:
        user_id = str(update.effective_user.id)
        text = update.message.text.strip()
        logger.info(f"telegram text  user={user_id}  text='{text[:70]}'")
        logger.info(f"[telegram] text message  user={user_id}  text='{text[:70]}'")

        await update.message.reply_text("⏳ Thinking...")

        # _run_pipeline_only runs the pipeline in a thread WITHOUT calling
        # send_message — so no telegram API calls happen from the thread.
        # All sends happen below in this async context.
        import asyncio
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, self._run_pipeline_only, user_id, text)

        if result.pending_approval:
            # Notify admins via async (no thread boundary)
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup
            keyboard = InlineKeyboardMarkup([[
                InlineKeyboardButton("✅ Approve", callback_data=f"approve:{result.session_id}"),
                InlineKeyboardButton("❌ Reject",  callback_data=f"reject:{result.session_id}"),
            ]])
            approval_text = self.format_approval_message(result.sql, text)
            for admin_id in self.admin_user_ids:
                try:
                    await self._send_message_async(
                        chat_id=admin_id,
                        text=approval_text,
                        reply_markup=keyboard,
                    )
                except Exception as exc:
                    logger.warning(f"[telegram] failed to notify admin {admin_id}: {exc}")
            await update.message.reply_text(
                "⏳ This query requires admin approval. "
                "An admin must /approve or /reject it before it runs."
            )

        elif result.success:
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup
            keyboard = InlineKeyboardMarkup([[
                InlineKeyboardButton("👍", callback_data=f"rlhf:positive:{result.session_id}"),
                InlineKeyboardButton("👎", callback_data=f"rlhf:negative:{result.session_id}"),
            ]])
            await self._reply_text_safe(
                update,
                result.response,
                reply_markup=keyboard,
            )

        else:
            await update.message.reply_text(
                self.format_error_message(result.error, result.session_id)
            )

    async def _handle_voice(self, update, context) -> None:
        """Transcribe voice message and route as text query."""
        user_id = str(update.effective_user.id)
        logger.info(f"[telegram] voice message  user={user_id}")
        await update.message.reply_text("🎤 Transcribing voice message...")

        try:
            text = await _transcribe_voice(update, context)
            if not text:
                await update.message.reply_text(
                    "⚠️ Couldn't transcribe the voice message. Please try again."
                )
                return
            await update.message.reply_text(f"📝 Heard: _{text}_", parse_mode="Markdown")

            import asyncio
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(None, self._run_pipeline_only, user_id, text)

            if result.pending_approval:
                from telegram import InlineKeyboardButton, InlineKeyboardMarkup
                keyboard = InlineKeyboardMarkup([[
                    InlineKeyboardButton("✅ Approve", callback_data=f"approve:{result.session_id}"),
                    InlineKeyboardButton("❌ Reject",  callback_data=f"reject:{result.session_id}"),
                ]])
                approval_text = self.format_approval_message(result.sql, text)
                for admin_id in self.admin_user_ids:
                    try:
                        await self._send_message_async(
                            chat_id=admin_id, text=approval_text,
                            reply_markup=keyboard,
                        )
                    except Exception as exc:
                        logger.warning(f"[telegram] failed to notify admin {admin_id}: {exc}")
                await update.message.reply_text(
                    "⏳ This query requires admin approval before it can run."
                )
            elif result.success:
                from telegram import InlineKeyboardButton, InlineKeyboardMarkup
                keyboard = InlineKeyboardMarkup([[
                    InlineKeyboardButton("👍", callback_data=f"rlhf:positive:{result.session_id}"),
                    InlineKeyboardButton("👎", callback_data=f"rlhf:negative:{result.session_id}"),
                ]])
                await self._reply_text_safe(
                    update, result.response, reply_markup=keyboard
                )
            else:
                await update.message.reply_text(
                    self.format_error_message(result.error, result.session_id)
                )
        except Exception as exc:
            logger.error(f"[telegram] voice handler error: {exc}")
            await update.message.reply_text("⚠️ Voice processing failed. Please send text.")

    async def _handle_photo(self, update, context) -> None:
        """OCR image and route extracted text as query."""
        user_id = str(update.effective_user.id)
        logger.info(f"[telegram] photo message  user={user_id}")
        await update.message.reply_text("🖼️ Reading image...")

        try:
            text = await _ocr_photo(update, context)
            if not text.strip():
                await update.message.reply_text(
                    "⚠️ No text found in the image. Please try again."
                )
                return
            await update.message.reply_text(
                f"📝 Extracted: _{text[:200]}_", parse_mode="Markdown"
            )

            import asyncio
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(None, self._run_pipeline_only, user_id, text)

            if result.pending_approval:
                from telegram import InlineKeyboardButton, InlineKeyboardMarkup
                keyboard = InlineKeyboardMarkup([[
                    InlineKeyboardButton("✅ Approve", callback_data=f"approve:{result.session_id}"),
                    InlineKeyboardButton("❌ Reject",  callback_data=f"reject:{result.session_id}"),
                ]])
                approval_text = self.format_approval_message(result.sql, text)
                for admin_id in self.admin_user_ids:
                    try:
                        await self._send_message_async(
                            chat_id=admin_id, text=approval_text,
                            reply_markup=keyboard,
                        )
                    except Exception as exc:
                        logger.warning(f"[telegram] failed to notify admin {admin_id}: {exc}")
                await update.message.reply_text(
                    "⏳ This query requires admin approval before it can run."
                )
            elif result.success:
                from telegram import InlineKeyboardButton, InlineKeyboardMarkup
                keyboard = InlineKeyboardMarkup([[
                    InlineKeyboardButton("👍", callback_data=f"rlhf:positive:{result.session_id}"),
                    InlineKeyboardButton("👎", callback_data=f"rlhf:negative:{result.session_id}"),
                ]])
                await self._reply_text_safe(
                    update, result.response, reply_markup=keyboard
                )
            else:
                await update.message.reply_text(
                    self.format_error_message(result.error, result.session_id)
                )
        except Exception as exc:
            logger.error(f"[telegram] photo handler error: {exc}")
            await update.message.reply_text("⚠️ Image processing failed. Please send text.")

    # ─────────────────────────────────────────
    # Callback query handlers
    # ─────────────────────────────────────────

    async def _handle_callback(self, update, context) -> None:
        """Handle inline approve/reject button taps."""
        query = update.callback_query
        await query.answer()

        user_id = str(query.from_user.id)
        data = query.data  # e.g. "approve:sess-xxx" or "reject:sess-xxx"

        action, session_id = data.split(":", 1)

        if not self._is_admin(user_id):
            await query.edit_message_text("❌ You don't have admin permissions.")
            return

        if action == "approve":
            self.handle_approve(user_id, session_id)
            await query.edit_message_text(f"✅ Approved by {query.from_user.first_name}")
        elif action == "reject":
            self.handle_reject(user_id, session_id)
            await query.edit_message_text(f"❌ Rejected by {query.from_user.first_name}")

    async def _handle_rlhf(self, update, context) -> None:
        """Handle 👍/👎 RLHF feedback button taps."""
        from ..memory.store import save_rlhf_signal

        query = update.callback_query
        await query.answer("Thanks for your feedback!")

        _, signal, session_id = query.data.split(":", 2)

        logger.info(f"[telegram] rlhf {signal} for session {session_id}")

        save_rlhf_signal(
            session_id=session_id,
            question="",    # question already stored in memory
            sql="",
            signal=signal,
        )
        await query.edit_message_reply_markup(reply_markup=None)

    # ─────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────

    def _is_admin(self, user_id: str) -> bool:
        if not self.admin_user_ids:
            return True  # no restriction if no admins configured
        return int(user_id) in self.admin_user_ids


# ─────────────────────────────────────────────────────────────────────────────
# Voice + image processing helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _transcribe_voice(update, context) -> str:
    """Download voice message and transcribe via SpeechRecognition."""
    import speech_recognition as sr
    import tempfile
    import os

    voice = update.message.voice
    file = await context.bot.get_file(voice.file_id)

    with tempfile.TemporaryDirectory() as tmpdir:
        ogg_path = os.path.join(tmpdir, "voice.ogg")
        wav_path = os.path.join(tmpdir, "voice.wav")

        await file.download_to_drive(ogg_path)

        # Convert ogg → wav
        try:
            from pydub import AudioSegment
            AudioSegment.from_ogg(ogg_path).export(wav_path, format="wav")
        except ImportError:
            raise ImportError(
                "pydub is required for voice support. "
                "Install with: pip install pydub"
            )

        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio = recognizer.record(source)

        return recognizer.recognize_google(audio)


async def _ocr_photo(update, context) -> str:
    """Download photo and extract text via pytesseract."""
    import tempfile
    import os

    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        raise ImportError(
            "pytesseract and Pillow are required for image support. "
            "Install with: pip install pytesseract Pillow"
        )

    photo = update.message.photo[-1]   # highest resolution
    file = await context.bot.get_file(photo.file_id)

    with tempfile.TemporaryDirectory() as tmpdir:
        img_path = os.path.join(tmpdir, "photo.jpg")
        await file.download_to_drive(img_path)
        return pytesseract.image_to_string(Image.open(img_path))