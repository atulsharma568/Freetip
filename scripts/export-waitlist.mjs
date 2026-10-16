import { open } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const columns = [
  "email",
  "handle",
  "channel_url",
  "source",
  "consent_version",
  "created_at",
];

function csvField(value) {
  if (value === null || value === undefined) return "";

  const text = value instanceof Date ? value.toISOString() : String(value);
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

  return /[",\r\n]/.test(safeText)
    ? `"${safeText.replaceAll('"', '""')}"`
    : safeText;
}

export function buildWaitlistCsv(rows) {
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => csvField(row[column])).join(","));

  return [header, ...body].join("\n");
}

function isAlreadyExistsError(error) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "EEXIST"
  );
}

export async function exportWaitlist() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required to export the waitlist.");
    return 1;
  }

  const outputName = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
  const outputPath = path.join(process.cwd(), outputName);
  let sql;

  try {
    sql = postgres(databaseUrl, {
      max: 1,
      prepare: false,
      connect_timeout: 10,
      onnotice: false,
    });

    const rows = await sql.begin("read only", async (tx) =>
      tx`
        select
          email,
          handle,
          channel_url,
          source,
          consent_version,
          created_at
        from waitlist
        order by created_at
      `,
    );

    const file = await open(outputPath, "wx");
    try {
      await file.writeFile(buildWaitlistCsv(rows), "utf8");
    } finally {
      await file.close();
    }

    console.log(`${rows.length} rows exported to ${outputName}`);
    return 0;
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      console.error(`Refusing to overwrite existing file: ${outputName}.`);
    } else {
      console.error("Waitlist export failed.");
    }
    return 1;
  } finally {
    if (sql) await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}

const isMain = path.basename(process.argv[1] ?? "") === "export-waitlist.mjs";

if (isMain) {
  exportWaitlist().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    () => {
      console.error("Waitlist export failed.");
      process.exitCode = 1;
    },
  );
}
