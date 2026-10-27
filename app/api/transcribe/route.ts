import { NextResponse } from "next/server";
import { MAX_AUDIO_BYTES, THINKING_CONFIG } from "@/lib/config";
import { generateWithFallback } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

// Turns a short voice recording into text. The audio is not stored.
export async function POST(request: Request) {
  const started = Date.now();
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Gravação inválida ou demasiado longa." }, { status: 400 });
  }

  try {
    const mimeType = (audio.type || "audio/webm").split(";")[0];
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
