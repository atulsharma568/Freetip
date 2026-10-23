import "server-only";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { languageFor } from "@/lib/tts-rules";

// Amazon Polly, Kajal (neural, Hindi + Indian English). Own variable names, not
// AWS_*: Vercel reserves those. Without them text-to-speech is simply off and
// alerts play silently. To move to another engine later (Sarvam), only
// synthesize() changes.

let client: PollyClient | null | undefined;

function getClient(): PollyClient | null {
  if (client !== undefined) return client;
  const accessKeyId = process.env.POLLY_ACCESS_KEY_ID;
  const secretAccessKey = process.env.POLLY_SECRET_ACCESS_KEY;
  client =
    accessKeyId && secretAccessKey
      ? new PollyClient({
          // Kajal neural is offered in Mumbai.
          region: process.env.POLLY_REGION || "ap-south-1",
          credentials: { accessKeyId, secretAccessKey },
        })
      : null;
  return client;
}

export function ttsConfigured(): boolean {
  return getClient() !== null;
}

// MP3 bytes for the text, or null if speech is off or the engine failed.
export async function synthesize(text: string): Promise<Uint8Array | null> {
  const polly = getClient();
  if (!polly) return null;
  try {
    const out = await polly.send(
      new SynthesizeSpeechCommand({
        Engine: "neural",
        VoiceId: "Kajal",
        LanguageCode: languageFor(text),
        OutputFormat: "mp3",
        // Plain text, not SSML, so a fan can't inject markup.
        TextType: "text",
        Text: text,
      }),
      { abortSignal: AbortSignal.timeout(5000) },
    );
    return out.AudioStream ? await out.AudioStream.transformToByteArray() : null;
  } catch {
    return null;
  }
}
