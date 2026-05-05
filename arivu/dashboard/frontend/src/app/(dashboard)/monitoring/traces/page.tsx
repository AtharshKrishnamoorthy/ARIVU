/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GitGraph, Search, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboard } from "@/app/(dashboard)/data-context";

type SortOrder = "time_desc" | "time_asc" | "latency_desc" | "latency_asc";

function fmtMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function fmtTs(ts: number | undefined) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-US", { hour12: false }) + " " + d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

const STATUS_CLASS: Record<string, string> = {
  ok:    "text-emerald-500 border-emerald-500/20 bg-emerald-500/5",
  fail:  "text-red-500 border-red-500/20 bg-red-500/5",
  retry: "text-amber-400 border-amber-400/20 bg-amber-400/5",
  skip:  "text-muted-foreground border-border",
};

const DIALECT_LOGOS: Record<string, string> = {
  postgresql: "/postgresql-logo.svg",
  mysql:      "/mysql-logo.svg",
  sqlite:     "/sqlite-logo.svg",
  snowflake:  "/snowflake-ar21.svg",
  databricks: "/azure-databricks.svg",
};

export default function TracesPage() {
  const { traces, loading } = useDashboard();
  const [filter, setFilter]     = useState("");
  const [sort, setSort]         = useState<SortOrder>("time_desc");

  const q = filter.toLowerCase();
  const filtered = traces
    .filter((t) => {
      if (!q) return true;
      return (
        (t.question || "").toLowerCase().includes(q) ||
        (t.session_id || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sort === "time_desc") return b.ts - a.ts;
      if (sort === "time_asc")  return a.ts - b.ts;
      const la = (a.events || []).reduce((s, e) => s + (e.latency_ms || 0), 0);
      const lb = (b.events || []).reduce((s, e) => s + (e.latency_ms || 0), 0);
      return sort === "latency_desc" ? lb - la : la - lb;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Pipeline Traces</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} trace{filtered.length !== 1 ? "s" : ""} recorded</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Filter by question or session…" value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-8 h-8 text-xs bg-card border-border" />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOrder)}>
            <SelectTrigger className="h-8 min-w-[140px] text-xs font-semibold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="time_desc">Newest First</SelectItem>
              <SelectItem value="time_asc">Oldest First</SelectItem>
              <SelectItem value="latency_desc">Highest Latency</SelectItem>
              <SelectItem value="latency_asc">Lowest Latency</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitGraph className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-xs text-muted-foreground">No traces found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((t, i) => (
            <motion.div key={`${t.session_id}-${t.ts}-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <Card className="bg-card border-border hover:border-primary/20 transition-colors">
                <CardContent className="p-4">
                  {/* Header row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 mb-3">
                    <p className="text-xs text-foreground font-medium leading-relaxed">{t.question || "—"}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.dialect && (
                        <div className="flex items-center gap-1">
                          <img src={DIALECT_LOGOS[t.dialect] || DIALECT_LOGOS.postgresql} alt={t.dialect} className="w-3.5 h-3.5 object-contain" />
                        </div>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono">{fmtTs(t.ts)}</span>
                    </div>
                  </div>

                  {/* Node pipeline */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {(t.events || []).map((ev, j) => (
                      <div key={j} className="flex items-center">
                        <div className="border border-border rounded-md px-2 py-1 min-w-[72px] text-center bg-card">
                          <div className="text-[8px] text-muted-foreground tracking-wide uppercase leading-none mb-0.5">
                            {ev.node.replace(/_node$/, "").replace(/_/g, " ")}
                          </div>
                          <div className="text-[10px] font-semibold text-foreground">{fmtMs(ev.latency_ms)}</div>
                          <Badge variant="outline" className={`text-[8px] px-1 py-0 mt-0.5 ${STATUS_CLASS[ev.status] || ""}`}>{ev.status}</Badge>
                        </div>
                        {j < (t.events || []).length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 mx-0.5 shrink-0" />}
                      </div>
                    ))}
                  </div>

                  {t.sql && (
                    <div className="mt-2 bg-muted border border-border rounded px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground truncate">
                      {t.sql}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
