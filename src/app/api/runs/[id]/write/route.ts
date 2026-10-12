import { stepHandler } from "@/lib/api";
import { writeStep } from "@/lib/pipeline/write";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export const POST = stepHandler("write", (id) => writeStep(id));
