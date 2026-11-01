import "server-only";
import { azureVoice, buildSsml, type SpeechLanguage, type VoiceGender } from "@/lib/tts-pure";

// Azure Speech over its REST API (no SDK). The free F0 tier gives 500,000
// characters a month. AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (for example
// centralindia) turn it on.

export function azureConfigured(): boolean {
  return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

export async function azureSynthesize(
  text: string,
  language: SpeechLanguage,
  gender: VoiceGender = "female",
): Promise<{ audio: Uint8Array; voice: string } | null> {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  // Azure's portal shows "Central India"; the endpoint wants "centralindia".
  const region = process.env.AZURE_SPEECH_REGION?.trim().toLowerCase().replace(/[\s_]+/g, "");
  if (!key || !region) return null;
  if (!/^[a-z0-9-]{3,40}$/.test(region)) {
    console.error("TTS: AZURE_SPEECH_REGION is not a valid region code (use for example centralindia).");
    return null;
  }
  const voice = azureVoice(language, process.env, gender);
  try {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "Freetip",
      },
      body: buildSsml(text, language, voice),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      // 401 bad key, 429 over the free limit (20 requests a minute), 5xx outage.
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      console.error(`TTS: Azure answered ${res.status} for region ${region}. ${detail}`);
      return null;
    }
    return { audio: new Uint8Array(await res.arrayBuffer()), voice };
  } catch (err) {
    console.error("TTS: Azure failed.", err);
    return null;
  }
}
