/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { Send, User, Bot, AlertTriangle, Database, BarChart3, Loader2, Pin, Gauge } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  chatDB, chatDBStream, fetchConnections, setActiveConnection, visualizeData,
  fetchDashboards, addDashboardWidget, type Dashboard, fetchConfig
} from "../../../services/api";
import type { RateLimitConfig } from "../../../services/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SaveQueryDialog } from "@/components/SaveQueryDialog";

/* ── Thesys C1 Generative UI ─────────────────────────────────────────────── */
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

/* ── Types ────────────────────────────────────────────────────────────────── */
type Message = {
  role: "user" | "bot";
  content: string;
  sql?: string | null;
  error?: string | null;
  raw_result?: Record<string, any>[] | null;
  has_tabular_data?: boolean;
  c1_response?: string | null;
  visualizing?: boolean;
  question_text?: string; // original question for this exchange
  results_truncated?: boolean;
  limits?: {
    max_query_chars: number;
    max_result_rows: number;
    max_retries: number;
  };
};

/* ── Component ────────────────────────────────────────────────────────────── */
export function ChatView() {
  const resolvedTheme = useResolvedTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("arivu_chat_session");
      if (stored) return stored;
    }
    const fresh = "web_" + Math.random().toString(36).substring(7);
    if (typeof window !== "undefined") {
      localStorage.setItem("arivu_chat_session", fresh);
    }
    return fresh;
  });

  const [connections, setConnections] = useState<any[]>([]);
  const [activeAlias, setActiveAlias] = useState<string>("");
  const [switching, setSwitching] = useState(false);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [rateConfig, setRateConfig] = useState<RateLimitConfig | null>(null);
  const [lastChars, setLastChars] = useState<number>(0);
  const [lastRows, setLastRows] = useState<number>(0);
  const [wasTruncated, setWasTruncated] = useState<boolean>(false);
  const [lastLimits, setLastLimits] = useState<any | null>(null);

  useEffect(() => {
    loadC1();
    fetchConnections().then(res => {
      if (res) setConnections(res.connections || []);
    });
    fetchDashboards().then(res => {
      if (res) setDashboards(res.dashboards || []);
    });
    fetchConfig().then(cfg => {
      if (cfg) setRateConfig(cfg);
    });
  }, []);

  const handlePin = async (dashboardId: string, msg: Message) => {
    if (!msg.c1_response || !msg.sql) return;
    try {
      await addDashboardWidget(dashboardId, {
        title: "Chart",
        query: msg.question_text || "Query",
        sql: msg.sql,
        data: msg.raw_result || [],
        c1_html: msg.c1_response,
        position: {}
      });
      toast.success("Pinned to dashboard!");
    } catch (e: any) {
      toast.error(`Failed to pin: ${e.message}`);
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSwitchConnection = async (alias: string) => {
    setActiveAlias(alias);
    setSwitching(true);
    try {
      if (alias && alias !== "none") {
        await setActiveConnection(alias);
        setMessages(prev => [...prev, { role: "bot", content: `Switched active connection to: **${alias}**` }]);
        toast.success(`Connected to ${alias}`);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "bot", content: "", error: "Failed to switch connection: " + e.message }]);
      toast.error(`Failed to switch connection: ${e.message}`);
    } finally {
      setSwitching(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading || switching) return;
    if (!activeAlias) {
      setMessages(prev => [...prev, { role: "bot", content: "", error: "No active connection selected. Please select one from the dropdown or configure one in the Connector." }]);
      return;
    }

    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    const progressIdx = messages.length + 1;
    setMessages(prev => [...prev, {
      role: "bot",
      content: "Processing...",
      sql: null,
      error: null,
      raw_result: null,
      has_tabular_data: false,
      question_text: msg,
    }]);

    try {
      await chatDBStream(msg, sessionId, {
        onProgress: (text) => {
          setMessages(prev => prev.map((m, i) =>
            i === progressIdx ? { ...m, content: text } : m
          ));
        },
        onDone: (res) => {
          const sqlLength = res.sql ? res.sql.length : 0;
          const resultRows = res.raw_result ? res.raw_result.length : 0;
          setLastChars(sqlLength);
          setLastRows(resultRows);
          setWasTruncated(res.results_truncated || false);
          setLastLimits(res.limits);

          setMessages(prev => prev.map((m, i) =>
            i === progressIdx ? {
              ...m,
              content: res.response,
              sql: res.sql,
              error: res.error,
              raw_result: res.raw_result || null,
              has_tabular_data: res.has_tabular_data || false,
              results_truncated: res.results_truncated || false,
              limits: res.limits,
            } : m
          ));
        },
        onError: (err) => {
          setMessages(prev => prev.map((m, i) =>
            i === progressIdx ? { ...m, content: "", error: err } : m
          ));
        },
      });
    } catch (e: any) {
      setMessages(prev => prev.map((m, i) =>
        i === progressIdx ? { ...m, content: "", error: e.message || "Failed to process message." } : m
      ));
    } finally {
      setLoading(false);
    }
  };

  /* ── Visualize handler ─────────────────────────────────────────────────── */
  const handleVisualize = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg.raw_result || !msg.sql) return;

    // Mark as visualizing
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, visualizing: true } : m
    ));

    try {
      const res = await visualizeData(
        msg.question_text || msg.content || "",
        msg.sql,
        msg.raw_result
      );
      if (res?.c1_response) {
        setMessages(prev => prev.map((m, i) =>
          i === msgIndex ? { ...m, c1_response: res.c1_response, visualizing: false } : m
        ));
      } else {
        toast.error("No visualization generated.");
        setMessages(prev => prev.map((m, i) =>
          i === msgIndex ? { ...m, visualizing: false } : m
        ));
      }
    } catch (e: any) {
      const errMsg = e?.message || "Visualization failed";
      if (errMsg.includes("not configured")) {
        toast.error("Thesys C1 is not configured. Set THESYS_API_KEY in your environment.");
      } else {
        toast.error(`Visualization error: ${errMsg}`);
      }
      setMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, visualizing: false } : m
      ));
    }
  };

  return (
    <Card className="bg-card border-border flex flex-col h-[calc(100dvh-7rem)] sm:h-[calc(100vh-10rem)] max-h-[800px] min-h-[400px] w-full max-w-6xl mx-auto shadow-sm">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Database Chat</CardTitle>
              {switching ? (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              ) : (
                <div className={`w-2 h-2 rounded-full ${activeAlias && activeAlias !== 'none' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse'}`} />
              )}
            </div>
            <CardDescription className="text-xs mt-1">
              Talk to your connected database in natural language.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 pr-2">
            <Database size={14} className="text-muted-foreground hidden sm:block" />
            <Select
              value={activeAlias || "none"}
              onValueChange={handleSwitchConnection}
              disabled={switching || connections.length === 0}
            >
              <SelectTrigger className="h-8 w-[140px] sm:min-w-40 text-xs font-semibold">
                <SelectValue placeholder="Select connection" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>-- Choose DB --</SelectItem>
                {connections.map((c: any) => {
                  const dbIcon = c.dialect === 'postgresql' ? '/postgresql-logo.svg' : c.dialect === 'sqlite' ? '/sqlite-logo.svg' : '/mysql-logo.svg';
                  return (
                    <SelectItem key={c.alias} value={c.alias}>
                      <div className="flex items-center gap-2">
                        <img src={dbIcon} alt={c.dialect || 'db'} className="w-3.5 h-3.5 object-contain" />
                        <span>{c.alias}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      {activeAlias && activeAlias !== "none" && (
        <div className="px-4 py-1.5 border-b border-border bg-muted/20 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3 h-3" />
            <span className="font-medium">Rate Limits</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Query:</span>
            <span className={lastChars > ((lastLimits?.max_query_chars || 10000) * 0.8) ? "text-amber-500 font-semibold" : "text-foreground/70 font-mono"}>{lastChars}</span>
            <span>/</span>
            <span className="font-mono">{(lastLimits?.max_query_chars || 10000).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Rows:</span>
            <span className={wasTruncated ? "text-amber-500 font-semibold" : "text-foreground/70 font-mono"}>{lastRows}</span>
            <span>/</span>
            <span className="font-mono">{(lastLimits?.max_result_rows || 10000).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Max Retries:</span>
            <span className="font-mono text-foreground/70">{lastLimits?.max_retries || 3}</span>
          </div>
          {wasTruncated && (
            <div className="flex items-center gap-1 ml-auto text-amber-500 font-medium">
              <AlertTriangle className="w-3 h-3" />
              <span>Results truncated</span>
            </div>
          )}
        </div>
      )}

      {!activeAlias || activeAlias === "none" ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-muted/10">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Database className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-medium">No Database Connected</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Please select a database from the dropdown above to establish a connection and begin chatting.
          </p>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1 p-3 sm:p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-xs mt-20">
                  Connection established! Send a query to begin.
                </div>
              )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {m.role === "user" ? <User size={16} /> : <Bot size={16} />}
              </div>

              <div className={`relative max-w-[90%] sm:max-w-[80%] space-y-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
                {m.c1_response && C1Component && (
                  <div className="absolute -top-2 right-2 z-50">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" className="h-7 px-2 text-[10px] gap-1 shadow-sm bg-background/95 border border-border/60 hover:bg-background">
                          <Pin className="h-3 w-3" /> Pin
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {dashboards.length === 0 ? (
                          <DropdownMenuItem disabled className="text-xs">No dashboards found</DropdownMenuItem>
                        ) : (
                          dashboards.map(d => (
                            <DropdownMenuItem key={d.id} onClick={() => handlePin(d.id, m)} className="text-xs cursor-pointer">
                              Pin to {d.name}
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
                {m.content && m.content.includes("Switched active connection") ? (
                   <div className="text-[11px] text-muted-foreground bg-muted px-3 py-1.5 rounded-full mt-2 font-medium">
                     {m.content.replace(/\*\*/g, '')}
                   </div>
                ) : (
                  <>
                    {m.sql && (
                      <div className="space-y-2">
                        <div className="bg-muted border border-border rounded-md px-3 py-2 text-[11px] font-mono text-teal-600 dark:text-teal-400 whitespace-pre-wrap">
                          {m.sql}
                        </div>
                        <div className="flex justify-end">
                          <SaveQueryDialog
                            sessionId={sessionId}
                            query={m.question_text || m.content || ""}
                            sql={m.sql}
                            trigger={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1.5"
                              >
                                <Pin className="w-3 h-3" />
                                Save Query
                              </Button>
                            }
                          />
                        </div>
                      </div>
                    )}

                    {m.content && (
                      <div className={`px-4 py-2 text-sm rounded-lg ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                        {m.content}
                      </div>
                    )}

                    {m.error && (
                      <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-xs flex items-start gap-2">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span>{m.error}</span>
                      </div>
                    )}

                    {/* ── Visualize Button ─────────────────────────────── */}
                    {m.role === "bot" && m.has_tabular_data && !m.c1_response && !m.visualizing && C1Component && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 text-[11px] gap-1.5 mt-1 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 transition-colors"
                        onClick={() => handleVisualize(i)}
                      >
                        <BarChart3 className="h-3 w-3" />
                        Visualize
                      </Button>
                    )}

                    {/* ── Visualizing Spinner ──────────────────────────── */}
                    {m.visualizing && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 px-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                        <span className="text-violet-400/80">Generating visualization…</span>
                      </div>
                    )}

                    {/* ── C1 Generative UI Render ──────────────────────── */}
                    {m.c1_response && C1Component && (
                      <div className="mt-2 rounded-lg border border-border bg-card/50 overflow-hidden relative">
                        
                        {ThemeProvider ? (
                          <ThemeProvider theme={resolvedTheme}>
                            <C1Component c1Response={m.c1_response} theme={resolvedTheme} />
                          </ThemeProvider>
                        ) : (
                          <C1Component c1Response={m.c1_response} theme={resolvedTheme} />
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 flex-row">
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="px-4 py-2 text-sm rounded-lg bg-card border border-border">
                <div className="flex items-center gap-1.5">
                  {[0, 0.15, 0.3].map((d, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-3 sm:p-4 border-t border-border mt-auto pb-safe">
        <form
          className="flex items-center gap-2"
          onSubmit={e => { e.preventDefault(); handleSend(); }}
        >
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question about your database..."
            className="flex-1 bg-background text-sm"
            disabled={loading || switching || !activeAlias}
          />
            <Button type="submit" size="icon" disabled={!input.trim() || loading || switching || !activeAlias}>
              <Send size={16} />
            </Button>
          </form>
        </div>
        </>
      )}
    </Card>
  );
}
