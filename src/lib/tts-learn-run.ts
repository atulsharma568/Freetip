import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getDb } from "@/lib/db";
import { knowsWord } from "@/lib/hinglish";
import {
  LEARN_MAX_PER_RUN,
  LEARN_MAX_TOTAL,
  LEARN_MIN_SEEN,
  LEARN_SYSTEM,
  VerdictList,
  decide,
} from "@/lib/tts-learn";

// Owner switch, like TTS_ENABLED: learning runs only with TTS_AUTOLEARN=true and an
// ANTHROPIC_API_KEY in Vercel.
export function autolearnEnabled(): boolean {
  return process.env.TTS_AUTOLEARN === "true" && !!process.env.ANTHROPIC_API_KEY;
}

// One run of the daily job: classify the most common unknown words with a language model, save
// the ones our own rules accept, and mark every word it answered so it is not asked
// again. Returns a one-line summary. A failed or refused request changes nothing, so
// the words are simply asked again tomorrow.
export async function learnWords(): Promise<string> {
  if (!autolearnEnabled()) return "off";
  const db = getDb();
  if (!db) return "no database";

  const [{ n }] = await db<{ n: number }[]>`select count(*)::int as n from tts_learned_words`;
  if (n >= LEARN_MAX_TOTAL) return `learned-word limit (${LEARN_MAX_TOTAL}) reached`;

  const open = await db<{ word: string }[]>`
    select word from tts_unknown_words
    where not reviewed and seen >= ${LEARN_MIN_SEEN}
    order by seen desc, last_seen desc limit ${LEARN_MAX_PER_RUN}
  `;
  // Words someone added to the dictionary by hand since they were logged.
  const known = open.filter((r) => knowsWord(r.word)).map((r) => r.word);
  if (known.length) {
    await db`update tts_unknown_words set reviewed = true, outcome = 'known' where word = any(${known})`;
  }
  const words = open.map((r) => r.word).filter((w) => !known.includes(w));
  if (!words.length) return `nothing to learn (${known.length} already known)`;

  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    system: LEARN_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(words) }],
    output_config: { format: zodOutputFormat(VerdictList) },
  });
  if (response.stop_reason === "refusal") return "the model declined; nothing changed";
  if (!response.parsed_output) return "no usable answer; nothing changed";

  const asked = new Set(words);
  const learned: Array<[string, string]> = [];
  const english: string[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  for (const v of response.parsed_output.words) {
    const d = decide(asked, v);
    const word = v.word.trim().toLowerCase();
    if (!d || seen.has(word)) continue;
    seen.add(word);
    if (d.outcome === "learned") learned.push([word, d.devanagari]);
    else if (d.outcome === "english") english.push(word);
    else rejected.push(word);
  }

  await db.begin(async (tx) => {
    for (const [word, dev] of learned) {
      await tx`insert into tts_learned_words (word, devanagari) values (${word}, ${dev}) on conflict (word) do nothing`;
    }
    const mark = async (list: string[], outcome: string) => {
      if (list.length) {
        await tx`update tts_unknown_words set reviewed = true, outcome = ${outcome} where word = any(${list})`;
      }
    };
    await mark(learned.map(([w]) => w), "learned");
    await mark(english, "english");
    await mark(rejected, "rejected");
  });
  return `${learned.length} learned, ${english.length} English, ${rejected.length} rejected, ${words.length - seen.size} unanswered`;
}
