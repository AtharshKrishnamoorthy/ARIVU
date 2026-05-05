"""
arivu.integrations
─────────────────────────
All Arivu integration adapters.
"""

from .base              import BaseIntegration
from .telegram_adapter  import TelegramIntegration
from .whatsapp_adapter  import WhatsAppIntegration
from .rest_adapter      import RESTIntegration
from .slack_adapter     import SlackIntegration
from .discord_adapter   import DiscordIntegration



__all__ = [
    "BaseIntegration",
    "TelegramIntegration",
    "WhatsAppIntegration",
    "RESTIntegration",
    "SlackIntegration",
    "DiscordIntegration",
]