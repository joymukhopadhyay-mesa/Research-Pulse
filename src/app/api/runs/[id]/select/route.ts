import { stepHandler } from "@/lib/api";
import { selectStep } from "@/lib/pipeline/select";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export const POST = stepHandler("select", (id) => selectStep(id));
