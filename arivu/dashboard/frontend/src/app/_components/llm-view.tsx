"use client";

import { useEffect, useState } from "react";
import { Cpu, Save, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fetchLLMConfig, saveLLMConfig } from "../../../services/api";

type LLMConfig = {
  provider: string;
  model: string;
  api_key: string;
};

export function LLMView() {
  const [config, setConfig] = useState<LLMConfig>({
    provider: "groq",
    model: "",
    api_key: "",
  });
  const [providers, setProviders] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchLLMConfig().then(res => {
      if (res) {
        setProviders(res.providers || {});
        if (Object.keys(res.config || {}).length > 0) {
          setConfig({
            provider: res.config.provider || "groq",
            model: res.config.model || "",
            api_key: res.config.api_key || "",
          });
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleProviderChange = (newProvider: string) => {
    setConfig(prev => ({
      ...prev,
      provider: newProvider,
      model: providers[newProvider] || ""
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus("idle");
    try {
      await saveLLMConfig(config);
      setStatus("success");
      toast.success("LLM configuration updated successfully.");
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.message || "Failed to save LLM configuration");
      toast.error(`Failed to save LLM configuration: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-xs text-muted-foreground p-4">Loading LLM config...</div>;

  const providerOptions = Object.keys(providers).sort();

  const providerIcons: Record<string, string> = {
    openai: "/openai-svgrepo-com.svg",
    anthropic: "/anthropic-logo.png",
    groq: "/groq-logo.png",
    deepseek: "/deepseek-color.svg",
    ollama: "/ollama-logo-dark.svg",
    huggingface: "/hf-logo.svg",
    alibabacloud: "/alibabacloud-color.svg"
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Language Model Configuration</h2>
            <div className={`w-2 h-2 rounded-full ${config.provider && config.api_key ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse'}`} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select your LLM vendor and provide API keys for the Arivu engine.
          </p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Provider Settings</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Model inference requires an API key for cloud providers. Local providers like Ollama do not require one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Provider</Label>
            <Select value={config.provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full h-8 text-xs font-medium">
                <SelectValue placeholder="Select Provider" />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map(p => (
                  <SelectItem key={p} value={p}>
                    <div className="flex items-center gap-2">
                      {providerIcons[p] ? (
                        <img 
                          src={providerIcons[p]} 
                          alt={p} 
                          className={`w-4 h-4 object-contain ${p === 'openai' ? 'dark:invert' : ''}`} 
                        />
                      ) : (
                        <Cpu className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Model Name</Label>
            <Input 
              value={config.model}
              onChange={e => setConfig({...config, model: e.target.value})}
              className="h-8 text-xs" 
              placeholder={providers[config.provider] || "e.g. gpt-4o"}
            />
            <p className="text-[10px] text-muted-foreground">Leave blank to use the provider's default model.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">API Key</Label>
            <Input 
              type="password"
              value={config.api_key}
              onChange={e => setConfig({...config, api_key: e.target.value})}
              className="h-8 text-xs" 
              placeholder="sk-..." 
            />
          </div>
          
          {status === "error" && (
            <div className="text-destructive text-xs bg-destructive/10 border border-destructive/20 p-2.5 rounded-md">
              {errorMsg}
            </div>
          )}
          
          {status === "success" && (
            <div className="text-emerald-500 text-xs bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-md flex items-center gap-2">
              <CheckCircle2 size={14} /> LLM configuration updated.
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t border-border pt-4 justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm" className="h-8 text-xs">
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />}
            Save Configuration
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
