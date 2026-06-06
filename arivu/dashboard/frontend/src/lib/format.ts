export function formatTimestamp(ts: number | undefined, full = false): string {
  if (!ts) return "\u2014";
  const d = new Date(ts * 1000);
  if (full) {
    return d.toLocaleTimeString("en-US", { hour12: false }) + " " + d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  }
  return d.toLocaleTimeString("en-US", { hour12: false }) + " " + d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function relativeTime(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function truncate(str: string | undefined, n = 60): string {
  if (!str) return "\u2014";
  return str.length > n ? str.slice(0, n) + "\u2026" : str;
}

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform) || (navigator as any).userAgentData?.platform === "macOS";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
