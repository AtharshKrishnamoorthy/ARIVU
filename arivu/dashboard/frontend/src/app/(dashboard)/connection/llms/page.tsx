/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Save, Loader2, CheckCircle2, Key, Zap,
  ExternalLink, ArrowRight, Settings, Trash2, Power,
  Plus, Database, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  fetchLLMConfig, saveLLMConfig,
  fetchLLMStore, addLLMEntry, activateLLMEntry, deleteLLMEntry,
} from "@services/api";

type LLMConfig = { provider: string; model: string; api_key: string; name?: string };
type LLMEntry = { id: string; name: string; provider: string; model: string; is_active: boolean; created_at: number };

const PROVIDER_META: Record<string, { logo: string; docs: string; local?: boolean; gradient: string; description: string; invert?: boolean }> = {
  openai:       { logo: "/openai-svgrepo-com.svg",           docs: "https://platform.openai.com/docs",  gradient: "from-green-500/15 to-transparent",   description: "GPT-5.4 series, GPT-4o",     invert: true },
  anthropic:    { logo: "/anthropic-logo.png",                docs: "https://docs.anthropic.com",         gradient: "from-orange-500/15 to-transparent", description: "Claude 4.6 Sonnet, Haiku" },
  groq:         { logo: "/groq-logo.png",                    docs: "https://console.groq.com/docs",      gradient: "from-purple-500/15 to-transparent", description: "Llama 3.3, ultra-fast inference" },
  deepseek:     { logo: "/deepseek-color.svg",               docs: "https://api-docs.deepseek.com",      gradient: "from-sky-500/15 to-transparent",    description: "DeepSeek-V4, R1" },
  gemini:       { logo: "/Google_Gemini_icon_2025.svg",      docs: "https://ai.google.dev/docs",         gradient: "from-blue-500/15 to-transparent",   description: "Gemini 3.1 Pro, Flash" },
  ollama:       { logo: "/ollama-logo-dark.svg",             docs: "https://ollama.com",                 gradient: "from-gray-500/15 to-transparent",   description: "Run local models (Llama 3.3)", local: true },
  huggingface:  { logo: "/hf-logo.svg",                      docs: "https://huggingface.co/docs",        gradient: "from-yellow-500/15 to-transparent", description: "Mistral, Qwen, open models" },
  alibabacloud: { logo: "/alibabacloud-color.svg",           docs: "https://www.alibabacloud.com",       gradient: "from-orange-400/15 to-transparent", description: "Qwen 3.7 series" },
  qwen:         { logo: "/alibabacloud-color.svg",           docs: "https://www.alibabacloud.com",       gradient: "from-orange-400/15 to-transparent", description: "Qwen 3.7 series" },
};

const STEPS = [
  { icon: Cpu,      label: "Provider" },
  { icon: Settings, label: "Configure" },
  { icon: Zap,      label: "Done" },
];

function ProviderIcon({ provider, size = "w-7 h-7" }: { provider: string; size?: string }) {
  const m = PROVIDER_META[provider];
  if (m) {
    return <img src={m.logo} alt={provider} className={`${size} object-contain shrink-0 ${m.invert ? "dark:invert" : ""}`} />;
  }
  return <Cpu className={`${size} text-muted-foreground shrink-0`} />;
}

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return "Recently added";

  const deltaMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (deltaMs < minute) return "Just now";
  if (deltaMs < hour) return `${Math.max(1, Math.round(deltaMs / minute))}m ago`;
  if (deltaMs < day) return `${Math.max(1, Math.round(deltaMs / hour))}h ago`;
  if (deltaMs < 7 * day) return `${Math.max(1, Math.round(deltaMs / day))}d ago`;

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(timestamp));
}

/* ── Tab 1: Existing LLM connection (unchanged) ── */
function LLMConnectionTab({
  providers, config, step, setStep, setConfig, loading, saving, savedOk, handleSave,
}: {
  providers: Record<string, string>;
  config: LLMConfig;
  step: number;
  setStep: (n: number) => void;
  setConfig: (fn: (p: LLMConfig) => LLMConfig) => void;
  loading: boolean;
  saving: boolean;
  savedOk: boolean;
  handleSave: () => void;
}) {
  const providerList = Object.keys({ ...PROVIDER_META, ...providers });
  const meta = PROVIDER_META[config.provider];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Active LLM Connection</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {config.provider
              ? `${config.provider.charAt(0).toUpperCase() + config.provider.slice(1)}${config.model ? ` · ${config.model}` : ""}${config.api_key ? " · configured" : " · no API key"}`
              : "No provider configured"}
          </p>
        </div>
        {step === 2 && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
            onClick={() => setStep(0)}>
            Change provider
          </Button>
        )}
      </div>

      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isDone   = i < step;
          const isActive = i === step;
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center gap-1.5 ${isActive ? "text-foreground" : isDone ? "text-emerald-500" : "text-muted-foreground"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all
                  ${isActive ? "bg-primary border-primary text-primary-foreground"
                    : isDone ? "bg-emerald-500/15 border-emerald-500 text-emerald-500"
                    : "bg-muted border-border"}`}>
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3 h-3" />}
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
        {step === 0 && (
          <motion.div key="s0" className="w-full" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Choose a provider</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Select the AI provider you want to use with Arivu.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {providerList.map((p, i) => {
                  const m = PROVIDER_META[p];
                  const isSelected = config.provider === p;
                  return (
                    <motion.div key={p} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <Card
                        className={`cursor-pointer transition-all hover:shadow-md relative overflow-hidden group h-[72px]
                          ${isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/40"}`}
                        onClick={() => setConfig(prev => ({ ...prev, provider: p, model: providers[p] || "" }))}>
                        {isSelected && m && (
                          <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} pointer-events-none`} />
                        )}
                        <CardContent className="flex items-center gap-3 h-full px-3.5 py-0 relative">
                          {m ? (
                            <img src={m.logo} alt={p}
                              className={`w-7 h-7 object-contain shrink-0 ${m.invert ? "dark:invert" : ""}`} />
                          ) : (
                            <Cpu className="w-7 h-7 text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold">{p.charAt(0).toUpperCase() + p.slice(1)}</p>
                            {m?.description && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{m.description}</p>}
                            {m?.local && (
                              <Badge variant="outline" className="text-[9px] px-1 h-3.5 mt-0.5 text-emerald-400 border-emerald-400/30">Local</Badge>
                            )}
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
              <Button className="w-full h-9 text-xs gap-1.5" disabled={!config.provider}
                onClick={() => setStep(1)}>
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="s1" className="w-full" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="border-border">
              <CardContent className="p-5 space-y-5">
                <div className="flex items-center gap-3">
                  {meta && (
                    <img src={meta.logo} alt={config.provider}
                      className={`w-8 h-8 object-contain ${meta?.invert ? "dark:invert" : ""}`} />
                  )}
                  <div>
                    <h3 className="text-sm font-semibold">
                      {config.provider.charAt(0).toUpperCase() + config.provider.slice(1)} Configuration
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta?.description}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Layers className="w-3 h-3" /> Config Name
                    </Label>
                    <Input value={config.name || ""}
                      onChange={e => setConfig(p => ({ ...p, name: e.target.value }))}
                      className="h-9 text-xs"
                      placeholder="e.g. Production LLM" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Zap className="w-3 h-3" /> Model Name
                    </Label>
                    <Input value={config.model}
                      onChange={e => setConfig(p => ({ ...p, model: e.target.value }))}
                      className="h-9 text-xs"
                      placeholder={providers[config.provider] || "e.g. llama-3.3-70b-versatile"} />
                    <p className="text-[10px] text-muted-foreground">
                      Leave blank to use the default model for this provider.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Key className="w-3 h-3" /> API Key
                      {meta?.local && (
                        <Badge variant="outline" className="text-[9px] px-1.5 h-4 text-muted-foreground">Not req. for local</Badge>
                      )}
                    </Label>
                    <Input type="password" value={config.api_key}
                      onChange={e => setConfig(p => ({ ...p, api_key: e.target.value }))}
                      className="h-9 text-xs" placeholder="sk-…" />
                  </div>
                </div>

                {meta?.docs && (
                  <a href={meta.docs} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ExternalLink className="w-3 h-3" />
                    {config.provider.charAt(0).toUpperCase() + config.provider.slice(1)} documentation
                  </a>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button size="sm" className="flex-1 h-9 text-xs gap-1.5"
                    onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save & Activate
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" className="w-full" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {config.provider.charAt(0).toUpperCase() + config.provider.slice(1)} configured
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {config.model || providers[config.provider] || "Default model"} · API key {config.api_key ? "set" : "not set"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  {[
                    ["Name", config.name || "Default"],
                    ["Provider", config.provider.charAt(0).toUpperCase() + config.provider.slice(1)],
                    ["Model", config.model || providers[config.provider] || "(default)"],
                    ["API Key", config.api_key ? "••••••••" + config.api_key.slice(-4) : "Not set"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3 text-xs">
                      <span className="text-muted-foreground w-20 shrink-0">{k}</span>
                      <span className="font-mono">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-9 text-xs flex-1"
                    onClick={() => setStep(1)}>
                    Edit
                  </Button>
                  <Button size="sm" className="h-9 text-xs flex-1 gap-1.5"
                    onClick={handleSave} disabled={saving}>
                    {savedOk
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</>
                      : <><Save className="w-3.5 h-3.5" /> Re-save</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Tab 2: LLM Store ── */
function LLMStoreTab({
  entries, loading, onActivate, onDelete, onAdd,
}: {
  entries: LLMEntry[];
  loading: boolean;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  const activeEntries = entries.filter((entry) => entry.is_active);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Saved configurations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entries.length} config{entries.length !== 1 ? "s" : ""} stored · {activeEntries.length} active
          </p>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5 self-start sm:self-auto" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5" /> Add new
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card className="border-border/70 bg-muted/20 overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl border border-border bg-background/80 shadow-sm flex items-center justify-center">
              <Database className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <p className="text-sm font-semibold">No saved configurations yet</p>
              <p className="text-xs text-muted-foreground">
                Create your first LLM setup in the Connection tab, and it will show up here for quick switching.
              </p>
            </div>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={onAdd}>
              <Plus className="w-3.5 h-3.5" /> Create one
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {entries.map((entry) => {
            const meta = PROVIDER_META[entry.provider];
            return (
              <motion.div key={entry.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={`group overflow-hidden border transition-colors duration-200 ${
                  entry.is_active
                    ? "border-emerald-500/40 bg-accent/10"
                    : "border-border/60 hover:border-border hover:bg-accent/10"
                }`}>
                  <CardContent className="p-0">
                    <div className="flex flex-row items-start sm:items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ProviderIcon provider={entry.provider} size="w-7 h-7" />

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium truncate max-w-full">{entry.name}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            {meta?.local ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 h-4 border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                                Local
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 h-4 border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium">
                                Cloud
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-mono font-normal bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
                              {entry.model || "default"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground/60 ml-1">
                              Added {formatRelativeTime(entry.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                        {entry.is_active && (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 h-4 gap-1 font-medium hover:bg-emerald-500/20">
                            <div className="w-1 h-1 rounded-full bg-emerald-500" />
                            Active
                          </Badge>
                        )}
                        <div className="flex flex-row items-center gap-2">
                          {!entry.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/50"
                              onClick={() => onActivate(entry.id)}
                            >
                              <Power className="w-3 h-3" />
                              Activate
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground/50 transition-opacity hover:text-destructive hover:bg-destructive/10 sm:opacity-0 sm:group-hover:opacity-100"
                            onClick={() => onDelete(entry.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main page with tabs ── */
export default function LLMsPage() {
  const [step, setStep]         = useState(0);
  const [providers, setProviders] = useState<Record<string, string>>({});
  const [config, setConfig]     = useState<LLMConfig>({ provider: "", model: "", api_key: "", name: "" });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [savedOk, setSavedOk]   = useState(false);

  const [storeEntries, setStoreEntries] = useState<LLMEntry[]>([]);
  const [storeLoading, setStoreLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchLLMConfig(),
      fetchLLMStore(),
    ]).then(([llmRes, storeRes]) => {
      if (llmRes) {
        const backendProviders = llmRes.providers || {};
        const knownProviders = Object.fromEntries(
          Object.keys(PROVIDER_META).map(k => [k, backendProviders[k] || ""])
        );
        setProviders({ ...knownProviders, ...backendProviders });
        const c = llmRes.config || {};
        if (c.provider) {
          setConfig({ provider: c.provider, model: c.model || "", api_key: c.api_key || "", name: c.name || "" });
          setStep(2);
        }
      }
      setLoading(false);

      if (storeRes) {
        setStoreEntries(storeRes.entries || []);
      }
      setStoreLoading(false);
    }).catch(() => {
      setLoading(false);
      setStoreLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true); setSavedOk(false);
    try {
      await saveLLMConfig(config);
      setSavedOk(true);
      setStep(2);
      toast.success("LLM configuration saved and activated.");
      const storeRes = await fetchLLMStore();
      if (storeRes) setStoreEntries(storeRes.entries || []);
    } catch (e: any) { toast.error("Failed: " + e.message); }
    finally { setSaving(false); }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateLLMEntry(id);
      toast.success("LLM configuration activated.");
      const [llmRes, storeRes] = await Promise.all([fetchLLMConfig(), fetchLLMStore()]);
      if (llmRes?.config) {
        const c = llmRes.config;
        setConfig({ provider: c.provider, model: c.model || "", api_key: c.api_key || "", name: c.name || "" });
      }
      if (storeRes) setStoreEntries(storeRes.entries || []);
    } catch (e: any) { toast.error("Failed: " + e.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLLMEntry(id);
      toast.success("LLM configuration removed.");
      const storeRes = await fetchLLMStore();
      if (storeRes) setStoreEntries(storeRes.entries || []);
    } catch (e: any) { toast.error("Failed: " + e.message); }
  };

  return (
    <Tabs defaultValue="connection" className="w-full">
      <TabsList className="h-9 bg-muted/50 mb-6">
        <TabsTrigger value="connection" className="text-xs px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
          <Zap className="w-3.5 h-3.5" /> Connection
        </TabsTrigger>
        <TabsTrigger value="store" className="text-xs px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
          <Database className="w-3.5 h-3.5" /> Store
        </TabsTrigger>
      </TabsList>

      <TabsContent value="connection" className="m-0">
        <LLMConnectionTab
          providers={providers}
          config={config}
          step={step}
          setStep={setStep}
          setConfig={setConfig}
          loading={loading}
          saving={saving}
          savedOk={savedOk}
          handleSave={handleSave}
        />
      </TabsContent>

      <TabsContent value="store" className="m-0">
        <LLMStoreTab
          entries={storeEntries}
          loading={storeLoading}
          onActivate={handleActivate}
          onDelete={handleDelete}
          onAdd={() => setStep(0)}
        />
      </TabsContent>
    </Tabs>
  );
}
