"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Timer, Plus, Play, Trash2, Power, PowerOff,
  Clock, Mail, Webhook, FileText, Loader2, Check, X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  fetchAutomations, createAutomation, updateAutomation,
  deleteAutomation, triggerAutomation,
  fetchIntegrationPlatforms,
  type Automation,
  type IntegrationStatus,
} from "@services/api";
import { useDB } from "../../../db-context";
import { toast } from "sonner";

// ── Cron presets for the friendly picker ─────────────────────────────────────
const CRON_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily at 9 AM", value: "0 9 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Every Monday 9 AM", value: "0 9 * * 1" },
  { label: "Every weekday 9 AM", value: "0 9 * * 1-5" },
  { label: "First of month", value: "0 9 1 * *" },
  { label: "Custom", value: "custom" },
] as const;

const SlackIcon = ({ className }: { className?: string }) => <img src="/slack-svgrepo-com.svg" className={className} alt="Slack" />;
const DiscordIcon = ({ className }: { className?: string }) => <img src="/discord-svgrepo-com.svg" className={className} alt="Discord" />;
const TelegramIcon = ({ className }: { className?: string }) => <img src="/telegram-svgrepo-com.svg" className={className} alt="Telegram" />;
const WhatsAppIcon = ({ className }: { className?: string }) => <img src="/whatsapp-svgrepo-com.svg" className={className} alt="WhatsApp" />;

const ACTION_ICONS: Record<string, React.ElementType> = {
  log: FileText,
  email: Mail,
  webhook: Webhook,
  slack: SlackIcon,
  discord: DiscordIcon,
  telegram: TelegramIcon,
  whatsapp: WhatsAppIcon,
};

function relativeTime(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function cronToHuman(expr: string): string {
  const preset = CRON_PRESETS.find((p) => p.value === expr);
  if (preset) return preset.label;
  return expr;
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AutomationsPage() {
  const router = useRouter();
  const { alias } = useDB();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const autoData = await fetchAutomations();
      setAutomations(autoData?.automations ?? []);
    } catch (err) {
      console.error("Failed to load automations:", err);
      setAutomations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (payload: any) => {
    await createAutomation(payload);
    setDialogOpen(false);
    load();
  };

  const handleToggle = async (auto: Automation) => {
    try {
      await updateAutomation(auto.id, { enabled: !auto.enabled });
      toast.success(auto.enabled ? "Automation paused" : "Automation enabled");
      load();
    } catch (err: any) {
      toast.error(`Failed to update: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteAutomation(id);
    load();
  };

  const handleRun = async (id: string) => {
    setRunningId(id);
    await triggerAutomation(id);
    setRunningId(null);
    load();
  };

  const filteredAutomations = automations.filter(a => (a as any).connection_alias === alias);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scheduled Automations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run queries on a recurring schedule. Results are logged, emailed, or sent to a webhook.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Create
              </Button>
            </DialogTrigger>
            <CreateDialog onSubmit={handleCreate} alias={alias} />
          </Dialog>
        </div>
      </div>

      {/* Empty state */}
      {!loading && filteredAutomations.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="rounded-full bg-muted p-4 mb-4">
            <Timer className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No automations found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {`No automations found for database '${alias}'.`}
          </p>
        </motion.div>
      )}

      {/* Automations grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filteredAutomations.map((auto, i) => {
            const ActionIcon = ACTION_ICONS[auto.action_type] ?? FileText;
            const isRunning = runningId === auto.id;

            return (
              <motion.div
                key={auto.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card
                  className={`relative transition-all cursor-pointer hover:shadow-lg hover:border-primary/50 ${!auto.enabled ? "opacity-50" : ""}`}
                  onClick={() => router.push(`/db/${encodeURIComponent(alias)}/automations/${auto.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{auto.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <CardDescription className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {cronToHuman(auto.cron_expr)}
                          </CardDescription>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {(auto as any).connection_alias || "default"}
                          </Badge>
                        </div>
                      </div>
                      <Badge variant={auto.enabled ? "default" : "secondary"} className="text-[10px] shrink-0">
                        {auto.enabled ? "Active" : "Paused"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Query preview */}
                    <div className="rounded-md bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground line-clamp-2">
                      {auto.query}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <ActionIcon className="h-3 w-3" />
                        <span className="capitalize">{auto.action_type}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {auto.last_status === "success" && <Check className="h-3 w-3 text-emerald-500" />}
                        {auto.last_status === "error" && <X className="h-3 w-3 text-red-500" />}
                        <span>{relativeTime(auto.last_run)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-border">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRun(auto.id);
                              }}
                              disabled={isRunning}
                            >
                              {isRunning
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Play className="h-3.5 w-3.5" />
                              }
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Run now</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggle(auto);
                              }}
                            >
                              {auto.enabled
                                ? <PowerOff className="h-3.5 w-3.5" />
                                : <Power className="h-3.5 w-3.5" />
                              }
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{auto.enabled ? "Pause" : "Enable"}</TooltipContent>
                        </Tooltip>

                        <div className="flex-1" />

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(auto.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}


// ── Create Dialog ────────────────────────────────────────────────────────────
function CreateDialog({ onSubmit, alias }: {
  onSubmit: (payload: any) => void;
  alias: string;
}) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const connectionAlias = alias;
  const [cronPreset, setCronPreset] = useState("0 9 * * 1");
  const [customCron, setCustomCron] = useState("");
  const [actionType, setActionType] = useState("log");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [socialTarget, setSocialTarget] = useState("");
  const [botToken, setBotToken] = useState("");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioFrom, setTwilioFrom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [integrationStatuses, setIntegrationStatuses] = useState<IntegrationStatus[]>([]);

  // Load integration statuses once when dialog mounts
  useEffect(() => {
    fetchIntegrationPlatforms()
      .then(data => setIntegrationStatuses(data?.platforms ?? []))
      .catch(() => setIntegrationStatuses([]));
  }, []);

  const isPlatformConnected = (platform: string) =>
    integrationStatuses.find(s => s.platform === platform)?.configured ?? false;


  const cronExpr = cronPreset === "custom" ? customCron : cronPreset;
  const nameValid = name.trim().length > 0;
  const queryValid = query.trim().length > 0;
  const cronValid = cronExpr.trim().length > 0;
  const isValid = nameValid && queryValid && cronValid && connectionAlias;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    const actionConfig: Record<string, unknown> = {};
    if (actionType === "webhook") actionConfig.url = webhookUrl;
    if (actionType === "email") actionConfig.to = emailTo;
    if (["slack", "discord", "telegram"].includes(actionType)) {
      actionConfig.target_id = socialTarget;
      if (botToken) actionConfig.bot_token = botToken.trim();
    }
    if (actionType === "whatsapp") {
      actionConfig.target_id = socialTarget;
      if (twilioSid) actionConfig.twilio_sid = twilioSid.trim();
      if (twilioToken) actionConfig.twilio_auth_token = twilioToken.trim();
      if (twilioFrom) actionConfig.twilio_from = twilioFrom.trim();
    }

    await onSubmit({
      name: name.trim(),
      query: query.trim(),
      connection_alias: connectionAlias,
      cron_expr: cronExpr.trim(),
      action_type: actionType,
      action_config: actionConfig,
    });
    setSubmitting(false);
  };

  return (
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>New Automation</DialogTitle>
        <DialogDescription>
          Schedule a recurring query against a specific database connection.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="auto-name">Name <span className="text-destructive">*</span></Label>
          <Input
            id="auto-name"
            placeholder="e.g. Weekly Sales Summary"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={name.length > 0 && !nameValid ? "border-destructive" : ""}
          />
        </div>

        {/* Query */}
        <div className="space-y-1.5">
          <Label htmlFor="auto-query">Query <span className="text-destructive">*</span></Label>
          <Textarea
            id="auto-query"
            placeholder="e.g. Show me total revenue by region for the last 7 days"
            rows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={query.length > 0 && !queryValid ? "border-destructive" : ""}
          />
        </div>

        {/* Schedule */}
        <div className="space-y-1.5">
          <Label>Schedule</Label>
          <Select value={cronPreset} onValueChange={setCronPreset}>
            <SelectTrigger>
              <SelectValue placeholder="Choose schedule" />
            </SelectTrigger>
            <SelectContent>
              {CRON_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cronPreset === "custom" && (
            <Input
              placeholder="e.g. 30 8 * * 1-5  (min hour day month weekday)"
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              className="mt-2 font-mono text-sm"
            />
          )}
        </div>

        {/* Action */}
        <div className="space-y-1.5">
          <Label>Action</Label>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Always available */}
              <SelectItem value="log">
                <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Log only</span>
              </SelectItem>
              <SelectItem value="email">
                <span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Send email</span>
              </SelectItem>
              <SelectItem value="webhook">
                <span className="flex items-center gap-2"><Webhook className="h-3.5 w-3.5" /> Webhook</span>
              </SelectItem>

              {/* Social platforms — gated by integration config */}
              {(["slack", "discord", "telegram", "whatsapp"] as const).map((platform) => {
                const connected = isPlatformConnected(platform);
                const icons: Record<string, React.ReactNode> = {
                  slack:    <SlackIcon className="h-4 w-4" />,
                  discord:  <DiscordIcon className="h-4 w-4" />,
                  telegram: <TelegramIcon className="h-4 w-4" />,
                  whatsapp: <WhatsAppIcon className="h-4 w-4" />,
                };
                const labels: Record<string, string> = {
                  slack: "Slack", discord: "Discord",
                  telegram: "Telegram", whatsapp: "WhatsApp",
                };
                return (
                  <SelectItem
                    key={platform}
                    value={platform}
                    disabled={!connected}
                    className={!connected ? "opacity-40 cursor-not-allowed" : ""}
                  >
                    <span className="flex items-center gap-2">
                      <span className={!connected ? "grayscale opacity-60" : ""}>
                        {icons[platform]}
                      </span>
                      {labels[platform]}
                      {!connected && (
                        <span className="ml-auto text-[10px] text-muted-foreground italic">Not connected</span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {actionType === "webhook" && (
            <Input
              placeholder="https://hooks.slack.com/services/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="mt-2"
            />
          )}
          {actionType === "email" && (
            <Input
              placeholder="team@company.com"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="mt-2"
            />
          )}
          {["slack", "discord", "telegram", "whatsapp"].includes(actionType) && (
            <div className="mt-2 space-y-1">
              <Input
                placeholder={
                  actionType === "slack" ? "Channel or User ID (e.g., C12345)" :
                  actionType === "discord" ? "User ID or Channel ID" :
                  actionType === "telegram" ? "Chat ID (e.g., -100123456789)" :
                  actionType === "whatsapp" ? "Phone Number (e.g., +919876543210)" : "Target ID"
                }
                value={socialTarget}
                onChange={(e) => setSocialTarget(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Leave empty to use the default from{" "}
                <span className="text-primary font-medium">Integrations settings</span>.
              </p>
            </div>
          )}

          {["slack", "discord", "telegram"].includes(actionType) && (
            <div className="space-y-2 mt-4 p-3 border rounded-md bg-muted/10">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Override Credentials (optional)</Label>
              <p className="text-[10px] text-muted-foreground">Leave blank to use credentials from Integrations page.</p>
              <Input
                placeholder="Bot Token"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                type="password"
                className="text-sm"
              />
            </div>
          )}

          {actionType === "whatsapp" && (
            <div className="space-y-2 mt-4 p-3 border rounded-md bg-muted/10">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Override Credentials (optional)</Label>
              <p className="text-[10px] text-muted-foreground">Leave blank to use credentials from Integrations page.</p>
              <Input
                placeholder="Account SID"
                value={twilioSid}
                onChange={(e) => setTwilioSid(e.target.value)}
                className="text-sm"
              />
              <Input
                placeholder="Auth Token"
                value={twilioToken}
                onChange={(e) => setTwilioToken(e.target.value)}
                type="password"
                className="text-sm"
              />
              <Input
                placeholder="From Number (e.g., whatsapp:+1...)"
                value={twilioFrom}
                onChange={(e) => setTwilioFrom(e.target.value)}
                className="text-sm"
              />
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button onClick={handleSubmit} disabled={!isValid || submitting} className="gap-1.5">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create Automation
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
