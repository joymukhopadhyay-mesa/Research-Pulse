import { stepHandler } from "@/lib/api";
import { deliverStep } from "@/lib/pipeline/deliver";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = stepHandler("deliver", (id) => deliverStep(id));
