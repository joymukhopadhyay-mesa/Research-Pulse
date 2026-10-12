import { RunDriver } from "@/components/RunDriver";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunDriver runId={id} />;
}
