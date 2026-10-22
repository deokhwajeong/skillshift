/**
 * POST /api/live: run one pasted article through Live mode and stream progress.
 *
 * Request:  JSON { role, article: LiveArticleInput }, header x-live-passphrase.
 * Response: newline-delimited JSON, one LiveEvent per line, ending with either
 *           a "result" event or an "error" event. On "error" the page replays
 *           the cached run (data/generated/<role>/live-cache.json) and says so.
 *
 * Protection: the passphrase must match LIVE_MODE_PASSPHRASE. When that variable
 * is not set, Live mode only works on a local dev server, never on a deployment.
 * The API key stays on the server (ANTHROPIC_API_KEY); the browser never sees it.
 */
import { timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getScoringConfig, loadRoleData } from "@/lib/data";
import { createLlm } from "@/lib/llm";
import { loadTaxonomy } from "@/pipeline/loaders";
import { runLive } from "@/pipeline/live";
import { LiveArticleInput, type LiveEvent } from "@/pipeline/schemas";

/** Vercel stops the function after this many seconds. */
export const maxDuration = 60;
/** Our own budget, a little under maxDuration, so we can still send a clean error. */
const BUDGET_MS = 50_000;

const Body = z.object({ role: z.string(), article: LiveArticleInput });

function passphraseOk(given: string | null): boolean {
  const expected = process.env.LIVE_MODE_PASSPHRASE;
  if (!expected) return process.env.NODE_ENV === "development";
  const a = Buffer.from(given ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Short, human messages for the failures a demo is most likely to hit. */
function friendly(message: string): string {
  if (/authentication_error|invalid x-api-key/.test(message)) return "The server's Anthropic API key was rejected.";
  if (/\b429\b|rate_limit/.test(message)) return "The API is rate limiting us right now.";
  if (/\b529\b|overloaded/.test(message)) return "The API is overloaded right now.";
  return message.length > 200 ? `${message.slice(0, 200)}...` : message;
}

const errorResponse = (status: number, message: string) =>
  new Response(JSON.stringify({ type: "error", message } satisfies LiveEvent) + "\n", {
    status,
    headers: { "content-type": "application/x-ndjson" },
  });

export async function POST(request: Request) {
  if (!passphraseOk(request.headers.get("x-live-passphrase"))) {
    return errorResponse(401, process.env.LIVE_MODE_PASSPHRASE ? "Wrong passphrase." : "Live mode is not enabled on this deployment (no passphrase set).");
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return errorResponse(400, `Check the form: ${issue.path.join(".")}: ${issue.message}`);
  }
  const data = loadRoleData(parsed.data.role);
  if (!data) return errorResponse(404, `Role "${parsed.data.role}" has no dataset yet.`);
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return errorResponse(503, "No Anthropic API key is configured on the server.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: LiveEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Live run took longer than ${BUDGET_MS / 1000} seconds.`)), BUDGET_MS);
      });
      try {
        // One SDK retry and a per-request timeout keep a slow API from eating the whole budget.
        const llm = createLlm(new Anthropic({ maxRetries: 1, timeout: 40_000 }));
        const result = await Promise.race([
          runLive(
            parsed.data.article,
            {
              role: data.role,
              roleSkills: [...data.skills.values()],
              allSkills: loadTaxonomy().skills,
              config: getScoringConfig(),
              articles: data.articles,
              shifts: data.shifts,
              jdMentions: data.jdMentions,
              analyzedJdCount: data.summary.analyzedJdIds.length,
            },
            llm,
            send,
          ),
          timeout,
        ]);
        send({ type: "result", result });
      } catch (error) {
        send({ type: "error", message: friendly(error instanceof Error ? error.message : String(error)) });
      } finally {
        clearTimeout(timer);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
