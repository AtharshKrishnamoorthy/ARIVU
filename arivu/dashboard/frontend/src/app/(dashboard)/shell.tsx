"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Database, GitGraph, LayoutDashboard, ThumbsUp,
  RefreshCw, PanelLeftClose, PanelLeftOpen, Menu,
  MessageSquare, Cpu, Server, Settings, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_GROUPS = [
  {
    label: "Connection",
    items: [
      { href: "/connection/connector", label: "Databases", icon: Database },
      { href: "/connection/llms",      label: "LLMs",      icon: Cpu },
      { href: "/connection/chat",      label: "Chat",      icon: MessageSquare },
    ],
  },
  {
    label: "Dashboards",
    items: [
      { href: "/dashboards",           label: "My Boards", icon: LayoutDashboard },
    ],
  },
  {
    label: "Automations",
    items: [
      { href: "/automations",          label: "Schedules", icon: Timer },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { href: "/monitoring/overview",  label: "Overview",  icon: LayoutDashboard },
      { href: "/monitoring/traces",    label: "Traces",    icon: GitGraph },
      { href: "/monitoring/sessions",  label: "Sessions",  icon: Server },
      { href: "/monitoring/errors",    label: "Errors",    icon: AlertTriangle, badge: true },
      { href: "/monitoring/feedback",  label: "Feedback",  icon: ThumbsUp },
    ],
  },
] as const;

function Sidebar({
  open, onToggle, isMobile = false, errorCount, onClose,
}: {
  open: boolean; onToggle: () => void; isMobile?: boolean;
  errorCount: number; onClose?: () => void;
}) {
  const pathname = usePathname();
  const show = open || isMobile;

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center px-4 h-14 border-b border-border shrink-0 gap-2.5">
        {show ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <img src="/arivu-logo-dark.png"  alt="Arivu" className="hidden dark:block h-5 w-auto object-contain" />
            <img src="/arivu-logo-light.png" alt="Arivu" className="block dark:hidden h-5 w-auto object-contain" />
          </motion.div>
        ) : (
          <div className="w-6 h-6 rounded-md bg-white text-black flex items-center justify-center font-bold text-sm mx-auto">A</div>
        )}
        {show && (
          <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0 text-muted-foreground border-border">
            v0.2
          </Badge>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {show && (
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 mb-2">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                const showBadge = "badge" in item && item.badge && errorCount > 0;
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`relative flex items-center gap-2.5 rounded-md text-xs font-medium transition-colors ${show ? "px-2.5 py-2" : "px-0 py-2 justify-center"} ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
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
              <Settings className="h-3.5 w-3.5 shrink-0" />
              {show && <span>Settings</span>}
            </Link>
          </TooltipTrigger>
          {!show && <TooltipContent side="right" className="text-xs">Settings</TooltipContent>}
        </Tooltip>

        {!isMobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggle}
                className={`w-full flex items-center gap-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors cursor-pointer ${show ? "px-2.5 py-2" : "px-0 py-2 justify-center"}`}
              >
                {open
                  ? <PanelLeftClose className="h-3.5 w-3.5 shrink-0" />
                  : <PanelLeftOpen  className="h-3.5 w-3.5 shrink-0" />}
                {open && (
                  <span className="flex items-center gap-2 text-xs">
                    Collapse
                    <kbd className="ml-auto text-[9px] bg-muted px-1 py-0.5 rounded font-mono">⌘B</kbd>
                  </span>
                )}
              </button>
            </TooltipTrigger>
            {!open && <TooltipContent side="right" className="text-xs">Expand (⌘B)</TooltipContent>}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function DashboardShell({ children, errorCount }: { children: React.ReactNode; errorCount: number; }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  useEffect(() => {
    const fn = () => setIsMobileLayout(window.innerWidth < 768);
    fn(); // initialize
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

  const pageTitle = pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") ?? "Dashboard";
  const W = isMobileLayout ? 0 : (sidebarOpen ? 220 : 56);

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
                className="w-[240px] h-full bg-card border-r border-border" onClick={(e) => e.stopPropagation()}>
                <Sidebar open={true} onToggle={() => setMobileOpen(false)} isMobile
                  errorCount={errorCount} onClose={() => setMobileOpen(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop sidebar */}
        <motion.aside className="hidden md:block fixed inset-y-0 left-0 z-40 border-r border-border bg-card overflow-hidden"
          initial={false} animate={{ width: isMobileLayout ? 0 : (sidebarOpen ? 220 : 56) }} transition={{ type: "spring", damping: 28, stiffness: 320 }}>
          <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} errorCount={errorCount} />
        </motion.aside>

        {/* Content */}
        <motion.div className="flex-1 flex flex-col min-w-0"
          initial={false} animate={{ paddingLeft: W }} transition={{ type: "spring", damping: 28, stiffness: 320 }}>
          <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-6 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="md:hidden h-8 w-8 p-0" onClick={() => setMobileOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
              <h1 className="text-sm font-semibold capitalize">{pageTitle}</h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-8 px-3 text-[11px] gap-1.5">
              <RefreshCw className="h-3 w-3" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </header>

          <main className="flex-1 overflow-hidden p-4 sm:p-6 min-w-0 flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div key={pathname} className="flex-1 min-h-0 flex flex-col"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}
