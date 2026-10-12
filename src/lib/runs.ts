import { one, q } from "./db";
import type { Domain, Run, RunProgress } from "./types";

export async function getRun(id: string): Promise<Run | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return one<Run>("select * from runs where id = $1", [id]);
}

/** Merge a patch into runs.progress at a top-level key. */
export async function patchProgress<K extends keyof RunProgress>(id: string, key: K, value: RunProgress[K]) {
  await q("update runs set progress = jsonb_set(progress, $2, $3::jsonb, true) where id = $1", [
    id,
    `{${key}}`,
    JSON.stringify(value),
  ]);
}

export async function setFetchState(id: string, source: string, domain: string, state: unknown) {
  await q(
    `update runs set progress = jsonb_set(
       jsonb_set(progress, '{fetch}', coalesce(progress->'fetch', '{}'::jsonb), true),
       array['fetch', $2::text], coalesce(progress->'fetch'->$2, '{}'::jsonb) || jsonb_build_object($3::text, $4::jsonb), true)
     where id = $1`,
    [id, source, domain, JSON.stringify(state)],
  );
}

export async function logRun(id: string, msg: string) {
  await q("update runs set log = log || jsonb_build_array(jsonb_build_object('at', now(), 'msg', $2::text)) where id = $1", [
    id,
    msg,
  ]);
}

export async function setStatus(id: string, status: string, step?: string) {
  await q("update runs set status = $2, step = coalesce($3, step), error = null where id = $1", [id, status, step ?? null]);
}

export async function failRun(id: string, step: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  await q("update runs set status = 'failed', step = $2, error = $3 where id = $1", [id, step, msg]);
  await logRun(id, `${step} failed: ${msg}`);
}

export function domainsOf(run: Run): Domain[] {
  return Array.isArray(run.domains) ? run.domains : [];
}

const ORDER = ["fetch", "score", "select", "write", "deliver", "done"];
export function stepIndex(step: string) {
  return ORDER.indexOf(step);
}
