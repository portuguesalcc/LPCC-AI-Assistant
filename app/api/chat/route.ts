import { NextResponse } from "next/server";
import { GEMINI_MODEL, MAX_HISTORY_MESSAGES, MAX_MESSAGE_CHARS, THINKING_CONFIG } from "@/lib/config";
import { gemini, getStoreName } from "@/lib/gemini";
import { FALLBACK_ANSWER, NO_ANSWER_TOKEN, SYSTEM_PROMPT } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; text: string };

function parseMessages(body: unknown): ChatMessage[] | null {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
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

    const response = await gemini().models.generateContent({
      model: GEMINI_MODEL,
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text }],
      })),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.2,
        thinkingConfig: THINKING_CONFIG,
        tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
        // Fail with a friendly message rather than hitting the platform time limit.
        httpOptions: { timeout: 45_000 },
      },
    });

    const text = response.text?.trim() ?? "";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = [
      ...new Set(
        chunks.map((c) => c.retrievedContext?.title).filter((t): t is string => Boolean(t)),
      ),
    ];

    // Safety net: an answer not backed by a retrieved document is never shown.
    if (!text || text.includes(NO_ANSWER_TOKEN) || sources.length === 0) {
      return NextResponse.json({ text: FALLBACK_ANSWER, sources: [] });
    }
    return NextResponse.json({ text, sources });
  } catch (err) {
    console.error("chat failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json(
      { error: "Ocorreu um erro. Tente novamente dentro de momentos." },
      { status: 500 },
    );
  }
}
