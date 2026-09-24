import "server-only";
import OpenAI from "openai";

export const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
let client: OpenAI | undefined;
const openai = () =>
  (client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 90_000,
    maxRetries: 1,
  }));

/** Low-temperature JSON completion. Content is never logged. */
export async function chatJson<T>(
  system: string,
  user: string,
  temperature = 0.1,
): Promise<{ data: T; requestId?: string }> {
  const res = await openai().chat.completions.create({
    model: MODEL,
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("empty_model_response");
  return { data: JSON.parse(content) as T, requestId: res.id };
}
