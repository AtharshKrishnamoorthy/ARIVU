"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Trace } from "../../../services/types";
import { Zap } from "lucide-react";

interface RecentQueriesProps {
  traces: Trace[];
  loading: boolean;
}

function fmtMs(ms: number | null | undefined): string {
  if (ms === undefined || ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(ts: number | undefined): string {
  if (!ts) return "—";
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function RecentQueries({ traces, loading }: RecentQueriesProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    );
  }

  const recent = traces.slice(0, 7);

  if (recent.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Zap className="h-6 w-6 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No queries yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recent.map((t, i) => {
        const totalMs = (t.events || []).reduce((sum, e) => sum + (e.latency_ms || 0), 0);
        const hasFail = (t.events || []).some((e) => e.status === "fail");

        return (
          <div key={`${t.session_id}-${t.ts}-${i}`} className="flex items-center gap-3">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                hasFail
                  ? "bg-red-500/10 text-red-500"
                  : "bg-emerald-500/10 text-emerald-500"
              }`}
            >
              {hasFail ? "✗" : "✓"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate leading-none mb-0.5">
                {t.question || "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {(t.events || []).length} nodes · {timeAgo(t.ts)}
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono px-1.5 py-0 text-muted-foreground border-border shrink-0"
            >
              {fmtMs(totalMs)}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
