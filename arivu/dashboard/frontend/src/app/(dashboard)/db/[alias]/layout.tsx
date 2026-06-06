"use client";

import { use } from "react";
import { DBProvider, useDB } from "../../db-context";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw, Database } from "lucide-react";

function DBGate({ children }: { children: React.ReactNode }) {
  const { alias, status, error, activate } = useDB();

  if (status === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="rounded-full bg-primary/10 p-5 mb-5">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Connecting to {alias}…</h2>
        <p className="text-sm text-muted-foreground mt-1">Setting up the database session.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="rounded-full bg-destructive/10 p-5 mb-5">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold">Connection Failed</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">{error}</p>
        <Button onClick={activate} className="mt-6 gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  if (status === "idle") return null;

  return <>{children}</>;
}

export default function DBWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ alias: string }>;
}) {
  const { alias } = use(params);
  const decodedAlias = decodeURIComponent(alias);

  return (
    <DBProvider alias={decodedAlias}>
      <DBGate>{children}</DBGate>
    </DBProvider>
  );
}
