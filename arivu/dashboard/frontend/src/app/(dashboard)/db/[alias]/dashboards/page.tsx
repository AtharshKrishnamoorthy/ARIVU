"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  LayoutDashboard, Plus, Trash2, Clock, ArrowRight, Loader2, Search
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  fetchDashboards, createDashboard, deleteDashboard,
  type Dashboard,
} from "@services/api";
import { useDB } from "../../../db-context";

function relativeTime(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function DashboardsListPage() {
  const { alias } = useDB();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDashboards();
      setDashboards(data?.dashboards ?? []);
    } catch (err) {
      console.error("Failed to load dashboards:", err);
      setDashboards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newBoardName.trim()) return;
    setSubmitting(true);
    try {
      await createDashboard(newBoardName.trim());
      setNewBoardName("");
      setDialogOpen(false);
      toast.success("Dashboard created");
      load();
    } catch (err: any) {
      toast.error(`Failed to create: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteDashboard(id);
      toast.success("Dashboard deleted");
      load();
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDashboards = dashboards.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saved Dashboards</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build and manage persistent grids of your favorite AI-generated charts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search dashboards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> New Dashboard
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Dashboard</DialogTitle>
                <DialogDescription>
                  Create a new empty dashboard. You can pin visualizations to it from the Chat interface.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 py-4">
                <Label htmlFor="board-name">Dashboard Name</Label>
                <Input
                  id="board-name"
                  placeholder="e.g. Sales KPIs 2026"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!newBoardName.trim() || submitting} className="gap-1.5">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Empty state */}
      {!loading && filteredDashboards.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="rounded-full bg-muted p-4 mb-4">
            <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">{searchTerm ? "No dashboards found" : "No dashboards yet"}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {searchTerm ? "No dashboards match your search." : "Create a dashboard here, then pin charts to it directly from the Chat interface."}
          </p>
        </motion.div>
      )}

      {/* Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {filteredDashboards.map((board, i) => (
            <motion.div
              key={board.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link href={`/db/${encodeURIComponent(alias)}/dashboards/${board.id}`}>
                <Card className="group relative transition-all hover:border-primary/50 hover:shadow-md cursor-pointer">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base truncate pr-8">{board.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 mt-1">
                      <Clock className="h-3 w-3" />
                      Created {relativeTime(board.created_at)}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="h-24 w-full rounded-md bg-muted/50 border border-border flex items-center justify-center">
                      <LayoutDashboard className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0 flex items-center justify-between border-t border-border mt-auto h-12 px-4">
                    <span className="text-xs font-medium text-muted-foreground group-hover:text-primary flex items-center gap-1 transition-colors">
                      Open Board <ArrowRight className="h-3 w-3" />
                    </span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleDelete(e, board.id)}
                            disabled={deletingId === board.id}
                          >
                            {deletingId === board.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete Dashboard</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardFooter>
                </Card>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
