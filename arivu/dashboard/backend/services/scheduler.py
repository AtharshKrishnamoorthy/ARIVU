"""
arivu.dashboard.backend.services.scheduler
───────────────────────────────────────────
APScheduler-based cron job runner.

On dashboard startup, all enabled automations are loaded from SQLite
and registered with APScheduler's AsyncIOScheduler.

When a job fires, it:
    1. Loads the active DB connection
    2. Runs the Arivu pipeline with the stored query
    3. Executes the configured action (log / email / webhook)
    4. Updates last_run metadata in SQLite
"""

from __future__ import annotations

import logging
import time
from typing import Optional

logger = logging.getLogger("arivu.dashboard.scheduler")

# ── Module-level scheduler singleton ─────────────────────────────────────────
_scheduler = None


def _get_scheduler():
    """Lazy-init the APScheduler instance."""
    global _scheduler
    if _scheduler is None:
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from apscheduler.triggers.cron import CronTrigger

            _scheduler = BackgroundScheduler(
                job_defaults={"coalesce": True, "max_instances": 1}
            )
            _scheduler.start()
            logger.info("[scheduler] APScheduler started")
        except ImportError:
            logger.warning(
                "[scheduler] apscheduler not installed. "
                "Install with: pip install apscheduler"
            )
    return _scheduler


# ─────────────────────────────────────────────────────────────────────────────
# Job execution — this is what fires on every cron tick
# ─────────────────────────────────────────────────────────────────────────────

def execute_automation_job(automation: dict) -> dict:
    """
    Execute a single automation: run the pipeline + perform the action.
    Returns a result summary dict.
    """
    query = automation.get("query", "")
    action_type = automation.get("action_type", "log")
    action_config = automation.get("action_config", {})

    logger.info(f"[scheduler] executing automation '{automation.get('name')}': {query}")

    try:
        # 1. Get the target DB connection for this specific automation
        from ....memory.store import get_active_connection, get_connections
        from ....connection.core import Arivu
        
        # Use the stored alias, fallback to global active connection if not set (legacy)
        target_alias = automation.get("connection_alias") or get_active_connection()
        connections = get_connections()
        conn_config = next(
            (c for c in connections if c.get("alias") == target_alias), None
        )

        if not conn_config:
            # Fallback to 'default' if the target alias is not found
            conn_config = next((c for c in connections if c.get("alias") == "default"), None)
            
        if not conn_config:
            return {"success": False, "error": f"Database connection '{target_alias}' not found."}

        logger.info(f"[scheduler] using connection alias: {conn_config.get('alias')}")
        connect_args = {k: v for k, v in conn_config.items() if k != "alias"}
        db = Arivu.connect(**connect_args)

        # 2. Run the pipeline
        from ....pipeline.runner import run_pipeline

        pipeline_input = db.query(query)
        pipeline_input["session_id"] = f"automation-{automation['id']}"
        pipeline_input["interface"] = "automation"
        result = run_pipeline(pipeline_input)

        summary = {
            "success": result.success,
            "response": result.response,
            "sql": result.sql,
            "error": result.error,
            "row_count": len(result.raw_result) if result.raw_result else 0,
        }

        # 3. Perform the action
        _run_action(action_type, action_config, automation, summary)

        return summary

    except Exception as exc:
        logger.error(f"[scheduler] automation failed: {exc}")
        return {"success": False, "error": str(exc)}


def _run_action(action_type: str, action_config: dict, automation: dict, result: dict):
    """Dispatch the post-execution action."""
    if action_type == "log":
        logger.info(
            f"[scheduler] automation '{automation['name']}' completed — "
            f"success={result['success']}, rows={result.get('row_count', 0)}"
        )

    elif action_type == "webhook":
        url = action_config.get("url", "")
        if url:
            try:
                import httpx
                httpx.post(url, json={
                    "automation": automation["name"],
                    "query": automation["query"],
                    "result": result,
                    "timestamp": time.time(),
                }, timeout=10)
                logger.info(f"[scheduler] webhook sent to {url}")
            except Exception as exc:
                logger.error(f"[scheduler] webhook failed: {exc}")

    elif action_type == "email":
        _send_email(action_config, automation, result)

    elif action_type in ("slack", "discord", "telegram", "whatsapp"):
        _send_social_integration(action_type, action_config, automation, result)

def _send_social_integration(action_type: str, config: dict, automation: dict, result: dict):
    """Dispatch the post-execution action via social platforms using existing adapters.

    Credential resolution order (highest priority first):
      1. Per-automation action_config  (user overrode for this specific automation)
      2. Integrations store            (configured globally in Integrations page)
      3. Environment variables         (adapter-level last resort)
    """
    import re
    target_id = config.get("target_id", "")

    # ── Load the stored integration config as fallback ────────────────────────
    try:
        from ....memory.store import get_integration
        stored = get_integration(action_type) or {}
    except Exception:
        stored = {}

    def _cred(key: str) -> str | None:
        """Return per-automation override first, then stored integration value."""
        return config.get(key) or stored.get(key) or None

    # Also fall back target_id to the stored default chat/channel ID
    if not target_id:
        target_id = (
            stored.get("chat_id") or      # Telegram default
            stored.get("channel_id") or   # Slack / Discord default
            stored.get("to_number") or    # WhatsApp default recipient
            ""
        )

    if not target_id:
        logger.error(f"[scheduler] {action_type} failed: missing target_id in config and no default in integration store")
        return

    # Build the message text
    status_emoji = "✅" if result.get("success") else "❌"
    text = f"{status_emoji} *Automation: {automation.get('name', 'Unknown')}*\n\n"
    text += f"*Query:*\n```sql\n{automation.get('query', '')}\n```\n"
    
    if result.get("success") and result.get("response"):
        resp = result["response"]
        think_match = re.search(r"<think>([\s\S]*?)</think>", resp)
        actual_content = re.sub(r"<think>[\s\S]*?</think>", "", resp).strip()
        
        if think_match:
            think_content = think_match.group(1).strip()
            # Prefix each line of reasoning with the markdown blockquote character '>'
            reasoning_formatted = "\n".join(f"> {line}" for line in think_content.splitlines())
            text += f"*Reasoning Process:*\n{reasoning_formatted}\n\n"
        
        text += f"*Response:*\n{actual_content}"
    elif not result.get("success") and result.get("error"):
        text += f"*Error:*\n{result['error']}"

    try:
        # We pass None for the db argument since we only need the send_message functionality
        adapter = None
        if action_type == "slack":
            from ....integrations.slack_adapter import SlackIntegration
            adapter = SlackIntegration(db=None, bot_token=_cred("bot_token"))
        elif action_type == "discord":
            from ....integrations.discord_adapter import DiscordIntegration
            adapter = DiscordIntegration(db=None, token=_cred("bot_token"))
        elif action_type == "telegram":
            from ....integrations.telegram_adapter import TelegramIntegration
            adapter = TelegramIntegration(db=None, token=_cred("bot_token"))
        elif action_type == "whatsapp":
            from ....integrations.whatsapp_adapter import WhatsAppIntegration
            adapter = WhatsAppIntegration(
                db=None,
                account_sid=_cred("twilio_sid"),
                auth_token=_cred("twilio_auth_token"),
                from_number=_cred("twilio_from"),
            )

        if adapter:
            adapter.send_message(target_id, text)
            logger.info(f"[scheduler] {action_type} message dispatched to {target_id}")

    except KeyError as exc:
        logger.error(f"[scheduler] {action_type} failed: Missing environment variable {exc}. Please set the required bot tokens.")
    except Exception as exc:
        logger.error(f"[scheduler] {action_type} failed: {exc}")



def _send_email(config: dict, automation: dict, result: dict):
    """Send an email notification using SMTP (stdlib)."""
    import smtplib
    import re
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    # Load SMTP settings from the memory config store
    from ....memory.store import _get_backend
    smtp_config = _get_backend().get_config("smtp_settings")

    if not smtp_config:
        logger.warning("[scheduler] email action skipped — no SMTP settings configured.")
        return

    to_addr = config.get("to", "")
    if not to_addr:
        logger.warning("[scheduler] email action skipped — no 'to' address.")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Arivu Automation: {automation['name']}"
    msg["From"] = smtp_config.get("from_addr", "arivu@localhost")
    msg["To"] = to_addr

    status = "✅ Success" if result["success"] else "❌ Failed"
    
    # Extract reasoning and response blocks
    resp = result.get('response', 'No response generated.')
    think_match = re.search(r"<think>([\s\S]*?)</think>", resp)
    actual_content = re.sub(r"<think>[\s\S]*?</think>", "", resp).strip()
    
    details_html = ""
    if think_match:
        think_content = think_match.group(1).strip()
        details_html = f"""
        <details style="border: 1px solid #ddd; background-color: #f9f9f9; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
            <summary style="font-weight: bold; cursor: pointer; color: #555; outline: none; user-select: none;">Reasoning Process (Click to Expand)</summary>
            <div style="margin-top: 10px; font-family: monospace; white-space: pre-wrap; font-size: 12px; color: #666; line-height: 1.5; max-height: 300px; overflow-y: auto;">
{think_content}
            </div>
        </details>
        """

    html = f"""
    <html>
    <body style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #333;">
        <h2>Arivu Scheduled Report</h2>
        <p><strong>Automation:</strong> {automation['name']}</p>
        <p><strong>Query:</strong> {automation['query']}</p>
        <p><strong>Status:</strong> {status}</p>
        <p><strong>SQL:</strong> <code>{result.get('sql', 'N/A')}</code></p>
        <p><strong>Rows Returned:</strong> {result.get('row_count', 0)}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>
        {details_html}
        <div style="font-size: 14px; white-space: pre-wrap;">{actual_content}</div>
    </body>
    </html>
    """
    msg.attach(MIMEText(html, "html"))

    try:
        server = smtplib.SMTP(smtp_config.get("host", "localhost"), smtp_config.get("port", 587))
        server.starttls()
        if smtp_config.get("user") and smtp_config.get("password"):
            server.login(smtp_config["user"], smtp_config["password"])
        server.sendmail(msg["From"], [to_addr], msg.as_string())
        server.quit()
        logger.info(f"[scheduler] email sent to {to_addr}")
    except Exception as exc:
        logger.error(f"[scheduler] email failed: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# Job registration helpers — called by the router and on startup
# ─────────────────────────────────────────────────────────────────────────────

def _parse_cron(expr: str) -> dict:
    """Parse a standard 5-field cron expression into APScheduler kwargs."""
    parts = expr.strip().split()
    if len(parts) != 5:
        raise ValueError(f"Invalid cron expression: '{expr}'. Expected 5 fields.")
    return {
        "minute": parts[0],
        "hour": parts[1],
        "day": parts[2],
        "month": parts[3],
        "day_of_week": parts[4],
    }


def register_job(automation: dict) -> None:
    """Register a single automation with APScheduler."""
    scheduler = _get_scheduler()
    if not scheduler:
        return

    try:
        from apscheduler.triggers.cron import CronTrigger
        cron_kwargs = _parse_cron(automation["cron_expr"])
        trigger = CronTrigger(**cron_kwargs)

        def _job_wrapper():
            import uuid as _uuid
            start_ts = time.time()
            result = execute_automation_job(automation)
            end_ts = time.time()

            # Update metadata + run history in SQLite
            from ..routers.automations import _load_automations, _save_automations
            automations = _load_automations()
            for a in automations:
                if a["id"] == automation["id"]:
                    a["last_run"] = end_ts
                    a["last_status"] = "success" if result.get("success") else "error"
                    run_record = {
                        "id": f"run-{str(_uuid.uuid4())[:8]}",
                        "automation_id": automation["id"],
                        "start_time": start_ts,
                        "end_time": end_ts,
                        "status": a["last_status"],
                        "error": result.get("error"),
                        "result_rows": result.get("row_count", 0),
                        "duration_ms": int((end_ts - start_ts) * 1000),
                    }
                    history = a.get("run_history", [])
                    history.insert(0, run_record)
                    a["run_history"] = history[:50]
                    break
            _save_automations(automations)

        scheduler.add_job(
            _job_wrapper,
            trigger=trigger,
            id=automation["id"],
            name=automation["name"],
            replace_existing=True,
        )
        logger.info(f"[scheduler] registered job: {automation['name']} ({automation['cron_expr']})")
    except Exception as exc:
        logger.error(f"[scheduler] failed to register job: {exc}")


def remove_job(automation_id: str) -> None:
    """Remove a job from APScheduler."""
    scheduler = _get_scheduler()
    if not scheduler:
        return
    try:
        scheduler.remove_job(automation_id)
    except Exception:
        pass  # job may not exist


def load_all_jobs() -> None:
    """
    Called once on app startup.
    Loads all enabled automations from SQLite and registers them.
    """
    from ..routers.automations import _load_automations

    automations = _load_automations()
    enabled = [a for a in automations if a.get("enabled", False)]
    logger.info(f"[scheduler] loading {len(enabled)} enabled automations")

    for automation in enabled:
        register_job(automation)
