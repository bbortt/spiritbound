/**
 * spacetimedb/integration/client.ts — thin REST client for a LIVE SpacetimeDB
 * instance, used only by the integration test suite (spacetimedb/integration/
 * *.integration.test.ts). Not part of the game module; never imported by
 * index.ts or rules/.
 *
 * Talks to the same HTTP API the `spacetime` CLI and the generated SDK use
 * under the hood: POST /v1/identity to mint an identity+token, POST
 * /v1/database/<db>/call/<snake_case_reducer> to invoke a reducer, and POST
 * /v1/database/<db>/sql to read state back out. This is a black-box client —
 * it only sees what any other connected client could see over the wire.
 */

const HOST = process.env.SPACETIME_HOST ?? 'http://localhost:3000';
const DB = process.env.SPACETIME_DB ?? 'spiritbound';

export class ReducerError extends Error {
  constructor(
    public readonly reducer: string,
    message: string,
  ) {
    super(`${reducer}: ${message}`);
  }
}

export interface TestIdentity {
  identity: string;
  token: string;
}

/** Mint a fresh SpacetimeDB identity + auth token. Every test uses its own. */
export async function mintIdentity(): Promise<TestIdentity> {
  const res = await fetch(`${HOST}/v1/identity`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(
      `mintIdentity failed: HTTP ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as TestIdentity;
}

/**
 * Call a reducer by its snake_case wire name (e.g. "start_life", "damage_enemy").
 * A thrown SenderError on the server surfaces here as HTTP 530 with the error
 * message as a plain-text body — this rethrows it as a ReducerError so tests
 * can assert on rejection with a readable message.
 */
export async function callReducer(
  token: string,
  reducer: string,
  args: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${HOST}/v1/database/${DB}/call/${reducer}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ReducerError(reducer, text || `HTTP ${res.status}`);
  }
}

export interface SqlResult {
  schema: { elements: { name: { some: string } }[] };
  rows: unknown[][];
}

/**
 * Run a read-only SQL query and return rows as plain objects keyed by column
 * name. Values are returned as the raw JSON the wire format uses for each
 * column's algebraic type — this only decodes far enough for the scalar
 * columns (bool/number/string) these tests actually select; keep SELECT
 * clauses scalar-only (avoid selecting Identity/Option/Sum columns) rather
 * than teaching this a full algebraic-type decoder.
 */
export async function sqlRows(
  token: string,
  query: string,
): Promise<Record<string, any>[]> {
  const res = await fetch(`${HOST}/v1/database/${DB}/sql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/sql',
    },
    body: query,
  });
  if (!res.ok) {
    throw new Error(`sql failed: HTTP ${res.status} ${await res.text()}`);
  }
  const [result] = (await res.json()) as SqlResult[];
  const columns = result.schema.elements.map((e) => e.name.some);
  return result.rows.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]])),
  );
}

/** True once the target SpacetimeDB instance answers /v1/identity. */
export async function isServerUp(): Promise<boolean> {
  try {
    const res = await fetch(`${HOST}/v1/identity`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}
