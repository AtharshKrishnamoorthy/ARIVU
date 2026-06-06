"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Database, GitGraph, LayoutDashboard, ThumbsUp,
  RefreshCw, PanelLeftClose, PanelLeftOpen, Menu,
  MessageSquare, Cpu, Server, Settings, Timer,
  BookOpen, Table, ArrowLeft, Activity, Plug, MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command } from "lucide-react";
import { CommandPalette } from "@/components/CommandPalette";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BackToTop } from "@/components/BackToTop";
import { ThemeToggle } from "@/components/ThemeToggle";

function isMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if ("userAgentData" in navigator && (navigator as any).userAgentData?.platform) {
    return (navigator as any).userAgentData.platform === "macOS";
  }
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

function getNavGroups(pathname: string) {
  const dbMatch = pathname.match(/^\/db\/([^/]+)/);

  if (dbMatch) {
    const alias = dbMatch[1];
    const base = `/db/${alias}`;
    return {
      dbAlias: decodeURIComponent(alias),
      groups: [
        {
          label: "Workspace",
          items: [
            { href: base,                    label: "Overview",    icon: Database },
            { href: `${base}/chat`,          label: "Chat",        icon: MessageSquare },
            { href: `${base}/explorer`,      label: "DB Explorer", icon: Table },
          ],
        },
        {
          label: "Analytics",
          items: [
            { href: `${base}/dashboards`,    label: "Dashboards",  icon: LayoutDashboard },
            { href: `${base}/queries`,       label: "Saved Queries", icon: BookOpen },
            { href: `${base}/automations`,   label: "Schedules",   icon: Timer },
          ],
        },
        {
          label: "Monitoring",
          items: [
            { href: `${base}/monitoring/overview`,  label: "Overview",  icon: Activity },
            { href: `${base}/monitoring/traces`,    label: "Traces",    icon: GitGraph },
            { href: `${base}/monitoring/sessions`,  label: "Sessions",  icon: Server },
            { href: `${base}/monitoring/errors`,    label: "Errors",    icon: AlertTriangle, badge: true },
            { href: `${base}/monitoring/feedback`,  label: "Feedback",  icon: ThumbsUp },
          ],
        },
      ],
    };
  }

  return {
    dbAlias: null,
    groups: [
      {
        label: "Main",
        items: [
          { href: "/",                          label: "Databases",    icon: Database },
          { href: "/connection/llms",           label: "LLMs",         icon: Cpu },
          { href: "/connection/integrations",   label: "Integrations", icon: Plug },
        ],
      },
    ],
  };
}

function Sidebar({
  open, onToggle, isMobile = false, errorCount, onClose,
}: {
  open: boolean; onToggle: () => void; isMobile?: boolean;
  errorCount: number; onClose?: () => void;
}) {
  const pathname = usePathname();
  const show = open || isMobile;

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {/* Brand */}
      <div className="flex items-center px-4 h-14 border-b border-border shrink-0 gap-2.5">
        {show ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <img src="/arivu-logo-dark.png"  alt="Arivu" className="hidden dark:block h-5 w-auto object-contain" />
            <img src="/arivu-logo-light.png" alt="Arivu" className="block dark:hidden h-5 w-auto object-contain" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto shrink-0">
            <img src="/arivu-logo-dark.png"  alt="Arivu" className="hidden dark:block h-5 w-auto object-contain" />
            <img src="/arivu-logo-light.png" alt="Arivu" className="block dark:hidden h-5 w-auto object-contain" />
          </motion.div>
        )}
        {show && (
          <div className="ml-auto flex items-center justify-center">
            <Tooltip>
              <TooltipTrigger>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                System Operational
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {(() => {
          const { dbAlias, groups } = getNavGroups(pathname);
          return (
            <>
              {dbAlias && (
                <div className="mb-4 flex flex-col gap-1">
                  {show && (
                    <div className="px-2 mb-2">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-primary/10 border border-primary/20 rounded-lg shadow-sm">
                        <Database className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-[13px] font-bold text-primary truncate tracking-tight">{dbAlias}</span>
                      </div>
                    </div>
                  )}
                  <div className={show ? "px-2" : ""}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href="/" onClick={onClose}
                          className={`flex items-center gap-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors ${show ? "px-2.5 py-1.5" : "px-0 py-2 justify-center"}`}>
                          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                          {show && <span className="font-medium">All Databases</span>}
                        </Link>
                      </TooltipTrigger>
                      {!show && <TooltipContent side="right" className="text-xs">All Databases</TooltipContent>}
                    </Tooltip>
                  </div>
                </div>
              )}
              {groups.map((group) => (
                <div key={group.label}>
                  {show && (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 mb-2">
                      {group.label}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
                      const showBadge = "badge" in item && item.badge && errorCount > 0;
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>
                            <Link
                              href={item.href}
                              onClick={onClose}
                              className={`relative flex items-center gap-2.5 rounded-md text-xs font-medium transition-colors ${show ? "px-2.5 py-2" : "px-0 py-2 justify-center"} ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              {show ? (
                                <>
                                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{item.label}</motion.span>
                                  {showBadge && (
                                    <Badge className="ml-auto bg-red-500/10 text-red-500 border-red-500/20 text-[9px] px-1.5 py-0 h-4">
                                      {errorCount}
                                    </Badge>
                                  )}
                                </>
                              ) : showBadge ? (
                                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                              ) : null}
                            </Link>
                          </TooltipTrigger>
                          {!show && <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>}
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          );
        })()}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border space-y-0.5 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/settings"
              onClick={onClose}
              className={`flex items-center gap-2.5 rounded-md text-xs transition-colors ${show ? "px-2.5 py-2" : "px-0 py-2 justify-center"} ${pathname === "/settings" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {show && <span>Settings</span>}
            </Link>
          </TooltipTrigger>
          {!show && <TooltipContent side="right" className="text-xs">Settings</TooltipContent>}
        </Tooltip>
      </div>
    </div>
  );
}

export function DashboardShell({ children, errorCount }: { children: React.ReactNode; errorCount: number; }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [openCommand, setOpenCommand] = useState(false);

  useEffect(() => {
    const fn = () => setIsMobileLayout(window.innerWidth < 768);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); setSidebarOpen((v) => !v); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const sidebarWidth = isMobileLayout ? 0 : (sidebarOpen ? 240 : 56);
  const gap = 16; // 1rem gap between sidebar and content

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-background flex">
        {/* Mobile overlay */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)}>
              <motion.div initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-[260px] h-full bg-sidebar border-r border-border" onClick={(e) => e.stopPropagation()}>
                <Sidebar open={true} onToggle={() => setMobileOpen(false)} isMobile
                  errorCount={errorCount} onClose={() => setMobileOpen(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop sidebar */}
        <motion.aside data-tour="sidebar"
          className="hidden md:block fixed inset-y-0 left-0 z-40 bg-sidebar"
          initial={false} animate={{ width: sidebarWidth }} transition={{ type: "tween", duration: 0.2, ease: "easeInOut" }}>
          <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} errorCount={errorCount} />
        </motion.aside>

        {/* Content wrapper — embedded inside sidebar layout */}
        <div className="flex-1 flex flex-col min-w-0 transition-[padding-left] duration-200 ease-in-out"
          style={{ paddingLeft: sidebarWidth + gap }}>
          <div className="flex-1 flex flex-col min-h-0 p-4">
            {/* Embedded content panel */}
            <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-border bg-card overflow-hidden">
              {/* Header */}
              <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-5 border-b border-border shrink-0 bg-card/50 backdrop-blur-md gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Button variant="ghost" size="sm" className="md:hidden h-8 w-8 p-0 shrink-0" onClick={() => setMobileOpen(true)}>
                    <Menu className="h-4 w-4" />
                  </Button>
                  
                  {/* Desktop Collapse Button */}
                  <div className="hidden md:flex items-center gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setSidebarOpen((v) => !v)}
                          className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          {sidebarOpen ? <PanelLeftClose className="h-[18px] w-[18px]" /> : <PanelLeftOpen className="h-[18px] w-[18px]" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {sidebarOpen ? "Collapse" : "Expand"} Sidebar ({isMacOS() ? "\u2318B" : "Ctrl+B"})
                      </TooltipContent>
                    </Tooltip>
                    
                    <div className="w-[1px] h-4 bg-border" /> {/* Separator */}
                  </div>

                  <Breadcrumbs />
                </div>
                {/* Mobile Dropdown */}
                <div className="flex sm:hidden items-center gap-1.5">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-40 p-2 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between px-2 pb-1.5 border-b border-border/50">
                        <span className="text-xs font-medium text-muted-foreground">Theme</span>
                        <ThemeToggle />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setOpenCommand(true)} className="justify-start px-2 h-8">
                        <Command className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Search
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="justify-start px-2 h-8">
                        <RefreshCw className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Refresh
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Desktop Buttons */}
                <div className="hidden sm:flex items-center gap-2">
                  <ThemeToggle />
                  <Button variant="outline" size="sm" onClick={() => setOpenCommand(true)} className="h-8 px-3 text-[11px] gap-1.5 flex items-center justify-center">
                    <Command className="h-3.5 w-3.5" />
                    <span>Search</span>
                    <kbd className="ml-auto text-[9px] bg-muted px-1 py-0.5 rounded font-mono">Ctrl+K</kbd>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-8 px-3 text-[11px] gap-1.5 flex items-center justify-center">
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Refresh</span>
                  </Button>
                </div>
              </header>

              {/* Main content */}
              <main className="flex-1 overflow-auto min-w-0">
                <AnimatePresence mode="wait">
                  <motion.div key={pathname} className="p-5"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                    {children}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
          </div>
        </div>
      </div>
      <CommandPalette open={openCommand} onOpenChange={setOpenCommand} />
      <BackToTop />
    </TooltipProvider>
  );
}
