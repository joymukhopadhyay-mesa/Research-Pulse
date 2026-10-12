import { NextResponse } from "next/server";
import { failRun } from "./runs";

type Ctx = { params: Promise<{ id: string }> };

/** Wraps a pipeline step: on failure the error is written to the run row so the UI can offer a retry. */
export function stepHandler(step: string, fn: (id: string, req: Request) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    const { id } = await ctx.params;
    try {
      return NextResponse.json(await fn(id, req));
    } catch (e) {
      const message = (e as Error).message || "Unknown error";
      try {
        await failRun(id, step, e);
      } catch {
        // The original error is more useful to the client than a logging failure.
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
