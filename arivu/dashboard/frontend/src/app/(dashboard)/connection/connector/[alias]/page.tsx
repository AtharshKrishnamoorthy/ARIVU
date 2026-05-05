/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft, CheckCircle2, XCircle, Loader2, LogIn,
  Trash2, Play, Save, Edit2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { fetchConnections, testConnection, saveConnection, setActiveConnection, deleteConnection } from "@services/api";

const DIALECT_LOGOS: Record<string, string> = {
  postgresql: "/postgresql-logo.svg", mysql: "/mysql-logo.svg", sqlite: "/sqlite-logo.svg",
  snowflake: "/snowflake-ar21.svg",   databricks: "/azure-databricks.svg",
};
const DIALECT_LABELS: Record<string, string> = {
  postgresql: "PostgreSQL", mysql: "MySQL", sqlite: "SQLite",
  snowflake: "Snowflake", databricks: "Databricks",
};

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <span className={`text-xs ${mono ? "font-mono text-muted-foreground" : "font-medium"} break-all`}>{value || "—"}</span>
    </div>
  );
}

export default function ConnectionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const alias  = decodeURIComponent(params.alias as string);

  const [conn, setConn]         = useState<any>(null);
  const [activeAlias, setActiveAlias] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [editConfig, setEditConfig] = useState<any>({});

  const [testing, setTesting]   = useState(false);
  const [testOk, setTestOk]     = useState<boolean | null>(null);
  const [activating, setActivating] = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    fetchConnections().then(res => {
      if (res) {
        const found = (res.connections || []).find((c: any) => c.alias === alias);
        setConn(found || null);
        setEditConfig(found || {});
        setActiveAlias(res.active_alias ?? null);
      }
      setLoading(false);
    });
  }, [alias]);

  const isActive = activeAlias === alias;
  const set = (k: string, v: string) => setEditConfig((p: any) => ({ ...p, [k]: v }));

  const handleTest = async () => {
    setTesting(true); setTestOk(null);
    try { await testConnection(editing ? editConfig : conn); setTestOk(true); toast.success("Test passed!"); }
    catch (e: any) { setTestOk(false); toast.error("Test failed: " + e.message); }
    finally { setTesting(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConnection(editConfig);
      setConn(editConfig); setEditing(false);
      toast.success("Connection updated.");
    } catch (e: any) { toast.error("Save failed: " + e.message); }
    finally { setSaving(false); }
  };

  const handleActivate = async () => {
    setActivating(true);
    try { await setActiveConnection(alias); setActiveAlias(alias); toast.success(`"${alias}" activated.`); }
    catch (e: any) { toast.error("Activation failed: " + e.message); }
    finally { setActivating(false); }
  };

  const handleDelete = async () => {
    try { await deleteConnection(alias); toast.success(`Deleted "${alias}"`); router.push("/connection/connector"); }
    catch (e: any) { toast.error("Delete failed: " + e.message); }
  };

  if (loading) return <div className="text-xs text-muted-foreground p-4">Loading...</div>;
  if (!conn) return <div className="text-xs text-muted-foreground p-4">Connection not found.</div>;

  const logo = DIALECT_LOGOS[conn.dialect] || DIALECT_LOGOS.postgresql;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      {/* Back */}
      <button onClick={() => router.push("/connection/connector")}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> All Connections
      </button>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt={conn.dialect} className="w-10 h-10 object-contain" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold">{conn.alias}</h2>
              {isActive
                ? <Badge className="h-4 px-1.5 text-[10px] bg-emerald-500/15 text-emerald-500 border-emerald-500/30 border">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Active
                  </Badge>
                : <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground">
                    <XCircle className="w-2.5 h-2.5 mr-0.5" /> Inactive
                  </Badge>
              }
              {(conn.dialect === "snowflake" || conn.dialect === "databricks") && (
                <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-blue-400 border-blue-400/30">Cloud</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{DIALECT_LABELS[conn.dialect] || conn.dialect}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
            onClick={() => { setEditing(e => !e); setEditConfig(conn); setTestOk(null); }}>
            {editing ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &quot;{alias}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove this connection. You cannot undo this.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </motion.div>

      <Separator />

      {/* Details / Edit */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {editing ? "Edit Configuration" : "Connection Details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Access Mode</Label>
                <Select value={editConfig.mode || "user"} onValueChange={v => set("mode", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User (Read-only)</SelectItem>
                    <SelectItem value="admin">Admin (DML allowed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editConfig.host !== undefined && (
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Host</Label>
                  <Input value={editConfig.host || ""} onChange={e => set("host", e.target.value)} className="h-8 text-xs" /></div>
              )}
              {editConfig.port !== undefined && (
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Port</Label>
                  <Input value={editConfig.port || ""} onChange={e => set("port", e.target.value)} className="h-8 text-xs" /></div>
              )}
              {editConfig.user !== undefined && (
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Username</Label>
                  <Input value={editConfig.user || ""} onChange={e => set("user", e.target.value)} className="h-8 text-xs" /></div>
              )}
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Password</Label>
                <Input type="password" value={editConfig.password || ""} onChange={e => set("password", e.target.value)} className="h-8 text-xs" placeholder="••••••••" /></div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <DetailRow label="Dialect" value={DIALECT_LABELS[conn.dialect] || conn.dialect} />
              <DetailRow label="Mode" value={conn.mode === "admin" ? "Admin (DML)" : "User (Read-only)"} />
              {conn.host     && <DetailRow label="Host"     value={conn.host}     mono />}
              {conn.port     && <DetailRow label="Port"     value={conn.port}     mono />}
              {conn.dbname   && <DetailRow label="Database" value={conn.dbname}   mono />}
              {conn.user     && <DetailRow label="Username" value={conn.user}     mono />}
              {conn.account  && <DetailRow label="Account"  value={conn.account}  mono />}
              {conn.warehouse && <DetailRow label="Warehouse" value={conn.warehouse} mono />}
              {conn.role     && <DetailRow label="Role"     value={conn.role}     mono />}
              {conn.http_path && <DetailRow label="HTTP Path" value={conn.http_path} mono />}
              {conn.catalog  && <DetailRow label="Catalog"  value={conn.catalog}  mono />}
              {conn.schema_name && <DetailRow label="Schema" value={conn.schema_name} mono />}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-9 flex-1 text-xs gap-1.5"
          onClick={handleTest} disabled={testing || activating}>
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Test
        </Button>
        {!isActive && (
          <Button size="sm" className="h-9 flex-1 text-xs gap-1.5"
            onClick={handleActivate} disabled={activating || testing}>
            {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
            Activate
          </Button>
        )}
      </div>

      {/* Test result */}
      {testOk === true && (
        <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-md">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Connection is healthy.
        </div>
      )}
      {testOk === false && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-md">
          Connection failed. Please check your credentials.
        </div>
      )}
    </div>
  );
}
