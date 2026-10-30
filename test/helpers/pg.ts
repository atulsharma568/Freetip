import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { LedgerDb, Query } from "../../src/lib/accrual";

// An in-memory Postgres with the real schema: db/schema-users.sql, then every
// migration in db/migrations in order. It runs the SQL itself (triggers,
// constraints, deferred checks) but is one connection with no pooler, so it cannot
// show lock races: those need a real database.
const dbDir = join(__dirname, "..", "..", "db");

export const migrationFiles = () =>
  readdirSync(join(dbDir, "migrations"))
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();

export const readMigration = (file: string) => readFileSync(join(dbDir, "migrations", file), "utf8");

export async function freshDatabase(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(readFileSync(join(dbDir, "schema-users.sql"), "utf8"));
  for (const file of migrationFiles()) {
    try {
      await pg.exec(readMigration(file));
    } catch (err) {
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return pg;
}

// The slice of postgres.js the money code uses: a tagged template that returns
// rows, and `begin` for a transaction.
type Client = Pick<PGlite, "query">;
const run =
  (client: Client): Query =>
  async (strings, ...values) => {
    const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""), "");
    // postgres.js turns the value bound to a json/jsonb parameter into JSON itself, so a
    // string there would be stored as a quoted string (PGlite would quietly accept it).
    // Refuse it here so that mistake cannot pass these tests.
    for (const m of text.matchAll(/\$(\d+)::jsonb?\b/g)) {
      if (typeof values[Number(m[1]) - 1] === "string") {
        throw new Error(`Parameter $${m[1]} is a string bound to json: pass an object (postgres.js would double-encode it)`);
      }
    }
    const res = await client.query(text, values as unknown[]);
    return res.rows as never;
  };

export function asLedgerDb(pg: PGlite): LedgerDb {
  const db = run(pg) as LedgerDb;
  db.begin = (fn) => pg.transaction((tx) => fn(run(tx)));
  return db;
}
