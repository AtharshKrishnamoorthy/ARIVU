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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Separator } from "@/components/ui/separator";
import type { ErrorEntry } from "../../../services/types";
import { AlertTriangle, Search, Eye, Database, Terminal, Clock, Hash, LayoutDashboard, MessageSquare } from "lucide-react";
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
    "  " +
    d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
  );
}

function truncate(str: string | undefined, n = 60): string {
  if (!str) return "—";
  return str.length > n ? str.slice(0, n) + "…" : str;
}

interface ErrorsTableProps {
  errors: ErrorEntry[];
  loading: boolean;
  globalSearch?: string;
}

/* ── tiny reusable label ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium mb-2">
      {children}
    </p>
  );
}

/* ── monospace block for SQL ── */
function SqlBlock({ sql }: { sql: string }) {
  return (
    <div className="relative group">
      <pre className="bg-[#0d1117] dark:bg-[#0d1117] border border-border rounded-lg px-4 py-3 font-mono text-[11.5px] text-teal-400 whitespace-pre-wrap break-all leading-relaxed overflow-x-auto">
        {sql}
      </pre>
    </div>
  );
}

export function ErrorsTable({ errors, loading, globalSearch = "" }: ErrorsTableProps) {
  const [filter, setFilter] = useState("");
  const [detailError, setDetailError] = useState<ErrorEntry | null>(null);

  const query = (globalSearch || filter).toLowerCase();

  const filtered = errors.filter(
    (e) =>
      !query ||
      (e.error_node || "").toLowerCase().includes(query) ||
      (e.error_type || "").toLowerCase().includes(query) ||
      (e.error || "").toLowerCase().includes(query)
  );

  const columns = useMemo<ColumnDef<ErrorEntry>[]>(() => [
    {
      accessorKey: "error_node",
      header: "Node",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-red-400 border-red-500/20 bg-red-500/5 text-[10px] px-1.5 py-0 whitespace-nowrap">
          {row.original.error_node}
        </Badge>
      ),
    },
    {
      accessorKey: "error_type",
      header: "Type",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-amber-400 whitespace-nowrap">
          {row.original.error_type || "—"}
        </span>
      ),
    },
    {
      accessorKey: "error",
      header: "Error",
      cell: ({ row }) => (
        <div className="max-w-[220px]">
          <span className="text-[11px] text-red-400/90 line-clamp-1">{truncate(row.original.error, 45)}</span>
        </div>
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
      accessorKey: "question",
      header: "Question",
      meta: { className: "hidden lg:table-cell" },
      cell: ({ row }) => (
        <div className="max-w-[150px]">
          <span className="text-xs text-muted-foreground line-clamp-1">{truncate(row.original.question, 32)}</span>
        </div>
      ),
    },
    {
      accessorKey: "session_id",
      header: "Session",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
          {row.original.session_id ? row.original.session_id.slice(0, 10) + "…" : "—"}
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
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-accent -mr-2"
          onClick={(ev) => {
            ev.stopPropagation();
            setDetailError(row.original);
          }}
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ], []);

  const isDesktop = useMediaQuery("(min-width: 768px)");

  const detailHeaderContent = detailError && (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline" className="text-red-400 border-red-500/25 bg-red-500/8 text-[10px] px-2 py-0.5">
          {detailError.error_node || "unknown"}
        </Badge>
        <span className="text-[10px] text-muted-foreground/50">·</span>
        <span className="font-mono text-[10px] text-amber-400">{detailError.error_type || "Unknown"}</span>
      </div>
      {isDesktop ? (
        <SheetTitle className="text-base font-semibold text-foreground leading-snug">
          Error Details
        </SheetTitle>
      ) : (
        <DrawerTitle className="text-base font-semibold text-foreground leading-snug mt-2">
          Error Details
        </DrawerTitle>
      )}
    </>
  );

  const detailMainContent = detailError && (
    <div className="px-6 py-5 space-y-6">
      {/* Error message */}
      <section>
        <SectionLabel>Error Message</SectionLabel>
        <div className="border border-red-500/20 bg-red-500/5 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400 leading-relaxed break-words">{detailError.error || "No error message."}</p>
        </div>
      </section>

      <Separator className="bg-border" />

      {/* Connection section */}
      <section>
        <SectionLabel>
          <Database className="w-3 h-3 inline-block mr-1 -mt-0.5" />
          Connection
        </SectionLabel>
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
            {detailError.dialect ? (
              <img
                src={DIALECT_LOGOS[detailError.dialect] || DIALECT_LOGOS.postgresql}
                alt={detailError.dialect}
                className="w-5 h-5 object-contain flex-shrink-0"
              />
            ) : (
              <Database className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium capitalize">
                {detailError.dialect || "Unknown"}
              </span>
            </div>
            {detailError.connection_meta?.mode && (
              <Badge variant="outline" className="text-[9px] px-2 py-0.5 h-5 capitalize flex-shrink-0">
                {detailError.connection_meta.mode}
              </Badge>
            )}
          </div>
          {detailError.connection_meta?.display ? (
            <div className="px-4 py-2.5">
              <p className="font-mono text-[11px] text-muted-foreground break-all leading-relaxed">
                {detailError.connection_meta.display}
              </p>
            </div>
          ) : (
            <div className="px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground/40 italic">
                No connection metadata — this trace predates v0.2.0.
              </p>
            </div>
          )}
        </div>
      </section>

      <Separator className="bg-border" />

      {/* Query context */}
      <section>
        <SectionLabel>
          <Terminal className="w-3 h-3 inline-block mr-1 -mt-0.5" />
          Query Context
        </SectionLabel>
        <div className="space-y-3">
          {/* Question */}
          <div>
            <p className="text-[10px] text-muted-foreground/60 mb-1.5">Question</p>
            <div className="bg-muted/60 border border-border/60 rounded-lg px-4 py-3">
              <p className="text-sm text-foreground leading-relaxed break-words">
                {detailError.question || "—"}
              </p>
            </div>
          </div>
          {/* SQL */}
          {detailError.sql && (
            <div>
              <p className="text-[10px] text-muted-foreground/60 mb-1.5">Generated SQL</p>
              <SqlBlock sql={detailError.sql} />
            </div>
          )}
        </div>
      </section>

      <Separator className="bg-border" />

      {/* Meta */}
      <section>
        <SectionLabel>
          <Hash className="w-3 h-3 inline-block mr-1 -mt-0.5" />
          Trace Metadata
        </SectionLabel>
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-start gap-3 bg-muted/40 rounded-lg px-4 py-3">
            <Hash className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground/60 mb-0.5">Session ID</p>
              <p className="font-mono text-[11.5px] text-muted-foreground break-all">
                {detailError.session_id || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-muted/40 rounded-lg px-4 py-3">
            <Clock className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground/60 mb-0.5">Timestamp</p>
              <p className="font-mono text-[11.5px] text-muted-foreground">{fmtTs(detailError.ts)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <>
      {/* ─── Table ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              Error Log <Badge variant="secondary" className="bg-red-500/10 text-red-500 font-mono text-[10px] py-0 px-1.5 leading-tight h-5">Live</Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {errors.length} error{errors.length !== 1 ? "s" : ""} recorded in total
            </p>
          </div>
          {!globalSearch && (
            <div className="relative w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter errors…"
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
              <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-xs text-muted-foreground">
                {errors.length === 0
                  ? "No errors recorded. Everything is running clean."
                  : "No errors match your filter."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <DataTable columns={columns} data={filtered} />
        )}
      </div>

      {/* ─── Error Details Sheet / Drawer ─── */}
      {isDesktop ? (
        <Sheet open={!!detailError} onOpenChange={(v) => !v && setDetailError(null)}>
          <SheetContent
            className="w-full sm:w-[640px] sm:max-w-[640px] lg:w-[720px] lg:max-w-[720px] bg-background border-l border-border overflow-y-auto p-0"
            style={{ maxWidth: "min(720px, 92vw)" }}
          >
            {detailError && (
              <>
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 pt-6 pb-4">
                  <SheetHeader className="text-left">{detailHeaderContent}</SheetHeader>
                </div>
                {detailMainContent}
              </>
            )}
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer open={!!detailError} onOpenChange={(v) => !v && setDetailError(null)}>
          <DrawerContent className="bg-background border-border max-h-[85vh] rounded-t-[1.5rem] flex flex-col overflow-hidden">
            {detailError && (
              <>
                <div className="sticky top-0 z-10 bg-background border-b border-border px-6 pt-4 pb-4 shrink-0">
                  <DrawerHeader className="p-0 text-left">{detailHeaderContent}</DrawerHeader>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {detailMainContent}
                </div>
              </>
            )}
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
