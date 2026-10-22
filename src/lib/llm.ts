/**
 * llm.ts: the ONE place the app talks to Claude.
 *
 * Every LLM agent calls `llm.call(...)` with a system prompt, a user message,
 * and a Zod schema. This wrapper:
 *   1. asks Claude for JSON that matches the schema (structured outputs),
 *   2. validates the reply with Zod (which also checks rules JSON Schema
 *      cannot express, such as "excerpt is at most 14 words"),
 *   3. on a validation failure, retries ONCE, telling the model what was wrong,
 *   4. records tokens, latency, and retries for the cost and latency log.
 *
 * Failure behavior: API errors (after the SDK's own network retries), refusals,
 * and a second validation failure all throw AgentFailure. The orchestrator
 * catches it, skips that one item, and records the failure.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { AgentRunLog } from "@/pipeline/schemas";

export type Effort = "low" | "medium" | "high";

export interface StructuredCall<S extends z.ZodType> {
  /** Agent name, used in logs (e.g. "filter"). */
  agent: string;
  /** What this call is about (e.g. an article id), used in logs. */
  itemId: string;
  model: string;
  effort: Effort;
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
}

export class AgentFailure extends Error {
  constructor(
    public readonly agent: string,
    public readonly itemId: string,
    message: string,
  ) {
    super(`${agent} failed on ${itemId}: ${message}`);
    this.name = "AgentFailure";
  }
}

/** The slice of the Anthropic client we use, so tests can pass a fake. */
export type MessagesClient = Pick<Anthropic, "messages">;

export interface Llm {
  call<S extends z.ZodType>(req: StructuredCall<S>): Promise<z.infer<S>>;
  /** One row per call, appended as calls finish. */
  readonly logs: AgentRunLog[];
}

const MAX_ATTEMPTS = 2; // first try + one retry on invalid output

/** Model for an agent: a per-agent override (ANTHROPIC_MODEL_FILTER) or the shared default. */
export function modelFor(agent: string): string {
  const override = process.env[`ANTHROPIC_MODEL_${agent.toUpperCase().replaceAll("-", "_")}`];
  return override || process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
}

/** `signal` cancels in-flight requests (Live mode aborts when its time budget runs out). */
export function createLlm(client: MessagesClient = new Anthropic(), options: { signal?: AbortSignal } = {}): Llm {
  const logs: AgentRunLog[] = [];

  async function call<S extends z.ZodType>(req: StructuredCall<S>): Promise<z.infer<S>> {
    const format = zodOutputFormat(req.schema);
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: req.user }];
    const started = performance.now();
    const usage = { input: 0, output: 0, cacheRead: 0 };
    let attempts = 0;

    const finish = (ok: boolean) =>
      logs.push({
        agent: req.agent,
        itemId: req.itemId,
        model: req.model,
        inputTokens: usage.input,
        outputTokens: usage.output,
        cacheReadTokens: usage.cacheRead,
        ms: Math.round(performance.now() - started),
        ok,
        retries: Math.max(0, attempts - 1),
      });

    try {
      while (attempts < MAX_ATTEMPTS) {
        attempts++;
        const response = await client.messages.create({
          model: req.model,
          max_tokens: req.maxTokens ?? 16000,
          // The system prompt (instructions + taxonomy) is identical across items,
          // so we mark it cacheable: later calls read it at a fraction of the cost.
          system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
          messages,
          output_config: {
            effort: req.effort,
            format: { type: "json_schema", schema: format.schema },
          },
        }, { signal: options.signal });
        usage.input += response.usage.input_tokens;
        usage.output += response.usage.output_tokens;
        usage.cacheRead += response.usage.cache_read_input_tokens ?? 0;

        if (response.stop_reason === "refusal") {
          throw new AgentFailure(req.agent, req.itemId, "the model declined this request");
        }

        const text = response.content
          .flatMap((block) => (block.type === "text" ? [block.text] : []))
          .join("");
        const problem = validate(text, req.schema, response.stop_reason);
        if (problem.ok) {
          finish(true);
          return problem.data;
        }

        // Show the model its own answer and what was wrong, then ask again.
        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content: `Your previous answer failed validation:\n${problem.issues}\nReturn the corrected JSON only.`,
        });
      }
      throw new AgentFailure(req.agent, req.itemId, `output failed validation ${MAX_ATTEMPTS} times`);
    } catch (error) {
      finish(false);
      if (error instanceof AgentFailure) throw error;
      if (error instanceof Anthropic.APIError) {
        throw new AgentFailure(req.agent, req.itemId, `API error ${error.status ?? ""}: ${error.message}`);
      }
      throw error;
    }
  }

  return { call, logs };
}

type Validation<T> = { ok: true; data: T } | { ok: false; issues: string };

function validate<S extends z.ZodType>(text: string, schema: S, stopReason: string | null): Validation<z.infer<S>> {
  if (stopReason === "max_tokens") return { ok: false, issues: "- the answer was cut off; keep it shorter" };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, issues: "- the answer was not valid JSON" };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n"),
  };
}
