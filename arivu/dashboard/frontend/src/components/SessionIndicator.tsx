"use client";

import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { fetchSessionHealth } from "../../services/api";

export function useSessionWindow(alias: string, currentSessionId?: string) {
  const [windowSessions, setWindowSessions] = useState<string[]>([]);

  useEffect(() => {
    if (!alias) return;
    const key = `arivu_sessions_${alias}`;
    const stored = localStorage.getItem(key);
    let sessions: string[] = stored ? JSON.parse(stored) : [];

    if (currentSessionId) {
      sessions = sessions.filter((id: string) => id !== currentSessionId);
      sessions.unshift(currentSessionId);
      if (sessions.length > 3) sessions = sessions.slice(0, 3);
      localStorage.setItem(key, JSON.stringify(sessions));
    }
    setWindowSessions(sessions);
  }, [alias, currentSessionId]);

  return windowSessions;
}

export function SessionIndicator({ alias, sessionId, currentSessionId }: { alias: string; sessionId: string; currentSessionId?: string }) {
  const windowSessions = useSessionWindow(alias, currentSessionId);
  const [status, setStatus] = useState<"green" | "yellow" | "red">("red");

  useEffect(() => {
    if (!alias || !sessionId) return;

    let active = true;
    const pingHealth = async () => {
      try {
        const inWindow = windowSessions.includes(sessionId);
        if (!inWindow && sessionId !== currentSessionId) {
           if (active) setStatus("red");
           return;
        }

        const data = await fetchSessionHealth(sessionId);
        
        if (!active) return;

        if (data && data.connection === "ok") {
           if (currentSessionId === sessionId) {
              setStatus("green");
           } else {
              setStatus("yellow");
           }
        } else {
           setStatus("red");
        }
      } catch (e) {
        if (active) setStatus("red");
      }
    };

    pingHealth();
    const interval = setInterval(pingHealth, 10000);

    return () => { active = false; clearInterval(interval); };
  }, [alias, sessionId, currentSessionId, windowSessions]);

  const colors = {
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-red-500"
  };

  const labels = {
    green: "Active Session",
    yellow: "Recent Session (Inactive)",
    red: "Disconnected / Archived"
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center p-0.5 cursor-help">
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${colors[status]} transition-colors duration-300`} />
          </div>
        </TooltipTrigger>
        <TooltipContent className="text-xs font-medium" side="bottom">
          {labels[status]}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
