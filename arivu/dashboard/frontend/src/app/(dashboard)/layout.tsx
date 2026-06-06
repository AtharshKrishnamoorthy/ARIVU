"use client";

import { DashboardDataProvider, useDashboard } from "./data-context";
import { DashboardShell } from "./shell";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/* Thesys C1 Generative UI styles (charts, tables, cards) */
import "@crayonai/react-ui/styles/index.css";

function ShellWithData({ children }: { children: React.ReactNode }) {
  const { errors } = useDashboard();
  return <DashboardShell errorCount={errors.length}>{children}</DashboardShell>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <DashboardDataProvider>
        <ShellWithData>{children}</ShellWithData>
      </DashboardDataProvider>
    </ErrorBoundary>
  );
}
