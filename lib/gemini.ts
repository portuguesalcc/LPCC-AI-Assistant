import { GoogleGenAI } from "@google/genai";
import { STORE_DISPLAY_NAME, requireEnv } from "./config";

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
