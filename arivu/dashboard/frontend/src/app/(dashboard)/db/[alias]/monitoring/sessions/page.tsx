"use client";

import { useState } from "react";
import { SessionsTable } from "@/app/_components/sessions-table";
import { SessionDrawer } from "@/app/_components/session-drawer";
import { useDashboard } from "@/app/(dashboard)/data-context";

export default function SessionsPage() {
  const { sessions, loading } = useDashboard();
  const [drawerSession, setDrawerSession] = useState<string | null>(null);

  return (
    <>
      <SessionsTable
        sessions={sessions}
        loading={loading}
        onSelect={setDrawerSession}
      />
      <SessionDrawer
        sessionId={drawerSession}
        open={!!drawerSession}
        onClose={() => setDrawerSession(null)}
      />
    </>
  );
}
