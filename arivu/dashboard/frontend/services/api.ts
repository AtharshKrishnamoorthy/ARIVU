import type {
    TracesResponse,
    SessionsResponse,
    ErrorsResponse,
    RLHFResponse,
    SessionDetail,
    DashboardStats,
    HealthResponse,
    RateLimitConfig,
    ChatResponse,
    SavedQuery,
    SavedQueriesResponse,
    SavedQueryResponse,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Base URL — in dev points to the FastAPI backend on port 9000
// ─────────────────────────────────────────────────────────────────────────────

export const API_BASE =
    typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1")
        ? `http://${window.location.hostname}:8000`
        : "";

// ─────────────────────────────────────────────────────────────────────────────
// Generic fetcher
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
    try {
        const res = await fetch(`${API_BASE}${path}`, options);
        if (!res.ok) {
            let errorMsg = `HTTP Error ${res.status}`;
            try {
                const text = await res.text();
                try {
                    const err = JSON.parse(text);
                    errorMsg = err.detail || errorMsg;
                } catch {
                    if (text && text.trim().length > 0 && text.length < 200) {
                        errorMsg = text.trim();
                    }
                }
            } catch {
                // Ignore errors reading response body
            }
            throw new Error(errorMsg);
        }
        
        let text = "";
        try {
            text = await res.text();
        } catch {
            return null;
        }

        if (!text || text.trim() === "") {
            return null;
        }

        try {
            return JSON.parse(text) as T;
        } catch (parseErr) {
            console.error("Failed to parse JSON response:", text);
            throw new Error("Invalid JSON response from server");
        }
    } catch (err) {
        console.error("API error", err);
        throw err;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchTraces(
    sessionId?: string,
    limit = 50
): Promise<TracesResponse | null> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (sessionId) params.set("session_id", sessionId);
    return apiFetch<TracesResponse>(`/api/traces?${params}`);
}

export async function fetchSessions(
    limit = 50
): Promise<SessionsResponse | null> {
    return apiFetch<SessionsResponse>(`/api/sessions?limit=${limit}`);
}

export async function fetchErrors(
    limit = 100
): Promise<ErrorsResponse | null> {
    return apiFetch<ErrorsResponse>(`/api/errors?limit=${limit}`);
}

export async function fetchRLHF(
    limit = 100,
    signal?: string
): Promise<RLHFResponse | null> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (signal) params.set("signal", signal);
    return apiFetch<RLHFResponse>(`/api/rlhf?${params}`);
}

export async function fetchSessionDetail(
    sessionId: string
): Promise<SessionDetail | null> {
    return apiFetch<SessionDetail>(`/api/session/${sessionId}`);
}

export async function fetchStats(): Promise<DashboardStats | null> {
    return apiFetch<DashboardStats>("/api/stats");
}

export async function fetchHealth(): Promise<HealthResponse | null> {
    return apiFetch<HealthResponse>("/api/health");
}

export async function fetchSessionHealth(sessionId: string): Promise<{ session_id: string; connection: string; status: string } | null> {
    return apiFetch<{ session_id: string; connection: string; status: string }>(`/api/session/${sessionId}/health`);
}

export async function fetchConfig(): Promise<RateLimitConfig | null> {
    return apiFetch<RateLimitConfig>("/api/chat/config");
}

// ── Command Center ───────────────────────────────────────────────────────────

export async function fetchConnections(): Promise<any> {
    return apiFetch("/api/connections");
}

export async function saveRLHFSignal(
    session_id: string,
    question: string,
    sql: string,
    signal: "positive" | "negative"
): Promise<any> {
    return apiFetch("/api/rlhf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id, question, sql, signal }),
    });
}

export async function deleteConnection(alias: string): Promise<any> {
    return apiFetch(`/api/connections/${encodeURIComponent(alias)}`, {
        method: "DELETE",
    });
}

export async function saveConnection(config: any): Promise<any> {
    return apiFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
    });
}

export async function testConnection(config: any): Promise<any> {
    return apiFetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
    });
}

export async function setActiveConnection(alias: string): Promise<any> {
    return apiFetch("/api/connections/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias })
    });
}

export async function fetchLLMConfig(): Promise<any> {
    return apiFetch("/api/llm");
}

export async function saveLLMConfig(config: any): Promise<any> {
    return apiFetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
    });
}

export async function fetchLLMStore(): Promise<{ entries: any[] } | null> {
    return apiFetch("/api/llm/store");
}

export async function addLLMEntry(config: any): Promise<any> {
    return apiFetch("/api/llm/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
    });
}

export async function activateLLMEntry(id: string): Promise<any> {
    return apiFetch(`/api/llm/store/${id}/activate`, { method: "POST" });
}

export async function deleteLLMEntry(id: string): Promise<any> {
    return apiFetch(`/api/llm/store/${id}`, { method: "DELETE" });
}

export async function chatDB(message: string, session_id: string): Promise<ChatResponse | null> {
    return apiFetch<ChatResponse>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, session_id })
    });
}

export interface StreamCallbacks {
    onProgress?: (text: string) => void;
    onDone?: (data: ChatResponse) => void;
    onError?: (error: string) => void;
}

export async function chatDBStream(
    message: string,
    session_id: string,
    callbacks: StreamCallbacks
): Promise<void> {
    const res = await fetch(`${API_BASE}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, session_id })
    });

    if (!res.ok) {
        callbacks.onError?.(`HTTP Error ${res.status}`);
        return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
        callbacks.onError?.("ReadableStream not supported");
        return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let event = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (line.startsWith("event: ")) {
                    event = line.slice(7);
                    continue;
                }
                if (line.startsWith("data: ")) {
                    const data = JSON.parse(line.slice(6));
                    if (event === "progress") {
                        callbacks.onProgress?.(data.text);
                    } else if (event === "done") {
                        callbacks.onDone?.(data);
                    } else if (event === "error") {
                        callbacks.onError?.(data.text);
                    }
                    event = "";
                }
            }
        }
    } catch (e) {
        console.error("[chatDBStream] Error:", e);
        callbacks.onError?.(e instanceof Error ? e.message : "Stream error");
    }
}

export async function visualizeData(
    question: string,
    sql: string,
    data: Record<string, unknown>[]
): Promise<{ c1_response: string } | null> {
    // Detect current app theme
    const theme =
        typeof document !== "undefined" && document.documentElement.classList.contains("dark")
            ? "dark" : "light";
    return apiFetch<{ c1_response: string }>("/api/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sql, data, theme }),
    });
}

export async function fetchSuggestions(context?: string): Promise<{ suggestions: string[] } | null> {
    const url = context 
        ? `/api/suggestions?context=${encodeURIComponent(context)}` 
        : "/api/suggestions";
    return apiFetch<{ suggestions: string[] }>(url);
}

export async function exportData(data: Record<string, unknown>[], filename?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, filename: filename || "arivu_export" }),
    });
    
    if (!res.ok) throw new Error("Export failed");
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename || "arivu_export"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Automations
// ─────────────────────────────────────────────────────────────────────────────

export interface Automation {
    id: string;
    name: string;
    query: string;
    cron_expr: string;
    connection_alias: string;
    action_type: "log" | "email" | "webhook" | "slack" | "discord" | "telegram" | "whatsapp";
    action_config: Record<string, unknown>;
    enabled: boolean;
    last_run: number | null;
    last_status: string | null;
    created_at: number;
}

export async function fetchAutomations(): Promise<{ automations: Automation[] } | null> {
    return apiFetch<{ automations: Automation[] }>("/api/automations");
}

export async function createAutomation(payload: {
    name: string;
    query: string;
    cron_expr: string;
    action_type: string;
    action_config?: Record<string, unknown>;
}): Promise<any> {
    return apiFetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

export async function updateAutomation(id: string, payload: Partial<Automation>): Promise<any> {
    return apiFetch(`/api/automations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

export async function deleteAutomation(id: string): Promise<any> {
    return apiFetch(`/api/automations/${id}`, { method: "DELETE" });
}

export async function triggerAutomation(id: string): Promise<any> {
    return apiFetch(`/api/automations/${id}/run`, { method: "POST" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings (SMTP)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSMTPSettings(): Promise<any> {
    return apiFetch("/api/settings/smtp");
}

export async function saveSMTPSettings(config: any): Promise<any> {
    return apiFetch("/api/settings/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
    });
}

export async function testSMTPEmail(to: string): Promise<any> {
    return apiFetch("/api/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Integrations (media / messaging platforms)
// ─────────────────────────────────────────────────────────────────────────────

export type IntegrationPlatform =
    | "slack" | "discord" | "telegram" | "whatsapp" | "webhook" | "email";

export interface IntegrationStatus {
    platform: IntegrationPlatform;
    configured: boolean;
}

export async function fetchIntegrationPlatforms(): Promise<{ platforms: IntegrationStatus[] } | null> {
    return apiFetch("/api/integrations/platforms");
}

export async function fetchIntegrations(): Promise<{ integrations: any[] } | null> {
    return apiFetch("/api/integrations");
}

export async function fetchIntegration(platform: IntegrationPlatform): Promise<any> {
    return apiFetch(`/api/integrations/${platform}`);
}

export async function saveIntegration(platform: IntegrationPlatform, config: Record<string, unknown>): Promise<any> {
    return apiFetch(`/api/integrations/${platform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
    });
}

export async function toggleIntegration(platform: IntegrationPlatform, enabled: boolean): Promise<any> {
    return apiFetch(`/api/integrations/${platform}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
    });
}

export async function deleteIntegration(platform: IntegrationPlatform): Promise<any> {
    return apiFetch(`/api/integrations/${platform}`, { method: "DELETE" });
}


// ─────────────────────────────────────────────────────────────────────────────
// Dashboards
// ─────────────────────────────────────────────────────────────────────────────

export interface Dashboard {
    id: string;
    name: string;
    layout: any[];
    created_at: number;
}

export interface DashboardWidget {
    id: string;
    dashboard_id: string;
    title: string;
    query: string;
    sql: string;
    data: any[];
    c1_html: string;
    position: any;
    created_at: number;
}

export async function fetchDashboards(): Promise<{ dashboards: Dashboard[] } | null> {
    return apiFetch("/api/dashboards");
}

export async function createDashboard(name: string): Promise<any> {
    return apiFetch("/api/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
}

export async function fetchDashboard(id: string): Promise<{ dashboard: Dashboard, widgets: DashboardWidget[] } | null> {
    return apiFetch(`/api/dashboards/${id}`);
}

export async function updateDashboardLayout(id: string, layout: any[]): Promise<any> {
    return apiFetch(`/api/dashboards/${id}/layout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
    });
}

export async function deleteDashboard(id: string): Promise<any> {
    return apiFetch(`/api/dashboards/${id}`, { method: "DELETE" });
}

export async function addDashboardWidget(dashboardId: string, payload: Partial<DashboardWidget>): Promise<any> {
    return apiFetch(`/api/dashboards/${dashboardId}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

export async function removeDashboardWidget(dashboardId: string, widgetId: string): Promise<any> {
    return apiFetch(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, { method: "DELETE" });
}

export async function refreshDashboardWidget(dashboardId: string, widgetId: string): Promise<any> {
    return apiFetch(`/api/dashboards/${dashboardId}/widgets/${widgetId}/refresh`, { method: "POST" });
}

// ─────────────────────────────────────────────────────────────────────────────
// DB Explorer
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchExplorerSchema(alias: string): Promise<{ tables: { name: string; columns: { name: string; type: string }[] }[] } | null> {
    return apiFetch(`/api/explorer/schema?alias=${encodeURIComponent(alias)}`);
}

export async function fetchExplorerPreview(alias: string, tableName: string): Promise<{ columns: string[]; rows: Record<string, any>[] } | null> {
    return apiFetch(`/api/explorer/preview/${encodeURIComponent(tableName)}?alias=${encodeURIComponent(alias)}`);
}

export async function fetchExplorerQuery(payload: {
    alias: string;
    table: string;
    columns: string[];
    limit?: number;
    aggregate?: string;
}): Promise<{ columns: string[]; rows: Record<string, any>[] } | null> {
    return apiFetch("/api/explorer/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Saved Queries
// ─────────────────────────────────────────────────────────────────────────────

export async function saveSavedQuery(
    sessionId: string,
    query: string,
    sql: string,
    notes: string = ""
): Promise<{ status: string; data: SavedQuery } | null> {
    return apiFetch("/api/saved-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, query, sql, notes }),
    });
}

export async function listSavedQueries(
    limit: number = 50,
    offset: number = 0
): Promise<SavedQueriesResponse | null> {
    return apiFetch(`/api/saved-queries?limit=${limit}&offset=${offset}`);
}

export async function getSavedQuery(queryId: string): Promise<SavedQueryResponse | null> {
    return apiFetch(`/api/saved-queries/${queryId}`);
}

export async function listSessionSavedQueries(
    sessionId: string,
    limit: number = 50
): Promise<SavedQueriesResponse | null> {
    return apiFetch(`/api/saved-queries/sessions/${sessionId}/queries?limit=${limit}`);
}

export async function updateSavedQueryNotes(
    queryId: string,
    notes: string
): Promise<SavedQueryResponse | null> {
    return apiFetch(`/api/saved-queries/${queryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
    });
}

export async function deleteSavedQuery(queryId: string): Promise<{ status: string; query_id: string } | null> {
    return apiFetch(`/api/saved-queries/${queryId}`, { method: "DELETE" });
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket live feed
// ─────────────────────────────────────────────────────────────────────────────

export function createLiveSocket(
    onMessage?: (data: Record<string, unknown>) => void
): WebSocket | null {
    if (typeof window === "undefined") return null;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host =
        window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1"
            ? `${window.location.hostname}:8000`
            : window.location.host;

    const ws = new WebSocket(`${protocol}://${host}/ws/live`);

    ws.onmessage = (ev) => {
        try {
            const data = JSON.parse(ev.data);
            onMessage?.(data);
        } catch {
            /* ignore malformed */
        }
    };

    return ws;
}
