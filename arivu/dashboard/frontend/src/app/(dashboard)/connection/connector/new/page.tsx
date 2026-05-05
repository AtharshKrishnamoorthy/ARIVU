/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, CheckCircle2, Loader2, Play, Save,
  Database, Settings, Zap, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { testConnection, saveConnection, setActiveConnection } from "@services/api";

type Config = {
  alias: string; dialect: string; mode: string;
  host: string; port: string; user: string; password: string; dbname: string;
  account?: string; warehouse?: string; role?: string; schema_name?: string;
  http_path?: string; access_token?: string; catalog?: string;
};

const DIALECTS: { key: string; label: string; logo: string; cloud?: boolean }[] = [
  { key: "postgresql", label: "PostgreSQL",  logo: "/postgresql-logo.svg" },
  { key: "mysql",      label: "MySQL",       logo: "/mysql-logo.svg" },
  { key: "sqlite",     label: "SQLite",      logo: "/sqlite-logo.svg" },
  { key: "snowflake",  label: "Snowflake",   logo: "/snowflake-ar21.svg",   cloud: true },
  { key: "databricks", label: "Databricks",  logo: "/azure-databricks.svg", cloud: true },
];

// Step 1: Choose dialect
// Step 2: Fill details
// Step 3: Test & Activate

const STEPS = [
  { icon: Database,  label: "Choose Type" },
  { icon: Settings,  label: "Configure"   },
  { icon: Zap,       label: "Connect"     },
];

export default function NewConnectionPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<Config>({
    alias: "", dialect: "", mode: "user", host: "localhost", port: "", user: "", password: "", dbname: "",
  });
  const [testing, setTesting]   = useState(false);
  const [testOk, setTestOk]     = useState<boolean | null>(null);
  const [saving, setSaving]     = useState(false);
  const [activating, setActivating] = useState(false);
  const [done, setDone]         = useState(false);

  const isTraditional = config.dialect === "postgresql" || config.dialect === "mysql";

  const set = (k: keyof Config, v: string) => setConfig(p => ({ ...p, [k]: v }));

  const handleTest = async () => {
    setTesting(true); setTestOk(null);
    try {
      await testConnection(config);
      setTestOk(true);
      toast.success("Connection test passed!");
    } catch (e: any) {
      setTestOk(false);
      toast.error("Test failed: " + e.message);
    } finally { setTesting(false); }
  };

  const handleSaveAndActivate = async () => {
    setSaving(true);
    try {
      await saveConnection(config);
      toast.success("Connection saved!");
      setActivating(true);
      await setActiveConnection(config.alias);
      toast.success(`"${config.alias}" is now active.`);
      setDone(true);
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally { setSaving(false); setActivating(false); }
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 15 }}>
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
        </motion.div>
        <h2 className="text-base font-semibold">Connection Active</h2>
        <p className="text-xs text-muted-foreground">&quot;{config.alias}&quot; is now your active database connection.</p>
        <div className="flex gap-2 justify-center pt-2">
          <Button variant="outline" size="sm" className="h-8 text-xs"
            onClick={() => router.push("/connection/connector")}>
            Back to Connections
          </Button>
          <Button size="sm" className="h-8 text-xs"
            onClick={() => router.push("/connection/chat")}>
            Start Chatting <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> {step === 0 ? "Back" : "Previous step"}
      </button>

      {/* Progress steps */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center gap-1.5 ${active ? "text-foreground" : done ? "text-emerald-500" : "text-muted-foreground"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border transition-all
                  ${active ? "bg-primary border-primary text-primary-foreground"
                    : done ? "bg-emerald-500/15 border-emerald-500 text-emerald-500"
                    : "bg-muted border-border"}`}>
                  {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3 h-3" />}
                </div>
                <span className="text-[11px] font-medium hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 transition-colors ${i < step ? "bg-emerald-500" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 0 — Pick dialect */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Choose a database type</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Select the type of database you want to connect to.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {DIALECTS.map(d => (
                  <Card key={d.key}
                    className={`cursor-pointer transition-all hover:shadow-md h-[72px] ${config.dialect === d.key ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/50"}`}
                    onClick={() => { set("dialect", d.key); setConfig(p => ({ ...p, dialect: d.key, port: d.key === "mysql" ? "3306" : d.key === "postgresql" ? "5432" : "" })); }}>
                    <CardContent className="flex items-center gap-3 h-full px-4 py-0">
                      <img src={d.logo} alt={d.label} className="w-7 h-7 object-contain shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">{d.label}</p>
                        {d.cloud && <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 text-blue-400 border-blue-400/30 mt-0.5">Cloud</Badge>}
                      </div>
                      {config.dialect === d.key && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Button className="w-full h-9 text-xs" disabled={!config.dialect}
                onClick={() => setStep(1)}>
                Continue <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 1 — Fill config */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <img src={DIALECTS.find(d => d.key === config.dialect)?.logo} className="w-5 h-5 object-contain" alt={config.dialect} />
                  <h3 className="text-sm font-semibold">{DIALECTS.find(d => d.key === config.dialect)?.label} Configuration</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Fill in the connection details below.</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Connection Name <span className="text-destructive">*</span></Label>
                  <Input value={config.alias} onChange={e => set("alias", e.target.value)}
                    className="h-8 text-xs" placeholder="e.g. Production DB" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Access Mode</Label>
                  <Select value={config.mode} onValueChange={v => set("mode", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User (Read-only)</SelectItem>
                      <SelectItem value="admin">Admin (DML allowed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isTraditional && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Host</Label>
                      <Input value={config.host} onChange={e => set("host", e.target.value)} className="h-8 text-xs" placeholder="localhost" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Port</Label>
                      <Input value={config.port} onChange={e => set("port", e.target.value)} className="h-8 text-xs" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Database</Label>
                      <Input value={config.dbname} onChange={e => set("dbname", e.target.value)} className="h-8 text-xs" placeholder="postgres" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Username</Label>
                      <Input value={config.user} onChange={e => set("user", e.target.value)} className="h-8 text-xs" /></div>
                    <div className="col-span-2 space-y-1.5"><Label className="text-xs text-muted-foreground">Password</Label>
                      <Input type="password" value={config.password} onChange={e => set("password", e.target.value)} className="h-8 text-xs" placeholder="••••••••" /></div>
                  </div>
                )}

                {config.dialect === "sqlite" && (
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Database File Path</Label>
                    <Input value={config.dbname} onChange={e => set("dbname", e.target.value)} className="h-8 text-xs" placeholder="/path/to/db.sqlite3" /></div>
                )}

                {config.dialect === "snowflake" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Account</Label>
                      <Input value={config.account || ""} onChange={e => set("account", e.target.value)} className="h-8 text-xs" placeholder="xy12345.us-east-1" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Warehouse</Label>
                      <Input value={config.warehouse || ""} onChange={e => set("warehouse", e.target.value)} className="h-8 text-xs" placeholder="COMPUTE_WH" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Database</Label>
                      <Input value={config.dbname} onChange={e => set("dbname", e.target.value)} className="h-8 text-xs" placeholder="ANALYTICS" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Role</Label>
                      <Input value={config.role || ""} onChange={e => set("role", e.target.value)} className="h-8 text-xs" placeholder="SYSADMIN" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Username</Label>
                      <Input value={config.user} onChange={e => set("user", e.target.value)} className="h-8 text-xs" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Password</Label>
                      <Input type="password" value={config.password} onChange={e => set("password", e.target.value)} className="h-8 text-xs" placeholder="••••••••" /></div>
                  </div>
                )}

                {config.dialect === "databricks" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Host</Label>
                      <Input value={config.host} onChange={e => set("host", e.target.value)} className="h-8 text-xs" placeholder="adb-123.azuredatabricks.net" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">HTTP Path</Label>
                      <Input value={config.http_path || ""} onChange={e => set("http_path", e.target.value)} className="h-8 text-xs" placeholder="/sql/1.0/endpoints/abc123" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Access Token</Label>
                      <Input type="password" value={config.access_token || ""} onChange={e => set("access_token", e.target.value)} className="h-8 text-xs" placeholder="dapi..." /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Catalog</Label>
                        <Input value={config.catalog || ""} onChange={e => set("catalog", e.target.value)} className="h-8 text-xs" placeholder="main" /></div>
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Schema</Label>
                        <Input value={config.schema_name || ""} onChange={e => set("schema_name", e.target.value)} className="h-8 text-xs" placeholder="default" /></div>
                    </div>
                  </div>
                )}
              </div>

              <Button className="w-full h-9 text-xs" disabled={!config.alias}
                onClick={() => setStep(2)}>
                Continue <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 2 — Test & Activate */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Test &amp; Activate</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Test your connection first, then save and activate it.</p>
              </div>

              {/* Summary card */}
              <Card className="bg-muted/40 border-border">
                <CardContent className="pt-4 pb-4 space-y-1.5">
                  <div className="flex items-center gap-2 mb-2">
                    <img src={DIALECTS.find(d => d.key === config.dialect)?.logo} className="w-5 h-5 object-contain" alt="" />
                    <span className="text-sm font-semibold">{config.alias}</span>
                  </div>
                  {[
                    ["Type", DIALECTS.find(d => d.key === config.dialect)?.label || config.dialect],
                    ["Mode", config.mode === "admin" ? "Admin (DML)" : "User (Read-only)"],
                    ...(config.host ? [["Host", config.host]] : []),
                    ...(config.dbname ? [["Database", config.dbname]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-muted-foreground w-20 shrink-0">{k}</span>
                      <span className="font-mono">{v}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Test result */}
              <AnimatePresence>
                {testOk === true && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-md">
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> Connection successful!
                  </motion.div>
                )}
                {testOk === false && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-md">
                    Connection failed. Please check your credentials and try again.
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Animated progress when activating */}
              {(saving || activating) && (
                <div className="space-y-2">
                  {[
                    { label: "Saving configuration", done: true },
                    { label: "Initialising connection", done: activating },
                    { label: "Setting as active", done: false },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {item.done
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        : <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />}
                      <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-9 text-xs flex-1 gap-1.5"
                  onClick={handleTest} disabled={testing || saving}>
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Test Connection
                </Button>
                <Button size="sm" className="h-9 text-xs flex-1 gap-1.5"
                  onClick={handleSaveAndActivate} disabled={saving || testing}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save &amp; Activate
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
