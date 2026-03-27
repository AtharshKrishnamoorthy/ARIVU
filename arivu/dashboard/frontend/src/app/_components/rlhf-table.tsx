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
import { ThumbsUp } from "lucide-react";

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

export function RLHFTable({ entries, loading }: RLHFTableProps) {
  const [signalFilter, setSignalFilter] = useState<string>("all");

  const filtered =
    signalFilter === "all"
      ? entries
      : entries.filter((e) => e.signal === signalFilter);

  const pos = entries.filter((e) => e.signal === "positive").length;
  const neg = entries.filter((e) => e.signal === "negative").length;

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
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Signal", "Question", "SQL", "Approved", "Session", "Time"].map(
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
                    <Badge
                      variant="outline"
                      className={
                        e.signal === "positive"
                          ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5 text-[10px] px-1.5 py-0"
                          : "text-red-500 border-red-500/20 bg-red-500/5 text-[10px] px-1.5 py-0"
                      }
                    >
                      {e.signal === "positive" ? "👍" : "👎"} {e.signal}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-2.5 max-w-[160px] truncate">
                    {truncate(e.question, 35)}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground py-2.5 max-w-[140px] truncate">
                    {truncate(e.sql, 30)}
                  </TableCell>
                  <TableCell className="py-2.5">
                    {e.approved === true ? (
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/5 text-[10px] px-1.5 py-0">
                        ✓ yes
                      </Badge>
                    ) : e.approved === false ? (
                      <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5 text-[10px] px-1.5 py-0">
                        ✗ no
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
