"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table as TableIcon, Loader2, AlertCircle, LayoutList, Database, Search,
  Hash, Type, Calendar, Hash as HashIcon, Globe, Key, FileText, Clock,
  CheckCircle2, XCircle, AlertCircle as AlertIcon, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useDB } from "../../../db-context";
import { API_BASE } from "@services/api";

interface SchemaColumn { name: string; type: string; }
interface TableDef { name: string; columns: SchemaColumn[]; }
interface PreviewData { columns: string[]; rows: Record<string, any>[]; }

/* ── Color-coded data type badges ── */
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  /* Text types */
  text:       { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", icon: Type },
  varchar:    { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", icon: Type },
  char:       { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", icon: Type },
  string:     { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", icon: Type },
  /* Numeric types */
  integer:    { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", icon: Hash },
  int:        { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", icon: Hash },
  bigint:     { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", icon: Hash },
  smallint:   { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", icon: Hash },
  float:      { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", icon: Hash },
  double:     { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", icon: Hash },
  decimal:    { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", icon: Hash },
  numeric:    { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", icon: Hash },
  real:       { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", icon: Hash },
  /* Date/Time types */
  timestamp:  { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", icon: Clock },
  date:       { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", icon: Calendar },
  datetime:   { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", icon: Clock },
  time:       { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", icon: Clock },
  /* Boolean */
  boolean:    { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", icon: CheckCircle2 },
  bool:       { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", icon: CheckCircle2 },
  /* UUID / Key types */
  uuid:       { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", icon: Key },
  /* JSON / Binary */
  json:       { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", icon: FileText },
  jsonb:      { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", icon: FileText },
  blob:       { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", icon: FileText },
  bytea:      { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", icon: FileText },
  /* Array */
  array:      { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20", icon: HashIcon },
  /* Default fallback */
};

function getTypeStyle(type: string) {
  const normalized = type.toLowerCase().replace(/\(\d+\)/g, "").trim();
  return TYPE_COLORS[normalized] || { bg: "bg-muted/50", text: "text-muted-foreground", border: "border-border", icon: Info };
}

function TypeBadge({ type }: { type: string }) {
  const style = getTypeStyle(type);
  const Icon = style.icon;
  return (
    <Badge variant="outline" className={`${style.bg} ${style.text} ${style.border} font-mono text-[10px] uppercase tracking-wider gap-1`}>
      <Icon className="h-3 w-3" />
      {type}
    </Badge>
  );
}

export default function DBExplorerPage() {
  const { alias } = useDB();
  const [schema, setSchema] = useState<TableDef[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState("");
  const [mobilePane, setMobilePane] = useState<"tables" | "details">("tables");

  useEffect(() => {
    if (!alias) return;
    setSchemaLoading(true);
    setActiveTable(null);
    setError(null);
    fetch(`${API_BASE}/api/explorer/schema?alias=${encodeURIComponent(alias)}`)
      .then(res => { if (!res.ok) throw new Error("Failed to fetch schema"); return res.json(); })
      .then(data => {
        setSchema(data.tables || []);
        if (data.tables?.length) setActiveTable(data.tables[0].name);
      })
      .catch(err => setError(err.message))
      .finally(() => setSchemaLoading(false));
  }, [alias]);

  useEffect(() => {
    if (!alias || !activeTable) { setPreviewData(null); return; }
    setPreviewLoading(true);
    fetch(`${API_BASE}/api/explorer/preview/${activeTable}?alias=${encodeURIComponent(alias)}`)
      .then(res => { if (!res.ok) throw new Error("Failed to fetch preview"); return res.json(); })
      .then(data => setPreviewData(data))
      .catch(err => console.error("Preview fetch failed", err))
      .finally(() => setPreviewLoading(false));
  }, [alias, activeTable]);

  const currentTableDef = schema.find(t => t.name === activeTable);

  const filteredTables = schema.filter(t =>
    t.name.toLowerCase().includes(tableFilter.toLowerCase())
  );

  /* ── Schema columns with colored type badges ── */
  const schemaColumns = useMemo<ColumnDef<SchemaColumn>[]>(() => [
    {
      accessorKey: "name",
      header: "Column Name",
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium text-foreground">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "type",
      header: "Data Type",
      enableSorting: true,
      cell: ({ row }) => <TypeBadge type={row.original.type} />,
    },
  ], []);

  /* ── Data preview columns — NO truncation, full horizontal scroll ── */
  const dataColumns = useMemo<ColumnDef<Record<string, any>>[]>(() => {
    if (!previewData) return [];
    return previewData.columns.map(col => ({
      accessorKey: col,
      header: col.toUpperCase(),
      enableSorting: true,
      cell: ({ row }: { row: { original: Record<string, any> } }) => {
        const val = row.original[col];
        const display = val === null || val === undefined ? "NULL" : String(val);
        return (
          <span className="text-xs text-foreground whitespace-nowrap" title={display}>
            {display}
          </span>
        );
      },
    }));
  }, [previewData]);

  const handleTableSelect = (name: string) => {
    setActiveTable(name);
    setMobilePane("details");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-border bg-card/30">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground truncate">
            Browsing <span className="font-medium text-foreground">{alias}</span>
          </p>
        </div>
      </div>

      {/* Two-Pane View */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Tables list */}
        <div className={`${mobilePane === "tables" ? "flex" : "hidden"} md:flex flex-col w-full md:w-64 lg:w-72 shrink-0 border-r border-border bg-card/20`}>
          <div className="px-3 py-3 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <LayoutList className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Tables</span>
              {schema.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">{schema.length}</Badge>
              )}
            </div>
            {!schemaLoading && schema.length > 3 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter tables..."
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background/50 border-border/50"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            {schemaLoading ? (
              <div className="p-2 space-y-1">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <AlertCircle className="h-8 w-8 text-destructive/50 mb-2" />
                <p className="text-xs text-destructive font-medium">{error}</p>
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                {schema.length === 0 ? "No tables found." : "No tables match."}
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-2 space-y-0.5">
                  {filteredTables.map(table => (
                    <button
                      key={table.name}
                      onClick={() => handleTableSelect(table.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                        activeTable === table.name
                          ? "bg-primary text-primary-foreground font-medium shadow-sm"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      }`}
                    >
                      <span className="truncate font-mono">{table.name}</span>
                      <span className={`text-[10px] shrink-0 ml-2 ${
                        activeTable === table.name ? "text-primary-foreground/60" : "text-muted-foreground/40"
                      }`}>
                        {table.columns.length} cols
                      </span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Right: Details */}
        <div className={`${mobilePane === "details" ? "flex" : "hidden"} md:flex flex-1 flex-col min-w-0`}>
          {activeTable ? (
            <>
              {/* Mobile back button */}
              <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20">
                <button onClick={() => setMobilePane("tables")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <LayoutList className="h-3.5 w-3.5" /> Tables
                </button>
              </div>

              {/* Table header + tabs */}
              <Tabs defaultValue="schema" className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <TableIcon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm font-mono truncate">{activeTable}</span>
                  </div>
                  <TabsList className="h-8 bg-muted/50">
                    <TabsTrigger value="schema" className="text-xs px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Schema</TabsTrigger>
                    <TabsTrigger value="data" className="text-xs px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Data Preview</TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab content */}
                <TabsContent value="schema" className="flex-1 m-0 data-[state=active]:flex flex-col">
                  <div className="flex-1 overflow-auto p-4">
                    {currentTableDef?.columns ? (
                      <DataTable columns={schemaColumns} data={currentTableDef.columns} scrollable maxHeight="calc(100vh - 240px)" />
                    ) : (
                      <div className="p-4 space-y-2">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="data" className="flex-1 m-0 data-[state=active]:flex flex-col">
                  {previewLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-xs">Loading data…</span>
                      </div>
                    </div>
                  ) : previewData ? (
                    <div className="flex-1 overflow-auto p-4">
                      {previewData.rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                          <TableIcon className="h-10 w-10 mb-3 opacity-20" />
                          <p className="text-sm">Table is empty.</p>
                        </div>
                      ) : (
                        <DataTable columns={dataColumns} data={previewData.rows} scrollable maxHeight="calc(100vh - 240px)" />
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
                      Failed to load preview data.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <TableIcon className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">Select a table to view its schema and data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
