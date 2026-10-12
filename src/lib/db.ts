import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | null = null;

function getClient() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Add it in your environment variables.");
    client = neon(url);
  }
  return client;
}

/** Run a parameterised query and return rows. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await getClient().query(text, params);
  return rows as T[];
}

/** Runs several statements atomically (one Neon HTTP transaction). */
export async function tx(statements: [string, unknown[]][]): Promise<void> {
  const c = getClient();
  await c.transaction(statements.map(([text, params]) => c.query(text, params)));
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}
