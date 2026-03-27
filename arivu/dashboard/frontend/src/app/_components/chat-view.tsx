"use client";

import { useState, useEffect } from "react";
import { Send, User, Bot, AlertTriangle, Database, Server, HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { chatDB, fetchConnections, setActiveConnection } from "../../../services/api";

type Message = {
  role: "user" | "bot";
  content: string;
  sql?: string | null;
  error?: string | null;
};

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => "web_" + Math.random().toString(36).substring(7));
  
  const [connections, setConnections] = useState<any[]>([]);
  const [activeAlias, setActiveAlias] = useState<string>("");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetchConnections().then(res => {
      if (res) {
        setConnections(res.connections || []);
        setActiveAlias(res.active_alias || "");
      }
    });
  }, []);

  const handleSwitchConnection = async (alias: string) => {
    setActiveAlias(alias);
    setSwitching(true);
    try {
      if (alias && alias !== "none") {
        await setActiveConnection(alias);
        setMessages(prev => [...prev, { role: "bot", content: `Switched active connection to: **${alias}**` }]);
        toast.success(`Connected to ${alias}`);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "bot", content: "", error: "Failed to switch connection: " + e.message }]);
      toast.error(`Failed to switch connection: ${e.message}`);
    } finally {
      setSwitching(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading || switching) return;
    if (!activeAlias) {
      setMessages(prev => [...prev, { role: "bot", content: "", error: "No active connection selected. Please select one from the dropdown or configure one in the Connector." }]);
      return;
    }
    
    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await chatDB(msg, sessionId);
      setMessages(prev => [...prev, {
        role: "bot",
        content: res.response,
        sql: res.sql,
        error: res.error
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: "bot",
        content: "",
        error: e.message || "Failed to process message."
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card border-border flex flex-col h-[75vh] min-h-[600px] w-full max-w-6xl mx-auto shadow-sm">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Database Chat</CardTitle>
              <div className={`w-2 h-2 rounded-full ${activeAlias && activeAlias !== 'none' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse'}`} />
            </div>
            <CardDescription className="text-xs mt-1">
              Talk to your connected database in natural language.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 pr-2">
            <Database size={14} className="text-muted-foreground hidden sm:block" />
            <Select 
              value={activeAlias || "none"} 
              onValueChange={handleSwitchConnection} 
              disabled={switching || connections.length === 0}
            >
              <SelectTrigger className="h-8 min-w-40 text-xs font-semibold">
                <SelectValue placeholder="Select connection" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>-- Choose DB --</SelectItem>
                {connections.map((c: any) => {
                  const dbIcon = c.dialect === 'postgresql' ? '/postgresql-logo.svg' : c.dialect === 'sqlite' ? '/sqlite-logo.svg' : '/mysql-logo.svg';
                  return (
                    <SelectItem key={c.alias} value={c.alias}>
                      <div className="flex items-center gap-2">
                        <img src={dbIcon} alt={c.dialect || 'db'} className="w-3.5 h-3.5 object-contain" />
                        <span>{c.alias}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-xs mt-20">
              No messages yet. Select a connection and send a query to begin.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {m.role === "user" ? <User size={16} /> : <Bot size={16} />}
              </div>
              
              <div className={`max-w-[75%] space-y-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
                {m.content && m.content.includes("Switched active connection") ? (
                   <div className="text-[11px] text-muted-foreground bg-muted px-3 py-1.5 rounded-full mt-2 font-medium">
                     {m.content.replace(/\*\*/g, '')}
                   </div>
                ) : (
                  <>
                    {m.sql && (
                      <div className="bg-muted border border-border rounded-md px-3 py-2 text-[11px] font-mono text-teal-600 dark:text-teal-400 whitespace-pre-wrap">
                        {m.sql}
                      </div>
                    )}
                    
                    {m.content && (
                      <div className={`px-4 py-2 text-sm rounded-lg ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                        {m.content}
                      </div>
                    )}
    
                    {m.error && (
                      <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-xs flex items-start gap-2">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span>{m.error}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 flex-row">
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="px-4 py-2 text-sm rounded-lg bg-card border border-border">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border mt-auto">
        <form 
          className="flex items-center gap-2"
          onSubmit={e => { e.preventDefault(); handleSend(); }}
        >
          <Input 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question about your database..."
            className="flex-1 bg-background text-sm"
            disabled={loading || switching || !activeAlias}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || loading || switching || !activeAlias}>
            <Send size={16} />
          </Button>
        </form>
      </div>
    </Card>
  );
}
