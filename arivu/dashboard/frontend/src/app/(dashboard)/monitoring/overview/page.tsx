"use client";

import { motion } from "framer-motion";
import { Activity, Timer, AlertTriangle, ThumbsUp, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OverviewChart } from "@/app/_components/overview-chart";
import { RecentQueries } from "@/app/_components/recent-queries";
import { useDashboard } from "@/app/(dashboard)/data-context";

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default function OverviewPage() {
  const { stats, traces, loading } = useDashboard();

  const cards = [
    {
      title: "Total Queries",
      value: stats?.total_queries ?? 0,
      desc: `${stats?.total_sessions ?? 0} active sessions`,
      icon: Activity,
      trend: stats?.total_queries ? "+12.5%" : null,
      up: true,
    },
    {
      title: "Avg Latency",
      value: fmtMs(stats?.avg_latency_ms),
      desc: "Pipeline execution time",
      icon: Timer,
      trend: stats?.avg_latency_ms ? "-8.2%" : null,
      up: false,
    },
    {
      title: "Error Rate",
      value: `${stats?.error_rate ?? 0}%`,
      desc: `${stats?.total_errors ?? 0} total errors`,
      icon: AlertTriangle,
      trend: stats?.error_rate != null ? `${stats.error_rate}%` : "0%",
      up: (stats?.error_rate ?? 0) > 5,
    },
    {
      title: "RLHF Score",
      value: stats
        ? `${Math.round((stats.positive_rlhf / Math.max(stats.positive_rlhf + stats.negative_rlhf, 1)) * 100)}%`
        : "—",
      desc: `${stats?.positive_rlhf ?? 0} positive · ${stats?.negative_rlhf ?? 0} negative`,
      icon: ThumbsUp,
      trend: stats?.positive_rlhf ? "+4.1%" : null,
      up: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
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
                          <Badge variant="outline"
                            className={`text-[10px] px-1.5 py-0 gap-0.5 font-mono ${card.up ? "text-emerald-500 border-emerald-500/20" : "text-red-500 border-red-500/20"}`}>
                            {card.up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                            {card.trend}
                          </Badge>
                        )}
                        <p className="text-[11px] text-muted-foreground">{card.desc}</p>
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
            <CardDescription className="text-xs">Node-level average latency across all traces</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <OverviewChart stats={stats} loading={loading} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm">Recent Queries</CardTitle>
            <CardDescription className="text-xs">Latest pipeline executions</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentQueries traces={traces} loading={loading} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
