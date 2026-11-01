import { readFileSync } from "node:fs";

// config.json, checked once at start so a typo is a clear sentence and not a crash later.

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
// Only Discord's own webhook address (the same rule Freetip applies).
const WEBHOOK = /^https:\/\/(?:(?:www|canary|ptb)\.)?(?:discord|discordapp)\.com\/api\/(?:v\d+\/)?webhooks\/\d{15,25}\/[A-Za-z0-9_-]{20,120}$/;
const SOURCES = ["chat", "tip", "goal"];

export const DEFAULTS = {
  freetipUrl: "https://freetip.in",
  obs: { url: "ws://127.0.0.1:4455", password: "" },
  sources: SOURCES,
  maxUploadMb: 10,
  secondsBefore: 20,
  secondsAfter: 10,
};

// Returns { ok: true, config } or { ok: false, errors: [sentence, ...] }.
export function validateConfig(raw) {
  const errors = [];
  const c = raw && typeof raw === "object" ? raw : {};

  const freetipUrl = String(c.freetipUrl ?? DEFAULTS.freetipUrl).replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/]+/.test(freetipUrl)) errors.push('"freetipUrl" must be a web address such as https://freetip.in');

  if (typeof c.helperToken !== "string" || !TOKEN.test(c.helperToken)) {
    errors.push('"helperToken" is missing or wrong. Make one on the Timestamps page in Freetip and paste all of it.');
  }
  if (typeof c.discordWebhook !== "string" || !WEBHOOK.test(c.discordWebhook)) {
    errors.push('"discordWebhook" is missing or is not a Discord webhook address (it starts with https://discord.com/api/webhooks/).');
  }

  const obsUrl = String(c.obs?.url ?? DEFAULTS.obs.url);
  if (!/^wss?:\/\/[^\s/]+/.test(obsUrl)) errors.push('"obs.url" must look like ws://127.0.0.1:4455');

  const sources = c.sources === undefined ? DEFAULTS.sources : c.sources;
  if (!Array.isArray(sources) || !sources.length || sources.some((s) => !SOURCES.includes(s))) {
    errors.push('"sources" must be a list made of "chat", "tip" and "goal".');
  }

  const num = (key, min, max, fallback) => {
    const v = c[key] ?? fallback;
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
      errors.push(`"${key}" must be a number from ${min} to ${max}.`);
      return fallback;
    }
    return v;
  };
  const maxUploadMb = num("maxUploadMb", 1, 100, DEFAULTS.maxUploadMb);
  const secondsBefore = num("secondsBefore", 0, 120, DEFAULTS.secondsBefore);
  const secondsAfter = num("secondsAfter", 0, 60, DEFAULTS.secondsAfter);

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    config: {
      freetipUrl,
      helperToken: c.helperToken,
      discordWebhook: c.discordWebhook,
      obs: { url: obsUrl, password: String(c.obs?.password ?? "") },
      sources,
      maxUploadMb,
      secondsBefore,
      secondsAfter,
    },
  };
}

export function loadConfig(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { ok: false, errors: [`Could not read ${path}. Copy config.example.json to config.json and fill it in.`] };
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, errors: [`${path} is not valid JSON (${err.message}). Check commas and quotes.`] };
  }
  return validateConfig(raw);
}
