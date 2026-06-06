"use client";

import { useState, useEffect } from "react";
import {
  BarChart3, LineChart, PieChart, AreaChart, Loader2, Table as TableIcon, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  fetchExplorerSchema, fetchExplorerQuery, addDashboardWidget,
} from "@services/api";
import { useDB } from "../../../../db-context";

const CHART_TYPES = [
  { value: "bar",  label: "Bar Chart",  icon: BarChart3 },
  { value: "line", label: "Line Chart", icon: LineChart },
  { value: "area", label: "Area Chart", icon: AreaChart },
  { value: "pie",  label: "Pie Chart",  icon: PieChart },
] as const;

const AGGREGATES = [
  { value: "none",  label: "Raw values" },
  { value: "sum",   label: "SUM" },
  { value: "avg",   label: "AVG" },
  { value: "count", label: "COUNT" },
  { value: "min",   label: "MIN" },
  { value: "max",   label: "MAX" },
] as const;

interface Props {
  dashboardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWidgetAdded: () => void;
}

interface TableDef { name: string; columns: { name: string; type: string }[] }

const isNumericType = (type: string) => {
  if (!type) return false;
  const t = type.toLowerCase();
  return t.includes("int") || t.includes("float") || t.includes("double") || t.includes("real") || t.includes("numeric") || t.includes("decimal");
};

export default function BuildWidgetDialog({ dashboardId, open, onOpenChange, onWidgetAdded }: Props) {
  const { alias } = useDB();
  const [tables, setTables] = useState<TableDef[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [xCol, setXCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [chartType, setChartType] = useState("bar");
  const [aggregate, setAggregate] = useState("none");
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load schema when dialog opens
  useEffect(() => {
    if (!open || !alias) return;
    setSchemaLoading(true);
    setSelectedTable("");
    setXCol("");
    setYCol("");
    setError(null);
    fetchExplorerSchema(alias)
      .then(data => {
        setTables(data?.tables || []);
        if (data?.tables?.length) setSelectedTable(data.tables[0].name);
      })
      .catch(err => setError(err.message))
      .finally(() => setSchemaLoading(false));
  }, [open, alias]);

  // Reset columns when table changes
  useEffect(() => {
    setXCol("");
    setYCol("");
    setAggregate("none");
  }, [selectedTable]);

  const currentTableCols = tables.find(t => t.name === selectedTable)?.columns || [];
  const yColDef = currentTableCols.find(c => c.name === yCol);
  const isYNumeric = yColDef ? isNumericType(yColDef.type) : false;

  // Auto-correct aggregate if non-numeric column is selected
  useEffect(() => {
    if (yColDef && !isYNumeric && (aggregate === "sum" || aggregate === "avg")) {
      setAggregate("count");
    }
  }, [yColDef, isYNumeric, aggregate]);

  const canSubmit = alias && selectedTable && xCol && yCol && chartType;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const agg = aggregate !== "none" ? aggregate : undefined;
      const queryResult = await fetchExplorerQuery({
        alias,
        table: selectedTable,
        columns: [xCol, yCol],
        limit: 500,
        aggregate: agg,
      });

      if (!queryResult || !queryResult.rows.length) {
        setError("Query returned no data.");
        setSubmitting(false);
        return;
      }

      // Build the C1 component string
      const keyProp = chartType === "pie" ? "nameKey" : "xKey";
      const valProp = chartType === "pie" ? "valueKey" : "yKey";
      const tagMap: Record<string, string> = {
        bar: "BarChart", line: "LineChart", area: "AreaChart", pie: "PieChart",
      };
      const tag = tagMap[chartType] || "BarChart";
      const c1_html = `<${tag} data={data} ${keyProp}="${xCol}" ${valProp}="${yCol}" />`;

      const aggLabel = agg ? ` (${agg.toUpperCase()})` : "";
      const title = `${yCol}${aggLabel} by ${xCol}`;

      await addDashboardWidget(dashboardId, {
        title,
        query: title,
        sql: `SELECT ${xCol}, ${agg ? `${agg}(${yCol})` : yCol} FROM ${selectedTable}${agg ? ` GROUP BY ${xCol}` : ""} LIMIT 500`,
        data: queryResult.rows,
        c1_html,
      });

      onWidgetAdded();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to create widget.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Build Widget
          </DialogTitle>
          <DialogDescription>
            Select a table, pick columns, and choose a chart type to create a widget.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-primary/5 text-primary text-xs p-3 rounded-md border border-primary/10 flex gap-2 items-start mt-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5 opacity-80" />
          <p className="leading-relaxed opacity-90">
            <strong>Single-Table Builder:</strong> This tool is for simple 1-table rollups. 
            For complex metrics spanning multiple tables, ask the AI in the <strong>Chat</strong> tab and click <em>"Pin to Dashboard"</em>.
          </p>
        </div>

        <div className="space-y-4 py-2">
          {/* Table Selection */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <TableIcon className="h-3.5 w-3.5" /> Table
            </Label>
            {schemaLoading ? (
              <div className="h-9 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger><SelectValue placeholder="Select table" /></SelectTrigger>
                <SelectContent>
                  {tables.map(t => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name} <span className="text-muted-foreground text-xs ml-1">({t.columns.length})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Column Selection */}
          {currentTableCols.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">X-Axis / Category</Label>
                <Select value={xCol} onValueChange={setXCol}>
                  <SelectTrigger><SelectValue placeholder="Pick column" /></SelectTrigger>
                  <SelectContent>
                    {currentTableCols.map(c => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name} <Badge variant="outline" className="ml-1 text-[9px]">{c.type}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Y-Axis / Value</Label>
                <Select value={yCol} onValueChange={setYCol}>
                  <SelectTrigger><SelectValue placeholder="Pick column" /></SelectTrigger>
                  <SelectContent>
                    {currentTableCols.map(c => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name} <Badge variant="outline" className="ml-1 text-[9px]">{c.type}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Chart Type & Aggregate */}
          {xCol && yCol && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Chart Type</Label>
                <Select value={chartType} onValueChange={setChartType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHART_TYPES.map(ct => {
                      const Icon = ct.icon;
                      return (
                        <SelectItem key={ct.value} value={ct.value}>
                          <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {ct.label}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Aggregation</Label>
                <Select value={aggregate} onValueChange={setAggregate}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGGREGATES.map(a => {
                      const disabled = (a.value === "sum" || a.value === "avg") && yColDef && !isYNumeric;
                      return (
                        <SelectItem key={a.value} value={a.value} disabled={disabled || false}>
                          {a.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            Add Widget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
