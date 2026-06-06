/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, MessageSquare, RefreshCw, Clock,
  ChevronRight, Trash2, Loader2, Hash, Search, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fetchSessions } from "@services/api";
import type { Session } from "@services/types";
import { useDB } from "../../../db-context";
import { SessionIndicator } from "@/components/SessionIndicator";

const DIALECT_LOGOS: Record<string, string> = {
  postgresql: "/postgresql-logo.svg", mysql: "/mysql-logo.svg",
  sqlite: "/sqlite-logo.svg", snowflake: "/snowflake-ar21.svg",
  databricks: "/azure-databricks.svg",
};

function timeAgo(ts: number) {
  const diff = Date.now() - ts * 1000;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

export default function ChatOverviewPage() {
  const router = useRouter();
  const { alias, dialect } = useDB();
  const [sessions, setSessions]         = useState<Session[]>([]);
  const [loading, setLoading]           = useState(true);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  // Filters
  const [search, setSearch]     = useState("");
  const [sortBy, setSortBy]     = useState<"recent" | "queries" | "errors">("recent");
  const [filterErr, setFilterErr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sessRes = await fetchSessions(200);
      if (sessRes) setSessions(sessRes.sessions || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (sessionId: string) => {
    setDeletingId(sessionId);
    await new Promise(r => setTimeout(r, 400));
    setSessions(prev => prev.filter(s => s.session_id !== sessionId));
    setDeletingId(null);
    toast.success("Session removed from view.");
  };

  const handleNewChat = () => {
    const newId = "web_" + Math.random().toString(36).substring(2, 9);
    router.push(`/db/${encodeURIComponent(alias)}/chat/${newId}`);
  };

  // Derived list
  const filtered = sessions
    .filter(s => {
      if (search && !s.session_id.includes(search) && !s.last_question.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterErr && s.error_count === 0) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "recent") return b.last_ts - a.last_ts;
      if (sortBy === "queries") return b.query_count - a.query_count;
      return b.error_count - a.error_count;
    });

  const logoSrc = DIALECT_LOGOS[dialect] || DIALECT_LOGOS.postgresql;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""} · {alias}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" className="h-8 px-3 text-xs gap-1.5" onClick={handleNewChat}>
            <Plus className="h-3.5 w-3.5" /> New Chat
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative w-full sm:flex-1 sm:min-w-36 sm:max-w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search sessions…" className="h-8 text-xs pl-8" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="h-8 flex-1 sm:w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most recent</SelectItem>
              <SelectItem value="queries">Most queries</SelectItem>
              <SelectItem value="errors">Most errors</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={filterErr ? "default" : "outline"} size="sm"
            className="h-8 text-xs px-3 gap-1.5 flex-1 sm:flex-none"
            onClick={() => setFilterErr(v => !v)}>
            <Filter className="h-3 w-3" />
            {filterErr ? "Errors only" : "All"}
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i} className="bg-card border-border min-h-[140px]">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed rounded-xl p-14 text-center">
          <MessageSquare className="h-7 w-7 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">{search || filterErr ? "No matching sessions" : "No sessions yet"}</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            {search || filterErr ? "Try clearing your filters." : "Start a new chat to query your database."}
          </p>
          {!search && !filterErr && (
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleNewChat}>
              <Plus className="h-3.5 w-3.5" /> New Chat
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <AnimatePresence>
            {filtered.map((s, idx) => (
              <motion.div key={s.session_id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: idx * 0.03 }}>
                <Card
                  className="bg-card border-border hover:shadow-sm hover:border-muted-foreground/30 transition-all cursor-pointer group min-h-[140px] flex flex-col"
                  onClick={() => router.push(`/db/${encodeURIComponent(alias)}/chat/${s.session_id}`)}>
                  <CardContent className="flex flex-col h-full p-4">
                    {/* Top: dialect icon + error indicator */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <img src={logoSrc} className="w-5 h-5 object-contain" alt="" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <SessionIndicator alias={alias} sessionId={s.session_id} />
                        {s.error_count > 0 && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-destructive border-destructive/30">
                            {s.error_count} err
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Session ID short */}
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {s.session_id.slice(0, 12)}…
                    </p>

                    {/* Last question */}
                    <p className="text-xs font-medium text-foreground mt-1 line-clamp-2 flex-1">
                      {s.last_question || "No messages yet"}
                    </p>

                    {/* Bottom meta */}
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/40"
                      onClick={e => e.stopPropagation()}>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Hash className="w-2.5 h-2.5" /> {s.query_count}
                          <Clock className="w-2.5 h-2.5 ml-1" /> {timeAgo(s.last_ts)}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{formatDate(s.last_ts)}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              disabled={deletingId === s.session_id}>
                              {deletingId === s.session_id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Trash2 className="w-3 h-3" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove session?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Removes from this list. Trace data stays in monitoring.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={e => e.stopPropagation()}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={e => { e.stopPropagation(); handleDelete(s.session_id); }}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
