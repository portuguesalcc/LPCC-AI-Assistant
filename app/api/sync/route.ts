import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncDriveToFileSearch } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function runSync() {
  try {
    // Leave a margin before the function's time limit.
    const report = await syncDriveToFileSearch(Date.now() + (maxDuration - 40) * 1000);
    return NextResponse.json(report);
  } catch (err) {
    console.error("sync failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}

// Daily Vercel Cron job. Vercel sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? null;
  if (!secretMatches(token, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync();
}

// "Sync now" button on /admin.
export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-admin-secret"), process.env.ADMIN_SYNC_SECRET)) {
    return NextResponse.json({ error: "Palavra-passe incorreta." }, { status: 401 });
  }
  return runSync();
}
