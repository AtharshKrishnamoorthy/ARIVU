"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setActiveConnection, fetchConnections } from "@services/api";

interface DBContextValue {
  alias: string;
  dialect: string;
  status: "idle" | "connecting" | "connected" | "error";
  error: string | null;
  activate: () => Promise<void>;
}

const DBCtx = createContext<DBContextValue>({
  alias: "", dialect: "", status: "idle", error: null, activate: async () => {},
});

export function DBProvider({ alias, children }: { alias: string; children: React.ReactNode }) {
  const [status, setStatus] = useState<DBContextValue["status"]>("idle");
  const [error, setError]   = useState<string | null>(null);
  const [dialect, setDialect] = useState("");

  const activate = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      // Look up dialect from saved connections
      const res = await fetchConnections();
      const conn = (res?.connections || []).find((c: any) => c.alias === alias);
      if (conn) setDialect(conn.dialect || "");



      await setActiveConnection(alias);
      setStatus("connected");
    } catch (err: any) {
      setError(err.message || "Failed to connect");
      setStatus("error");
    }
  }, [alias]);

  useEffect(() => { activate(); }, [activate]);

  return (
    <DBCtx.Provider value={{ alias, dialect, status, error, activate }}>
      {children}
    </DBCtx.Provider>
  );
}

export const useDB = () => useContext(DBCtx);
