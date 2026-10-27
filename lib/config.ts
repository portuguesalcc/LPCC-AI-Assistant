import { ThinkingLevel } from "@google/genai";

// Tried in order: if a model is overloaded, slow or retired, the next one answers.
// Tested with File Search on 2026-10-27; GEMINI_MODEL puts another model first.
export const GEMINI_MODELS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
];

// FAQ answers need little reasoning; low thinking keeps replies fast and cheap.
export const THINKING_CONFIG = { thinkingLevel: ThinkingLevel.LOW };

// The File Search store is found by this display name, so no database is needed.
export const STORE_DISPLAY_NAME = "lpcc-documentos-aprovados";

// Contacts taken from the approved LPCC FAQ (Núcleo Regional do Sul).
export const HELPLINE_TEXT =
  process.env.HELPLINE_TEXT ||
  "a Liga Portuguesa Contra o Cancro – Núcleo Regional do Sul, pelos telefones 217 264 099 ou 912 732 946";

// Limits that keep a public endpoint cheap and predictable.
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_HISTORY_MESSAGES = 12;
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}
