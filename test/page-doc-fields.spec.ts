import { expect, test } from "@playwright/test";
import { BLOCK_TYPES, defaultSettings } from "../src/lib/page-doc/blocks";
import { defaultPageDoc, ownerPageDoc } from "../src/lib/page-doc/defaults";
import { addBlock } from "../src/lib/page-doc/edit";
import { CHOICE_FIELDS, RANGE_FIELDS, TEXT_FIELDS, textFieldsFor } from "../src/lib/page-doc/fields";
import { parsePageDoc } from "../src/lib/page-doc/parse";
import type { Block, BlockType, PageDoc } from "../src/lib/page-doc/types";

// The field table (page builder phase 2) is what the editor draws its settings panel from, so it
// has to agree with the parser: every limit, and every setting a block has.

// Settings the table does not list as a text or choice field, because they have their own editor
// or are not editable.
// The pictures are chosen in the library picker, the rank bar has its own editor, and the meter's
// goal, rank words, colour and celebration have theirs.
const OTHER = new Set(["ladder", "asset", "bannerAsset", "goal", "levels", "fill", "celebrate"]);

const withSetting = (doc: PageDoc, type: BlockType, patch: Record<string, unknown>): PageDoc => ({
  ...doc,
  blocks: doc.blocks.map((b) => (b.type === type ? ({ ...b, settings: { ...b.settings, ...patch } } as Block) : b)),
});

test.describe("the field table agrees with the parser", () => {
  test("every text field's limit is the length the parser cuts at", () => {
    for (const type of BLOCK_TYPES) {
      for (const field of TEXT_FIELDS[type]) {
        // A handle may hold only some characters, so test it with letters it allows.
        const long = "a".repeat(field.max + 25);
        const base =
          type === "creatorLinks" || type === "strip" || type === "successScreen" ? ownerPageDoc() : type === "pressureMeter" ? addBlock(defaultPageDoc(), type).doc : defaultPageDoc();
        const patch = { [field.key]: long, ...(type === "successScreen" ? { style: "owner" } : {}) };
        const parsed = parsePageDoc(withSetting(base, type, patch))!;
        const block = parsed.doc.blocks.find((b) => b.type === type)!;
        const stored = (block.settings as Record<string, unknown>)[field.key];
        // An Instagram handle longer than its limit is not cut, it is refused whole.
        const expected = field.key === "instagram" ? "" : "a".repeat(field.max);
        expect(stored, `${type}.${field.key}`).toBe(expected);
      }
    }
  });

  test("every setting a block has is in the table, or has its own editor", () => {
    for (const type of BLOCK_TYPES) {
      const listed = new Set([...TEXT_FIELDS[type].map((f) => f.key), ...CHOICE_FIELDS[type].map((f) => f.key), ...RANGE_FIELDS[type].map((f) => f.key)]);
      for (const key of Object.keys(defaultSettings(type))) {
        const special = OTHER.has(key) || OTHER.has(`${key}:${type}`);
        expect(listed.has(key) || special, `${type}.${key}`).toBe(true);
      }
    }
  });

  test("every field in the table is a setting the block really has", () => {
    for (const type of BLOCK_TYPES) {
      const keys = new Set(Object.keys(defaultSettings(type)));
      for (const field of [...TEXT_FIELDS[type], ...CHOICE_FIELDS[type], ...RANGE_FIELDS[type]]) expect(keys.has(field.key), `${type}.${field.key}`).toBe(true);
    }
  });

  test("the standard wording of a field is within its own limit", () => {
    for (const type of BLOCK_TYPES) for (const field of TEXT_FIELDS[type]) expect(Array.from(field.standard).length).toBeLessThanOrEqual(field.max);
  });

  test("the small line on the thank-you screen applies only to the sign-off style", () => {
    expect(textFieldsFor("successScreen", { style: "default", line: "" }).map((f) => f.key)).toEqual([]);
    expect(textFieldsFor("successScreen", { style: "owner", line: "" }).map((f) => f.key)).toEqual(["line"]);
  });

  test("the header and the QR have nothing to edit", () => {
    expect(TEXT_FIELDS.header).toEqual([]);
    expect(TEXT_FIELDS.qr).toEqual([]);
  });
});
