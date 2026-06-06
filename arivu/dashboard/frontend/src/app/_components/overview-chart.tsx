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
  const barFill = isDark ? "hsl(0 0% 55%)" : "hsl(0 0% 65%)";
  const barHover = isDark ? "hsl(0 0% 80%)" : "hsl(0 0% 10%)";
  const gridColor = isDark ? "hsl(0 0% 20%)" : "hsl(0 0% 75%)";
  const tickColor = isDark ? "hsl(0 0% 45%)" : "hsl(0 0% 55%)";
  const tooltipBg = isDark ? "hsl(0 0% 12%)" : "hsl(0 0% 100%)";
  const tooltipBorder = isDark ? "hsl(0 0% 20%)" : "hsl(0 0% 85%)";
  const tooltipText = isDark ? "hsl(0 0% 90%)" : "hsl(0 0% 15%)";
  const tooltipLabel = isDark ? "hsl(0 0% 55%)" : "hsl(0 0% 50%)";
  const cursorFill = isDark ? "hsl(0 0% 18%)" : "hsl(0 0% 94%)";

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={gridColor}
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: tickColor }}
          tickLine={false}
          axisLine={false}
          dy={8}
        />
        <YAxis
          tick={{ fontSize: 10, fill: tickColor }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}ms`}
          dx={-4}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: "8px",
            fontSize: "11px",
            color: tooltipText,
            boxShadow: isDark ? "0 4px 12px rgba(0,0,0,0.4)" : "0 4px 12px rgba(0,0,0,0.08)",
            padding: "8px 12px",
          }}
          labelStyle={{ color: tooltipLabel, fontWeight: 600, marginBottom: 4 }}
          formatter={(value: number, name: string) => [`${value}ms`, "Avg Latency"]}
          cursor={{ fill: cursorFill, radius: 4 }}
        />
        <Bar
          dataKey="latency"
          fill={barFill}
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
          activeBar={{ fill: barHover }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
