"use client";

import { RLHFTable } from "@/app/_components/rlhf-table";
import { useDashboard } from "@/app/(dashboard)/data-context";

export default function FeedbackPage() {
  const { rlhf, loading } = useDashboard();
  return <RLHFTable entries={rlhf} loading={loading} />;
}
