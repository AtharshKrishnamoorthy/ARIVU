"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Play, Pause, Edit2, Trash2, Loader2, Clock, CheckCircle2, AlertCircle,
  Zap, Copy, Check, RefreshCw, Mail, Webhook, FileText, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useDB } from "../../../../db-context";
import { API_BASE } from "@services/api";

interface Automation {
  id: string;
  name: string;
  query: string;
  cron_expr: string;
  connection_alias: string;
  action_type: string;
  action_config: Record<string, any>;
  enabled: boolean;
  last_run?: number;
  last_status?: string;
  created_at: number;
}

interface RunRecord {
  id: string;
  automation_id: string;
  start_time: number;
  end_time: number;
  status: "success" | "error" | "running";
  error?: string;
  result_rows?: number;
  duration_ms: number;
}

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

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function CronExprDescription(expr: string): string {
  if (expr === "0 * * * *") return "Every hour";
  if (expr === "0 */6 * * *") return "Every 6 hours";
  if (expr === "0 9 * * *") return "Daily at 9 AM";
  if (expr === "0 0 * * *") return "Daily at midnight";
  if (expr === "0 9 * * 1") return "Every Monday at 9 AM";
  if (expr === "0 9 * * 1-5") return "Weekdays at 9 AM";
  if (expr === "0 9 1 * *") return "First of every month at 9 AM";
  return expr;
}

// ── Run History Row ────────────────────────────────────────────────────────────
function RunRow({ run, index }: { run: RunRecord; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {run.status === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold">{formatDate(run.start_time)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDuration(run.duration_ms)}
              {run.result_rows != null && run.result_rows > 0 && ` · ${run.result_rows} rows`}
            </p>
          </div>
        </div>
        <Badge
          variant={run.status === "success" ? "default" : "destructive"}
          className="shrink-0 text-xs capitalize"
        >
          {run.status}
        </Badge>
      </div>
      {run.error && (
        <p className="text-xs text-red-500/80 ml-6 mt-1 line-clamp-2">{run.error}</p>
      )}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AutomationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const automationId = resolvedParams.id;
  const router = useRouter();
  const { alias } = useDB();

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [runHistory, setRunHistory] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // ── Load automation + persisted run history ──────────────────────────────
  const loadAutomation = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/automations/${automationId}`);
      if (res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        setAutomation(data.automation);
      } else if (res.status === 404) {
        toast.error("Automation not found");
        setTimeout(() => router.push(`/db/${encodeURIComponent(alias)}/automations`), 1000);
      }
    } catch (err) {
      toast.error("Failed to load automation");
    } finally {
      setLoading(false);
    }
  }, [automationId, router, alias]);

  const loadRunHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/automations/${automationId}/runs`);
      if (res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        setRunHistory(data.runs ?? []);
      }
    } catch {
      // non-fatal
    }
  }, [automationId]);

  useEffect(() => {
    loadAutomation();
    loadRunHistory();
  }, [loadAutomation, loadRunHistory]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // ── Run Now ──────────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!automation) return;
    setRunning(true);
    setLogs(["[00:00] Starting automation: " + automation.name, "[00:01] Executing pipeline..."]);

    try {
      const res = await fetch(`${API_BASE}/api/automations/${automation.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const text = await res.text();
        const result = text ? JSON.parse(text) : {};

        setLogs([
          "[00:00] Starting automation: " + automation.name,
          "[00:01] Executing pipeline...",
          result?.result?.success
            ? `[✓] Query executed — ${result?.run?.result_rows ?? 0} rows`
            : `[✗] Query failed`,
          ...(result?.result?.error ? [`[ERROR] ${result.result.error}`] : []),
          `[DONE] Completed in ${((result?.run?.duration_ms ?? 0) / 1000).toFixed(1)}s`,
        ]);

        // Prepend the new run returned by the backend
        if (result?.run) {
          setRunHistory(prev => [result.run, ...prev]);
        }

        // Refresh automation metadata (last_run, last_status)
        loadAutomation();
        toast.success("Automation executed successfully");
      } else {
        let errorDetail = `HTTP ${res.status}`;
        try {
          const t = await res.text();
          const e = JSON.parse(t);
          errorDetail = e.detail || errorDetail;
        } catch {}
        setLogs(prev => [...prev, `[ERROR] ${errorDetail}`]);
        toast.error("Failed to run automation");
      }
    } catch (err) {
      setLogs(prev => [...prev, `[ERROR] ${String(err)}`]);
      toast.error("Error running automation");
    } finally {
      setRunning(false);
    }
  };

  // ── Toggle enable ────────────────────────────────────────────────────────
  const handleToggle = async () => {
    if (!automation) return;
    try {
      const res = await fetch(`${API_BASE}/api/automations/${automation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !automation.enabled }),
      });
      if (res.ok) {
        setAutomation(prev => prev ? { ...prev, enabled: !prev.enabled } : null);
        toast.success(automation.enabled ? "Automation paused" : "Automation enabled");
      }
    } catch {
      toast.error("Failed to update automation");
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/automations/${automation?.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Automation deleted");
        router.push(`/db/${encodeURIComponent(alias)}/automations`);
      } else {
        toast.error("Failed to delete automation");
      }
    } catch {
      toast.error("Failed to delete automation");
    }
  };

  const handleCopyQuery = () => {
    if (automation) {
      navigator.clipboard.writeText(automation.query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Query copied");
    }
  };

  // ── Loading / Not found ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">Automation not found</h3>
          <p className="text-sm text-muted-foreground mt-1">The automation you're looking for doesn't exist.</p>
        </div>
        <Button onClick={() => router.push(`/db/${encodeURIComponent(alias)}/automations`)} variant="outline">
          Back to Automations
        </Button>
      </div>
    );
  }

  const ActionIcon = ACTION_ICONS[automation.action_type] || FileText;

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Button
            variant="ghost" size="icon" className="h-9 w-9 shrink-0"
            onClick={() => router.push(`/db/${encodeURIComponent(alias)}/automations`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3 truncate">
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-primary/70 shrink-0" />
              <span className="truncate">{automation.name}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 truncate">{CronExprDescription(automation.cron_expr)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleToggle} className="gap-2">
            {automation.enabled ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Enable</>}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDeleteDialogOpen(true)} className="text-red-500 hover:text-red-600 gap-2">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Details + Run ─────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary/70" />
                  Schedule Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Database</label>
                  <div className="mt-1.5">
                    <Badge variant="secondary" className="px-2 py-1 bg-primary/10 text-primary border-primary/20 font-mono">
                      {automation.connection_alias || "default"}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cron</label>
                  <p className="text-sm font-mono bg-muted/40 px-2 py-2 rounded-lg border border-border/40 mt-1.5 text-muted-foreground">
                    {automation.cron_expr}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</label>
                  <div className="flex items-center gap-2 mt-1">
                    <ActionIcon className="h-4 w-4 text-primary/70" />
                    <Badge variant="outline" className="capitalize">{automation.action_type}</Badge>
                  </div>
                </div>
                <Separator />
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                  <div className="flex items-center gap-2 mt-2">
                    {automation.enabled ? (
                      <><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-sm text-emerald-600 dark:text-emerald-400">Active</span></>
                    ) : (
                      <><div className="w-2 h-2 rounded-full bg-muted-foreground/50" /><span className="text-sm text-muted-foreground">Paused</span></>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</label>
                  <p className="text-sm text-muted-foreground mt-1">{formatDate(automation.created_at)}</p>
                </div>
                {automation.last_run && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Run</label>
                      <div className="flex items-center gap-2 mt-2">
                        {automation.last_status === "success"
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          : <AlertCircle className="h-4 w-4 text-red-500" />}
                        <span className="text-sm">{formatDate(automation.last_run)}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Button onClick={handleRun} disabled={running} size="lg" className="w-full gap-2 h-12 text-base font-semibold">
              {running
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Running...</>
                : <><Play className="h-4 w-4" /> Run Now</>}
            </Button>
          </motion.div>
        </div>

        {/* ── Right: Query + Live Logs + Persistent History ───────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Query */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Query</CardTitle>
                  <Button size="sm" variant="ghost" onClick={handleCopyQuery} className="gap-1.5 h-7">
                    {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/40 p-3 rounded-lg font-mono text-sm text-muted-foreground max-h-40 overflow-auto">
                  {automation.query}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Live Logs */}
          <AnimatePresence>
            {(running || logs.length > 0) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" style={{ animationPlayState: running ? "running" : "paused" }} />
                      Live Output
                      {running && <span className="text-xs text-primary animate-pulse ml-1">• running</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-44 w-full rounded-lg border border-border/50 bg-background/60 p-3">
                      <div className="space-y-1 font-mono text-xs">
                        {logs.map((log, idx) => (
                          <div key={idx} className={
                            log.includes("ERROR") || log.includes("✗") ? "text-red-500" :
                            log.includes("✓") || log.includes("DONE") ? "text-emerald-500" :
                            "text-muted-foreground"
                          }>
                            {log}
                          </div>
                        ))}
                        {running && <div className="text-primary animate-pulse">▋</div>}
                        <div ref={logsEndRef} />
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Persistent Run History */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4 text-primary/70" />
                    Run History
                    {runHistory.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">{runHistory.length}</Badge>
                    )}
                  </CardTitle>
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={loadRunHistory}>
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80 w-full">
                  <div className="space-y-2 pr-2">
                    {runHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">No runs yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Click "Run Now" or wait for the schedule</p>
                      </div>
                    ) : (
                      runHistory.map((run, idx) => (
                        <RunRow key={run.id} run={run} index={idx} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Automation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{automation?.name}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 pt-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
