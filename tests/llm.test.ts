import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AgentFailure, createLlm, type MessagesClient } from "@/lib/llm";
import { Excerpt } from "@/pipeline/schemas";

/** A fake Anthropic client that replays canned replies and records requests. */
function fakeClient(replies: { text: string; stop?: string }[]) {
  const requests: { messages: unknown[] }[] = [];
  let i = 0;
  const client = {
    messages: {
      create: async (params: { messages: unknown[] }) => {
        requests.push({ messages: structuredClone(params.messages) });
        const reply = replies[i++];
        return {
          content: [{ type: "text", text: reply.text }],
          stop_reason: reply.stop ?? "end_turn",
          usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50 },
        };
      },
    },
  } as unknown as MessagesClient;
  return { client, requests };
}

const schema = z.object({ excerpt: Excerpt, score: z.number().min(0).max(1) });
const request = { agent: "test", itemId: "a1", model: "m", effort: "low" as const, system: "s", user: "u", schema };

describe("llm.call", () => {
  it("returns validated output and logs tokens", async () => {
    const { client } = fakeClient([{ text: '{"excerpt":"short quote","score":0.9}' }]);
    const llm = createLlm(client);
    await expect(llm.call(request)).resolves.toEqual({ excerpt: "short quote", score: 0.9 });
    expect(llm.logs[0]).toMatchObject({ agent: "test", itemId: "a1", ok: true, retries: 0, inputTokens: 100, cacheReadTokens: 50 });
  });

  it("retries once with the validation problem, then succeeds", async () => {
    const tooLong = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen";
    const { client, requests } = fakeClient([
      { text: JSON.stringify({ excerpt: tooLong, score: 0.9 }) },
      { text: '{"excerpt":"one two three","score":0.9}' },
    ]);
    const llm = createLlm(client);
    await expect(llm.call(request)).resolves.toMatchObject({ excerpt: "one two three" });
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requests[1].messages)).toContain("at most 14 words");
    expect(llm.logs[0]).toMatchObject({ ok: true, retries: 1, inputTokens: 200 });
  });

  it("gives up after two invalid answers", async () => {
    const { client } = fakeClient([{ text: "not json" }, { text: '{"excerpt":"x","score":7}' }]);
    const llm = createLlm(client);
    await expect(llm.call(request)).rejects.toBeInstanceOf(AgentFailure);
    expect(llm.logs[0]).toMatchObject({ ok: false, retries: 1 });
  });

  it("does not retry a refusal", async () => {
    const { client, requests } = fakeClient([{ text: "", stop: "refusal" }]);
    await expect(createLlm(client).call(request)).rejects.toThrow(/declined/);
    expect(requests).toHaveLength(1);
  });
});
