import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const DIGEST_MODEL = "claude-opus-5-5";

export const DigestSchema = z.object({
  headline: z.string().describe("At most 10 words. Punchy, honest."),
  verdict: z.enum(["crushing_it", "on_track", "mixed", "off_track"]),
  summary: z.string().describe("2–3 sentences on the week in context of the trend."),
  wins: z.array(z.string()).describe("1–3 specific wins backed by numbers from the data."),
  realityChecks: z.array(z.string()).describe("0–3 blunt, specific problems. Empty if none."),
  focus: z
    .array(z.object({ action: z.string().describe("Concrete action for the coming week."), why: z.string().describe("One sentence tying it to the data.") }))
    .describe("Exactly 3 items, most important first."),
});
export type Digest = z.infer<typeof DigestSchema>;

// Stable system prompt. It's too small and too infrequent (weekly) to benefit from prompt caching, so none is used.
const SYSTEM = `You are HankGainz Coach, writing a weekly check-in for one lifter based only on the JSON the user message provides.

How to coach:
- Be encouraging when it's earned and blunt when they're off track. A "reality check" names the problem and its likely consequence plainly. Never insulting.
- Respect the athlete's stated preferences; never flag things they've said are intentional.
- Goals change over time: judge each period against the goal phase it belonged to (phaseHistory), and the present against the current phase. An "Off plan" phase had no goal; describe it honestly, don't grade it.
- Prioritize: bodyweight trend vs. target rate first, then strength progress on key lifts, then protein, then consistency and steps.
- Use only numbers that appear in the data. Simple comparisons (e.g. week vs. target) are fine; don't invent new statistics.
- Guideline grade A/B means research-backed ("research suggests…"); grade C is a rule of thumb, so word it that way. Patterns in their own data are correlation, not proof.
- Units: lb, kcal, grams; protein in g per lb of bodyweight.
- Training and nutrition guidance only, no medical advice. If something looks medically concerning, suggest checking with a doctor.
- Write tight: short sentences, no filler, no emojis.`;

export interface DigestResult {
  digest: Digest;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export class DigestError extends Error {}

/** One Claude call: aggregates in, validated structured digest out. `client` is injectable for tests. */
export async function writeDigest(payload: Record<string, unknown>, client: Anthropic = new Anthropic()): Promise<DigestResult> {
  const response = await client.beta.messages.parse({
    model: DIGEST_MODEL,
    max_tokens: 16000,
    // Server-side fallback: if a safety classifier declines, the API retries on a fallback model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(DigestSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Here is this week's data. Write the weekly digest.\n\n${JSON.stringify(payload)}` }],
  });

  if (response.stop_reason === "refusal") throw new DigestError("The model declined to write this digest. Try again later.");
  if (response.stop_reason === "max_tokens") throw new DigestError("The digest was cut off. Try again.");
  const digest = response.parsed_output;
  if (!digest) throw new DigestError("The model's response didn't match the digest format.");

  return {
    digest: { ...digest, focus: digest.focus.slice(0, 3), wins: digest.wins.slice(0, 3), realityChecks: digest.realityChecks.slice(0, 3) },
    model: response.model,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
  };
}

/** Human-readable message for API failures (typed SDK errors, most specific first). */
export function describeDigestError(e: unknown): string {
  if (e instanceof DigestError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "The API key was rejected. Check ANTHROPIC_API_KEY in .env.local.";
  if (e instanceof Anthropic.PermissionDeniedError) return "This API key doesn't have access to the model.";
  if (e instanceof Anthropic.RateLimitError) return "Rate limited by the API. Wait a minute and try again.";
  if (e instanceof Anthropic.APIConnectionError) return "Couldn't reach the Claude API. Check your internet connection.";
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status ?? ""}: ${e.message}`;
  if (e instanceof Anthropic.AnthropicError) return e.message;
  return (e as Error)?.message ?? "Unknown error";
}

export const hasApiCredentials = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
