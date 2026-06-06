import { redirect } from "next/navigation";
export default async function MonitoringIndex({ params }: { params: Promise<{ alias: string }> }) {
  const resolvedParams = await params;
  redirect(`/db/${encodeURIComponent(resolvedParams.alias)}/monitoring/overview`);
}
