"""
arivu.integrations.whatsapp
───────────────────────────────────
WhatsApp integration for Arivu via Twilio's WhatsApp API.

Features:
  - NL queries via text messages
  - Approval flow via reply keywords (APPROVE / REJECT)
  - RLHF feedback via reply keywords (GOOD / BAD)
  - Voice message support (Twilio media URL → transcription)
  - Image message support (Twilio media URL → OCR)
  - Runs as a FastAPI webhook server

Setup:
    1. Create a Twilio account and enable WhatsApp sandbox
    2. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM env vars
    3. Point your Twilio webhook to: POST /webhook

    export TWILIO_ACCOUNT_SID=ACxxxxxxx
    export TWILIO_AUTH_TOKEN=your_token
    export TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

Usage:
    from arivu import Arivu
    from arivu.integrations.whatsapp import WhatsAppIntegration

    db = Arivu.connect(host=..., mode="user")
    bot = WhatsAppIntegration(db, admin_numbers=["+919876543210"])
    bot.start(host="0.0.0.0", port=8080)   # starts FastAPI/uvicorn server

Requires:
    pip install fastapi uvicorn python-multipart twilio
    pip install pytesseract Pillow          # for image support
    pip install SpeechRecognition requests  # for voice support
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from .base import BaseIntegration
from ..connection.core import Arivu

# FastAPI imports at module level so Pydantic can resolve the `Request`
# type hint at schema-generation time (avoids ForwardRef / 422 errors).
try:
    from fastapi import FastAPI, Request, Response
    from fastapi.responses import PlainTextResponse
except ImportError:
    FastAPI = Request = Response = PlainTextResponse = None  # type: ignore

logger = logging.getLogger("arivu.integrations.whatsapp")

# Keywords the user can reply with
APPROVE_KEYWORDS  = {"approve", "yes", "confirm", "/approve"}
REJECT_KEYWORDS   = {"reject",  "no",  "cancel",  "/reject"}
POSITIVE_KEYWORDS = {"good", "👍", "correct", "right", "/good"}
NEGATIVE_KEYWORDS = {"bad",  "👎", "wrong",   "incorrect", "/bad"}


class WhatsAppIntegration(BaseIntegration):
    """
    WhatsApp adapter for Arivu using Twilio's WhatsApp API.

    Runs a lightweight FastAPI webhook server. Every inbound WhatsApp
    message hits POST /webhook and is routed through the pipeline.

    Session identity: "whatsapp:{E164_number}"
    e.g. whatsapp:+919876543210
    """

    def __init__(
        self,
        db: Arivu,
        account_sid: Optional[str] = None,
        auth_token: Optional[str] = None,
        from_number: Optional[str] = None,
        admin_numbers: Optional[list[str]] = None,
    ) -> None:
        super().__init__(db)
        self.account_sid  = account_sid or os.environ["TWILIO_ACCOUNT_SID"]
        self.auth_token   = auth_token  or os.environ["TWILIO_AUTH_TOKEN"]
        self.from_number  = from_number or os.environ.get(
            "TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886"
        )
        self.admin_numbers = set(admin_numbers or [])
        self._fastapi_app  = None

    # ─────────────────────────────────────────
    # Lifecycle
    # ─────────────────────────────────────────

    def start(self, host: str = "0.0.0.0", port: int = 8080, debug: bool = False) -> None:
        """Build FastAPI app and start serving the webhook via uvicorn."""
        try:
            import uvicorn
        except ImportError:
            raise ImportError(
                "uvicorn is required to run the WhatsApp integration. "
                "Install with: pip install uvicorn"
            )

        self._fastapi_app = self._build_fastapi_app()
        logger.info(f"WhatsApp webhook starting on {host}:{port}")
        uvicorn.run(self._fastapi_app, host=host, port=port, log_level="debug" if debug else "info")

    def stop(self) -> None:
        logger.info("WhatsApp integration stopped.")

    def get_fastapi_app(self):
        """
        Return the FastAPI app without starting it.
        Useful for deploying behind gunicorn/uvicorn or integrating with existing apps.

            app = bot.get_fastapi_app()
            # uvicorn arivu_app:app
        """
        if not self._fastapi_app:
            self._fastapi_app = self._build_fastapi_app()
        return self._fastapi_app

    # ─────────────────────────────────────────
    # Send helpers
    # ─────────────────────────────────────────

    def send_message(self, user_id: str, text: str) -> None:
        """Send a WhatsApp message via Twilio. user_id is E164 number."""
        client = self._get_twilio_client()
        to_number = user_id if user_id.startswith("whatsapp:") else f"whatsapp:{user_id}"

        # Twilio WhatsApp has a 1600-char limit — chunk if needed
        for chunk in _chunk_text(text, max_len=1500):
            client.messages.create(
                from_=self.from_number,
                to=to_number,
                body=chunk,
            )

    def send_approval_request(
        self,
        user_id: str,
        sql: str,
        question: str,
        session_id: str,
    ) -> None:
        """Send pending SQL to all admin numbers for approval."""
        text = (
            f"🔐 *Admin approval required*\n\n"
            f"*From:* {user_id}\n"
            f"*Question:* {question}\n\n"
            f"*SQL:*\n{sql}\n\n"
            f"*Session:* {session_id[:8]}\n\n"
            f"Reply APPROVE or REJECT"
        )
        for admin_number in self.admin_numbers:
            self.send_message(admin_number, text)

    # ─────────────────────────────────────────
    # FastAPI webhook
    # ─────────────────────────────────────────

    def _build_fastapi_app(self):
        if FastAPI is None:
            raise ImportError(
                "FastAPI is required for the WhatsApp integration. "
                "Install with: pip install fastapi"
            )

        try:
            from twilio.twiml.messaging_response import MessagingResponse
            from twilio.request_validator import RequestValidator
        except ImportError:
            raise ImportError(
                "twilio is required for the WhatsApp integration. "
                "Install with: pip install twilio"
            )

        app = FastAPI(title="arivu_whatsapp")
        integration = self   # capture self for closure

        @app.post("/webhook")
        async def webhook(request: Request):
            form_data = await request.form()
            form_dict  = dict(form_data)

            # Twilio signature validation.
            # NOTE: when running behind ngrok the forwarded URL often differs
            # from what Twilio signed, causing false 403s.  Set the env var
            # TWILIO_SKIP_VALIDATION=1 during local development to bypass.
            skip_validation = os.environ.get("TWILIO_SKIP_VALIDATION", "0") == "1"
            if not skip_validation:
                validator = RequestValidator(integration.auth_token)
                signature = request.headers.get("X-Twilio-Signature", "")
                # Rebuild the URL using the forwarded host so it matches
                # what Twilio signed (handles ngrok / reverse-proxy setups)
                forwarded_host = request.headers.get("X-Forwarded-Host") or request.headers.get("Host", "")
                forwarded_proto = request.headers.get("X-Forwarded-Proto", "https")
                url_for_validation = (
                    f"{forwarded_proto}://{forwarded_host}{request.url.path}"
                )
                if not validator.validate(url_for_validation, form_dict, signature):
                    logger.warning("Invalid Twilio signature — request rejected")
                    return Response(content="Forbidden", status_code=403)

            from_number = form_dict.get("From", "")
            body        = form_dict.get("Body", "").strip()
            num_media   = int(form_dict.get("NumMedia", 0))
            media_type  = form_dict.get("MediaContentType0", "")
            media_url   = form_dict.get("MediaUrl0", "")

            logger.info(f"[whatsapp] from={from_number}  body='{body[:60]}'")

            user_id    = from_number   # e.g. "whatsapp:+919876543210"
            session_id = integration._session_for(user_id)

            resp = MessagingResponse()

            # ── Approval keywords ────────────────────────────────────────
            if body.lower() in APPROVE_KEYWORDS:
                integration.handle_approve(user_id, session_id)
                return PlainTextResponse(content=str(resp), media_type="application/xml")

            if body.lower() in REJECT_KEYWORDS:
                integration.handle_reject(user_id, session_id)
                return PlainTextResponse(content=str(resp), media_type="application/xml")

            # ── RLHF keywords ────────────────────────────────────────────
            if body.lower() in POSITIVE_KEYWORDS:
                _save_rlhf(session_id, "positive")
                resp.message("👍 Thanks for the feedback!")
                return PlainTextResponse(content=str(resp), media_type="application/xml")

            if body.lower() in NEGATIVE_KEYWORDS:
                _save_rlhf(session_id, "negative")
                resp.message("👎 Thanks — we'll use that to improve.")
                return PlainTextResponse(content=str(resp), media_type="application/xml")

            # ── Voice message ────────────────────────────────────────────
            if num_media > 0 and "audio" in media_type:
                try:
                    body = _transcribe_audio_url(
                        media_url,
                        integration.account_sid,
                        integration.auth_token,
                    )
                    resp.message(f"🎤 Heard: {body}")
                except Exception as exc:
                    logger.error(f"[whatsapp] voice error: {exc}")
                    resp.message("⚠️ Couldn't process voice message. Please send text.")
                    return PlainTextResponse(content=str(resp), media_type="application/xml")

            # ── Image message ────────────────────────────────────────────
            if num_media > 0 and "image" in media_type:
                try:
                    body = _ocr_image_url(
                        media_url,
                        integration.account_sid,
                        integration.auth_token,
                    )
                    if not body.strip():
                        resp.message("⚠️ No text found in image. Please send text.")
                        return PlainTextResponse(content=str(resp), media_type="application/xml")
                    resp.message(f"🖼️ Extracted: {body[:200]}")
                except Exception as exc:
                    logger.error(f"[whatsapp] image error: {exc}")
                    resp.message("⚠️ Couldn't process image. Please send text.")
                    return PlainTextResponse(content=str(resp), media_type="application/xml")

            # ── Text query (main path) ───────────────────────────────────
            if not body:
                resp.message(
                    "👋 Hi! Ask me anything about your database in plain English.\n"
                    "Example: *How many orders were placed this week?*"
                )
                return PlainTextResponse(content=str(resp), media_type="application/xml")

            result = integration.handle_query(user_id, body)

            if result.success and not result.pending_approval:
                resp.message(
                    f"{result.response}\n\n"
                    f"_Reply GOOD or BAD to give feedback_"
                )
            elif result.pending_approval:
                pass   # send_approval_request already called by handle_query
            else:
                resp.message(
                    integration.format_error_message(
                        result.error, result.session_id
                    )
                )

            return PlainTextResponse(content=str(resp), media_type="application/xml")

        @app.get("/health")
        async def health():
            return {"status": "ok", "integration": "whatsapp"}

        return app

    # ─────────────────────────────────────────
    # Twilio client
    # ─────────────────────────────────────────

    def _get_twilio_client(self):
        try:
            from twilio.rest import Client
            return Client(self.account_sid, self.auth_token)
        except ImportError:
            raise ImportError(
                "twilio is required. Install with: pip install twilio"
            )

    def _is_admin(self, user_id: str) -> bool:
        if not self.admin_numbers:
            return True
        clean = user_id.replace("whatsapp:", "")
        return clean in self.admin_numbers or user_id in self.admin_numbers


# ─────────────────────────────────────────────────────────────────────────────
# Media processing helpers
# ─────────────────────────────────────────────────────────────────────────────

def _transcribe_audio_url(url: str, account_sid: str, auth_token: str) -> str:
    """Download audio from Twilio media URL and transcribe."""
    import requests
    import speech_recognition as sr
    import tempfile, os

    r = requests.get(url, auth=(account_sid, auth_token))
    r.raise_for_status()

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.ogg")
        wav_path   = os.path.join(tmpdir, "audio.wav")

        with open(audio_path, "wb") as f:
            f.write(r.content)

        from pydub import AudioSegment
        AudioSegment.from_file(audio_path).export(wav_path, format="wav")

        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio = recognizer.record(source)
        return recognizer.recognize_google(audio)


def _ocr_image_url(url: str, account_sid: str, auth_token: str) -> str:
    """Download image from Twilio media URL and OCR it."""
    import requests
    import tempfile, os
    import pytesseract
    from PIL import Image

    r = requests.get(url, auth=(account_sid, auth_token))
    r.raise_for_status()

    with tempfile.TemporaryDirectory() as tmpdir:
        img_path = os.path.join(tmpdir, "image.jpg")
        with open(img_path, "wb") as f:
            f.write(r.content)
        return pytesseract.image_to_string(Image.open(img_path))


def _chunk_text(text: str, max_len: int = 1500) -> list[str]:
    """Split long text into chunks within Twilio's message size limit."""
    if len(text) <= max_len:
        return [text]
    chunks = []
    while text:
        chunks.append(text[:max_len])
        text = text[max_len:]
    return chunks


def _save_rlhf(session_id: str, signal: str) -> None:
    try:
        from ..memory.store import save_rlhf_signal
        save_rlhf_signal(session_id=session_id, question="", sql="", signal=signal)
    except Exception as exc:
        logger.warning(f"[whatsapp] RLHF save failed: {exc}")