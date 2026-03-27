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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import type { Session } from "../../../services/types";
import { Database, Search } from "lucide-react";

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
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Session ID", "Queries", "Errors", "Last Question", "Last Active"].map(
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
              {filtered.map((s, i) => (
                <motion.tr
                  key={s.session_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => onSelect(s.session_id)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground py-2.5">
                    {s.session_id.slice(0, 20)}…
                  </TableCell>
                  <TableCell className="text-xs font-medium py-2.5">
                    {s.query_count}
                  </TableCell>
                  <TableCell className="py-2.5">
                    {s.error_count > 0 ? (
                      <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5 text-[10px] px-1.5 py-0">
                        {s.error_count}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate py-2.5">
                    {s.last_question || "—"}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground font-mono py-2.5 whitespace-nowrap">
                    {fmtTs(s.last_ts)}
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
