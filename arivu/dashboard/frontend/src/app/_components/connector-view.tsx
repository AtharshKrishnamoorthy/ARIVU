"use client";

import { useEffect, useState } from "react";
import { Database, Save, Loader2, CheckCircle2, Play, LogIn, Server, HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fetchConnections, saveConnection, testConnection, setActiveConnection } from "../../../services/api";

type ConnectionConfig = {
  alias: string;
  dialect: string;
  mode: string;
  host: string;
  port: string;
  user: string;
  password?: string;
  dbname: string;
};

export function ConnectorView() {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [activeAlias, setActiveAlias] = useState<string | null>(null);

  const [config, setConfig] = useState<ConnectionConfig>({
    alias: "", dialect: "postgresql", mode: "user", host: "localhost", port: "5432", user: "postgres", password: "", dbname: "postgres",
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [status, setStatus] = useState<{type: "idle" | "success" | "error", msg: string}>({type: "idle", msg: ""});

  const loadData = async () => {
    try {
      const res = await fetchConnections();
      if (res) {
        setConnections(res.connections || []);
        setActiveAlias(res.active_alias);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTest = async () => {
    if (!config.alias) {
      setStatus({type: "error", msg: "Alias is required"});
      toast.error("Alias is required to test the connection.");
      return;
    }
    setTesting(true);
    setStatus({type: "idle", msg: ""});
    try {
      await testConnection(config);
      setStatus({type: "success", msg: "Connection successful!"});
      toast.success("Connection test successful!");
    } catch (e: any) {
      setStatus({type: "error", msg: e.message || "Failed to connect"});
      toast.error(`Connection failed: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!config.alias) {
      setStatus({type: "error", msg: "Alias is required"});
      toast.error("Alias is required to save the connection.");
      return;
    }
    setSaving(true);
    setStatus({type: "idle", msg: ""});
    try {
      await saveConnection(config);
      setStatus({type: "success", msg: "Configuration saved."});
      toast.success("Database configuration saved successfully.");
      await loadData();
    } catch (e: any) {
      setStatus({type: "error", msg: e.message || "Failed to save"});
      toast.error(`Failed to save configuration: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (alias: string) => {
    setActivating(alias);
    try {
      await setActiveConnection(alias);
      await loadData();
      toast.success(`Active connection set to ${alias}`);
    } catch (alert: any) {
      toast.error("Failed to activate: " + alert.message);
    } finally {
      setActivating(null);
    }
  };

  if (loading) return <div className="text-xs text-muted-foreground p-4">Loading connections...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Database Connections Manager</h2>
          <div className={`w-2 h-2 rounded-full ${activeAlias ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse'}`} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure and save multiple database environments.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card border-border h-max">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Connection Details</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Add or update a database destination.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Alias Name</Label>
              <Input 
                value={config.alias}
                onChange={e => setConfig({...config, alias: e.target.value})}
                className="h-8 text-xs font-semibold" 
                placeholder="e.g. Production DB" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">SQL Dialect</Label>
                <Select value={config.dialect} onValueChange={v => setConfig({...config, dialect: v})}>
                  <SelectTrigger className="w-full h-8 text-xs font-medium">
                    <SelectValue placeholder="Select Dialect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgresql">
                      <div className="flex items-center gap-2"><img src="/postgresql-logo.svg" alt="PostgreSQL" className="w-3.5 h-3.5 object-contain" /><span>PostgreSQL</span></div>
                    </SelectItem>
                    <SelectItem value="mysql">
                      <div className="flex items-center gap-2"><img src="/mysql-logo.svg" alt="MySQL" className="w-3.5 h-3.5 object-contain" /><span>MySQL</span></div>
                    </SelectItem>
                    <SelectItem value="sqlite">
                      <div className="flex items-center gap-2"><img src="/sqlite-logo.svg" alt="SQLite" className="w-3.5 h-3.5 object-contain" /><span>SQLite</span></div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mode</Label>
                <Select value={config.mode} onValueChange={v => setConfig({...config, mode: v})}>
                  <SelectTrigger className="w-full h-8 text-xs font-medium">
                    <SelectValue placeholder="Select Access Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User (Read-only)</SelectItem>
                    <SelectItem value="admin">Admin (DML allowed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Host</Label>
                <Input value={config.host} onChange={e => setConfig({...config, host: e.target.value})} className="h-8 text-xs" placeholder="localhost" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Port</Label>
                <Input value={config.port} onChange={e => setConfig({...config, port: e.target.value})} className="h-8 text-xs" placeholder="5432" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Database Name</Label>
                <Input value={config.dbname} onChange={e => setConfig({...config, dbname: e.target.value})} className="h-8 text-xs" placeholder="postgres" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Username</Label>
                <Input value={config.user} onChange={e => setConfig({...config, user: e.target.value})} className="h-8 text-xs" placeholder="postgres" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Password</Label>
                <Input type="password" value={config.password} onChange={e => setConfig({...config, password: e.target.value})} className="h-8 text-xs" placeholder="••••••••" />
              </div>
            </div>
            
            {status.type === "error" && (
              <div className="text-destructive text-xs bg-destructive/10 border border-destructive/20 p-2.5 rounded-md">
                {status.msg}
              </div>
            )}
            {status.type === "success" && (
              <div className="text-emerald-500 text-xs bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-md flex items-center gap-2">
                <CheckCircle2 size={14} /> {status.msg}
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t border-border pt-4 justify-end gap-2">
            <Button onClick={handleTest} disabled={testing || saving} variant="secondary" size="sm" className="h-8 text-xs">
              {testing ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-2" />}
              Test
            </Button>
            <Button onClick={handleSave} disabled={saving || testing} size="sm" className="h-8 text-xs">
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />}
              Save
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-4">
          <div className="text-sm font-semibold">Saved Connections</div>
          {connections.length === 0 ? (
            <div className="text-xs text-muted-foreground border border-dashed rounded-md p-6 text-center">
              No connections saved yet.
            </div>
          ) : (
            <div className="grid gap-3">
              {connections.map(c => {
                const isActive = c.alias === activeAlias;
                return (
                  <Card key={c.alias} className={`bg-card overflow-hidden transition-all ${isActive ? 'border-primary ring-1 ring-primary' : 'border-border opacity-80 hover:opacity-100 hover:border-muted-foreground/50'}`}>
                    <div className="p-3 flex items-start justify-between cursor-pointer group" onClick={() => setConfig(c as any)}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <img src={c.dialect === 'postgresql' ? '/postgresql-logo.svg' : c.dialect === 'sqlite' ? '/sqlite-logo.svg' : '/mysql-logo.svg'} alt={c.dialect} className="w-3.5 h-3.5 object-contain" />
                          <span className="text-sm font-medium">{c.alias}</span>
                          {isActive && <Badge className="h-5 px-1.5 text-[10px] bg-primary">Active</Badge>}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {c.dialect}://{c.user}@{c.host}:{c.port}/{c.dbname}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant={isActive ? "secondary" : "default"}
                        disabled={isActive || activating === c.alias}
                        onClick={(e) => { e.stopPropagation(); handleActivate(c.alias); }}
                        className="h-7 text-[10px] px-2"
                      >
                        {activating === c.alias ? <Loader2 className="w-3 h-3 animate-spin"/> : <LogIn className="w-3 h-3 mr-1"/>}
                        {isActive ? "Connected" : "Connect"}
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
