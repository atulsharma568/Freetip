import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Encrypts the two secrets we must be able to use later (a creator's YouTube refresh
// token and Discord webhook URL), so a copy of the database alone does not hold them.
// AES-256-GCM; the key is YT_TOKEN_KEY, 32 random bytes as base64
// (openssl rand -base64 32). Losing or changing the key makes stored secrets unreadable:
// creators then reconnect, nothing else breaks.

const PREFIX = "v1";

function keyFrom(keyBase64: string | undefined): Buffer | null {
  if (!keyBase64) return null;
  const key = Buffer.from(keyBase64, "base64");
  return key.length === 32 ? key : null;
}

export const secretBoxAvailable = (keyBase64 = process.env.YT_TOKEN_KEY) => keyFrom(keyBase64) !== null;

export function seal(plaintext: string, keyBase64 = process.env.YT_TOKEN_KEY): string {
  const key = keyFrom(keyBase64);
  if (!key) throw new Error("YT_TOKEN_KEY is missing or is not 32 bytes of base64.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [PREFIX, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

// The plaintext, or null if the value is not ours, was tampered with, or the key changed.
export function open(sealed: string | null | undefined, keyBase64 = process.env.YT_TOKEN_KEY): string | null {
  const key = keyFrom(keyBase64);
  if (!key || !sealed) return null;
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== PREFIX || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
