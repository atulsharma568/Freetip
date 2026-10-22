import "server-only";
import postgres from "postgres";

// One small connection pool per server instance, reused across requests and
// across hot reloads in development. Null when DATABASE_URL isn't set, so the
// site still builds and runs without a database (the waitlist then says it
// isn't working). Use Neon's pooled connection string; `prepare: false` keeps
// it working through the pooler.
const cache = globalThis as unknown as { sql?: postgres.Sql };

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  cache.sql ??= postgres(url, {
    max: 3,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
  });
  return cache.sql;
}
