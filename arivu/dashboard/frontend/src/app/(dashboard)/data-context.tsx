"use client";

import { createContext, useContext, useCallback, useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { fetchStats, fetchTraces, fetchSessions, fetchErrors, fetchRLHF } from "@services/api";
import type { DashboardStats, Trace, Session, ErrorEntry, RLHFEntry } from "@services/types";

interface DashboardData {
  stats: DashboardStats | null;
  traces: Trace[];
  sessions: Session[];
  errors: ErrorEntry[];
  rlhf: RLHFEntry[];
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<DashboardData>({
  stats: null, traces: [], sessions: [], errors: [], rlhf: [],
  loading: true, refreshing: false, refresh: async () => {},
});

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [traces, setTraces]     = useState<Trace[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [errors, setErrors]     = useState<ErrorEntry[]>([]);
  const [rlhf, setRlhf]         = useState<RLHFEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const started = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [s, t, sess, e, r] = await Promise.allSettled([
        fetchStats(),
        fetchTraces(undefined, 50),
        fetchSessions(50),
        fetchErrors(100),
        fetchRLHF(100),
      ]);
      if (s.status === "fulfilled") setStats(s.value);
      if (t.status === "fulfilled") setTraces(t.value?.traces ?? []);
      if (sess.status === "fulfilled") setSessions(sess.value?.sessions ?? []);
      if (e.status === "fulfilled") setErrors(e.value?.errors ?? []);
      if (r.status === "fulfilled") setRlhf(r.value?.rlhf ?? []);
    } catch (err) {
      console.error("Dashboard data load failed:", err);
    } finally {
      setLoading(false);
      if (isRefresh) { setRefreshing(false); toast.success("Dashboard refreshed."); }
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return (
    <Ctx.Provider value={{ stats, traces, sessions, errors, rlhf, loading, refreshing, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useDashboard = () => useContext(Ctx);
