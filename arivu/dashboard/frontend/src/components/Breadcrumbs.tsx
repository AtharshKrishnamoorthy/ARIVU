"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home, MoreHorizontal } from "lucide-react";
import { useDB } from "@/app/(dashboard)/db-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_LABELS: Record<string, string> = {
  chat: "Chat",
  explorer: "DB Explorer",
  dashboards: "Dashboards",
  queries: "Saved Queries",
  automations: "Schedules",
  monitoring: "Monitoring",
  overview: "Overview",
  traces: "Traces",
  sessions: "Sessions",
  errors: "Errors",
  feedback: "Feedback",
  connector: "Connections",
  llms: "LLMs",
  integrations: "Integrations",
  settings: "Settings",
};

function formatSegment(seg: string): string {
  return PAGE_LABELS[seg] || seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const { alias } = useDB();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const ITEMS_TO_SHOW = 2;
  
  let displayedSegments: { seg: string; index: number; isEllipsis?: boolean }[] = [];
  let collapsedSegments: { seg: string; index: number }[] = [];

  if (segments.length > ITEMS_TO_SHOW) {
    displayedSegments = [
      { seg: "...", index: -1, isEllipsis: true },
      { seg: segments[segments.length - 1], index: segments.length - 1 }
    ];
    collapsedSegments = segments.slice(0, segments.length - 1).map((seg, i) => ({
      seg,
      index: i
    }));
  } else {
    displayedSegments = segments.map((seg, i) => ({ seg, index: i }));
  }

  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1 shrink-0">
        <Home className="h-3 w-3" />
      </Link>
      {displayedSegments.map((item, i) => {
        if (item.isEllipsis) {
          return (
            <span key="ellipsis" className="flex items-center gap-1 shrink-0">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-muted transition-colors outline-none">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {collapsedSegments.map((col) => {
                    const href = `/${segments.slice(0, col.index + 1).join("/")}`;
                    const label = col.seg === alias ? alias : formatSegment(col.seg);
                    return (
                      <DropdownMenuItem key={col.index} asChild>
                        <Link href={href} className="w-full truncate block">{label}</Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          );
        }

        const isLast = i === displayedSegments.length - 1;
        const href = `/${segments.slice(0, item.index + 1).join("/")}`;
        const label = item.seg === alias ? alias : formatSegment(item.seg);

        return (
          <span key={item.index} className="flex items-center gap-1 min-w-0 shrink-0 sm:shrink">
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            {isLast ? (
              <span className="text-foreground font-medium truncate max-w-[40vw] sm:max-w-[200px]">{label}</span>
            ) : (
              <Link href={href} className="hover:text-foreground transition-colors truncate max-w-[20vw] sm:max-w-[120px]">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
