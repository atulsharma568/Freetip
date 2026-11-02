// Search and paging for the owner's finance tables. The rows are already read in full
// (the totals above each table need all of them), so this works on that list in memory.

export const ROWS_PER_PAGE = 25;

export interface ListQuery {
  q: string;
  page: number;
}

// The search text and page number from the address, made safe.
export function parseListQuery(params: { q?: string; page?: string }): ListQuery {
  return {
    q: (params.q ?? "").trim().slice(0, 100),
    page: Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  };
}

// Rows whose text (any of the given strings) contains the search, ignoring case.
export function searchRows<T>(rows: T[], q: string, texts: (row: T) => (string | null)[]): T[] {
  const needle = q.trim().toLowerCase();
  if (needle === "") return rows;
  return rows.filter((r) => texts(r).some((t) => t?.toLowerCase().includes(needle)));
}

// One page of rows. A page past the end shows the last one, so a stale link never
// lands on an empty table.
export function pageOfRows<T>(rows: T[], page: number, size = ROWS_PER_PAGE): { rows: T[]; page: number; total: number } {
  const last = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), last);
  return { rows: rows.slice((current - 1) * size, current * size), page: current, total: rows.length };
}

// The address of a list page, keeping the search and any other filter (the date range).
export function listHref(path: string, keep: Record<string, string>, q: string, page = 1): string {
  const sp = new URLSearchParams(keep);
  if (q) sp.set("q", q);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}
