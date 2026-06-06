"use client";

import { useRouter } from "next/navigation";
import { useDB } from "../../db-context";
import { motion } from "framer-motion";
import {
  MessageSquare, Table, LayoutDashboard, Timer, BookOpen, Activity,
  Database, CheckCircle2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const QUICK_LINKS = [
  { label: "Chat",        icon: MessageSquare,  path: "chat",        desc: "Query with natural language" },
  { label: "DB Explorer", icon: Table,          path: "explorer",    desc: "Browse tables & data" },
  { label: "Dashboards",  icon: LayoutDashboard, path: "dashboards", desc: "Visual dashboards" },
  { label: "Automations",  icon: Timer,          path: "automations", desc: "Scheduled queries" },
  { label: "Saved Queries", icon: BookOpen,      path: "queries",     desc: "Bookmarked queries" },
  { label: "Monitoring",  icon: Activity,       path: "monitoring/overview", desc: "Traces, sessions & errors" },
];

export default function DBOverviewPage() {
  const router = useRouter();
  const { alias, dialect, status } = useDB();

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      {/* Status Banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Database className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{alias}</h1>
            <p className="text-sm text-muted-foreground capitalize">{dialect || "Database"}</p>
          </div>
        </div>
        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1.5 px-3 py-1 shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5" /> Connected
        </Badge>
      </motion.div>

      {/* Quick Links Grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_LINKS.map((link, i) => {
            const Icon = link.icon;
            return (
              <motion.div key={link.path}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}>
                <Card
                  className="bg-card cursor-pointer transition-all hover:shadow-md hover:border-primary/40 hover:scale-[1.01] group"
                  onClick={() => router.push(`/db/${encodeURIComponent(alias)}/${link.path}`)}>
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{link.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{link.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
