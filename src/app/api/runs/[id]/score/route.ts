import { stepHandler } from "@/lib/api";
import { scoreStep } from "@/lib/pipeline/score";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export const POST = stepHandler("score", (id) => scoreStep(id));
