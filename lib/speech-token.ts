import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "./config";

/**
 * Signs answers so /api/speak only reads text this assistant wrote. Without it,
 * anyone could use the endpoint as a free text-to-speech service on LPCC's bill.
 */
function signingKey(): Buffer {
  const secret = process.env.SPEECH_SECRET;
  if (secret) return Buffer.from(secret);
  // No extra setting needed: derive a separate key from the Gemini key.
  return createHash("sha256").update(`lpcc-speech:${requireEnv("GEMINI_API_KEY")}`).digest();
}

export function signSpeech(text: string): string {
  return createHmac("sha256", signingKey()).update(text).digest("base64url");
}

export function isValidSpeechToken(text: string, token: unknown): boolean {
  if (typeof token !== "string") return false;
  const expected = Buffer.from(signSpeech(text));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
