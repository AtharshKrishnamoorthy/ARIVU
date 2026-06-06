// ─────────────────────────────────────────────────────────────────────────────
// Arivu Dashboard — Type definitions matching backend API (server.py)
// ─────────────────────────────────────────────────────────────────────────────

/** A single node execution inside a pipeline trace. */
export interface TraceEvent {
  node: string;
  latency_ms: number;
  status: "ok" | "fail" | "retry" | "skip";
}

/** A single rendered chat message (frontend only — built from HistoryEntry). */
export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  sql?: string | null;
  error?: string | null;
  ts: number;
  responseMs?: number;  // latency in ms for bot messages
  results_truncated?: boolean;
  limits?: {
    max_query_chars: number;
    max_result_rows: number;
    max_retries: number;
  };
  /* ── Thesys C1 Generative UI fields ── */
  raw_result?: Record<string, unknown>[] | null;
  has_tabular_data?: boolean;
  c1_response?: string | null;
  visualizing?: boolean;
  question_text?: string;   // original user question for this exchange
}

/** One complete pipeline execution trace. */
export interface Trace {
  question: string;
  sql: string;
  ts: number;
  session_id: string;
  events: TraceEvent[];
  dialect?: string;
  connection_meta?: {
    dialect?: string;
    display?: string;
    mode?: string;
  };
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
  dialect?: string;
  interface?: string;
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
  dialect?: string;
  interface?: string;
  connection_meta?: {
    dialect?: string;
    display?: string;
    mode?: string;
  };
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
  dialect?: string;
  interface?: string;
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

/** GET /api/config or /api/chat/config response — rate-limit transparency. */
export interface RateLimitConfig {
  limits: {
    max_query_chars: number;
    max_result_rows: number;
    max_retries: number;
  };
}

/** Per-query usage stats returned in chat/POST /api/chat response body. */
export interface QueryUsage {
  results_truncated: boolean;
  limits: {
    max_query_chars: number;
    max_result_rows: number;
    max_retries: number;
  };
  query_chars: number;
  result_rows: number;
}

/** POST /api/chat response — full chat message response with limits. */
export interface ChatResponse {
  response: string;           // LLM response text
  sql: string;               // Generated SQL query
  error: string | null;      // Error message if failed
  raw_result: Record<string, unknown>[] | null;  // Query results
  has_tabular_data: boolean;  // Whether raw_result contains tabular data
  results_truncated: boolean; // Whether results were truncated
  limits: {
    max_query_chars: number;
    max_result_rows: number;
    max_retries: number;
  };
  _cached?: boolean;         // Indicates if result came from cache
}

/** A saved query bookmark with optional notes. */
export interface SavedQuery {
  id: string;                  // UUID
  session_id: string;          // originating chat session
  query: string;               // natural language question
  sql: string;                 // generated SQL
  notes: string;               // user annotations / documentation
  created_at: number;          // timestamp (seconds)
  updated_at: number;          // timestamp (seconds)
}

/** GET /api/saved-queries response. */
export interface SavedQueriesResponse {
  status: string;
  data: SavedQuery[];
}

/** GET /api/saved-queries/:id response. */
export interface SavedQueryResponse {
  status: string;
  data: SavedQuery;
}
