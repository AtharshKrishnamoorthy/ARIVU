"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import _GridLayout from "react-grid-layout";
const GridLayout = _GridLayout as any;
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ArrowLeft, Save, Loader2, RefreshCw, Trash2, Edit2, Check, Plus, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BuildWidgetDialog from "./BuildWidgetDialog";
import {
  fetchDashboard, deleteDashboard, removeDashboardWidget,
  refreshDashboardWidget, updateDashboardLayout, type Dashboard, type DashboardWidget
} from "@services/api";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDB } from "../../../../db-context";
import { toast } from "sonner";

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
    // SDK not available — widgets will show fallback
  }
}

/* ── Basic HTML sanitizer (strips scripts, event handlers, javascript: URLs) ── */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript\s*:/gi, "");
}

export default function DashboardViewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const dashboardId = resolvedParams.id;
  const router = useRouter();
  const { alias } = useDB();
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<any[]>([]);
  const [refreshingWidgetId, setRefreshingWidgetId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [buildDialogOpen, setBuildDialogOpen] = useState(false);
  const [deleteWidgetId, setDeleteWidgetId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchDashboard(dashboardId);
      if (data) {
        setDashboard(data.dashboard);
        setWidgets(data.widgets);
        
        // Build layout from widgets if not present in dashboard
        if (data.dashboard.layout && data.dashboard.layout.length > 0) {
          setLayout(data.dashboard.layout);
        } else {
          // Generate default layout
          const defaultLayout = data.widgets.map((w, i) => ({
            i: w.id,
            x: (i * 6) % 12,
            y: Math.floor(i / 2) * 4,
            w: 6,
            h: 4,
          }));
          setLayout(defaultLayout);
        }
      }
    } catch (err) {
      console.error(err);
      router.push(`/db/${encodeURIComponent(alias)}/dashboards`);
    } finally {
      setLoading(false);
    }
  }, [dashboardId, router]);

  useEffect(() => {
    loadC1();
    // Detect dark mode
    const detectDarkMode = () => {
      setIsDark(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
    };
    detectDarkMode();
    load();
  }, [load]);

  /* Measure container width for responsive GridLayout */
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setContainerWidth(w);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Listen for theme changes */
  useEffect(() => {
    const detectDarkMode = () => {
      setIsDark(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
    };
    
    // Watch for class changes on html element
    const observer = new MutationObserver(detectDarkMode);
    if (typeof document !== "undefined") {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    }
    
    return () => observer.disconnect();
  }, []);

  const handleLayoutChange = (newLayout: any) => {
    setLayout(newLayout);
  };

  const handleSaveLayout = async () => {
    setSaving(true);
    try {
      await updateDashboardLayout(dashboardId, layout);
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshWidget = async (widgetId: string) => {
    setRefreshingWidgetId(widgetId);
    try {
      await refreshDashboardWidget(dashboardId, widgetId);
      toast.success("Widget refreshed");
      load();
    } catch (err: any) {
      toast.error(`Refresh failed: ${err.message}`);
    } finally {
      setRefreshingWidgetId(null);
    }
  };

  const handleDeleteWidget = async () => {
    if (!deleteWidgetId) return;
    try {
      await removeDashboardWidget(dashboardId, deleteWidgetId);
      toast.success("Widget deleted");
      load();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setDeleteWidgetId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => router.push(`/db/${encodeURIComponent(alias)}/dashboards`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3 truncate">
              <LayoutDashboard className="h-5 w-5 sm:h-6 sm:w-6 text-primary/70 shrink-0" />
              <span className="truncate">{dashboard.name}</span>
            </h1>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setBuildDialogOpen(true)} className="gap-2">
            <BarChart3 className="h-4 w-4" /> Build Widget
          </Button>
          {editMode ? (
            <Button size="sm" onClick={handleSaveLayout} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Layout
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditMode(true)} className="gap-2">
              <Edit2 className="h-4 w-4" /> Edit Layout
            </Button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {widgets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 px-6 rounded-xl border-2 border-dashed border-border/80 bg-muted/30">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <LayoutDashboard className="h-8 w-8 text-primary/60" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Dashboard is empty</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm text-center">
            Go to Chat, visualize your data, and click <span className="font-medium">"Pin"</span> to add it here.
          </p>
          <Button onClick={() => router.push(`/db/${encodeURIComponent(alias)}/chat`)} className="mt-6 gap-2">
            Open Chat
          </Button>
        </div>
      )}

      {/* Grid */}
      {widgets.length > 0 && (
        <div ref={gridRef} className="rounded-xl border border-border bg-background/50 backdrop-blur-sm min-h-[600px] p-2 sm:p-6 w-full max-w-[100vw] overflow-hidden">
          <GridLayout
            className="layout w-full"
            layout={layout.map(l => containerWidth < 768 ? { ...l, w: 12, x: 0 } : l)}
            cols={12}
            rowHeight={120}
            width={containerWidth}
            onLayoutChange={handleLayoutChange}
            isDraggable={editMode && containerWidth >= 768}
            isResizable={editMode && containerWidth >= 768}
            margin={containerWidth < 768 ? [8, 8] : [12, 12]}
            useCSSTransforms={true}
            containerPadding={[0, 0]}
          >
            {widgets.map((widget) => {
              const isRefreshing = refreshingWidgetId === widget.id;
              
              return (
                <div 
                  key={widget.id} 
                  className={`flex flex-col rounded-xl border transition-all duration-200 overflow-hidden ${
                    editMode 
                      ? 'border-primary/60 shadow-lg ring-2 ring-primary/30 bg-card' 
                      : 'border-border/70 shadow-sm hover:shadow-md bg-card'
                  }`}
                >
                  {/* Widget Header */}
                  <div className={`px-3.5 py-2.5 border-b border-border/50 flex items-center justify-between shrink-0 ${
                    editMode ? 'bg-primary/5 cursor-move' : 'bg-muted/40'
                  }`}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <h3 className="text-sm font-semibold truncate pr-2 text-foreground cursor-default">{widget.query}</h3>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs break-words">{widget.query}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <div className="flex items-center gap-0.5">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 hover:bg-accent" 
                              onClick={() => handleRefreshWidget(widget.id)}
                              disabled={isRefreshing || editMode}
                            >
                              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Refresh Data</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {editMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 text-red-500/70 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => setDeleteWidgetId(widget.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Widget Body (Thesys C1 Render) */}
                  <div className="flex-1 relative p-3 overflow-auto min-h-[200px] bg-gradient-to-br from-background via-card to-background">
                    {isRefreshing ? (
                      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-20 rounded-lg">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">Refreshing…</span>
                        </div>
                      </div>
                    ) : null}
                    
                    {widget.c1_html && C1Component ? (
                      <div className="w-full h-full flex items-center justify-center">
                        {ThemeProvider ? (
                          <ThemeProvider theme={isDark ? "dark" : "light"}>
                            <C1Component c1Response={widget.c1_html} theme={isDark ? "dark" : "light"} />
                          </ThemeProvider>
                        ) : (
                          <C1Component c1Response={widget.c1_html} theme={isDark ? "dark" : "light"} />
                        )}
                      </div>
                    ) : widget.c1_html ? (
                      <div 
                        className="w-full h-full text-xs text-muted-foreground/60 overflow-auto flex items-center justify-center p-2" 
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(widget.c1_html) }} 
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                        <LayoutDashboard className="h-8 w-8 mb-2 opacity-30" />
                        <span className="text-xs">No visualization</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </GridLayout>
        </div>
      )}

      {/* Delete Widget Confirmation */}
      <AlertDialog open={!!deleteWidgetId} onOpenChange={(v) => !v && setDeleteWidgetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Widget?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The widget will be permanently removed from this dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 pt-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWidget} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Build Widget Dialog */}
      <BuildWidgetDialog
        dashboardId={dashboardId}
        open={buildDialogOpen}
        onOpenChange={setBuildDialogOpen}
        onWidgetAdded={load}
      />
    </div>
  );
}
