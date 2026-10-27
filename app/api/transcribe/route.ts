import { NextResponse } from "next/server";
import { GEMINI_MODEL, MAX_AUDIO_BYTES } from "@/lib/config";
import { gemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

// Turns a short voice recording into text. The audio is not stored.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Gravação inválida ou demasiado longa." }, { status: 400 });
  }

  try {
    const mimeType = (audio.type || "audio/webm").split(";")[0];
    const data = Buffer.from(await audio.arrayBuffer()).toString("base64");

    const response = await gemini().models.generateContent({
      model: GEMINI_MODEL,
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
      config: { temperature: 0 },
    });

    return NextResponse.json({ text: response.text?.trim() ?? "" });
  } catch (err) {
    console.error("transcribe failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json(
      { error: "Não foi possível perceber a gravação. Tente novamente." },
      { status: 500 },
    );
  }
}
