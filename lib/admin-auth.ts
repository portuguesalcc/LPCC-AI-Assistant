import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { clientIp, hasReachedLimit, isRateLimited } from "./rate-limit";

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Checks a secret sent with an admin request. Returns an error response to send back,
 * or null when the secret is correct. Repeated wrong guesses from one IP are blocked
 * for a while, so the password can't be brute-forced.
 */
export function rejectUnlessSecret(
  request: Request,
  given: string | null,
  expected: string | undefined,
): NextResponse | null {
  const key = `admin-fail:${clientIp(request)}`;
  if (hasReachedLimit(key, MAX_FAILURES, FAILURE_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Demasiadas tentativas. Tente novamente dentro de 15 minutos." },
      { status: 429 },
    );
  }
  if (secretMatches(given, expected)) return null;
  isRateLimited(key, MAX_FAILURES, FAILURE_WINDOW_MS);
  return NextResponse.json({ error: "Palavra-passe incorreta." }, { status: 401 });
}
