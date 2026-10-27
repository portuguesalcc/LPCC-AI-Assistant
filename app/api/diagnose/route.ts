import { NextResponse } from "next/server";
import { secretMatches } from "@/lib/admin-auth";
import { GEMINI_MODEL, THINKING_CONFIG } from "@/lib/config";
import { gemini, getStoreName } from "@/lib/gemini";
import { SYSTEM_PROMPT } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 120;

const ENV_NAMES = [
  "GEMINI_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_DRIVE_FOLDER_ID",
  "CRON_SECRET",
  "ADMIN_SYNC_SECRET",
];

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Admin-only health check: runs the same steps as the chat and reports what fails.
export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-admin-secret"), process.env.ADMIN_SYNC_SECRET)) {
    return NextResponse.json({ error: "Palavra-passe incorreta." }, { status: 401 });
  }

  const started = Date.now();
  const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
  const report: Record<string, unknown> = {
    model: GEMINI_MODEL,
    envMissing: ENV_NAMES.filter((name) => !process.env[name]),
  };

  try {
    const models: string[] = [];
    const pager = await gemini().models.list({ config: { pageSize: 100 } });
    for await (const m of pager) {
      if (m.name?.includes("gemini") && m.supportedActions?.includes("generateContent")) {
        models.push(m.name.replace("models/", ""));
      }
    }
    report.availableModels = models;
    report.modelAvailable = models.includes(GEMINI_MODEL);
    report.modelsCheckedAt = elapsed();
  } catch (err) {
    report.modelsError = message(err);
  }

  let storeName: string | null = null;
  try {
    storeName = await getStoreName({ create: false });
    if (storeName) {
      const store = await gemini().fileSearchStores.get({ name: storeName });
      report.store = {
        name: storeName,
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
    try {
      const response = await gemini().models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: "Como posso pedir apoio social?" }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.2,
          thinkingConfig: THINKING_CONFIG,
          tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
        },
      });
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      report.testAnswer = {
        ok: true,
        took: elapsed(),
        sources: chunks.length,
        preview: (response.text ?? "").slice(0, 300),
      };
    } catch (err) {
      report.testAnswer = { ok: false, took: elapsed(), error: message(err) };
    }
  }

  return NextResponse.json(report);
}
