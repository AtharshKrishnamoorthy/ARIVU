"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchSessionDetail } from "../../../services/api";
import type { SessionDetail } from "../../../services/types";

function fmtTs(ts: number | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return (
    d.toLocaleTimeString("en-US", { hour12: false }) +
    " " +
    d.toLocaleDateString("en-US", { month: "short", day: "2-digit" })
  );
}

function parseQuestion(q: string): string {
  if (q.includes("Current question:")) {
    return q.split("Current question:")[1].trim();
  }
  return q;
}

interface SessionDrawerProps {
  sessionId: string | null;
  open: boolean;
  onClose: () => void;
}

export function SessionDrawer({
  sessionId,
  open,
  onClose,
}: SessionDrawerProps) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    fetchSessionDetail(sessionId).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  }, [sessionId]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[85vw] sm:max-w-[800px] xl:max-w-[1000px] bg-background border-border overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            Session
          </div>
          <SheetTitle className="font-mono text-xs text-primary/70 mt-1">
            {sessionId || "—"}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4 pt-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 bg-muted" />
            ))}
          </div>
        ) : !detail ? (
          <p className="text-xs text-muted-foreground pt-4">No data.</p>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* ── Conversation History ── */}
              <Separator className="bg-border my-4" />
              <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                Conversation History
              </h3>

              {(detail.history || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No history.</p>
              ) : (
                <div className="space-y-2">
                  {detail.history.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="border border-border rounded-lg p-3 bg-card"
                    >
                      <p className="text-xs font-medium text-foreground mb-2">
                        {parseQuestion(h.question)}
                      </p>
                      {h.sql && (
                        <div className="bg-muted border border-border rounded px-2.5 py-2 font-mono text-[11px] text-teal-600 dark:text-teal-400 whitespace-pre-wrap break-all mb-2">
                          {h.sql}
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground/80">{h.response}</p>
                      <span className="text-[10px] text-muted-foreground/50 font-mono mt-1 block">
                        {fmtTs(h.ts)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* ── Errors ── */}
              {(detail.errors || []).length > 0 && (
                <>
                  <Separator className="bg-border my-4" />
                  <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                    Errors ({detail.errors.length})
                  </h3>
                  <div className="space-y-2">
                    {detail.errors.map((e, i) => (
                      <div
                        key={i}
                        className="border border-destructive/20 bg-destructive/5 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className="text-destructive border-destructive/30 text-[10px] px-1.5 py-0"
                          >
                            {e.error_node}
                          </Badge>
                          <span className="text-[10px] text-amber-500 font-mono">
                            {e.error_type}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{e.error}</p>
                        <span className="text-[10px] text-muted-foreground/50 font-mono mt-1 block">
                          {fmtTs(e.ts)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── RLHF ── */}
              {(detail.rlhf || []).length > 0 && (
                <>
                  <Separator className="bg-border my-4" />
                  <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                    Feedback ({detail.rlhf.length})
                  </h3>
                  <div className="space-y-1">
                    {detail.rlhf.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs py-1"
                      >
                        <Badge
                          variant="outline"
                          className={
                            r.signal === "positive"
                              ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5 text-[10px] px-1.5 py-0"
                              : "text-destructive border-destructive/30 bg-destructive/5 text-[10px] px-1.5 py-0"
                          }
                        >
                          {r.signal === "positive" ? "👍" : "👎"} {r.signal}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/50 font-mono">
                          {fmtTs(r.ts)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </SheetContent>
    </Sheet>
  );
}
