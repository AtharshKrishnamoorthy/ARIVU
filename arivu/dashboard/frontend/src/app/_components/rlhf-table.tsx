"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RLHFEntry } from "../../../services/types";
import { ThumbsUp, LayoutDashboard, MessageSquare } from "lucide-react";

const DIALECT_LOGOS: Record<string, string> = {
  postgresql: "/postgresql-logo.svg",
  mysql: "/mysql-logo.svg",
  sqlite: "/sqlite-logo.svg",
  snowflake: "/snowflake-ar21.svg",
  databricks: "/azure-databricks.svg",
};

function fmtTs(ts: number | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return (
    d.toLocaleTimeString("en-US", { hour12: false }) +
    " " +
    d.toLocaleDateString("en-US", { month: "short", day: "2-digit" })
  );
}

function truncate(str: string | undefined, n = 60): string {
  if (!str) return "—";
  return str.length > n ? str.slice(0, n) + "…" : str;
}

interface RLHFTableProps {
  entries: RLHFEntry[];
  loading: boolean;
}

import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

export function RLHFTable({ entries, loading }: RLHFTableProps) {
  const [signalFilter, setSignalFilter] = useState<string>("all");

  const filtered =
    signalFilter === "all"
      ? entries
      : entries.filter((e) => e.signal === signalFilter);

  const pos = entries.filter((e) => e.signal === "positive").length;
  const neg = entries.filter((e) => e.signal === "negative").length;

  const columns: ColumnDef<RLHFEntry>[] = [
    {
      accessorKey: "signal",
      header: "Signal",
      cell: ({ row }) => {
        const sig = row.original.signal;
        return (
          <Badge
            variant="outline"
            className={
              sig === "positive"
                ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5 text-[10px] px-1.5 py-0"
                : "text-red-500 border-red-500/20 bg-red-500/5 text-[10px] px-1.5 py-0"
            }
          >
            {sig === "positive" ? "👍" : "👎"} {sig}
          </Badge>
        );
      },
    },
    {
      accessorKey: "dialect",
      header: "Dialect",
      cell: ({ row }) => {
        const dialect = row.original.dialect;
        return dialect ? (
          <div className="flex items-center gap-1.5">
            <img
              src={DIALECT_LOGOS[dialect] || DIALECT_LOGOS.postgresql}
              alt={dialect}
              className="w-3.5 h-3.5 object-contain flex-shrink-0"
            />
            <span className="text-[10px] text-muted-foreground capitalize">{dialect}</span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/30">—</span>
        );
      },
    },
    {
      accessorKey: "interface",
      header: "Interface",
      cell: ({ row }) => {
        const intf = row.original.interface || "dashboard";
        const Icon = intf === "dashboard" ? LayoutDashboard : MessageSquare;
        return (
          <Badge variant="outline" className="text-muted-foreground bg-muted/20 text-[10px] px-1.5 py-0 capitalize flex items-center gap-1 w-fit">
            <Icon className="w-3 h-3 opacity-70" />
            {intf}
          </Badge>
        );
      },
    },
    {
      accessorKey: "question",
      header: "Question",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground max-w-[160px] truncate block">
          {truncate(row.original.question, 35)}
        </span>
      ),
    },
    {
      accessorKey: "sql",
      header: "SQL",
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-muted-foreground max-w-[140px] truncate block">
          {truncate(row.original.sql, 30)}
        </span>
      ),
    },
    {
      accessorKey: "approved",
      header: "Approved",
      cell: ({ row }) => {
        const ok = row.original.approved;
        if (ok === true) {
          return (
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/5 text-[10px] px-1.5 py-0">
              ✓ yes
            </Badge>
          );
        }
        if (ok === false) {
          return (
            <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5 text-[10px] px-1.5 py-0">
              ✗ no
            </Badge>
          );
        }
        return <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: "session_id",
      header: "Session",
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
          {row.original.session_id ? row.original.session_id.slice(0, 12) + "…" : "—"}
        </span>
      ),
    },
    {
      accessorKey: "ts",
      header: "Time",
      cell: ({ row }) => (
        <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
          {fmtTs(row.original.ts)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">RLHF Feedback</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entries.length} signal{entries.length !== 1 ? "s" : ""} collected
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/5 text-[10px] px-2 py-0.5">
              👍 {pos}
            </Badge>
            <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5 text-[10px] px-2 py-0.5">
              👎 {neg}
            </Badge>
          </div>
          <Select value={signalFilter} onValueChange={setSignalFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All signals</SelectItem>
              <SelectItem value="positive" className="text-xs">Positive</SelectItem>
              <SelectItem value="negative" className="text-xs">Negative</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-1">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ThumbsUp className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-xs text-muted-foreground">No feedback signals yet.</p>
          </CardContent>
        </Card>
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </div>
  );
}
