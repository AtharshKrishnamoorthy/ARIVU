"use client";

import { useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Session } from "../../../services/types";
import { Search, Eye, LayoutDashboard, MessageSquare, Database } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

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

interface SessionsTableProps {
  sessions: Session[];
  loading: boolean;
  onSelect: (sid: string) => void;
  globalSearch?: string;
}

export function SessionsTable({ sessions, loading, onSelect, globalSearch = "" }: SessionsTableProps) {
  const [filter, setFilter] = useState("");
  const query = (globalSearch || filter).toLowerCase();

  const filtered = sessions.filter(
    (s) =>
      !query ||
      s.session_id.toLowerCase().includes(query) ||
      (s.last_question || "").toLowerCase().includes(query)
  );

  const columns = useMemo<ColumnDef<Session>[]>(() => [
    {
      accessorKey: "session_id",
      header: "Session ID",
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {row.original.session_id.slice(0, 10)}…
        </span>
      ),
    },
    {
      accessorKey: "dialect",
      header: "Dialect",
      meta: { className: "hidden md:table-cell" },
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
      meta: { className: "hidden lg:table-cell" },
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
      accessorKey: "query_count",
      header: "Queries",
      cell: ({ row }) => <span className="text-xs font-medium">{row.original.query_count}</span>,
    },
    {
      accessorKey: "error_count",
      header: "Errors",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => {
        const errors = row.original.error_count;
        return errors > 0 ? (
          <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5 text-[10px] px-1.5 py-0">
            {errors}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">0</span>
        );
      },
    },
    {
      accessorKey: "last_question",
      header: "Last Question",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground max-w-[150px] truncate block">
          {row.original.last_question || "—"}
        </span>
      ),
    },
    {
      accessorKey: "last_ts",
      header: "Last Active",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => (
        <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
          {fmtTs(row.original.last_ts)}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={(ev) => {
            ev.stopPropagation();
            onSelect(row.original.session_id);
          }}
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ], [onSelect]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Sessions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        {!globalSearch && (
          <div className="relative w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter sessions…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8 h-8 text-xs bg-card border-border"
            />
          </div>
        )}
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
            <Database className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-xs text-muted-foreground">No sessions found.</p>
          </CardContent>
        </Card>
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </div>
  );
}
