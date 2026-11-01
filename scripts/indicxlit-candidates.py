#!/usr/bin/env python3
"""Offline helper: suggest Devanagari spellings for the voice's unknown words.

Reads the CSV from /admin/tts-words (voice-words.csv, "word,seen"), drops words the
dictionary already has, asks IndicXlit (AI4Bharat, Apache-2.0) for its best Hindi
spellings and writes a review file. Nothing here ships to the site: the owner reads
the review file and says which rows to add to src/lib/hinglish-words.ts.

Setup and use: see docs/indicxlit.md. Run with --no-model to test the CSV handling
without installing the model.
"""
import argparse
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DICT_FILES = [ROOT / "src/lib/hinglish-words.ts", ROOT / "src/lib/hinglish-verbs.ts"]


def known_words() -> set:
    """Quoted keys such as "bhai": in the dictionary files (an over-count is harmless)."""
    found = set()
    for f in DICT_FILES:
        if f.exists():
            found.update(re.findall(r'"([a-z][a-z\']*)"\s*:', f.read_text(encoding="utf-8").lower()))
    return found


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv_in", help="voice-words.csv exported from /admin/tts-words")
    ap.add_argument("-o", "--out", default="indicxlit-review.csv")
    ap.add_argument("--top", type=int, default=3, help="candidates per word (default 3)")
    ap.add_argument("--min-seen", type=int, default=1, help="skip words seen fewer times")
    ap.add_argument("--no-model", action="store_true", help="only filter and write the file")
    args = ap.parse_args()

    with open(args.csv_in, newline="", encoding="utf-8") as fh:
        rows = [(r["word"].strip().lower(), int(r["seen"])) for r in csv.DictReader(fh) if r.get("word")]

    known = known_words()
    todo = [(w, n) for w, n in rows if w not in known and n >= args.min_seen and w.isascii() and w.replace("'", "").isalpha()]
    print(f"{len(rows)} words in the file, {len(rows) - len(todo)} skipped (known, rare or not plain letters), {len(todo)} to suggest.")

    engine = None
    if not args.no_model:
        try:
            from ai4bharat.transliteration import XlitEngine  # type: ignore
        except ImportError:
            print("IndicXlit is not installed. Follow docs/indicxlit.md, or use --no-model.", file=sys.stderr)
            return 1
        engine = XlitEngine("hi", beam_width=10, rescore=True, src_script_type="en")

    with open(args.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["word", "seen"] + [f"candidate{i + 1}" for i in range(args.top)] + ["approve (y/n or your own spelling)"])
        for word, seen in todo:
            cands = []
            if engine:
                out = engine.translit_word(word, topk=args.top)
                cands = out.get("hi", []) if isinstance(out, dict) else []
            w.writerow([word, seen] + (cands + [""] * args.top)[: args.top] + [""])
    print(f"Wrote {args.out}. Open it in a spreadsheet, fill the last column, say so.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
