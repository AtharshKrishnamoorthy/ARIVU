"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Database, MessageSquare, Table, LayoutDashboard, BookOpen, Timer,
  Activity, GitGraph, Server, AlertTriangle, ThumbsUp, Settings, Cpu, Plug,
} from "lucide-react";

interface SearchableItem {
  href: string;
  label: string;
  icon: React.ElementType;
  group: string;
  keywords?: string;
}

const GLOBAL_ITEMS: SearchableItem[] = [
  { href: "/", label: "All Databases", icon: Database, group: "Global", keywords: "home databases connections" },
  { href: "/connection/llms", label: "LLM Configuration", icon: Cpu, group: "Global", keywords: "llm ai model api key openai anthropic" },
  { href: "/connection/integrations", label: "Integrations", icon: Plug, group: "Global", keywords: "integrations slack telegram discord whatsapp webhook messaging" },
  { href: "/settings", label: "Settings", icon: Settings, group: "Global", keywords: "preferences config options" },
];

const DB_ITEMS: SearchableItem[] = [
  { href: "/chat", label: "Chat", icon: MessageSquare, group: "Workspace", keywords: "ask query question natural language" },
  { href: "/explorer", label: "DB Explorer", icon: Table, group: "Workspace", keywords: "tables schema columns browse structure" },
  { href: "/dashboards", label: "Dashboards", icon: LayoutDashboard, group: "Analytics", keywords: "charts graphs visualize metrics" },
  { href: "/queries", label: "Saved Queries", icon: BookOpen, group: "Analytics", keywords: "sql history saved bookmarks" },
  { href: "/automations", label: "Schedules", icon: Timer, group: "Analytics", keywords: "cron automation scheduled jobs" },
  { href: "/monitoring/overview", label: "Monitoring Overview", icon: Activity, group: "Monitoring", keywords: "monitor performance health status" },
  { href: "/monitoring/traces", label: "Traces", icon: GitGraph, group: "Monitoring", keywords: "trace pipeline flow execution" },
  { href: "/monitoring/sessions", label: "Sessions", icon: Server, group: "Monitoring", keywords: "session connection active" },
  { href: "/monitoring/errors", label: "Errors", icon: AlertTriangle, group: "Monitoring", keywords: "error crash exception bug" },
  { href: "/monitoring/feedback", label: "Feedback", icon: ThumbsUp, group: "Monitoring", keywords: "feedback rating review thumbs" },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();

  const runCommand = useCallback((href: string) => {
    onOpenChange(false);
    router.push(href);
  }, [router, onOpenChange]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  const dbMatch = pathname.match(/^\/db\/([^/]+)/);
  const alias = dbMatch ? dbMatch[1] : "";
  const dbPath = alias ? `/db/${alias}` : "";

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, settings..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          {GLOBAL_ITEMS.map((item) => (
            <CommandItem
              key={item.href}
              value={`${item.label} ${item.keywords ?? ""}`}
              onSelect={() => runCommand(item.href)}
            >
              <item.icon className="h-4 w-4 mr-2 text-muted-foreground" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {alias && (
          <>
            <CommandSeparator />
            {["Workspace", "Analytics", "Monitoring"].map((group) => {
              const items = DB_ITEMS.filter((i) => i.group === group);
              return (
                <CommandGroup key={group} heading={group}>
                  {items.map((item) => (
                    <CommandItem
                      key={item.href}
                      value={`${item.label} ${item.keywords ?? ""}`}
                      onSelect={() => runCommand(`${dbPath}${item.href}`)}
                    >
                      <item.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem
                value="switch database change connection"
                onSelect={() => runCommand("/")}
              >
                <Database className="h-4 w-4 mr-2 text-muted-foreground" />
                Switch Database
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
