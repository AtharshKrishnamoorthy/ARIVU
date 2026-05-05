/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Plug, BarChart3, CheckCircle2, XCircle, Loader2,
  LogIn, Trash2, ExternalLink, RefreshCw, Server
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fetchConnections, setActiveConnection, deleteConnection } from "@services/api";

const DIALECT_LOGOS: Record<string, string> = {
  postgresql: "/postgresql-logo.svg",
  mysql: "/mysql-logo.svg",
  sqlite: "/sqlite-logo.svg",
  snowflake: "/snowflake-ar21.svg",
  databricks: "/azure-databricks.svg",
};
const DIALECT_LABELS: Record<string, string> = {
  postgresql: "PostgreSQL", mysql: "MySQL", sqlite: "SQLite",
  snowflake: "Snowflake", databricks: "Databricks",
};
const DIALECT_COLORS: Record<string, string> = {
  postgresql: "text-blue-500", mysql: "text-orange-500",
  sqlite: "text-sky-400",   snowflake: "text-cyan-400",
  databricks: "text-red-400",
};

function getDisplay(c: any): string {
  if (c.dialect === "snowflake") return `${c.account || ""}/${c.dbname || ""}`;
  if (c.dialect === "databricks") return c.host || "";
  if (c.dialect === "sqlite") return c.dbname || "";
  return `${c.user || ""}@${c.host || ""}:${c.port || ""}/${c.dbname || ""}`;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="py-3 px-4">
        <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function ConnectorPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<any[]>([]);
  const [activeAlias, setActiveAliasState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchConnections();
      if (res) {
        setConnections(res.connections || []);
        setActiveAliasState(res.active_alias ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleActivate = async (alias: string) => {
    setActivating(alias);
    try {
      await setActiveConnection(alias);
      setActiveAliasState(alias);
      toast.success(`Active connection set to "${alias}"`);
    } catch (e: any) {
      toast.error("Failed to activate: " + e.message);
    } finally {
      setActivating(null);
    }
  };

  const handleDeactivate = async () => {
    // Just clear active locally — no backend call needed
    toast.info("Deactivated current connection.");
    setActiveAliasState(null);
  };

  const handleDelete = async (alias: string) => {
    setDeleting(alias);
    try {
      await deleteConnection(alias);
      toast.success(`Deleted "${alias}"`);
      await load();
    } catch (e: any) {
      toast.error("Delete failed: " + e.message);
    } finally {
      setDeleting(null);
    }
  };

  const total = connections.length;
  const active = connections.filter(c => c.alias === activeAlias).length;
  const inactive = total - active;
  const cloudCount = connections.filter(c => c.dialect === "snowflake" || c.dialect === "databricks").length;

  const skeletons = Array(3).fill(0);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header - no status dot here */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Connections</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeAlias ? `Active: ${activeAlias}` : "No active connection"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5"
            onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" className="h-8 px-3 text-xs gap-1.5"
            onClick={() => router.push("/connection/connector/new")}>
            <Plus className="h-3.5 w-3.5" />
            New Connection
          </Button>
        </div>
      </div>

      <Tabs defaultValue="connections">
        <TabsList className="h-8">
          <TabsTrigger value="connections" className="text-xs h-7 px-3 gap-1.5">
            <Plug className="h-3 w-3" /> Connections
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-xs h-7 px-3 gap-1.5">
            <BarChart3 className="h-3 w-3" /> Stats
          </TabsTrigger>
        </TabsList>

        {/* ── Connections tab ── */}
        <TabsContent value="connections" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {skeletons.map((_, i) => (
                <Card key={i} className="bg-card border-border min-h-[140px]">
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : connections.length === 0 ? (
            <div className="border border-dashed rounded-lg p-12 text-center">
              <Server className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No connections yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Add your first database connection to get started.</p>
              <Button size="sm" className="h-8 text-xs gap-1.5"
                onClick={() => router.push("/connection/connector/new")}>
                <Plus className="h-3.5 w-3.5" /> New Connection
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <AnimatePresence>
                {connections.map((c, idx) => {
                  const isActive = c.alias === activeAlias;
                  const logo = DIALECT_LOGOS[c.dialect] || DIALECT_LOGOS.postgresql;
                  const color = DIALECT_COLORS[c.dialect] || "text-muted-foreground";
                  return (
                    <motion.div key={c.alias}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.04 }}>
                      <Card className={`bg-card cursor-pointer transition-all hover:shadow-md group min-h-[140px] flex flex-col
                        ${isActive ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/40"}`}
                        onClick={() => router.push(`/connection/connector/${encodeURIComponent(c.alias)}`)}>
                        <CardContent className="flex flex-col h-full p-4">
                          {/* Top: logo + status dot */}
                          <div className="flex items-start justify-between mb-3">
                            <img src={logo} alt={c.dialect} className="w-10 h-10 object-contain" />
                            <div className="flex flex-col items-end gap-1">
                              <div className={`w-2 h-2 rounded-full ${isActive
                                ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                                : "bg-muted-foreground/30"}`} />
                              {(c.dialect === "snowflake" || c.dialect === "databricks") && (
                                <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-blue-400 border-blue-400/30">Cloud</Badge>
                              )}
                            </div>
                          </div>

                          {/* Alias + dialect */}
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <span className="text-sm font-semibold truncate">{c.alias}</span>
                              {isActive && (
                                <Badge className="h-4 px-1.5 text-[9px] bg-emerald-500/15 text-emerald-500 border-emerald-500/30 border shrink-0">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <p className={`text-[10px] font-medium ${color}`}>
                              {DIALECT_LABELS[c.dialect] || c.dialect}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                              {getDisplay(c)}
                            </p>
                          </div>

                          {/* Actions — bottom of square card */}
                          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/40"
                            onClick={e => e.stopPropagation()}>
                            {isActive ? (
                              <Button variant="outline" size="sm"
                                className="h-7 text-[10px] px-2 text-muted-foreground gap-1"
                                onClick={handleDeactivate}>
                                <XCircle className="w-3 h-3" /> Deactivate
                              </Button>
                            ) : (
                              <Button size="sm" className="h-7 text-[10px] px-2 gap-1"
                                disabled={activating === c.alias}
                                onClick={() => handleActivate(c.alias)}>
                                {activating === c.alias
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <LogIn className="w-3 h-3" />}
                                Activate
                              </Button>
                            )}
                            <Button variant="ghost" size="sm"
                              className="h-7 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground ml-auto"
                              onClick={() => router.push(`/connection/connector/${encodeURIComponent(c.alias)}`)}>
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  disabled={deleting === c.alias}>
                                  {deleting === c.alias
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <Trash2 className="w-3 h-3" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete &quot;{c.alias}&quot;?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove this connection config. You cannot undo this.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
                                    onClick={() => handleDelete(c.alias)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* ── Stats tab ── */}
        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Connections" value={total} />
            <StatCard label="Active" value={active} sub={active ? `"${activeAlias}"` : "None"} />
            <StatCard label="Inactive" value={inactive} />
            <StatCard label="Cloud" value={cloudCount} sub="Snowflake / Databricks" />
          </div>
          {connections.length > 0 && (
            <Card className="mt-4 bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Dialect Breakdown</p>
                <div className="space-y-2">
                  {Object.entries(DIALECT_LABELS).map(([key, label]) => {
                    const count = connections.filter(c => c.dialect === key).length;
                    if (count === 0) return null;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <img src={DIALECT_LOGOS[key]} className="w-4 h-4 object-contain" alt={label} />
                        <span className="text-xs w-28 text-muted-foreground">{label}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden border border-border/50">
                          <div className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${(count / total) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium w-5 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
