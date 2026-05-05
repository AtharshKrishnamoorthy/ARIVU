"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Play, Pause, Edit2, Trash2, Loader2, Clock, CheckCircle2, AlertCircle,
  Zap, Copy, Check, RefreshCw, Download, Mail, Webhook, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Automation {
  id: string;
  name: string;
  query: string;
  cron_expr: string;
  action_type: string;
  action_config: Record<string, any>;
  enabled: boolean;
  last_run?: number;
  last_status?: string;
  created_at: number;
}

interface RunHistory {
  id: string;
  automation_id: string;
  start_time: number;
  end_time: number;
  status: "success" | "error" | "running";
  error?: string;
  result_rows?: number;
  duration_ms: number;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  log: FileText,
  email: Mail,
  webhook: Webhook,
};

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function CronExprDescription(expr: string): string {
  const parts = expr.split(" ");
  if (parts.length !== 5) return expr;
  
  const [minute, hour, day, month, dow] = parts;
  
  if (expr === "0 * * * *") return "Every hour";
  if (expr === "0 */6 * * *") return "Every 6 hours";
  if (expr === "0 9 * * *") return "Daily at 9 AM";
  if (expr === "0 0 * * *") return "Daily at midnight";
  if (expr === "0 9 * * 1") return "Every Monday at 9 AM";
  if (expr === "0 9 * * 1-5") return "Weekdays at 9 AM";
  if (expr === "0 9 1 * *") return "First of every month at 9 AM";
  
  return expr;
}

export default function AutomationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const automationId = resolvedParams.id;
  const router = useRouter();
  
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [runHistory, setRunHistory] = useState<RunHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const loadAutomation = useCallback(async () => {
    try {
      const res = await fetch(`/api/automations/${automationId}`);
      if (res.ok) {
        const data = await res.json();
        console.log("Loaded automation:", data);
        setAutomation(data.automation);
      } else if (res.status === 404) {
        console.error("Automation not found:", automationId);
        toast.error("Automation not found");
        setTimeout(() => router.push("/automations"), 1000);
      } else {
        throw new Error(`Failed to load automation: ${res.status}`);
      }
    } catch (err) {
      console.error("Error loading automation:", err);
      toast.error("Failed to load automation");
    } finally {
      setLoading(false);
    }
  }, [automationId, router]);

  useEffect(() => {
    loadAutomation();
    // Mock run history for demo (in production, fetch from backend)
    setRunHistory([
      {
        id: "run-1",
        automation_id: automationId,
        start_time: Date.now() / 1000 - 3600,
        end_time: Date.now() / 1000 - 3540,
        status: "success",
        result_rows: 1250,
        duration_ms: 3600,
      },
      {
        id: "run-2",
        automation_id: automationId,
        start_time: Date.now() / 1000 - 7200,
        end_time: Date.now() / 1000 - 7140,
        status: "success",
        result_rows: 1189,
        duration_ms: 3200,
      },
      {
        id: "run-3",
        automation_id: automationId,
        start_time: Date.now() / 1000 - 10800,
        end_time: Date.now() / 1000 - 10750,
        status: "error",
        error: "Connection timeout",
        duration_ms: 5000,
      },
    ]);
  }, [automationId, loadAutomation]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleRun = async () => {
    if (!automation) return;
    
    setRunning(true);
    setLogs([]);
    
    try {
      // Call the backend to actually trigger the automation
      const res = await fetch(`/api/automations/${automation.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const result = await res.json();
        console.log("Automation run result:", result);

        // Show execution logs
        setLogs([
          "[00:00] Starting automation: " + automation.name,
          "[00:01] Executing query...",
          "[00:02] " + (result.result?.success ? "✓ Query executed successfully" : "❌ Query failed"),
          ...(result.result?.rows ? [`[00:03] Processed ${result.result.rows} rows`] : []),
          ...(result.result?.error ? [`[ERROR] ${result.result.error}`] : []),
          "[00:04] Automation completed",
        ]);

        // Add to history
        const newRun: RunHistory = {
          id: `run-${Date.now()}`,
          automation_id: automation.id,
          start_time: Date.now() / 1000 - 5,
          end_time: Date.now() / 1000,
          status: result.result?.success ? "success" : "error",
          error: result.result?.error,
          result_rows: result.result?.rows,
          duration_ms: 5000,
        };

        setRunHistory((prev) => [newRun, ...prev]);
        toast.success("Automation executed successfully");
      } else {
        const error = await res.json();
        setLogs([`[ERROR] Failed to run automation: ${error.detail}`]);
        toast.error("Failed to run automation");
      }
    } catch (err) {
      setLogs([`[ERROR] ${String(err)}`]);
      console.error("Error running automation:", err);
      toast.error("Error running automation");
    } finally {
      setRunning(false);
    }
  };

  const handleToggle = async () => {
    if (!automation) return;
    try {
      const res = await fetch(`/api/automations/${automation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !automation.enabled }),
      });
      if (res.ok) {
        setAutomation((prev) => prev ? { ...prev, enabled: !prev.enabled } : null);
        toast.success(automation.enabled ? "Automation paused" : "Automation enabled");
      }
    } catch (err) {
      toast.error("Failed to update automation");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this automation?")) return;
    try {
      const res = await fetch(`/api/automations/${automation?.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Automation deleted");
        router.push("/automations");
      }
    } catch (err) {
      toast.error("Failed to delete automation");
    }
  };

  const handleCopyQuery = () => {
    if (automation) {
      navigator.clipboard.writeText(automation.query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Query copied to clipboard");
    }
  };

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
        <Button onClick={() => router.push("/automations")} variant="outline" className="mt-4">
          Back to Automations
        </Button>
      </div>
    );
  }

  const ActionIcon = ACTION_ICONS[automation.action_type] || FileText;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.push("/automations")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Zap className="h-6 w-6 text-primary/70" />
              {automation.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{CronExprDescription(automation.cron_expr)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggle}
            className="gap-2"
          >
            {automation.enabled ? (
              <>
                <Pause className="h-4 w-4" /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Enable
              </>
            )}
          </Button>
          <Button size="sm" variant="outline" className="gap-2">
            <Edit2 className="h-4 w-4" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            className="text-red-500 hover:text-red-600 gap-2"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Run */}
        <div className="lg:col-span-1 space-y-6">
          {/* Automation Details */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary/70" />
                  Schedule Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">CRON EXPRESSION</label>
                  <p className="text-sm font-mono bg-muted/40 px-2 py-1.5 rounded mt-1">{automation.cron_expr}</p>
                </div>

                <Separator className="my-2" />

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">ACTION TYPE</label>
                  <div className="flex items-center gap-2 mt-1">
                    <ActionIcon className="h-4 w-4 text-primary/70" />
                    <Badge variant="outline" className="capitalize">{automation.action_type}</Badge>
                  </div>
                </div>

                <Separator className="my-2" />

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">STATUS</label>
                  <div className="flex items-center gap-2 mt-2">
                    {automation.enabled ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm text-emerald-600 dark:text-emerald-400">Active</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                        <span className="text-sm text-muted-foreground">Paused</span>
                      </>
                    )}
                  </div>
                </div>

                <Separator className="my-2" />

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">CREATED</label>
                  <p className="text-sm text-muted-foreground mt-1">{formatDate(automation.created_at)}</p>
                </div>

                {automation.last_run && (
                  <>
                    <Separator className="my-2" />
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">LAST RUN</label>
                      <div className="flex items-center gap-2 mt-2">
                        {automation.last_status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">{formatDate(automation.last_run)}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Run Button */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Button
              onClick={handleRun}
              disabled={running}
              size="lg"
              className="w-full gap-2 h-12 text-base font-semibold"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Now
                </>
              )}
            </Button>
          </motion.div>
        </div>

        {/* Right Column: Query, History & Logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Query Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Query</CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyQuery}
                    className="gap-1.5 h-7"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary/70 animate-spin" style={{ animationPlayState: running ? "running" : "paused" }} />
                  Live Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 w-full rounded-lg border border-border/50 bg-background/50 p-3">
                  <div className="space-y-1 font-mono text-xs">
                    {logs.length === 0 ? (
                      <p className="text-muted-foreground">Click "Run Now" to see live logs...</p>
                    ) : (
                      logs.map((log, idx) => (
                        <div
                          key={idx}
                          className={`${
                            log.includes("ERROR") ? "text-red-500" : log.includes("✓") ? "text-emerald-500" : "text-muted-foreground"
                          }`}
                        >
                          {log}
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          {/* Run History */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary/70" />
                  Run History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96 w-full">
                  <div className="space-y-3 pr-4">
                    {runHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No runs yet</p>
                    ) : (
                      runHistory.map((run, idx) => (
                        <div
                          key={run.id}
                          className="p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-1">
                              {run.status === "success" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold">
                                  {formatDate(run.start_time)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {formatDuration(run.duration_ms)} {run.result_rows && `• ${run.result_rows} rows`}
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
                            <p className="text-xs text-red-500/80 ml-6">{run.error}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
