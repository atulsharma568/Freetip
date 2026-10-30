import "server-only";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

// Amazon Polly, Kajal (neural, Hindi + Indian English). The second engine: used
// only when Azure is not set up or fails. Own variable names, not AWS_*: Vercel
// reserves those.

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

export function pollyConfigured(): boolean {
  return getClient() !== null;
}

export async function pollySynthesize(text: string, language: "hi-IN" | "en-IN"): Promise<Uint8Array | null> {
  const polly = getClient();
  if (!polly) return null;
  try {
    const out = await polly.send(
      new SynthesizeSpeechCommand({
        Engine: "neural",
        VoiceId: "Kajal",
        LanguageCode: language,
        OutputFormat: "mp3",
        // Plain text, not SSML, so a fan can't inject markup.
        TextType: "text",
        Text: text,
      }),
      { abortSignal: AbortSignal.timeout(5000) },
    );
    return out.AudioStream ? await out.AudioStream.transformToByteArray() : null;
  } catch (err) {
    console.error("TTS: Polly failed.", err);
    return null;
  }
}
