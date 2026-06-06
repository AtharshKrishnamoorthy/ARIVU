"""
arivu.dashboard.backend.routers.integrations
─────────────────────────────────────────────
CRUD endpoints for messaging/media platform integrations.

Platforms: slack, discord, telegram, whatsapp, webhook, email
Each platform config is persisted in the KV store under `integration:{platform}`.
"""

from __future__ import annotations

import logging
from fastapi import APIRouter, Body, HTTPException

from ....memory.store import (
    save_integration,
    get_integration,
    list_integrations,
    delete_integration,
    INTEGRATION_PLATFORMS,
)

logger = logging.getLogger("arivu.dashboard.integrations")
router = APIRouter(prefix="/api/integrations")


# ── List all configured integrations ────────────────────────────────────────
@router.get("")
def get_integrations():
    """Return all configured integrations (platform + masked creds + enabled)."""
    integrations = list_integrations()
    # Mask sensitive fields before returning
    masked = []
    for entry in integrations:
        safe = {"platform": entry["platform"], "enabled": entry.get("enabled", True), "configured": True}
        # Include non-sensitive metadata fields
        for k in ("name", "label", "chat_id", "channel_id", "from_number"):
            if k in entry:
                safe[k] = entry[k]
        masked.append(safe)
    return {"integrations": masked}


# ── List all platform names (connected or not) ────────────────────────────────
@router.get("/platforms")
def get_platforms():
    """Return all supported platforms with their connection status."""
    configured = {e["platform"] for e in list_integrations()}
    return {
        "platforms": [
            {"platform": p, "configured": p in configured}
            for p in INTEGRATION_PLATFORMS
        ]
    }


# ── Get a single integration ─────────────────────────────────────────────────
@router.get("/{platform}")
def get_one_integration(platform: str):
    if platform not in INTEGRATION_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")
    data = get_integration(platform)
    if not data:
        return {"configured": False, "platform": platform}
    # Return config but mask tokens/passwords
    safe = {"platform": platform, "configured": True, "enabled": data.get("enabled", True)}
    for k in ("name", "label", "chat_id", "channel_id", "from_number"):
        if k in data:
            safe[k] = data[k]
    # Indicate whether a token is saved without revealing it
    for secret_field in ("bot_token", "twilio_sid", "twilio_auth_token", "twilio_from",
                         "webhook_url", "api_key"):
        if secret_field in data and data[secret_field]:
            safe[f"{secret_field}_saved"] = True
    return safe


# ── Save / update an integration ─────────────────────────────────────────────
@router.post("/{platform}")
def save_one_integration(platform: str, payload: dict = Body(...)):
    if platform not in INTEGRATION_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")

    # If secrets are sent as empty string, keep the old value
    existing = get_integration(platform) or {}
    secret_fields = ("bot_token", "twilio_sid", "twilio_auth_token", "twilio_from",
                     "webhook_url", "api_key")
    merged = {**existing, **payload}
    for field in secret_fields:
        if field in payload and payload[field] == "":
            # Don't overwrite with empty — keep existing
            if field in existing:
                merged[field] = existing[field]
            else:
                merged.pop(field, None)

    save_integration(platform, merged)
    logger.info(f"[integrations] saved config for platform={platform}")
    return {"status": "success", "platform": platform}


# ── Toggle enabled/disabled ──────────────────────────────────────────────────
@router.post("/{platform}/toggle")
def toggle_integration(platform: str, payload: dict = Body(...)):
    if platform not in INTEGRATION_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")
    existing = get_integration(platform) or {}
    existing["enabled"] = payload.get("enabled", not existing.get("enabled", True))
    save_integration(platform, existing)
    return {"status": "success", "platform": platform, "enabled": existing["enabled"]}


# ── Delete / disconnect an integration ───────────────────────────────────────
@router.delete("/{platform}")
def remove_integration(platform: str):
    if platform not in INTEGRATION_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")
    delete_integration(platform)
    logger.info(f"[integrations] deleted config for platform={platform}")
    return {"status": "success", "platform": platform}
