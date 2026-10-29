import { NextResponse } from "next/server";
import { MAX_SPEECH_CHARS, TTS_MODELS, TTS_VOICE } from "@/lib/config";
import { generateWithFallback } from "@/lib/gemini";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { speechChunks } from "@/lib/speech";
import { isValidSpeechToken } from "@/lib/speech-token";

export const runtime = "nodejs";
export const maxDuration = 60;

// Each answer is read in a few parts, so this allows roughly 30 answers per 5 minutes.
const RATE_LIMIT = { hits: 120, windowMs: 5 * 60 * 1000 };

/** Gemini returns raw 16-bit PCM; browsers need a WAV header to play it. */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM header size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // bytes per second
  header.writeUInt16LE(2, 32); // bytes per sample
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Reads one part of an assistant answer aloud with a natural Gemini voice.
// The page asks for the parts in order, so reading starts before the whole answer is ready.
export async function POST(request: Request) {
  const started = Date.now();
  if (isRateLimited(`speak:${clientIp(request)}`, RATE_LIMIT.hits, RATE_LIMIT.windowMs)) {
    return NextResponse.json({ error: "Demasiados pedidos." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text || text.length > MAX_SPEECH_CHARS || !isValidSpeechToken(text, body?.token)) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const part = speechChunks(text)[Number.isInteger(body?.part) ? body.part : 0];
  if (!part) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    const response = await generateWithFallback(
      {
        // Only the answer itself: voice models may read any added instructions out loud.
        // The accent comes from languageCode, which is never spoken.
        contents: [{ role: "user", parts: [{ text: part }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            languageCode: "pt-PT",
            voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } },
          },
        },
      },
      { deadline: started + (maxDuration - 5) * 1000, perAttemptMs: 25_000, models: TTS_MODELS },
    );

    const audio = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!audio?.data) throw new Error("No audio in response");

    const pcm = Buffer.from(audio.data, "base64");
    const rate = Number(audio.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24000);
    const wav = audio.mimeType?.includes("wav") ? pcm : pcmToWav(pcm, rate);

    return new NextResponse(new Uint8Array(wav), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("speak failed:", err instanceof Error ? err.message.slice(0, 200) : "unknown error");
    return NextResponse.json({ error: "Não foi possível gerar o áudio." }, { status: 502 });
  }
}
