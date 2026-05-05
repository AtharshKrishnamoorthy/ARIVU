"""
arivu.dashboard.backend.routers.settings
─────────────────────────────────────────
Endpoints for saving global dashboard settings.
"""

from fastapi import APIRouter, Body
from ....memory.store import _get_backend

router = APIRouter(prefix="/api/settings")

@router.get("/smtp")
def get_smtp_settings():
    """Retrieve SMTP configuration from SQLite."""
    try:
        data = _get_backend().get_config("smtp_settings")
        return data or {}
    except Exception:
        return {}

@router.post("/smtp")
def save_smtp_settings(payload: dict = Body(...)):
    """Save SMTP configuration to SQLite."""
    _get_backend().save_config("smtp_settings", payload)
    return {"status": "success"}

@router.post("/test-email")
def test_email(payload: dict = Body(...)):
    """Send a test email using saved SMTP settings."""
    import smtplib
    from email.mime.text import MIMEText
    
    to_addr = payload.get("to")
    if not to_addr:
        return {"success": False, "error": "No 'to' address provided"}
        
    config = _get_backend().get_config("smtp_settings")
    if not config:
        return {"success": False, "error": "SMTP not configured"}
        
    msg = MIMEText("This is a test email from Arivu Automations. Your SMTP integration is working successfully.")
    msg["Subject"] = "Arivu: SMTP Test"
    msg["From"] = config.get("from_addr", "arivu@localhost")
    msg["To"] = to_addr
    
    try:
        server = smtplib.SMTP(config.get("host", "localhost"), int(config.get("port", 587)))
        server.starttls()
        if config.get("user") and config.get("password"):
            server.login(config["user"], config["password"])
        server.sendmail(msg["From"], [to_addr], msg.as_string())
        server.quit()
        return {"success": True}
    except Exception as exc:
        return {"success": False, "error": str(exc)}
