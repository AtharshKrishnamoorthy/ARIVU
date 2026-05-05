/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Save, Loader2, CheckCircle2, Key, Zap,
  ExternalLink, ArrowRight, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { fetchLLMConfig, saveLLMConfig } from "@services/api";

type LLMConfig = { provider: string; model: string; api_key: string };

const PROVIDER_META: Record<string, { logo: string; docs: string; local?: boolean; gradient: string; description: string; invert?: boolean }> = {
  openai:       { logo: "/openai-svgrepo-com.svg",           docs: "https://platform.openai.com/docs",  gradient: "from-green-500/15 to-transparent",   description: "GPT-4o, o1, and more",       invert: true },
  anthropic:    { logo: "/anthropic-logo.png",                docs: "https://docs.anthropic.com",         gradient: "from-orange-500/15 to-transparent", description: "Claude 3.5 Sonnet, Haiku" },
  groq:         { logo: "/groq-logo.png",                    docs: "https://console.groq.com/docs",      gradient: "from-purple-500/15 to-transparent", description: "Ultra-fast inference" },
  deepseek:     { logo: "/deepseek-color.svg",               docs: "https://api-docs.deepseek.com",      gradient: "from-sky-500/15 to-transparent",    description: "DeepSeek-V3, R1" },
  gemini:       { logo: "/Google_Gemini_icon_2025.svg",      docs: "https://ai.google.dev/docs",         gradient: "from-blue-500/15 to-transparent",   description: "Gemini 1.5 Pro, Flash" },
  ollama:       { logo: "/ollama-logo-dark.svg",             docs: "https://ollama.com",                 gradient: "from-gray-500/15 to-transparent",   description: "Run models locally",         local: true },
  huggingface:  { logo: "/hf-logo.svg",                      docs: "https://huggingface.co/docs",        gradient: "from-yellow-500/15 to-transparent", description: "Open-source models" },
  alibabacloud: { logo: "/alibabacloud-color.svg",           docs: "https://www.alibabacloud.com",       gradient: "from-orange-400/15 to-transparent", description: "Alibaba Qwen series" },
  qwen:         { logo: "/alibabacloud-color.svg",           docs: "https://www.alibabacloud.com",       gradient: "from-orange-400/15 to-transparent", description: "Qwen / Alibaba Cloud" },
};

const STEPS = [
  { icon: Cpu,      label: "Provider" },
  { icon: Settings, label: "Configure" },
  { icon: Zap,      label: "Done" },
];

export default function LLMsPage() {
  const [step, setStep]         = useState(0);
  const [providers, setProviders] = useState<Record<string, string>>({});
  const [config, setConfig]     = useState<LLMConfig>({ provider: "", model: "", api_key: "" });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [savedOk, setSavedOk]   = useState(false);

  useEffect(() => {
    fetchLLMConfig().then(res => {
      if (res) {
        // Merge known providers with PROVIDER_META so Gemini etc. always appear
        const backendProviders = res.providers || {};
        const knownProviders = Object.fromEntries(
          Object.keys(PROVIDER_META).map(k => [k, backendProviders[k] || ""])
        );
        setProviders({ ...knownProviders, ...backendProviders });
        const c = res.config || {};
        if (c.provider) {
          setConfig({ provider: c.provider, model: c.model || "", api_key: c.api_key || "" });
          setStep(2);
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setSavedOk(false);
    try {
      await saveLLMConfig(config);
      setSavedOk(true);
      setStep(2);
      toast.success("LLM configuration saved.");
    } catch (e: any) { toast.error("Failed: " + e.message); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  const providerList = Object.keys({ ...PROVIDER_META, ...providers });
  const meta = PROVIDER_META[config.provider];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Language Models</h2>
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

      {/* Progress steps */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isDone   = i < step;
          const isActive = i === step;
          return (
            <div key={i} className={`flex items-center flex-1 last:flex-none`}>
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
        {/* ── STEP 0: Pick provider ── */}
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

        {/* ── STEP 1: Configure ── */}
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
                      <Zap className="w-3 h-3" /> Model Name
                    </Label>
                    <Input value={config.model}
                      onChange={e => setConfig(p => ({ ...p, model: e.target.value }))}
                      className="h-9 text-xs"
                      placeholder={providers[config.provider] || "e.g. llama-3.1-8b-instant"} />
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
                    Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── STEP 2: Done ── */}
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
