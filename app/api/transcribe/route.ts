import { NextResponse } from "next/server";
import { MAX_AUDIO_BYTES, THINKING_CONFIG } from "@/lib/config";
import { generateWithFallback } from "@/lib/gemini";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_LIMIT = { hits: 15, windowMs: 5 * 60 * 1000 };

// Only real voice recordings are accepted, so this can't be used to analyse other files.
const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/wav",
  "audio/aac",
]);

// Turns a short voice recording into text. The audio is not stored.
export async function POST(request: Request) {
  const started = Date.now();
  if (isRateLimited(`voice:${clientIp(request)}`, RATE_LIMIT.hits, RATE_LIMIT.windowMs)) {
    return NextResponse.json(
      { error: "Fez muitos pedidos seguidos. Aguarde alguns minutos e tente novamente." },
      { status: 429 },
    );
  }
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const mimeType = audio instanceof Blob ? (audio.type || "audio/webm").split(";")[0] : "";
  if (
    !(audio instanceof Blob) ||
    audio.size === 0 ||
    audio.size > MAX_AUDIO_BYTES ||
    !AUDIO_TYPES.has(mimeType)
  ) {
    return NextResponse.json({ error: "Gravação inválida ou demasiado longa." }, { status: 400 });
  }

  try {
    const data = Buffer.from(await audio.arrayBuffer()).toString("base64");

    const response = await generateWithFallback({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data } },
            {
              text:
                "Transcreve exatamente o que a pessoa diz nesta gravação, na língua falada " +
                "(normalmente português europeu). Devolve apenas a transcrição, sem comentários. " +
                "Se não houver fala percetível, devolve uma resposta vazia.",
            },
          ],
        },
      ],
      config: {
        temperature: 0,
        thinkingConfig: THINKING_CONFIG,
      },
    }, { deadline: started + (maxDuration - 5) * 1000, perAttemptMs: 20_000 });

    return NextResponse.json({ text: response.text?.trim() ?? "" });
  } catch (err) {
    console.error("transcribe failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json(
      { error: "Não foi possível perceber a gravação. Tente novamente." },
      { status: 500 },
    );
  }
}
