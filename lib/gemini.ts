import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";
import { GEMINI_MODELS, STORE_DISPLAY_NAME, requireEnv } from "./config";

let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  return client;
}

let cachedStoreName: string | null = null;

/**
 * Returns the File Search store holding LPCC's approved documents.
 * With `create`, the store is created on first use (only the sync job does this).
 */
export async function getStoreName({ create }: { create: boolean }): Promise<string | null> {
  if (cachedStoreName) return cachedStoreName;

  const stores = await gemini().fileSearchStores.list({ config: { pageSize: 20 } });
  for await (const store of stores) {
    if (store.displayName === STORE_DISPLAY_NAME && store.name) {
      cachedStoreName = store.name;
      return cachedStoreName;
    }
  }

  if (!create) return null;
  const created = await gemini().fileSearchStores.create({
    config: { displayName: STORE_DISPLAY_NAME },
  });
  cachedStoreName = created.name ?? null;
  return cachedStoreName;
}

/**
 * Calls Gemini with each model in GEMINI_MODELS until one answers, so a busy or
 * retired model doesn't take the assistant down. Stops trying near the deadline.
 */
export async function generateWithFallback(
  params: Omit<GenerateContentParameters, "model">,
  { deadline, perAttemptMs }: { deadline: number; perAttemptMs: number },
): Promise<GenerateContentResponse> {
  let lastError: unknown = new Error("No model attempted");
  for (const model of GEMINI_MODELS) {
    const remaining = deadline - Date.now();
    if (remaining < 5_000) break;
    try {
      return await gemini().models.generateContent({
        ...params,
        model,
        config: {
          ...params.config,
          httpOptions: { timeout: Math.min(perAttemptMs, remaining) },
        },
      });
    } catch (err) {
      lastError = err;
      console.error(`gemini ${model} failed:`, err instanceof Error ? err.message.slice(0, 200) : "");
    }
  }
  throw lastError;
}
