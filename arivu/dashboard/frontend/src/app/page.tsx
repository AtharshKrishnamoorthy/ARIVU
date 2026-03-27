"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Activity,
  AlertTriangle,
  Database,
  GitGraph,
  LayoutDashboard,
  Search,
  Settings,
  ThumbsUp,
  Timer,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
  Monitor,
  Menu,
  X,
  Keyboard,
  Palette,
  Bell,
  Globe,
  MessageSquare,
  Cpu,
  Blocks,
  Server,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

import { fetchStats, fetchTraces, fetchSessions, fetchErrors, fetchRLHF } from "../../services/api";
import type { DashboardStats, Trace, Session, ErrorEntry, RLHFEntry } from "../../services/types";

import { OverviewChart } from "./_components/overview-chart";
import { RecentQueries } from "./_components/recent-queries";
import { SessionsTable } from "./_components/sessions-table";
import { ErrorsTable } from "./_components/errors-table";
import { RLHFTable } from "./_components/rlhf-table";
import { SessionDrawer } from "./_components/session-drawer";

import { ConnectorView } from "./_components/connector-view";
import { ChatView } from "./_components/chat-view";
import { LLMView } from "./_components/llm-view";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number | null | undefined): string {
  if (ms === undefined || ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Sidebar nav items ────────────────────────────────────────────────────────

const navGroups = [
  {
    label: "Connection",
    items: [
      { id: "connector", label: "Connector", icon: Database },
      { id: "chat", label: "Chat", icon: MessageSquare },
      { id: "llm", label: "LLMs", icon: Cpu },
    ]
  },
  {
    label: "Monitoring",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "traces", label: "Traces", icon: GitGraph },
      { id: "sessions", label: "Sessions", icon: Server },
      { id: "errors", label: "Errors", icon: AlertTriangle },
      { id: "rlhf", label: "Feedback", icon: ThumbsUp },
    ]
  }
] as const;

type PageId = 
  | "connector" | "chat" | "llm"
  | "overview" | "traces" | "sessions" | "errors" | "rlhf" 
  | "settings";

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [page, setPage] = useState<PageId>("overview");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [rlhf, setRlhf] = useState<RLHFEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [drawerSession, setDrawerSession] = useState<string | null>(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Settings state
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  // ── Keyboard shortcut: Ctrl+B to toggle sidebar ────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Auto refresh interval ──────────────────────────────────────────────────
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadAll();
    }, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  const loadAll = useCallback(async () => {
    const [s, t, sess, e, r] = await Promise.all([
      fetchStats(),
      fetchTraces(undefined, 50),
      fetchSessions(50),
      fetchErrors(100),
      fetchRLHF(100),
    ]);
    setStats(s);
    setTraces(t?.traces || []);
    setSessions(sess?.sessions || []);
    setErrors(e?.errors || []);
    setRlhf(r?.rlhf || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
    toast.success("Dashboard data refreshed.");
  };

  // ── Metric cards data ──────────────────────────────────────────────────────
  const metricCards = [
    {
      title: "Total Queries",
      value: stats?.total_queries ?? 0,
      description: `${stats?.total_sessions ?? 0} active sessions`,
      icon: Activity,
      trend: stats?.total_queries ? "+12.5%" : null,
      trendUp: true,
    },
    {
      title: "Avg Latency",
      value: fmtMs(stats?.avg_latency_ms),
      description: "Pipeline execution time",
      icon: Timer,
      trend: stats?.avg_latency_ms ? "-8.2%" : null,
      trendUp: false,
    },
    {
      title: "Error Rate",
      value: `${stats?.error_rate ?? 0}%`,
      description: `${stats?.total_errors ?? 0} total errors`,
      icon: AlertTriangle,
      trend: stats?.error_rate !== undefined && stats.error_rate > 0 ? `${stats.error_rate}%` : "0%",
      trendUp: (stats?.error_rate ?? 0) > 5,
    },
    {
      title: "RLHF Score",
      value: stats
        ? `${Math.round(
            (stats.positive_rlhf /
              Math.max(stats.positive_rlhf + stats.negative_rlhf, 1)) *
              100
          )}%`
        : "—",
      description: `${stats?.positive_rlhf ?? 0} positive · ${stats?.negative_rlhf ?? 0} negative`,
      icon: ThumbsUp,
      trend: stats?.positive_rlhf ? "+4.1%" : null,
      trendUp: true,
    },
  ];

  // ── Sidebar width ──────────────────────────────────────────────────────────
  const sidebarWidth = sidebarOpen ? 220 : 56;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen bg-background">
        {/* ── Mobile overlay ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            >
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-[260px] h-full bg-card border-r border-border"
                onClick={(e) => e.stopPropagation()}
              >
                <SidebarContent
                  page={page}
                  setPage={(id) => { setPage(id); setMobileMenuOpen(false); }}
                  errors={errors}
                  sidebarOpen={true}
                  onToggle={() => setMobileMenuOpen(false)}
                  isMobile
                />
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarWidth }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="hidden md:flex flex-col border-r border-border bg-card fixed inset-y-0 left-0 z-40 overflow-hidden"
        >
          <SidebarContent
            page={page}
            setPage={setPage}
            errors={errors}
            sidebarOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        </motion.aside>

        {/* ── Main content ───────────────────────────────────────────────── */}
        <motion.main
          initial={false}
          animate={{ marginLeft: typeof window !== "undefined" && window.innerWidth >= 768 ? sidebarWidth : 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="flex-1 min-w-0"
        >
          {/* Header */}
          <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 h-14 border-b border-border bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden h-8 w-8 p-0"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <h1 className="text-sm font-semibold capitalize">{page}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={`Search ${page}...`}
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-card border-border focus-visible:ring-ring"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-8 px-3 text-[11px] gap-1.5"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </header>

          {/* Content */}
          <div className={`p-4 sm:p-6 ${compactMode ? "max-w-[1100px]" : ""}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                {/* ── Overview ───────────────────────────────────────────── */}
                {page === "overview" && (
                  <div className="space-y-6">
                    {/* Metric cards */}
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                      {metricCards.map((card, i) => {
                        const Icon = card.icon;
                        return (
                          <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            <Card className="bg-card border-border">
                              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-xs font-medium text-muted-foreground">
                                  {card.title}
                                </CardTitle>
                                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              </CardHeader>
                              <CardContent>
                                {loading ? (
                                  <Skeleton className="h-7 w-20" />
                                ) : (
                                  <>
                                    <div className="text-2xl font-bold">{card.value}</div>
                                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                                      {card.trend && (
                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] px-1.5 py-0 gap-0.5 font-mono ${
                                            card.trendUp
                                              ? "text-emerald-500 border-emerald-500/20"
                                              : "text-red-500 border-red-500/20"
                                          }`}
                                        >
                                          {card.trendUp ? (
                                            <TrendingUp className="h-2.5 w-2.5" />
                                          ) : (
                                            <TrendingDown className="h-2.5 w-2.5" />
                                          )}
                                          {card.trend}
                                        </Badge>
                                      )}
                                      <p className="text-[11px] text-muted-foreground">
                                        {card.description}
                                      </p>
                                    </div>
                                  </>
                                )}
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Chart + Recent queries */}
                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
                      <Card className="lg:col-span-4 bg-card border-border">
                        <CardHeader>
                          <CardTitle className="text-sm">Pipeline Performance</CardTitle>
                          <CardDescription className="text-xs">
                            Node-level average latency across all traces
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pl-2">
                          <OverviewChart stats={stats} loading={loading} />
                        </CardContent>
                      </Card>

                      <Card className="lg:col-span-3 bg-card border-border">
                        <CardHeader>
                          <CardTitle className="text-sm">Recent Queries</CardTitle>
                          <CardDescription className="text-xs">
                            Latest pipeline executions
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <RecentQueries traces={traces} loading={loading} />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* ── Connector ──────────────────────────────────────────── */}
                {page === "connector" && <ConnectorView />}

                {/* ── Chat ───────────────────────────────────────────────── */}
                {page === "chat" && <ChatView />}

                {/* ── LLMs ───────────────────────────────────────────────── */}
                {page === "llm" && <LLMView />}



                {/* ── Traces ─────────────────────────────────────────────── */}
                {page === "traces" && (
                  <TracesView traces={traces} loading={loading} globalSearch={globalSearch} />
                )}

                {/* ── Sessions ───────────────────────────────────────────── */}
                {page === "sessions" && (
                  <SessionsTable
                    sessions={sessions}
                    loading={loading}
                    onSelect={setDrawerSession}
                    globalSearch={globalSearch}
                  />
                )}

                {/* ── Errors ─────────────────────────────────────────────── */}
                {page === "errors" && (
                  <ErrorsTable errors={errors} loading={loading} globalSearch={globalSearch} />
                )}

                {/* ── RLHF ───────────────────────────────────────────────── */}
                {page === "rlhf" && (
                  <RLHFTable entries={rlhf} loading={loading} />
                )}

                {/* ── Settings ───────────────────────────────────────────── */}
                {page === "settings" && (
                  <SettingsPanel
                    autoRefresh={autoRefresh}
                    setAutoRefresh={setAutoRefresh}
                    compactMode={compactMode}
                    setCompactMode={setCompactMode}
                    notifications={notifications}
                    setNotifications={setNotifications}
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.main>

        {/* Session drawer */}
        <SessionDrawer
          sessionId={drawerSession}
          open={!!drawerSession}
          onClose={() => setDrawerSession(null)}
        />
      </div>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar content (shared between desktop + mobile)
// ─────────────────────────────────────────────────────────────────────────────

function SidebarContent({
  page,
  setPage,
  errors,
  sidebarOpen,
  onToggle,
  isMobile = false,
}: {
  page: PageId;
  setPage: (id: PageId) => void;
  errors: ErrorEntry[];
  sidebarOpen: boolean;
  onToggle: () => void;
  isMobile?: boolean;
}) {
  return (
    <>
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
        {(sidebarOpen || isMobile) ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <img src="/arivu-logo-dark.png" alt="Arivu Logo" className="hidden dark:block h-6 w-auto object-contain" />
            <img src="/arivu-logo-light.png" alt="Arivu Logo" className="block dark:hidden h-6 w-auto object-contain" />
          </motion.div>
        ) : (
          <div className="w-6 h-6 rounded-md bg-white text-black flex items-center justify-center font-bold pb-0.5 mx-auto">A</div>
        )}
        {(sidebarOpen || isMobile) && (
          <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0 text-muted-foreground border-border">
            v0.1
          </Badge>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            {(sidebarOpen || isMobile) && (
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 mb-2">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = page === item.id;
                
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setPage(item.id)}
                        className={`w-full flex items-center gap-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          sidebarOpen || isMobile ? "px-2.5 py-1.5" : "px-0 py-1.5 justify-center"
                        } ${
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {(sidebarOpen || isMobile) && (
                          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {item.label}
                          </motion.span>
                        )}
                        {(sidebarOpen || isMobile) && item.id === "errors" && errors.length > 0 && (
                          <Badge className="ml-auto bg-red-500/10 text-red-500 border-red-500/20 text-[9px] px-1.5 py-0">
                            {errors.length}
                          </Badge>
                        )}
                      </button>
                    </TooltipTrigger>
                    {!sidebarOpen && !isMobile && (
                      <TooltipContent side="right" className="text-xs">
                        {item.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border space-y-0.5 shrink-0">
        {/* Settings button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setPage("settings")}
              className={`w-full flex items-center gap-2.5 rounded-md text-xs transition-colors cursor-pointer ${
                sidebarOpen || isMobile ? "px-2.5 py-1.5" : "px-0 py-1.5 justify-center"
              } ${
                page === "settings"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Settings className="h-3.5 w-3.5 shrink-0" />
              {(sidebarOpen || isMobile) && <span>Settings</span>}
            </button>
          </TooltipTrigger>
          {!sidebarOpen && !isMobile && (
            <TooltipContent side="right" className="text-xs">Settings</TooltipContent>
          )}
        </Tooltip>

        {/* Collapse button */}
        {!isMobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggle}
                className={`w-full flex items-center gap-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors cursor-pointer ${
                  sidebarOpen ? "px-2.5 py-1.5" : "px-0 py-1.5 justify-center"
                }`}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <PanelLeftOpen className="h-3.5 w-3.5 shrink-0" />
                )}
                {sidebarOpen && (
                  <span className="flex items-center gap-2">
                    Collapse
                    <kbd className="ml-auto text-[9px] bg-muted px-1 py-0.5 rounded text-muted-foreground font-mono">
                      ⌘B
                    </kbd>
                  </span>
                )}
              </button>
            </TooltipTrigger>
            {!sidebarOpen && (
              <TooltipContent side="right" className="text-xs">
                Expand (⌘B)
              </TooltipContent>
            )}
          </Tooltip>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings panel
// ─────────────────────────────────────────────────────────────────────────────

function SettingsPanel({
  autoRefresh,
  setAutoRefresh,
  compactMode,
  setCompactMode,
  notifications,
  setNotifications,
  sidebarOpen,
  setSidebarOpen,
}: {
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  compactMode: boolean;
  setCompactMode: (v: boolean) => void;
  notifications: boolean;
  setNotifications: (v: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}) {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="space-y-6 w-full">
      <div>
        <h2 className="text-sm font-semibold">Settings</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your dashboard preferences
        </p>
      </div>

      {/* Appearance */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Appearance</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Customize how the dashboard looks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Theme selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Theme</Label>
            <div className="flex gap-2">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <Button
                    key={opt.id}
                    variant={theme === opt.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme(opt.id)}
                    className="h-8 px-3 text-xs gap-1.5 flex-1"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Compact mode */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Compact mode</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Reduce content width for focused viewing
              </p>
            </div>
            <Switch checked={compactMode} onCheckedChange={setCompactMode} />
          </div>

          <Separator />

          {/* Sidebar collapse */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Sidebar expanded</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Toggle with <kbd className="text-[9px] bg-muted px-1 py-0.5 rounded font-mono">Ctrl+B</kbd>
              </p>
            </div>
            <Switch checked={sidebarOpen} onCheckedChange={setSidebarOpen} />
          </div>
        </CardContent>
      </Card>

      {/* Data Settings */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Data</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Configure data fetching and refresh behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Auto-refresh</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Refresh data every 30 seconds
              </p>
            </div>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Notifications</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Control alert behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Error alerts</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Show badge count for pipeline errors
              </p>
            </div>
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </div>
        </CardContent>
      </Card>

      {/* Keyboard shortcuts */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Keyboard Shortcuts</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { keys: "Ctrl + B", action: "Toggle sidebar" },
              { keys: "Ctrl + R", action: "Refresh data" },
            ].map((shortcut) => (
              <div
                key={shortcut.keys}
                className="flex items-center justify-between py-1"
              >
                <span className="text-xs text-muted-foreground">{shortcut.action}</span>
                <kbd className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Traces sub-view (inline)
// ─────────────────────────────────────────────────────────────────────────────

function TracesView({
  traces,
  loading,
  globalSearch = "",
}: {
  traces: Trace[];
  loading: boolean;
  globalSearch?: string;
}) {
  const [filter, setFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<"time_desc" | "time_asc" | "latency_desc" | "latency_asc">("time_desc");
  
  const queryFilter = (globalSearch || filter).toLowerCase();

  const filtered = traces
    .filter((t) => {
      if (!queryFilter) return true;
      const qt = (t.question || "").toLowerCase();
      const st = (t.session_id || "").toLowerCase();
      const events = (t.events || []).map(e => `${e.node} ${e.status} ${(e as any).error || ""}`).join(" ").toLowerCase();
      return qt.includes(queryFilter) || st.includes(queryFilter) || events.includes(queryFilter);
    })
    .sort((a, b) => {
      if (sortOrder === "time_desc") return b.ts - a.ts;
      if (sortOrder === "time_asc") return a.ts - b.ts;
      
      const latA = (a.events || []).reduce((acc, ev) => acc + (ev.latency_ms || 0), 0);
      const latB = (b.events || []).reduce((acc, ev) => acc + (ev.latency_ms || 0), 0);
      
      if (sortOrder === "latency_desc") return latB - latA;
      return latA - latB;
    });

  function fmtMs(ms: number | null | undefined) {
    if (ms === undefined || ms === null) return "—";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function fmtTs(ts: number | undefined) {
    if (!ts) return "—";
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString("en-US", { hour12: false }) + " " + d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ok: "text-emerald-500 border-emerald-500/20 bg-emerald-500/5",
      fail: "text-red-500 border-red-500/20 bg-red-500/5",
      retry: "text-amber-400 border-amber-400/20 bg-amber-400/5",
      skip: "text-muted-foreground border-border",
    };
    return map[status] || "";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Pipeline Traces</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtered.length} trace{filtered.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!globalSearch && (
            <div className="relative flex-1 sm:w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Content, message, or session..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-8 h-8 text-xs bg-card border-border"
              />
            </div>
          )}
          <Select value={sortOrder} onValueChange={v => setSortOrder(v as any)}>
            <SelectTrigger className="h-8 min-w-[140px] text-xs font-semibold">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
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
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
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
            <motion.div
              key={`${t.session_id}-${t.ts}-${i}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              <Card className="bg-card border-border hover:border-border/80 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 mb-3">
                    <p className="text-xs text-foreground font-medium leading-relaxed">
                      {t.question || "—"}
                    </p>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      {fmtTs(t.ts)}
                    </span>
                  </div>

                  {/* Node pipeline */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {(t.events || []).map((ev, j) => (
                      <div key={j} className="flex items-center">
                        <div className="border rounded-md px-2 py-1 min-w-[72px] text-center">
                          <div className="text-[8px] text-muted-foreground tracking-wide uppercase leading-none mb-0.5">
                            {ev.node.replace(/_node$/, "").replace(/_/g, " ")}
                          </div>
                          <div className="text-[10px] font-semibold text-foreground">
                            {fmtMs(ev.latency_ms)}
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[8px] px-1 py-0 mt-0.5 ${statusBadge(ev.status)}`}
                          >
                            {ev.status}
                          </Badge>
                        </div>
                        {j < (t.events || []).length - 1 && (
                          <ChevronRight className="h-3 w-3 text-muted-foreground/30 mx-0.5 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>

                  {t.sql && (
                    <div className="mt-2 bg-background border border-border rounded px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground truncate">
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
