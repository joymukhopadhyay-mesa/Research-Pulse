import { TopicsEditor } from "@/components/TopicsEditor";
import { PageHeader } from "@/components/ui";
import { q } from "@/lib/db";
import type { Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const topics = await q<Topic>("select * from topics order by created_at, name");
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Topics"
        sub="The domains you monitor. Changes apply to the next brief, with no redeploy."
      />
      <TopicsEditor initial={topics} />
    </div>
  );
}
