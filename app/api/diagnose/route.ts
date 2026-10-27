import { NextResponse } from "next/server";
import { secretMatches } from "@/lib/admin-auth";
import { GEMINI_MODELS, THINKING_CONFIG } from "@/lib/config";
import { gemini, getStoreName } from "@/lib/gemini";
import { SYSTEM_PROMPT } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const ENV_NAMES = [
  "GEMINI_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_DRIVE_FOLDER_ID",
  "CRON_SECRET",
  "ADMIN_SYNC_SECRET",
];

// The models the chat falls back through, tested side by side with File Search.
const CANDIDATES = GEMINI_MODELS.map((model) => ({ model, lowThinking: true }));

const TEST_TIMEOUT_MS = 25_000;

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function testModel(storeName: string, model: string, lowThinking: boolean) {
  const started = Date.now();
  const took = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
  try {
    const response = await gemini().models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: "Como posso pedir apoio social?" }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.2,
        ...(lowThinking ? { thinkingConfig: THINKING_CONFIG } : {}),
        tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
        httpOptions: { timeout: TEST_TIMEOUT_MS },
      },
    });
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    return {
      model,
      lowThinking,
      ok: true,
      took: took(),
      sources: chunks.length,
      preview: (response.text ?? "").slice(0, 160),
    };
  } catch (err) {
    return { model, lowThinking, ok: false, took: took(), error: message(err).slice(0, 300) };
  }
}

// Admin-only health check: runs the same steps as the chat and reports what fails.
export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-admin-secret"), process.env.ADMIN_SYNC_SECRET)) {
    return NextResponse.json({ error: "Palavra-passe incorreta." }, { status: 401 });
  }

  const report: Record<string, unknown> = {
    modelOrder: GEMINI_MODELS,
    envMissing: ENV_NAMES.filter((name) => !process.env[name]),
  };

  let storeName: string | null = null;
  try {
    storeName = await getStoreName({ create: false });
    if (storeName) {
      const store = await gemini().fileSearchStores.get({ name: storeName });
      report.store = {
        active: store.activeDocumentsCount ?? "0",
        pending: store.pendingDocumentsCount ?? "0",
        failed: store.failedDocumentsCount ?? "0",
      };
    } else {
      report.store = "not found (run a sync first)";
    }
  } catch (err) {
    report.storeError = message(err);
  }

  if (storeName) {
    const name = storeName;
    report.modelTests = await Promise.all(
      CANDIDATES.map((c) => testModel(name, c.model, c.lowThinking)),
    );
  }

  return NextResponse.json(report);
}
