"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useMediaQuery } from "@/hooks/use-media-query";
import { fetchSessionDetail } from "../../../services/api";
import type { SessionDetail } from "../../../services/types";
import { Database, MessageSquare, AlertTriangle, ThumbsUp, ThumbsDown, Clock, Hash } from "lucide-react";

/* ── Helpers ── */
function fmtTs(ts: number | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return (
    d.toLocaleTimeString("en-US", { hour12: false }) +
    "  " +
    d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
  );
}

function parseQuestion(q: string): string {
  if (q.includes("Current question:")) {
    return q.split("Current question:")[1].trim();
  }
  return q;
}

function SectionLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      {icon && <span className="text-muted-foreground/50">{icon}</span>}
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
        {children}
      </p>
    </div>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  return (
    <pre className="bg-[#0d1117] border border-border rounded-lg px-4 py-3 font-mono text-[11.5px] text-teal-400 whitespace-pre-wrap break-all leading-relaxed overflow-x-auto mt-2">
      {sql}
    </pre>
  );
}

const DIALECT_LOGOS: Record<string, string> = {
  postgresql: "/postgresql-logo.svg",
  mysql: "/mysql-logo.svg",
  sqlite: "/sqlite-logo.svg",
  snowflake: "/snowflake-ar21.svg",
  databricks: "/azure-databricks.svg",
};

/* ── Props ── */
interface SessionDrawerProps {
  sessionId: string | null;
  open: boolean;
  onClose: () => void;
}

export function SessionDrawer({ sessionId, open, onClose }: SessionDrawerProps) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) { setDetail(null); return; }
    setLoading(true);
    fetchSessionDetail(sessionId).then((d) => { setDetail(d); setLoading(false); });
  }, [sessionId]);

  /* ── dialect info from first trace ── */
  const firstTrace = (detail?.traces || [])[0];
  const dialect = firstTrace?.dialect || "";
  const connMeta = firstTrace?.connection_meta || {};

  const isDesktop = useMediaQuery("(min-width: 768px)");

  const headerContent = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline" className="text-primary/70 border-primary/20 bg-primary/5 text-[10px] px-2 py-0.5">
          Session
        </Badge>
        {dialect && (
          <div className="flex items-center gap-1.5">
            <img
              src={DIALECT_LOGOS[dialect] || DIALECT_LOGOS.postgresql}
              alt={dialect}
              className="w-3.5 h-3.5 object-contain"
            />
            <span className="text-[10px] text-muted-foreground capitalize">{dialect}</span>
          </div>
        )}
      </div>
      {isDesktop ? (
        <SheetTitle className="text-sm font-semibold text-foreground">
          Session Detail
        </SheetTitle>
      ) : (
        <DrawerTitle className="text-sm font-semibold text-foreground mt-2">
          Session Detail
        </DrawerTitle>
      )}
      <p className="font-mono text-[10px] text-muted-foreground/60 mt-1 break-all">
        {sessionId || "—"}
      </p>
    </>
  );

  const mainContent = (
        <div className="px-6 py-5">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 bg-muted rounded-lg" />
              ))}
            </div>
          ) : !detail ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No data for this session.</p>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* ── Connection Info ── */}
                {(dialect || connMeta.display) && (
                  <section>
                    <SectionLabel icon={<Database className="w-3 h-3" />}>Connection</SectionLabel>
                    <div className="border border-border rounded-lg bg-card overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
                        {dialect ? (
                          <img
                            src={DIALECT_LOGOS[dialect] || DIALECT_LOGOS.postgresql}
                            alt={dialect}
                            className="w-5 h-5 object-contain flex-shrink-0"
                          />
                        ) : (
                          <Database className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium capitalize flex-1">{dialect || "unknown"}</span>
                        {connMeta.mode && (
                          <Badge variant="outline" className="text-[9px] px-2 py-0.5 h-5 capitalize">
                            {connMeta.mode}
                          </Badge>
                        )}
                      </div>
                      <div className="px-4 py-2.5">
                        {connMeta.display ? (
                          <p className="font-mono text-[11px] text-muted-foreground break-all leading-relaxed">
                            {connMeta.display}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/40 italic">
                            No connection URL available.
                          </p>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                <Separator className="bg-border" />

                {/* ── Conversation History ── */}
                <section>
                  <SectionLabel icon={<MessageSquare className="w-3 h-3" />}>
                    Conversation History
                    {(detail.history || []).length > 0 && (
                      <span className="ml-1 text-muted-foreground/40">({detail.history.length})</span>
                    )}
                  </SectionLabel>

                  {(detail.history || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No history recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {detail.history.map((h, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="border border-border rounded-lg bg-card overflow-hidden"
                        >
                          {/* Turn header */}
                          <div className="bg-muted/40 border-b border-border/60 px-4 py-2 flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                              Turn {i + 1}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground/50 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {fmtTs(h.ts)}
                            </span>
                          </div>
                          <div className="px-4 py-3 space-y-3">
                            {/* Question */}
                            <div>
                              <p className="text-[10px] text-muted-foreground/60 mb-1">Question</p>
                              <p className="text-sm text-foreground leading-relaxed break-words">
                                {parseQuestion(h.question)}
                              </p>
                            </div>
                            {/* SQL */}
                            {h.sql && (
                              <div>
                                <p className="text-[10px] text-muted-foreground/60 mb-1">Generated SQL</p>
                                <SqlBlock sql={h.sql} />
                              </div>
                            )}
                            {/* Response */}
                            {h.response && (
                              <div>
                                <p className="text-[10px] text-muted-foreground/60 mb-1">Response</p>
                                <p className="text-xs text-muted-foreground leading-relaxed break-words">
                                  {h.response}
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ── Errors in this session ── */}
                {(detail.errors || []).length > 0 && (
                  <>
                    <Separator className="bg-border" />
                    <section>
                      <SectionLabel icon={<AlertTriangle className="w-3 h-3 text-red-400" />}>
                        Errors ({detail.errors.length})
                      </SectionLabel>
                      <div className="space-y-2">
                        {detail.errors.map((e, i) => (
                          <div
                            key={i}
                            className="border border-red-500/20 bg-red-500/5 rounded-lg overflow-hidden"
                          >
                            <div className="bg-red-500/10 border-b border-red-500/15 px-4 py-2 flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-red-400 border-red-500/25 text-[10px] px-1.5 py-0"
                              >
                                {e.error_node}
                              </Badge>
                              <span className="text-[10px] text-amber-500 font-mono">{e.error_type}</span>
                              <span className="ml-auto font-mono text-[10px] text-muted-foreground/50">{fmtTs(e.ts)}</span>
                            </div>
                            <div className="px-4 py-3">
                              <p className="text-xs text-red-400/90 leading-relaxed break-words">{e.error}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                {/* ── RLHF Feedback ── */}
                {(detail.rlhf || []).length > 0 && (
                  <>
                    <Separator className="bg-border" />
                    <section>
                      <SectionLabel>Feedback ({detail.rlhf.length})</SectionLabel>
                      <div className="flex flex-wrap gap-2">
                        {detail.rlhf.map((r, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] ${
                              r.signal === "positive"
                                ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-500"
                                : "border-red-500/25 bg-red-500/8 text-red-400"
                            }`}
                          >
                            {r.signal === "positive" ? (
                              <ThumbsUp className="w-3 h-3" />
                            ) : (
                              <ThumbsDown className="w-3 h-3" />
                            )}
                            <span className="capitalize">{r.signal}</span>
                            <span className="text-[10px] opacity-60 font-mono">{fmtTs(r.ts)}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                {/* ── Session Meta ── */}
                <Separator className="bg-border" />
                <section>
                  <SectionLabel icon={<Hash className="w-3 h-3" />}>Session Metadata</SectionLabel>
                  <div className="flex items-start gap-3 bg-muted/40 rounded-lg px-4 py-3">
                    <Hash className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground/60 mb-0.5">Full Session ID</p>
                      <p className="font-mono text-[11.5px] text-muted-foreground break-all">{sessionId}</p>
                    </div>
                  </div>
                </section>

              </motion.div>
            </AnimatePresence>
          )}
        </div>
  );

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          className="w-full sm:w-[680px] sm:max-w-[680px] lg:w-[800px] lg:max-w-[800px] bg-background border-l border-border overflow-y-auto p-0"
          style={{ maxWidth: "min(800px, 95vw)" }}
        >
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 pt-6 pb-4">
            <SheetHeader className="text-left">{headerContent}</SheetHeader>
          </div>
          {mainContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="bg-background border-border max-h-[85vh] rounded-t-[1.5rem] flex flex-col overflow-hidden">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-6 pt-4 pb-4 shrink-0">
          <DrawerHeader className="p-0 text-left">{headerContent}</DrawerHeader>
        </div>
        <div className="flex-1 overflow-y-auto">
          {mainContent}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
