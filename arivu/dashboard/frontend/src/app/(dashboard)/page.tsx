"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Database, RefreshCw, Server, Loader2, LogIn, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fetchConnections, deleteConnection } from "@services/api";

const DIALECT_LOGOS: Record<string, string> = {
  postgresql: "/postgresql-logo.svg", mysql: "/mysql-logo.svg",
  sqlite: "/sqlite-logo.svg", snowflake: "/snowflake-ar21.svg",
  databricks: "/azure-databricks.svg",
};
const DIALECT_LABELS: Record<string, string> = {
  postgresql: "PostgreSQL", mysql: "MySQL", sqlite: "SQLite",
  snowflake: "Snowflake", databricks: "Databricks",
};
const DIALECT_COLORS: Record<string, string> = {
  postgresql: "text-blue-500", mysql: "text-orange-500",
  sqlite: "text-sky-400", snowflake: "text-cyan-400",
  databricks: "text-red-400",
};

function getDisplay(c: any): string {
  if (c.dialect === "snowflake") return `${c.account || ""}/${c.dbname || ""}`;
  if (c.dialect === "databricks") return c.host || "";
  if (c.dialect === "sqlite") return c.dbname || "";
  return `${c.user || ""}@${c.host || ""}:${c.port || ""}/${c.dbname || ""}`;
}

export default function LandingPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchConnections();
      if (res) setConnections(res.connections || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (alias: string) => {
    setDeleting(alias);
    try {
      await deleteConnection(alias);
      toast.success(`Deleted "${alias}"`);
      await load();
    } catch (e: any) {
      toast.error("Delete failed: " + e.message);
    } finally { setDeleting(null); }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Databases</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a database to open its workspace, or add a new connection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5"
            onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" className="h-8 px-3 text-xs gap-1.5"
            onClick={() => router.push("/connection/connector/new")}>
            <Plus className="h-3.5 w-3.5" /> Add Connection
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i} className="bg-card border-border min-h-[160px]">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : connections.length === 0 ? (
        /* Empty state */
        <div className="border border-dashed rounded-xl p-16 text-center">
          <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
            <Server className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No databases connected</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm mx-auto">
            Add your first database connection to start querying with natural language.
          </p>
          <Button onClick={() => router.push("/connection/connector/new")} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Connection
          </Button>
        </div>
      ) : (
        /* DB Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {connections.map((c, idx) => {
              const logo = DIALECT_LOGOS[c.dialect] || DIALECT_LOGOS.postgresql;
              const color = DIALECT_COLORS[c.dialect] || "text-muted-foreground";
              return (
                <motion.div key={c.alias}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: idx * 0.04 }}>
                  <Card
                    className="bg-card cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 hover:scale-[1.02] group min-h-[160px] flex flex-col border-border"
                    onClick={() => router.push(`/db/${encodeURIComponent(c.alias)}`)}>
                    <CardContent className="flex flex-col h-full p-5">
                      {/* Top: logo */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center">
                          <img src={logo} alt={c.dialect} className="w-7 h-7 object-contain" />
                        </div>
                        {(c.dialect === "snowflake" || c.dialect === "databricks") && (
                          <Badge variant="outline" className="h-5 px-2 text-[10px] text-blue-400 border-blue-400/30">Cloud</Badge>
                        )}
                      </div>

                      {/* Alias + dialect */}
                      <div className="flex-1">
                        <span className="text-base font-semibold">{c.alias}</span>
                        <p className={`text-xs font-medium mt-0.5 ${color}`}>
                          {DIALECT_LABELS[c.dialect] || c.dialect}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate mt-1">
                          {getDisplay(c)}
                        </p>
                      </div>

                      {/* Bottom actions */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40"
                        onClick={e => e.stopPropagation()}>
                        <Button size="sm" className="h-7 text-[10px] px-3 gap-1" 
                          onClick={() => router.push(`/db/${encodeURIComponent(c.alias)}`)}>
                          <LogIn className="w-3 h-3" /> Open
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
                                This will permanently remove this connection config.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
                                onClick={() => handleDelete(c.alias)}>Delete</AlertDialogAction>
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
    </div>
  );
}
