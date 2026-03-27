"use client";

import { useTheme } from "next-themes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStats } from "../../../services/types";

interface OverviewChartProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function OverviewChart({ stats, loading }: OverviewChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (loading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  const nodeLatency = stats?.node_avg_latency || {};
  const data = Object.entries(nodeLatency).map(([node, ms]) => ({
    name: node.replace(/_node$/, "").replace(/_/g, " "),
    latency: Math.round(ms),
  }));

  if (data.length === 0) {
    const placeholder = [
      { name: "intent", latency: 120 },
      { name: "schema", latency: 85 },
      { name: "sql gen", latency: 340 },
      { name: "validator", latency: 45 },
      { name: "executor", latency: 210 },
      { name: "formatter", latency: 60 },
    ];
    return (
      <div className="relative">
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="text-xs text-muted-foreground bg-card px-3 py-1.5 rounded-md border border-border">
            No data yet — showing placeholder
          </p>
        </div>
        <div className="opacity-30">
          <ChartInner data={placeholder} isDark={isDark} />
        </div>
      </div>
    );
  }

  return <ChartInner data={data} isDark={isDark} />;
}

function ChartInner({ data, isDark }: { data: { name: string; latency: number }[]; isDark: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={isDark ? "hsl(0 0% 15%)" : "hsl(0 0% 90%)"}
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: isDark ? "hsl(0 0% 53%)" : "hsl(0 0% 45%)" }}
          tickLine={false}
          axisLine={false}
          dy={8}
        />
        <YAxis
          tick={{ fontSize: 10, fill: isDark ? "hsl(0 0% 53%)" : "hsl(0 0% 45%)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}ms`}
          dx={-4}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "hsl(0 0% 4%)" : "hsl(0 0% 100%)",
            border: `1px solid ${isDark ? "hsl(0 0% 10%)" : "hsl(0 0% 90%)"}`,
            borderRadius: "6px",
            fontSize: "11px",
            color: isDark ? "hsl(0 0% 93%)" : "hsl(0 0% 10%)",
          }}
          formatter={(value: number) => [`${value}ms`, "Avg Latency"]}
          cursor={{ fill: isDark ? "hsl(0 0% 10%)" : "hsl(0 0% 95%)" }}
        />
        <Bar
          dataKey="latency"
          fill={isDark ? "hsl(0 0% 100%)" : "hsl(0 0% 10%)"}
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
