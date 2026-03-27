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
import { Input } from "@/components/ui/input";
import type { ErrorEntry } from "../../../services/types";
import { AlertTriangle, Search } from "lucide-react";

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

interface ErrorsTableProps {
  errors: ErrorEntry[];
  loading: boolean;
  globalSearch?: string;
}

export function ErrorsTable({ errors, loading, globalSearch = "" }: ErrorsTableProps) {
  const [filter, setFilter] = useState("");
  const query = (globalSearch || filter).toLowerCase();

  const filtered = errors.filter(
    (e) =>
      !query ||
      (e.error || "").toLowerCase().includes(query) ||
      (e.error_node || "").toLowerCase().includes(query)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Error Log</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {errors.length} error{errors.length !== 1 ? "s" : ""} recorded
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
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Node", "Type", "Error", "Question", "Session", "Time"].map(
                  (h) => (
                    <TableHead
                      key={h}
                      className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium h-9"
                    >
                      {h}
                    </TableHead>
                  )
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e, i) => (
                <motion.tr
                  key={`${e.session_id}-${e.ts}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-border hover:bg-accent/50 transition-colors"
                >
                  <TableCell className="py-2.5">
                    <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5 text-[10px] px-1.5 py-0">
                      {e.error_node}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-amber-400 py-2.5">
                    {e.error_type}
                  </TableCell>
                  <TableCell className="max-w-[240px] py-2.5">
                    <span className="text-[11px] text-red-400">{truncate(e.error, 50)}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-2.5 max-w-[160px] truncate">
                    {truncate(e.question, 35)}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground py-2.5">
                    {e.session_id ? e.session_id.slice(0, 12) + "…" : "—"}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground font-mono py-2.5 whitespace-nowrap">
                    {fmtTs(e.ts)}
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
