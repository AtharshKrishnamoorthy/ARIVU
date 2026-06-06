"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug, Trash2, Check, Loader2, Shield, Eye, EyeOff, AlertCircle, Plus,
  BookOpen, Settings2, ExternalLink, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  fetchIntegrationPlatforms,
  saveIntegration,
  deleteIntegration,
  type IntegrationPlatform,
  type IntegrationStatus,
} from "@services/api";

// ── Platform metadata ─────────────────────────────────────────────────────────
interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  hint?: string;
}

interface GuideStep {
  title: string;
  description: string;
  link?: { label: string; url: string };
}

interface PlatformMeta {
  id: IntegrationPlatform;
  label: string;
  description: string;
  iconSrc: string;
  color: string;
  accentClass: string;
  fields: FieldDef[];
  guide: GuideStep[];
}

const PLATFORMS: PlatformMeta[] = [
  {
    id: "telegram",
    label: "Telegram",
    description: "Send automated reports to any Telegram chat via a bot.",
    iconSrc: "/telegram-svgrepo-com.svg",
    color: "from-sky-500/20 to-sky-600/10 border-sky-500/30",
    accentClass: "text-sky-500",
    fields: [
      { key: "bot_token", label: "Bot Token", placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11", type: "password", hint: "From @BotFather → /newbot" },
      { key: "chat_id", label: "Default Chat ID", placeholder: "-100123456789 or @channelname", hint: "Group / channel / user chat ID for automation reports" },
    ],
    guide: [
      { title: "Open Telegram and search @BotFather", description: "In Telegram, search for @BotFather and start a chat. This is the official bot to create and manage bots." },
      { title: "Create a new bot", description: "Send the command /newbot to BotFather. It will ask you for a name and a username. The username must end in 'bot' (e.g. ArivuReportBot).", link: { label: "Open Telegram", url: "https://t.me/BotFather" } },
      { title: "Copy the Bot Token", description: "BotFather will reply with your bot token in the format 123456:ABC-DEF1234... Copy it and paste it in the Bot Token field on the left." },
      { title: "Get your Chat ID", description: "For a personal chat: send any message to your bot, then visit https://api.telegram.org/bot<TOKEN>/getUpdates. Find the 'chat.id' in the JSON response. For groups/channels: add the bot to the group, then run the same URL." },
      { title: "Paste and save", description: "Fill in the Bot Token and Default Chat ID fields, then click Save & Connect. Your Telegram integration is ready." },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Send reports via WhatsApp using the Twilio API.",
    iconSrc: "/whatsapp-svgrepo-com.svg",
    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    accentClass: "text-emerald-500",
    fields: [
      { key: "twilio_sid", label: "Twilio Account SID", placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password", hint: "From Twilio Console → Account Info" },
      { key: "twilio_auth_token", label: "Twilio Auth Token", placeholder: "your_auth_token", type: "password", hint: "From Twilio Console → Account Info" },
      { key: "twilio_from", label: "From Number (Sender)", placeholder: "whatsapp:+14155238886", hint: "Your Twilio WhatsApp sandbox or approved number, e.g. whatsapp:+14155238886" },
      { key: "to_number", label: "Default To Number (Recipient)", placeholder: "+919876543210", hint: "Phone number to receive automation reports" },
    ],
    guide: [
      { title: "Create a Twilio account", description: "Go to twilio.com and sign up for a free account. Your trial account comes with sandbox access for WhatsApp.", link: { label: "Open Twilio", url: "https://www.twilio.com/try-twilio" } },
      { title: "Enable WhatsApp Sandbox", description: "In the Twilio Console, go to Messaging → Try it out → Send a WhatsApp message. Follow the instructions to activate the sandbox — you'll need to send a keyword (e.g. 'join <word>') to the sandbox number from your WhatsApp.", link: { label: "WhatsApp Sandbox", url: "https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn" } },
      { title: "Get Account SID & Auth Token", description: "Go to the Twilio Console home page. Your Account SID and Auth Token are shown in the 'Account Info' section. Copy both." },
      { title: "Note your From number", description: "The sandbox 'From' number is whatsapp:+14155238886. Enter it exactly like that — including the 'whatsapp:' prefix. For production senders, use whatsapp:+your_approved_number." },
      { title: "Enter recipient number", description: "In the 'Default To Number' field, enter the phone number that should receive reports in E.164 format, e.g. +919876543210. This can be overridden per-automation." },
      { title: "Save & test", description: "Click Save & Connect. Then go to any Automation, choose WhatsApp as the action, and click Run Now to send a test message." },
    ],
  },
  {
    id: "slack",
    label: "Slack",
    description: "Post query results directly to Slack channels.",
    iconSrc: "/slack-svgrepo-com.svg",
    color: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    accentClass: "text-purple-500",
    fields: [
      { key: "bot_token", label: "Bot Token", placeholder: "xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx", type: "password", hint: "OAuth Bot Token from your Slack App (starts with xoxb-)" },
      { key: "channel_id", label: "Default Channel", placeholder: "C012AB3CD", hint: "Channel ID (right-click channel → View details → copy ID at bottom)" },
    ],
    guide: [
      { title: "Create a Slack App", description: "Go to api.slack.com/apps and click 'Create New App' → 'From scratch'. Give it a name (e.g. Arivu) and select your workspace.", link: { label: "Slack API Dashboard", url: "https://api.slack.com/apps" } },
      { title: "Add Bot Token Scopes", description: "In your app settings, go to OAuth & Permissions → Bot Token Scopes. Add these scopes: chat:write, channels:read, groups:read, im:write. These allow the bot to post messages." },
      { title: "Install to workspace", description: "Scroll up on the OAuth & Permissions page and click 'Install to Workspace'. Click Allow. You'll see the Bot User OAuth Token (starts with xoxb-). Copy it." },
      { title: "Get your Channel ID", description: "In Slack, right-click the channel you want reports sent to → 'View channel details'. Scroll to the bottom — the Channel ID starts with 'C' (e.g. C012AB3CD). Copy it." },
      { title: "Invite the bot to the channel", description: "In the Slack channel, type and send: /invite @YourBotName — the bot must be a member of the channel to post messages." },
      { title: "Save and test", description: "Enter the Bot Token and Channel ID, then click Save & Connect. Run any automation with Slack action to test." },
    ],
  },
  {
    id: "discord",
    label: "Discord",
    description: "Deliver reports to Discord via a bot.",
    iconSrc: "/discord-svgrepo-com.svg",
    color: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/30",
    accentClass: "text-indigo-500",
    fields: [
      { key: "bot_token", label: "Bot Token", placeholder: "MTxxxxxxxx.xxxxxx.xxx...", type: "password", hint: "Bot token from Discord Developer Portal → Your App → Bot" },
      { key: "channel_id", label: "Default Channel ID", placeholder: "1234567890123456789", hint: "Right-click channel in Discord (enable Developer Mode first)" },
    ],
    guide: [
      { title: "Create a Discord Application", description: "Go to discord.com/developers/applications and click 'New Application'. Give it a name.", link: { label: "Discord Developer Portal", url: "https://discord.com/developers/applications" } },
      { title: "Create a Bot", description: "In your application settings, go to the 'Bot' tab. Click 'Add Bot'. Under the bot section, enable 'Message Content Intent' under Privileged Gateway Intents." },
      { title: "Copy the Bot Token", description: "On the Bot tab, click 'Reset Token' to reveal your bot token. Copy it — this is your Bot Token credential." },
      { title: "Invite the bot to your server", description: "Go to OAuth2 → URL Generator. Under Scopes select 'bot'. Under Bot Permissions select 'Send Messages' and 'Read Message History'. Copy the generated URL, open it in a browser, and invite the bot to your server." },
      { title: "Enable Developer Mode & get Channel ID", description: "In Discord, go to User Settings → Advanced → enable Developer Mode. Then right-click any channel and click 'Copy Channel ID'." },
      { title: "Save and test", description: "Enter the Bot Token and Channel ID, then click Save & Connect. The bot will use Discord's REST API to post messages — no polling required." },
    ],
  },
  {
    id: "webhook",
    label: "Webhook",
    description: "POST query results as JSON to any HTTP endpoint.",
    iconSrc: "",
    color: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
    accentClass: "text-amber-500",
    fields: [
      { key: "webhook_url", label: "Endpoint URL", placeholder: "https://hooks.example.com/receive", hint: "Arivu will POST JSON to this URL after each automation run" },
      { key: "api_key", label: "API Key / Bearer Token (optional)", placeholder: "sk-...", type: "password", hint: "Sent as Authorization: Bearer <key> header if provided" },
    ],
    guide: [
      { title: "Choose your webhook receiver", description: "Any HTTP endpoint that accepts POST requests works. Common choices: your own API, Zapier, Make.com, n8n, or a custom server." },
      { title: "Get your endpoint URL", description: "Copy the POST endpoint URL from your service. For Zapier, create a 'Catch Hook' trigger and copy the webhook URL. For n8n, use the Webhook node URL.", link: { label: "Test with webhook.site", url: "https://webhook.site" } },
      { title: "Optional: API key / auth", description: "If your endpoint requires authentication, enter the key in the 'API Key / Bearer Token' field. Arivu will include it as: Authorization: Bearer <your-key>" },
      { title: "Payload format", description: "Arivu sends a JSON POST body with: automation name, query, result (success/error), SQL executed, rows returned, and a timestamp." },
      { title: "Save and test", description: "Enter the endpoint URL and optional key, then Save & Connect. Run any automation with Webhook action to see the payload arrive at your endpoint." },
    ],
  },
  {
    id: "email",
    label: "Email (SMTP)",
    description: "Send HTML email reports using your SMTP settings.",
    iconSrc: "",
    color: "from-rose-500/20 to-rose-600/10 border-rose-500/30",
    accentClass: "text-rose-500",
    fields: [
      { key: "from_number", label: "Override From Address (optional)", placeholder: "reports@yourcompany.com", hint: "Overrides the default SMTP 'From' address. Leave blank to use SMTP settings." },
    ],
    guide: [
      { title: "Configure SMTP first", description: "Email delivery uses the SMTP credentials configured in Settings. Go to Settings → Email (SMTP) and enter your server details before using this integration." },
      { title: "Using Gmail", description: "Host: smtp.gmail.com, Port: 587, TLS: yes. Use your Gmail address as User and an App Password as the password. Go to Google Account → Security → 2-Step Verification → App passwords to generate one.", link: { label: "Google App Passwords", url: "https://myaccount.google.com/apppasswords" } },
      { title: "Using Outlook / Microsoft 365", description: "Host: smtp.office365.com, Port: 587, TLS: yes. Use your Microsoft email and account password." },
      { title: "Using SendGrid / Mailgun", description: "For SendGrid: Host: smtp.sendgrid.net, Port: 587, User: apikey, Password: your SendGrid API key. For Mailgun, see their SMTP settings under Domains.", link: { label: "SendGrid SMTP", url: "https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api" } },
      { title: "Override From address (optional)", description: "If you want automation emails to come from a specific address (e.g. reports@yourco.com) instead of the SMTP default, enter it above." },
      { title: "Set recipient in automations", description: "The 'To' email address is configured per-automation in the Action settings, not here. This page just sets the integration credentials." },
    ],
  },
];

// ── Icons ─────────────────────────────────────────────────────────────────────
const WebhookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const MailIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

function PlatformIcon({ platform, className }: { platform: PlatformMeta; className?: string }) {
  if (platform.iconSrc) return <img src={platform.iconSrc} className={className} alt={platform.label} />;
  if (platform.id === "webhook") return <WebhookIcon className={`${className} text-amber-400`} />;
  if (platform.id === "email") return <MailIcon className={`${className} text-rose-400`} />;
  return <Plug className={className} />;
}

// ── Secret Input ──────────────────────────────────────────────────────────────
function SecretInput({ value, onChange, placeholder, id }: {
  value: string; onChange: (v: string) => void; placeholder?: string; id: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id} type={show ? "text" : "password"} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="pr-9 text-sm h-9"
      />
      <button type="button" onClick={() => setShow(v => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ── Config Dialog with Tabs ───────────────────────────────────────────────────
function ConfigDialog({
  platform, open, onClose, onSaved,
}: {
  platform: PlatformMeta; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setValues({}); }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveIntegration(platform.id, values);
      toast.success(`${platform.label} connected successfully`);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const primaryField = platform.fields[0];
  const isValid = primaryField ? (values[primaryField.key] || "").trim().length > 0 : true;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <PlatformIcon platform={platform} className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Connect {platform.label}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">{platform.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="configure" className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0 grid grid-cols-2 w-full">
            <TabsTrigger value="configure" className="gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" /> Configure
            </TabsTrigger>
            <TabsTrigger value="guide" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" /> Setup Guide
            </TabsTrigger>
          </TabsList>

          {/* ── Configure Tab ────────────────────────────────────── */}
          <TabsContent value="configure" className="flex-1 overflow-y-auto mt-3 space-y-4 pr-1">
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
              Credentials are stored locally in your Arivu database and never sent to external servers.
            </div>
            {platform.fields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`field-${field.key}`} className="text-xs">{field.label}</Label>
                {field.type === "password" ? (
                  <SecretInput
                    id={`field-${field.key}`}
                    value={values[field.key] || ""}
                    onChange={v => setValues(prev => ({ ...prev, [field.key]: v }))}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <Input
                    id={`field-${field.key}`}
                    value={values[field.key] || ""}
                    onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="text-sm h-9"
                  />
                )}
                {field.hint && <p className="text-[10px] text-muted-foreground">{field.hint}</p>}
              </div>
            ))}
          </TabsContent>

          {/* ── Setup Guide Tab ──────────────────────────────────── */}
          <TabsContent value="guide" className="flex-1 overflow-y-auto mt-3 pr-1">
            <div className="space-y-3">
              {platform.guide.map((step, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white mt-0.5 ${
                    platform.id === "telegram" ? "bg-sky-500" :
                    platform.id === "whatsapp" ? "bg-emerald-500" :
                    platform.id === "slack" ? "bg-purple-500" :
                    platform.id === "discord" ? "bg-indigo-500" :
                    platform.id === "webhook" ? "bg-amber-500" : "bg-rose-500"
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0 pb-3 border-b border-border/40 last:border-0 last:pb-0">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
                    {step.link && (
                      <a
                        href={step.link.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-xs text-primary hover:underline"
                      >
                        {step.link.label} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="shrink-0 pt-3 border-t border-border/50">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!isValid || saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save & Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [configTarget, setConfigTarget] = useState<PlatformMeta | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchIntegrationPlatforms();
      setStatuses(data?.platforms ?? []);
    } catch {
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDisconnect = async (platform: IntegrationPlatform) => {
    setDeletingId(platform);
    try {
      await deleteIntegration(platform);
      toast.success("Integration disconnected");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect");
    } finally {
      setDeletingId(null);
    }
  };

  const configuredPlatforms = statuses.filter(s => s.configured);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect messaging platforms to enable automation notifications. Only connected platforms can be selected in automation actions.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Connected */}
          {configuredPlatforms.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Connected</h2>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{configuredPlatforms.length}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <AnimatePresence mode="popLayout">
                  {configuredPlatforms.map((s, i) => {
                    const meta = PLATFORMS.find(p => p.id === s.platform)!;
                    if (!meta) return null;
                    return (
                      <motion.div key={s.platform} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.03 }}>
                        <Card className={`relative bg-gradient-to-br ${meta.color} border transition-shadow hover:shadow-md`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-background/60 backdrop-blur flex items-center justify-center shrink-0 shadow-sm">
                                  <PlatformIcon platform={meta} className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold">{meta.label}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Connected</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfigTarget(meta)} title="Reconfigure">
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                  disabled={deletingId === s.platform}
                                  onClick={() => handleDisconnect(s.platform)} title="Disconnect"
                                >
                                  {deletingId === s.platform ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Available Platforms */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Available Platforms</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {PLATFORMS.map((meta, i) => {
                  const status = statuses.find(s => s.platform === meta.id);
                  if (status?.configured) return null;
                  return (
                    <motion.div key={meta.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.03 }}>
                      <Card className="relative border border-border/60 hover:border-border hover:shadow-sm transition-all h-full">
                        <CardContent className="p-4 flex flex-col h-full">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <PlatformIcon platform={meta} className="h-5 w-5 opacity-70" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{meta.label}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{meta.description}</p>
                            </div>
                          </div>
                          <Button
                            size="sm" variant="outline"
                            className="w-full mt-3 h-8 text-xs gap-1.5"
                            onClick={() => setConfigTarget(meta)}
                          >
                            <Plug className="h-3.5 w-3.5" /> Connect
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </section>

          {/* Info callout */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">How it works</p>
              <p>
                Connected platforms appear as selectable actions when creating automations.
                Platforms that are <strong>not connected</strong> will appear grayed-out and cannot be selected.
              </p>
            </div>
          </div>
        </div>
      )}

      {configTarget && (
        <ConfigDialog
          platform={configTarget}
          open={!!configTarget}
          onClose={() => setConfigTarget(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
