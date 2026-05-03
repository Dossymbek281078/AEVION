import type { NextRequest } from "next/server";
import {
  attachRateHeaders,
  gateRequest,
  withCors,
} from "../../_lib";
import { processDue, queueStats, readQueue } from "../../_webhook_queue";

function isAuthorizedCron(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  // Allow normal API keys to trigger as well (manual flush from dashboard)
  if (/^Bearer\s+(sk_test_|sk_live_)/i.test(auth)) return true;
  return false;
}

async function runCron(): Promise<Response> {
  const result = await processDue();
  return withCors(
    Response.json({ object: "cron.run", at: Date.now(), ...result })
  );
}

export async function GET(req: NextRequest) {
  // Vercel Cron sends GET requests with x-vercel-cron: 1 header.
  if (req.headers.get("x-vercel-cron") === "1") {
    return runCron();
  }
  // Otherwise authenticate and return queue stats.
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const run = url.searchParams.get("run") === "1";
  if (run) return runCron();
  const includeData = url.searchParams.get("include") === "data";
  const stats = await queueStats();
  const body: Record<string, unknown> = { stats };
  if (includeData) {
    const all = await readQueue();
    body.data = all.slice(0, 100);
  }
  return attachRateHeaders(withCors(Response.json(body)), gate.rateHeaders);
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return withCors(
      Response.json(
        {
          error: {
            type: "authentication_error",
            message:
              "Provide x-vercel-cron, CRON_SECRET, or a Bearer sk_test_/sk_live_ key.",
          },
        },
        { status: 401 }
      )
    );
  }
  return runCron();
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
