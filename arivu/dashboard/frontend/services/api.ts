import type {
    TracesResponse,
    SessionsResponse,
    ErrorsResponse,
    RLHFResponse,
    SessionDetail,
    DashboardStats,
    HealthResponse,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Base URL — in dev points to the FastAPI backend on port 9000
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE =
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
            try {
                const err = await res.json();
                throw new Error(err.detail || `HTTP Error ${res.status}`);
            } catch (e) {
                if (e instanceof Error) throw e;
                throw new Error(`HTTP Error ${res.status}`);
            }
        }
        return (await res.json()) as T;
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

// ── Command Center ───────────────────────────────────────────────────────────

export async function fetchConnections(): Promise<any> {
    return apiFetch("/api/connections");
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

export async function chatDB(message: string, session_id: string): Promise<any> {
    return apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, session_id })
    });
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
            ? `${window.location.hostname}:9000`
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
