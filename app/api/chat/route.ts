import { NextResponse } from "next/server";
import { MAX_HISTORY_MESSAGES, MAX_MESSAGE_CHARS, THINKING_CONFIG } from "@/lib/config";
import { generateWithFallback, getStoreName, resetStoreCache } from "@/lib/gemini";
import { FALLBACK_ANSWER, NO_ANSWER_TOKEN, SYSTEM_PROMPT } from "@/lib/prompt";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { signSpeech } from "@/lib/speech-token";

export const runtime = "nodejs";
export const maxDuration = 60;

// About one question every 15 seconds per person; far above normal use.
const RATE_LIMIT = { hits: 20, windowMs: 5 * 60 * 1000 };

type ChatMessage = { role: "user" | "assistant"; text: string };

function parseMessages(body: unknown): ChatMessage[] | null {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  // Trimming can leave an assistant reply first; the conversation must start with the user.
  while (recent.length > 0 && recent[0]?.role === "assistant") recent.shift();
  if (recent.length === 0) return null;
  for (const m of recent) {
    if (
      !m ||
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.text !== "string" ||
      m.text.trim() === "" ||
      m.text.length > MAX_MESSAGE_CHARS
    ) {
      return null;
    }
  }
  if (recent[recent.length - 1].role !== "user") return null;
  return recent as ChatMessage[];
}

// Conversations are never stored or logged: the browser sends the history each time.
export async function POST(request: Request) {
  const started = Date.now();
  if (isRateLimited(`chat:${clientIp(request)}`, RATE_LIMIT.hits, RATE_LIMIT.windowMs)) {
    return NextResponse.json(
      { error: "Fez muitas perguntas seguidas. Aguarde alguns minutos e tente novamente." },
      { status: 429 },
    );
  }
  const messages = parseMessages(await request.json().catch(() => null));
  if (!messages) {
    return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  }

  try {
    const storeName = await getStoreName({ create: false });
    if (!storeName) {
      return NextResponse.json(
        { error: "O assistente ainda está a ser preparado. Tente novamente mais tarde." },
        { status: 503 },
      );
    }

    const response = await generateWithFallback({
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text }],
      })),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.2,
        thinkingConfig: THINKING_CONFIG,
        tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
      },
    }, { deadline: started + (maxDuration - 5) * 1000, perAttemptMs: 25_000 });

    const text = response.text?.trim() ?? "";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = [
      ...new Set(
        chunks.map((c) => c.retrievedContext?.title).filter((t): t is string => Boolean(t)),
      ),
    ];

    // Safety net: an answer not backed by a retrieved document is never shown.
    // Sources are only checked here, not shown to the user.
    const answer =
      !text || text.includes(NO_ANSWER_TOKEN) || sources.length === 0 ? FALLBACK_ANSWER : text;
    // The token lets the page ask /api/speak to read this exact answer aloud.
    return NextResponse.json({ text: answer, speechToken: signSpeech(answer) });
  } catch (err) {
    console.error("chat failed:", err instanceof Error ? err.message : "unknown error");
    // The store may have been recreated; look it up again on the next request.
    resetStoreCache();
    return NextResponse.json(
      { error: "Ocorreu um erro. Tente novamente dentro de momentos." },
      { status: 500 },
    );
  }
}
