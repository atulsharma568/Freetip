import { expect, test } from "@playwright/test";
import { listHref, pageOfRows, parseListQuery, searchRows } from "../src/lib/admin/list-view";

const rows = Array.from({ length: 60 }, (_, i) => ({ name: i % 2 ? `Riya ${i}` : null, handle: `h${i}` }));

test.describe("owner list search and paging", () => {
  test("search ignores case, matches any field and skips empty ones", () => {
    const found = searchRows(rows, "  RIYA 5 ", (r) => [r.name, r.handle]);
    expect(found.map((r) => r.handle)).toEqual(["h5", "h51", "h53", "h55", "h57", "h59"]);
    expect(searchRows(rows, "h1", (r) => [r.name, r.handle]).length).toBe(11);
    expect(searchRows(rows, "", (r) => [r.name]).length).toBe(60);
  });

  test("pages hold 25 rows and a page past the end shows the last", () => {
    expect(pageOfRows(rows, 1).rows.length).toBe(25);
    expect(pageOfRows(rows, 3).rows.length).toBe(10);
    const past = pageOfRows(rows, 99);
    expect(past.page).toBe(3);
    expect(past.rows.length).toBe(10);
    expect(pageOfRows([], 5)).toEqual({ rows: [], page: 1, total: 0 });
  });

  test("the address is made safe", () => {
    expect(parseListQuery({ q: " x ", page: "abc" })).toEqual({ q: "x", page: 1 });
    expect(parseListQuery({ page: "-4" }).page).toBe(1);
    expect(parseListQuery({ q: "a".repeat(300) }).q.length).toBe(100);
  });

  test("links keep the range and the search", () => {
    expect(listHref("/p", { range: "this_week" }, "riya", 2)).toBe("/p?range=this_week&q=riya&page=2");
    expect(listHref("/p", {}, "", 1)).toBe("/p");
  });
});
