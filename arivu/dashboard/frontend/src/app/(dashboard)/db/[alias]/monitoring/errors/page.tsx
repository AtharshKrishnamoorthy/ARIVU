"use client";

import { ErrorsTable } from "@/app/_components/errors-table";
import { useDashboard } from "@/app/(dashboard)/data-context";

export default function ErrorsPage() {
  const { errors, loading } = useDashboard();
  return <ErrorsTable errors={errors} loading={loading} />;
}
