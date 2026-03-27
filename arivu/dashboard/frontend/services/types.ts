// ─────────────────────────────────────────────────────────────────────────────
// Arivu Dashboard — Type definitions matching backend API (server.py)
// ─────────────────────────────────────────────────────────────────────────────

/** A single node execution inside a pipeline trace. */
export interface TraceEvent {
  node: string;
  latency_ms: number;
  status: "ok" | "fail" | "retry" | "skip";
}

/** One complete pipeline execution trace. */
export interface Trace {
  question: string;
  sql: string;
  ts: number;
  session_id: string;
  events: TraceEvent[];
}

/** GET /api/traces response. */
export interface TracesResponse {
  traces: Trace[];
  count: number;
}

/** A session summary row. */
export interface Session {
  session_id: string;
  query_count: number;
  error_count: number;
  last_question: string;
  last_ts: number;
}

/** GET /api/sessions response. */
export interface SessionsResponse {
  sessions: Session[];
  count: number;
}

/** A single error log entry. */
export interface ErrorEntry {
  error: string;
  error_node: string;
  error_type: string;
  question: string;
  sql: string;
  session_id: string;
  ts: number;
}

/** GET /api/errors response. */
export interface ErrorsResponse {
  errors: ErrorEntry[];
  count: number;
}

/** A single RLHF feedback entry. */
export interface RLHFEntry {
  signal: "positive" | "negative";
  question: string;
  sql: string;
  approved: boolean | null;
  session_id: string;
  ts: number;
}

/** GET /api/rlhf response. */
export interface RLHFResponse {
  rlhf: RLHFEntry[];
  count: number;
}

/** A single conversation turn in session history. */
export interface HistoryEntry {
  question: string;
  sql: string;
  response: string;
  ts: number;
}

/** GET /api/session/{sid} response — full session detail. */
export interface SessionDetail {
  session_id: string;
  history: HistoryEntry[];
  traces: Trace[];
  errors: ErrorEntry[];
  rlhf: RLHFEntry[];
}

/** GET /api/stats response — aggregate dashboard metrics. */
export interface DashboardStats {
  total_sessions: number;
  total_queries: number;
  total_errors: number;
  error_rate: number;
  positive_rlhf: number;
  negative_rlhf: number;
  avg_latency_ms: number;
  node_avg_latency: Record<string, number>;
}

/** GET /api/health response. */
export interface HealthResponse {
  status: string;
  ts: number;
}
