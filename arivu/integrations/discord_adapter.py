"""
arivu.integrations.discord_adapter
──────────────────────────────────────────
Discord integration for Arivu using discord.py.

Features:
  - NL queries via direct messages and channel messages with prefix
  - /query, /refresh slash commands (Discord application commands)
  - Approve / Reject buttons on destructive SQL (Discord UI components)
  - 👍 / 👎 button reactions for RLHF feedback
  - Responds in thread to keep channels clean

Setup:
    1. Create a bot at https://discord.com/developers/applications
    2. Under Bot → enable Message Content Intent
    3. Under OAuth2 → Scopes: bot, applications.commands
    4. Bot Permissions: Send Messages, Read Messages, Use Slash Commands,
       Add Reactions, Read Message History
    5. Invite bot to your server

    export DISCORD_BOT_TOKEN=your_bot_token_here
    export DISCORD_GUILD_ID=your_server_id     # optional, speeds up command sync

Usage:
    from arivu import Arivu
    from arivu.integrations.discord_adapter import DiscordIntegration

    db = Arivu.connect(host=..., mode="user")
    bot = DiscordIntegration(db, token="YOUR_TOKEN")
    bot.start()   # blocking

Requires:
    pip install discord.py
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from .base import BaseIntegration
from ..connection.core import Arivu

logger = logging.getLogger("arivu.integrations.discord")

COMMAND_PREFIX = "!dh "      # fallback prefix for non-slash usage


class DiscordIntegration(BaseIntegration):
    """
    Discord adapter for arivu.

    Session identity: "discord:{user_id}"
    """

    def __init__(
        self,
        db: ARIVU,
        token: Optional[str] = None,
        admin_user_ids: Optional[list[int]] = None,
        guild_id: Optional[int] = None,
    ) -> None:
        super().__init__(db)
        self.token         = token or os.environ["DISCORD_BOT_TOKEN"]
        self.admin_user_ids = set(admin_user_ids or [])
        self.guild_id      = guild_id or int(os.environ.get("DISCORD_GUILD_ID", 0)) or None
        self._client       = None

    # ─────────────────────────────────────────
    # Lifecycle
    # ─────────────────────────────────────────

    def start(self) -> None:
        client = self._build_client()
        self._client = client
        logger.info("Discord bot starting...")
        client.run(self.token)

    def stop(self) -> None:
        if self._client:
            import asyncio
            asyncio.get_event_loop().run_until_complete(self._client.close())
        logger.info("Discord bot stopped.")

    # ─────────────────────────────────────────
    # Send helpers
    # ─────────────────────────────────────────

    def send_message(self, user_id: str, text: str) -> None:
        """Send a message to a channel or DM.

        When called from the scheduler (self._client is None), uses Discord's
        REST API directly to post to a channel ID without needing the full bot.
        When called from a live bot context, uses the async client path.
        """
        if self._client is None:
            # REST path — used by the scheduler / automation runner
            self._send_via_rest(user_id, text)
        else:
            # Async bot path — used when bot is running live
            coro = self._send_dm(int(user_id), text)
            _run_async_safe(coro)

    def _send_via_rest(self, channel_id: str, text: str) -> None:
        """Post a message to a Discord channel via REST API (no bot required)."""
        try:
            import httpx
        except ImportError:
            try:
                import requests as _req
                resp = _req.post(
                    f"https://discord.com/api/v10/channels/{channel_id}/messages",
                    headers={
                        "Authorization": f"Bot {self.token}",
                        "Content-Type": "application/json",
                    },
                    json={"content": text[:2000]},
                    timeout=10,
                )
                resp.raise_for_status()
                return
            except ImportError:
                raise ImportError("httpx or requests is required. Install with: pip install httpx")

        resp = httpx.post(
            f"https://discord.com/api/v10/channels/{channel_id}/messages",
            headers={
                "Authorization": f"Bot {self.token}",
                "Content-Type": "application/json",
            },
            json={"content": text[:2000]},
            timeout=10,
        )
        resp.raise_for_status()


    def send_approval_request(
        self,
        user_id: str,
        sql: str,
        question: str,
        session_id: str,
    ) -> None:
        """Send approval DM to admin users — event-loop safe."""
        for admin_id in (self.admin_user_ids or {int(user_id)}):
            coro = self._send_approval_dm(admin_id, sql, question, session_id)
            _run_async_safe(coro)

    # ─────────────────────────────────────────
    # Client builder
    # ─────────────────────────────────────────

    def _build_client(self):
        try:
            import discord
            from discord.ext import commands
            from discord import app_commands
        except ImportError:
            raise ImportError(
                "discord.py is required. Install with: pip install discord.py"
            )

        intents = discord.Intents.default()
        intents.message_content = True
        intents.dm_messages     = True

        client = commands.Bot(command_prefix=COMMAND_PREFIX, intents=intents)
        integration = self
        guild_obj   = discord.Object(id=self.guild_id) if self.guild_id else None

        # ── On ready ────────────────────────────────────────────────────

        @client.event
        async def on_ready():
            logger.info(f"Discord bot logged in as {client.user}")
            if guild_obj:
                client.tree.copy_global_to(guild=guild_obj)
                await client.tree.sync(guild=guild_obj)
            else:
                await client.tree.sync()

        # ── Slash commands ───────────────────────────────────────────────

        @client.tree.command(
            name="query",
            description="Ask Arivu a question about your database",
            guild=guild_obj,
        )
        @app_commands.describe(question="Your question in plain English")
        async def slash_query(interaction: discord.Interaction, question: str):
            await interaction.response.defer(thinking=True)
            user_id = str(interaction.user.id)
            result  = integration.handle_query(user_id, question)

            if result.success and not result.pending_approval:
                view = _RLHFView(result.session_id)
                await interaction.followup.send(result.response, view=view)
            elif result.pending_approval:
                await interaction.followup.send(
                    "⏳ This operation requires admin approval. Request sent."
                )
            else:
                await interaction.followup.send(f"⚠️ {result.response}")

        @client.tree.command(
            name="refresh",
            description="Refresh the database schema cache",
            guild=guild_obj,
        )
        async def slash_refresh(interaction: discord.Interaction):
            await interaction.response.defer(thinking=True)
            try:
                integration.db.refresh_schema()
                await interaction.followup.send("✅ Schema refreshed successfully.")
            except Exception as exc:
                await interaction.followup.send(f"⚠️ Refresh failed: {exc}")

        # ── Prefix messages (!dh query) ──────────────────────────────────

        @client.event
        async def on_message(message):
            if message.author.bot:
                return

            # DM or prefix command
            is_dm      = isinstance(message.channel, discord.DMChannel)
            has_prefix = message.content.startswith(COMMAND_PREFIX)

            if not is_dm and not has_prefix:
                await client.process_commands(message)
                return

            text = (
                message.content.replace(COMMAND_PREFIX, "", 1).strip()
                if has_prefix
                else message.content.strip()
            )
            if not text:
                await message.reply(
                    "Ask me anything! Example: `!dh how many orders today?`\n"
                    "Or use `/query` for slash commands."
                )
                return

            user_id = str(message.author.id)
            async with message.channel.typing():
                result = integration.handle_query(user_id, text)

            if result.success and not result.pending_approval:
                view = _RLHFView(result.session_id)
                await message.reply(result.response, view=view)
            elif result.pending_approval:
                await message.reply("⏳ Admin approval required. Request sent.")
            else:
                await message.reply(f"⚠️ {result.response}")

            await client.process_commands(message)

        return client

    # ─────────────────────────────────────────
    # Async send helpers
    # ─────────────────────────────────────────

    async def _send_dm(self, user_id: int, text: str) -> None:
        import discord
        user = await self._client.fetch_user(user_id)
        dm   = await user.create_dm()
        await dm.send(text)

    async def _send_approval_dm(
        self, admin_id: int, sql: str, question: str, session_id: str
    ) -> None:
        import discord
        user = await self._client.fetch_user(admin_id)
        dm   = await user.create_dm()
        view = _ApprovalView(session_id, self)
        await dm.send(
            f"🔐 **Admin approval required**\n\n"
            f"**Question:** {question}\n\n"
            f"**SQL:**\n```sql\n{sql}\n```\n"
            f"**Session:** `{session_id[:12]}`",
            view=view,
        )

    def _is_admin(self, user_id: str) -> bool:
        if not self.admin_user_ids:
            return True
        return int(user_id) in self.admin_user_ids


# ─────────────────────────────────────────────────────────────────────────────
# Discord UI Views (buttons)
# ─────────────────────────────────────────────────────────────────────────────

class _RLHFView:
    """Thumbs up / down buttons attached to every response."""
    def __new__(cls, session_id: str):
        try:
            import discord
        except ImportError:
            return None

        class View(discord.ui.View):
            def __init__(self):
                super().__init__(timeout=300)

            @discord.ui.button(label="👍 Helpful", style=discord.ButtonStyle.success)
            async def positive(self, interaction, button):
                _save_rlhf(session_id, "positive")
                await interaction.response.edit_message(view=None)

            @discord.ui.button(label="👎 Not helpful", style=discord.ButtonStyle.secondary)
            async def negative(self, interaction, button):
                _save_rlhf(session_id, "negative")
                await interaction.response.edit_message(view=None)

        return View()


class _ApprovalView:
    """Approve / Reject buttons for admin destructive SQL approval."""
    def __new__(cls, session_id: str, integration: DiscordIntegration):
        try:
            import discord
        except ImportError:
            return None

        class View(discord.ui.View):
            def __init__(self):
                super().__init__(timeout=600)

            @discord.ui.button(label="✅ Approve", style=discord.ButtonStyle.success)
            async def approve(self, interaction, button):
                user_id = str(interaction.user.id)
                integration.handle_approve(user_id, session_id)
                await interaction.response.edit_message(
                    content=f"✅ Approved by {interaction.user.mention}", view=None
                )

            @discord.ui.button(label="❌ Reject", style=discord.ButtonStyle.danger)
            async def reject(self, interaction, button):
                user_id = str(interaction.user.id)
                integration.handle_reject(user_id, session_id)
                await interaction.response.edit_message(
                    content=f"❌ Rejected by {interaction.user.mention}", view=None
                )

        return View()


def _save_rlhf(session_id: str, signal: str) -> None:
    try:
        from ..memory.store import save_rlhf_signal
        save_rlhf_signal(session_id=session_id, question="", sql="", signal=signal)
    except Exception as exc:
        logger.warning(f"[discord] RLHF save failed: {exc}")


def _run_async_safe(coro) -> None:
    """
    Execute an async coroutine safely from any thread context.

    Uses ensure_future for fire-and-forget when inside a running event loop
    (typical for Discord event handlers — avoids deadlocks), otherwise
    falls back to asyncio.run() for non-async contexts and
    run_coroutine_threadsafe for cross-thread calls.
    """
    import asyncio

    try:
        loop = asyncio.get_running_loop()
        future = asyncio.ensure_future(coro, loop=loop)
        future.add_done_callback(
            lambda f: logger.error(f"[discord] async task failed: {f.exception()}")
            if f.exception() else None
        )
    except RuntimeError:
        asyncio.run(coro)