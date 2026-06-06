/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp, User, AlertTriangle, Copy, Check,
  ThumbsUp, ThumbsDown, RefreshCw, Mic, MicOff,
  ChevronLeft, ChevronRight, Paperclip, Database, Loader2,
  BarChart3, Download, Table2, Pin, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerDescription } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { chatDB, fetchSessionDetail, saveRLHFSignal, visualizeData, exportData, fetchSuggestions, fetchDashboards, fetchConfig, addDashboardWidget, type Dashboard } from "@services/api";
import type { ChatMessage } from "@services/types";
import { SaveQueryDialog } from "@/components/SaveQueryDialog";
import { useDB } from "../../../../db-context";
import { SessionIndicator } from "@/components/SessionIndicator";

/* ── Thesys C1 Generative UI (lazy-loaded) ───────────────────────────── */
let C1Component: any = null;
let ThemeProvider: any = null;
let c1Loaded = false;

function loadC1() {
  if (c1Loaded) return;
  c1Loaded = true;
  try {
    const sdk = require("@thesysai/genui-sdk");
    C1Component = sdk.C1Component;
    ThemeProvider = sdk.ThemeProvider;
  } catch {
    // SDK not available — visualize stays hidden
  }
}

/** Tracks the resolved dark/light theme from the <html> element */
function useResolvedTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  useEffect(() => {
    const update = () =>
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return theme;
}

const DIALECT_LOGOS: Record<string, string> = {
  postgresql: "/postgresql-logo.svg", mysql: "/mysql-logo.svg",
  sqlite: "/sqlite-logo.svg", snowflake: "/snowflake-ar21.svg",
  databricks: "/azure-databricks.svg",
};

function fmt(ts: number, full = false) {
  const d = new Date(ts);
  if (full) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

/* ── SQL copy block ── */
function SqlBlock({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => { navigator.clipboard.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <details className="group border border-border/60 bg-background/40 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden mb-3 shadow-sm">
      <summary className="flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/40 hover:text-foreground transition-colors select-none">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted border border-border/50 shadow-sm">
            <Database className="w-3 h-3 text-foreground/70" />
          </span>
          SQL Query Generated
        </div>
        <ChevronRight className="w-3.5 h-3.5 opacity-50 group-open:rotate-90 transition-transform duration-200" />
      </summary>
      <div className="relative group/sql border-t border-border/40 bg-muted/10">
        <pre className="px-4 py-3 text-[12px] font-mono text-teal-600 dark:text-teal-400 whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-60 overflow-y-auto">
          {sql}
        </pre>
        <button onClick={(e) => { e.preventDefault(); doCopy(); }}
          className="absolute top-2 right-2.5 opacity-0 group-hover/sql:opacity-100 transition-opacity p-1.5 rounded-lg bg-background/80 border border-border/60 backdrop-blur-sm hover:bg-background">
          {copied ? <Check className="w-3 md:w-3.5 h-3 md:h-3.5 text-emerald-500" /> : <Copy className="w-3 md:w-3.5 h-3 md:h-3.5 text-muted-foreground" />}
        </button>
      </div>
    </details>
  );
}

/* ── Message card ── */
interface MessageCardProps {
  msg: ChatMessage;
  sessionId: string;
  dashboards: Dashboard[];
  onRegenerate?: (question: string) => void;
  onVisualize?: () => void;
}

function MessageCard({
  msg, sessionId, dashboards, onRegenerate, onVisualize
}: MessageCardProps) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [rlhf, setRlhf] = useState<"positive" | "negative" | null>(null);
  const resolvedTheme = useResolvedTheme();

  const doCopy = () => {
    navigator.clipboard.writeText(msg.content || "");
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const doSpeak = () => {
    if (!("speechSynthesis" in window)) { toast.error("Speech not supported"); return; }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const text = msg.content || "";
    const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const utt = new SpeechSynthesisUtterance(cleanText);
    utt.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
    setSpeaking(true);
  };

  const doRlhf = async (sig: "positive" | "negative") => {
    setRlhf(sig);
    try {
      await saveRLHFSignal(sessionId, msg.content || "", (msg as any).sql || "", sig);
      toast.success(sig === "positive" ? "Thanks for the feedback!" : "Noted — we'll improve.");
    } catch { toast.error("Could not save feedback."); }
  };

  const doPin = async (dashboardId: string) => {
    if (!msg.c1_response || !msg.sql) return;
    try {
      await addDashboardWidget(dashboardId, {
        title: "Chart",
        query: msg.question_text || "Query",
        sql: msg.sql,
        data: msg.raw_result || [],
        c1_html: msg.c1_response,
        position: {},
      });
      toast.success("Pinned to dashboard!");
    } catch (e: any) {
      toast.error(`Failed to pin: ${e.message}`);
    }
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 self-end overflow-hidden
        ${isUser ? "bg-primary text-primary-foreground" : "bg-card border shadow-sm"}`}>
        {isUser ? <User size={14} /> : (
          <>
            <img src="/arivu-logo-dark.png" className="w-[18px] h-[18px] object-contain hidden dark:block" alt="Arivu" />
            <img src="/arivu-logo-light.png" className="w-[18px] h-[18px] object-contain block dark:hidden" alt="Arivu" />
          </>
        )}
      </div>

      {/* Card */}
      <div className={`max-w-[90%] sm:max-w-[80%] md:max-w-[78%] rounded-2xl overflow-hidden border
        ${isUser
          ? "bg-primary text-primary-foreground border-primary/20 rounded-br-sm"
          : "bg-card border-border rounded-bl-sm"}`}>

        {/* Body — top 3/4 */}
        <div className="px-4 pt-3.5 pb-2.5">
          {!isUser && msg.sql && <SqlBlock sql={msg.sql} />}
          {!isUser && msg.sql && msg.question_text && (
            <div className="flex items-center justify-end gap-1.5 -mt-2 mb-3">
              <SaveQueryDialog
                sessionId={sessionId}
                query={msg.question_text}
                sql={msg.sql}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Save
                  </Button>
                }
              />
            </div>
          )}
          
          {(() => {
            const renderMarkdown = () => {
              if (!msg.content) return null;
              const thinkMatch = msg.content.match(/<think>([\s\S]*?)<\/think>/);
              const actualContent = msg.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
              const thinkContent = thinkMatch ? thinkMatch[1].trim() : null;

              return (
                <div className={`text-sm leading-relaxed flex flex-col ${isUser ? "text-primary-foreground" : "text-foreground"}`}>
                  {thinkContent && (
                    <details className="group border border-border/60 bg-background/40 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden mb-3 shadow-sm">
                      <summary className="flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/40 hover:text-foreground transition-colors select-none">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted border border-border/50 shadow-sm">
                            <svg className="w-3 h-3 text-foreground/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          </span>
                          Reasoning Process
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 opacity-50 group-open:rotate-90 transition-transform duration-200" />
                      </summary>
                      <div className="px-4 pb-3.5 text-[11px] text-muted-foreground/80 border-t border-border/40 bg-muted/10 pt-3 whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
                        {thinkContent}
                      </div>
                    </details>
                  )}
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ node, ...props }) => <a className="text-blue-500 hover:underline" target="_blank" rel="noreferrer" {...props} />,
                      p: ({ node, ...props }) => <p className="mb-2 last:mb-0 break-words" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1" {...props} />,
                      li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                      em: ({ node, ...props }) => <em className="italic opacity-90" {...props} />,
                      h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-3 mb-2" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-base font-bold mt-3 mb-1" {...props} />,
                      blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-border pl-3 italic opacity-80 my-2" {...props} />,
                      table: ({ node, ...props }) => (
                        <div className="w-full overflow-x-auto my-3 rounded-lg border border-border">
                          <table className="w-full text-left border-collapse text-sm" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => <thead className="bg-muted/50 border-b border-border" {...props} />,
                      tbody: ({ node, ...props }) => <tbody className="divide-y divide-border/50" {...props} />,
                      tr: ({ node, ...props }) => <tr className="hover:bg-muted/30 transition-colors" {...props} />,
                      th: ({ node, ...props }) => <th className="px-3 py-2 font-semibold text-muted-foreground" {...props} />,
                      td: ({ node, ...props }) => <td className="px-3 py-2" {...props} />,
                      pre: ({ node, ...props }) => <pre className="bg-muted/80 p-3 rounded-xl overflow-x-auto my-3 text-[13px] font-mono border border-border" {...props} />,
                      code: ({ node, className, ...props }: any) => {
                        const isCodeBlock = className?.includes('language-');
                        return (
                          <code 
                            className={isCodeBlock ? className : `bg-muted/40 border border-border/50 px-1.5 py-0.5 rounded text-[12px] font-mono break-words ${isUser ? 'text-primary-foreground' : 'text-foreground'}`} 
                            {...props} 
                          />
                        );
                      },
                    }}
                  >
                    {actualContent}
                  </ReactMarkdown>
                </div>
              );
            };

            if (!isUser && msg.has_tabular_data) {
              return (
                <Tabs defaultValue="response" className="w-full mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <TabsList className="grid flex-1 grid-cols-3 bg-muted/50 p-1 rounded-xl h-9">
                      <TabsTrigger value="response" className="text-[10px] sm:text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-1 sm:px-3">
                        <span className="sm:hidden">Resp</span><span className="hidden sm:inline">Response</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="visualize"
                        className="text-[10px] sm:text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-1 sm:px-3"
                        onClick={() => {
                          if (!msg.c1_response && !msg.visualizing && onVisualize) {
                            onVisualize();
                          }
                        }}
                      >
                        <BarChart3 className="w-3 h-3 sm:mr-1.5" /> <span className="hidden sm:inline">Visualize</span>
                      </TabsTrigger>
                      <TabsTrigger value="table" className="text-[10px] sm:text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-1 sm:px-3">
                        <Table2 className="w-3 h-3 sm:mr-1.5" /> <span className="hidden sm:inline">Data Table</span>
                      </TabsTrigger>
                    </TabsList>

                    {msg.c1_response && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="sm" className="h-9 px-2 sm:px-3 text-xs gap-1.5 shrink-0 border-border/60 bg-background/95 hover:bg-background">
                            <Pin className="w-3 h-3" /> <span className="hidden sm:inline">Pin</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {dashboards.length === 0 ? (
                            <DropdownMenuItem disabled className="text-xs">No dashboards found</DropdownMenuItem>
                          ) : (
                            dashboards.map(dashboard => (
                              <DropdownMenuItem key={dashboard.id} className="text-xs cursor-pointer" onClick={() => doPin(dashboard.id)}>
                                Pin to {dashboard.name}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  
                  <TabsContent value="response" className="mt-0 outline-none">
                    {renderMarkdown()}
                  </TabsContent>
                  
                  <TabsContent value="visualize" className="mt-0 outline-none min-h-[150px]">
                    {msg.visualizing && (
                      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-sm">Generating chart…</span>
                      </div>
                    )}
                    {msg.c1_response && C1Component && (
                      <div className="c1-viz-wrapper rounded-xl border border-border overflow-hidden bg-background">
                        {ThemeProvider ? (
                          <ThemeProvider theme={resolvedTheme}>
                            <C1Component c1Response={msg.c1_response} theme={resolvedTheme} />
                          </ThemeProvider>
                        ) : (
                          <C1Component c1Response={msg.c1_response} theme={resolvedTheme} />
                        )}
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="table" className="mt-0 outline-none">
                    {msg.raw_result && msg.raw_result.length > 0 && (
                      <div className="rounded-xl border border-border overflow-hidden bg-background flex flex-col">
                        <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30">
                          <span className="text-xs font-medium text-muted-foreground ml-2">{msg.raw_result.length} rows</span>
                          <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1.5" onClick={() => exportData(msg.raw_result!, 'arivu_data')}>
                            <Download className="w-3 h-3" /> Export CSV
                          </Button>
                        </div>
                        <ScrollArea className="max-h-[400px] w-full">
                          <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                              <TableRow className="hover:bg-transparent">
                                {Object.keys(msg.raw_result[0]).map(key => (
                                  <TableHead key={key} className="h-8 text-xs font-semibold whitespace-nowrap">{key}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {msg.raw_result.map((row, i) => (
                                <TableRow key={i}>
                                  {Object.values(row).map((val, j) => (
                                    <TableCell key={j} className="py-2 text-xs">{String(val)}</TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              );
            }

            return renderMarkdown();
          })()}

          {msg.error && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mt-1">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>{msg.error}</span>
            </div>
          )}
        </div>

        <Separator className={isUser ? "bg-white/10" : "bg-border/60"} />

        {/* Metadata — bottom 1/4 */}
        <div className={`px-3 py-1.5 flex items-center gap-1 text-[10px]
          ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {isUser ? (
            <span className="ml-auto">{fmt(msg.ts, true)}</span>
          ) : (
            <>
              {/* Copy */}
              <button onClick={doCopy}
                className="p-1 rounded-md hover:bg-accent transition-colors"
                title="Copy response">
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
              {/* Thumbs */}
              <button onClick={() => doRlhf("positive")}
                className={`p-1 rounded-md hover:bg-accent transition-colors ${rlhf === "positive" ? "text-emerald-500" : ""}`}
                title="Good response">
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button onClick={() => doRlhf("negative")}
                className={`p-1 rounded-md hover:bg-accent transition-colors ${rlhf === "negative" ? "text-destructive" : ""}`}
                title="Bad response">
                <ThumbsDown className="w-3 h-3" />
              </button>
              {/* Regenerate */}
              {onRegenerate && (
                <button onClick={() => onRegenerate(msg.content || "")}
                  className="p-1 rounded-md hover:bg-accent transition-colors" title="Regenerate">
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
              {/* Speak */}
              <button onClick={doSpeak}
                className={`p-1 rounded-md hover:bg-accent transition-colors ${speaking ? "text-primary" : ""}`}
                title="Read aloud">
                {speaking ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              </button>

              <div className="flex-1" />

              {/* Response time + timestamp */}
              {msg.responseMs !== undefined && (
                <span className="font-mono">{(msg.responseMs / 1000).toFixed(1)}s</span>
              )}
              <span className="ml-1">{fmt(msg.ts, true)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Typing dots ── */
function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-card border shadow-sm flex items-center justify-center shrink-0 self-end overflow-hidden">
        <img src="/arivu-logo-dark.png" className="w-[18px] h-[18px] object-contain hidden dark:block" alt="Arivu" />
        <img src="/arivu-logo-light.png" className="w-[18px] h-[18px] object-contain block dark:hidden" alt="Arivu" />
      </div>
      <div className="flex items-center gap-1.5 px-4 py-3.5 bg-card border border-border rounded-2xl rounded-bl-sm">
        {[0, 0.15, 0.3].map((d, i) => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60"
            animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d }} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Main page                                                      */
/* ═══════════════════════════════════════════════════════════════ */
export default function ChatSessionPage({ params }: { params: Promise<{ session_id: string }> }) {
  const { session_id: sessionId } = use(params);
  const router = useRouter();
  const { alias: activeAlias, dialect: activeDialect } = useDB();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [rateConfig, setRateConfig] = useState<{ limits: { max_query_chars: number; max_result_rows: number; max_retries: number } } | null>(null);
  const [lastChars, setLastChars] = useState(0);
  const [lastRows, setLastRows] = useState(0);
  const [wasTruncated, setWasTruncated] = useState(false);
  const [lastLimits, setLastLimits] = useState<{ max_query_chars: number; max_result_rows: number; max_retries: number } | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [suggestions, setSuggestions] = useState<string[]>([
    "List all tables", "Show row counts per table",
    "What columns does the orders table have?", "Find the top 10 most recent records"
  ]);



  /* Load connections and existing session history */
  const loadInitial = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const [sessRes, suggRes, dashRes] = await Promise.all([
        fetchSessionDetail(sessionId).catch(() => null),
        fetchSuggestions().catch(() => null),
        fetchDashboards().catch(() => null),
      ]);

      if (suggRes?.suggestions) {
        setSuggestions(suggRes.suggestions);
      }
      if (dashRes?.dashboards) {
        setDashboards(dashRes.dashboards || []);
      }
      if (sessRes?.history?.length) {
        const rebuilt: ChatMessage[] = [];
        sessRes.history.forEach((h: any) => {
          rebuilt.push({
            id: `u_${h.ts}`, role: "user",
            content: h.question, ts: h.ts * 1000,
          });
          rebuilt.push({
            id: `b_${h.ts}`, role: "bot",
            content: h.response, sql: h.sql || null,
            ts: (h.ts + 0.001) * 1000,
          });
        });
        setMessages(rebuilt);

        if (sessRes.history.length > 0) {
          const lastQ = sessRes.history[sessRes.history.length - 1].question;
          fetchSuggestions(lastQ).then(res => {
            if (res?.suggestions) setFollowUpSuggestions(res.suggestions);
          }).catch(() => {});
        }
      }
    } finally { setHistoryLoading(false); }
  }, [sessionId]);

  useEffect(() => { loadC1(); loadInitial(); }, [loadInitial]);

  useEffect(() => {
    if (activeAlias) {
      fetchConfig().then(cfg => {
        if (cfg) setRateConfig(cfg);
      }).catch(() => {});
    }
  }, [activeAlias]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: messages.length > 2 ? "smooth" : "instant" });
  }, [messages, loading]);

  /* Auto-resize textarea */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const addMsg = useCallback((msg: ChatMessage) => setMessages(p => [...p, msg]), []);



  const handleSend = useCallback(async (overrideMsg?: string) => {
    const text = (overrideMsg ?? input).trim();
    if (!text || loading) return;
    if (!overrideMsg) setInput("");
    setFollowUpSuggestions([]); // Clear existing follow-ups

    const userMsg: ChatMessage = { id: "u_" + Date.now(), role: "user", content: text, ts: Date.now() };
    addMsg(userMsg);
    setLoading(true);
    const t0 = Date.now();

    try {
      const res = await chatDB(text, sessionId);
      if (!res) throw new Error("No response from server");
      addMsg({
        id: "b_" + Date.now(), role: "bot",
        content: res.response, sql: res.sql, error: res.error,
        ts: Date.now(), responseMs: Date.now() - t0,
        raw_result: res.raw_result || null,
        has_tabular_data: res.has_tabular_data || false,
        results_truncated: res.results_truncated || false,
        limits: res.limits,
        question_text: text,
      });
      setLastChars(res.sql?.length || 0);
      setLastRows(res.raw_result?.length || 0);
      setWasTruncated(res.results_truncated || false);
      setLastLimits(res.limits || null);
      
      // Fetch follow-up suggestions asynchronously
      fetchSuggestions(text).then(fRes => {
        if (fRes?.suggestions) setFollowUpSuggestions(fRes.suggestions);
      }).catch(() => {});
      
    } catch (e: any) {
      addMsg({ id: "e_" + Date.now(), role: "bot", content: "", error: e.message, ts: Date.now() });
    } finally { setLoading(false); }
  }, [input, loading, sessionId, addMsg]);

  /* ── Visualize handler ── */
  const handleVisualize = useCallback(async (msgId: string) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx === -1) return;
    const msg = messages[idx];
    if (!msg.raw_result || !msg.sql) return;

    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, visualizing: true } : m));

    try {
      const res = await visualizeData(
        msg.question_text || msg.content || "",
        msg.sql,
        msg.raw_result as Record<string, unknown>[]
      );
      if (res?.c1_response) {
        setMessages(prev => prev.map(m =>
          m.id === msgId ? { ...m, c1_response: res.c1_response, visualizing: false } : m
        ));
      } else {
        toast.error("No visualization generated.");
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, visualizing: false } : m));
      }
    } catch (e: any) {
      const errMsg = e?.message || "Visualization failed";
      if (errMsg.includes("not configured")) {
        toast.error("Thesys C1 is not configured. Set THESYS_API_KEY in your environment.");
      } else {
        toast.error(`Visualization error: ${errMsg}`);
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, visualizing: false } : m));
    }
  }, [messages]);

  /* Voice input */
  const handleMicInput = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      toast.error("Speech recognition not supported."); return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.onstart = () => setIsRecording(true);
    rec.onend = () => setIsRecording(false);
    rec.onresult = (ev: any) => setInput(prev => prev + ev.results[0][0].transcript);
    rec.start();
  };

  const isConnected = !!activeAlias;
  const logoSrc = DIALECT_LOGOS[activeDialect] || DIALECT_LOGOS.postgresql;
  const queryLimit = lastLimits?.max_query_chars || rateConfig?.limits.max_query_chars || 10000;
  const rowLimit = lastLimits?.max_result_rows || rateConfig?.limits.max_result_rows || 10000;
  const retryLimit = lastLimits?.max_retries || rateConfig?.limits.max_retries || 3;

  const MetadataContent = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground pb-2 border-b border-border">
          <Database className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">Rate Limits</span>
        </div>
        <div className="grid gap-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Query Characters</span>
            <div>
              <span className={lastChars > queryLimit * 0.8 ? "text-amber-500 font-semibold" : "text-foreground font-mono"}>{lastChars}</span>
              <span className="text-muted-foreground mx-1.5">/</span>
              <span className="font-mono text-muted-foreground">{queryLimit.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Result Rows</span>
            <div>
              <span className={wasTruncated ? "text-amber-500 font-semibold" : "text-foreground font-mono"}>{lastRows}</span>
              <span className="text-muted-foreground mx-1.5">/</span>
              <span className="font-mono text-muted-foreground">{rowLimit.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Retries</span>
            <div>
              <span className="font-mono text-foreground">{retryLimit}</span>
            </div>
          </div>
        </div>
      </div>
      {wasTruncated && (
        <div className="flex items-center gap-2 text-amber-500 font-medium text-xs p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Results were truncated to fit limits</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
        <Button size="sm" className="h-8 w-8 p-0"
          variant="ghost" 
          onClick={() => router.push(`/db/${encodeURIComponent(activeAlias)}/chat`)}>
          <ChevronLeft className="w-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Database className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold truncate mr-1 sm:mr-2">{activeAlias}</span>
          <Badge variant="outline" className="h-5 px-2 text-[10px] gap-1 shrink-0 hidden sm:flex">
            <img src={logoSrc} className="w-3 h-3 object-contain" alt="" />
            {activeDialect}
            <div className="ml-0.5">
              <SessionIndicator alias={activeAlias} sessionId={sessionId} currentSessionId={sessionId} />
            </div>
          </Badge>
        </div>

        <span className="text-[10px] text-muted-foreground font-mono hidden sm:block">
          {sessionId.slice(0, 16)}
        </span>

        {isConnected && (
          isMobile ? (
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto sm:ml-2">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader className="text-left">
                  <DrawerTitle>Session Metadata</DrawerTitle>
                  <DrawerDescription>Current resource usage and rate limits</DrawerDescription>
                </DrawerHeader>
                <div className="p-4 pb-8">
                  <MetadataContent />
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 ml-2">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] sm:w-[400px]">
                <SheetHeader className="mb-6">
                  <SheetTitle>Session Metadata</SheetTitle>
                  <SheetDescription>Current resource usage and rate limits</SheetDescription>
                </SheetHeader>
                <MetadataContent />
              </SheetContent>
            </Sheet>
          )
        )}
      </div>

      {/* ── Messages ── */}
      <>
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 sm:px-8 py-6 space-y-4 max-w-4xl mx-auto w-full">
            {historyLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-16 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                <img src={logoSrc} className="w-8 h-8 object-contain" alt="" />
              </div>
              <div>
                <p className="text-sm font-semibold">Ask anything about your database</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isConnected ? `Connected to ${activeAlias}` : "Select a connection above to start"}
                </p>
              </div>
              {isConnected && (
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {suggestions.map(s => (
                    <button key={s} onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                      className="text-xs bg-muted hover:bg-accent border border-border rounded-full px-3 py-1.5 transition-colors text-muted-foreground hover:text-foreground">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div key={m.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}>
                    <MessageCard
                      msg={m}
                      sessionId={sessionId}
                      dashboards={dashboards}
                      onRegenerate={m.role === "bot" ? () => {
                        const prev = messages[messages.findIndex(x => x.id === m.id) - 1];
                        if (prev?.role === "user") handleSend(prev.content);
                      } : undefined}
                      onVisualize={m.role === "bot" && m.has_tabular_data && C1Component
                        ? () => handleVisualize(m.id)
                        : undefined}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {messages.length > 0 && !loading && followUpSuggestions.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-2 mt-4 ml-11">
                  {followUpSuggestions.map(s => (
                    <button key={s} onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                      className="text-[11px] bg-primary/5 border border-primary/20 text-primary/90 hover:bg-primary/10 hover:border-primary/40 rounded-full px-3 py-1.5 transition-colors shadow-sm">
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
            </>
          )}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="relative z-10 shrink-0 px-2 sm:px-8 pb-4 sm:pb-8 pt-2 max-w-4xl mx-auto w-full">
        <div className={`relative flex items-end gap-1.5 sm:gap-2 bg-background shadow-[0_4px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_40px_rgba(0,0,0,0.3)] border border-border/80 rounded-2xl sm:rounded-[28px] px-2 sm:px-3 py-1.5 sm:py-2 transition-all
          ${isConnected ? "focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10" : "opacity-60"}`}>

          {/* Left: Attach + Mic */}
          <div className="flex items-center gap-1 shrink-0 mb-0.5">
            <button
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
              title="Attach PDF (coming soon)"
              onClick={() => toast.info("PDF context coming soon.")}>
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              className={`p-1.5 rounded-full transition-all ${isRecording
                ? "text-red-500 hover:text-red-600 bg-red-500/10"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
              title="Voice input"
              onClick={handleMicInput}>
              <Mic className="w-4 h-4" />
            </button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={isConnected ? "Ask anything about your data… (↵ to send)" : "Select a connection above"}
            disabled={!isConnected || loading}
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/60
              min-h-[24px] max-h-[160px] self-center leading-snug"
          />

          {/* Right: Send */}
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading || !isConnected}
            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all mb-0.5
              ${input.trim() && isConnected
                ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"}`}>
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
          Shift+Enter for new line · Arivu translates questions to SQL
        </p>
      </div>
      </>
    </div>
  );
}
