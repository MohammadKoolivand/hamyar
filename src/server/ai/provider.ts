import { MockProvider } from "../domain";
import { z } from "zod";
import { OllamaProvider } from "./ollama";
import type { HintInput, HintProvider } from "./types";
export function configuredProvider(
  transport: typeof fetch = fetch,
): HintProvider {
  const configured = process.env.AI_PROVIDER ?? "mock";
  if (configured === "mock") {
    const provider = new MockProvider();
    return Object.assign(provider, {
      status: () => ({
        configured: "mock",
        active: "mock",
        state: "mock",
        model: "approved-hints",
      }),
    });
  }
  if (configured !== "ollama") throw new Error("Unsupported AI_PROVIDER");
  const provider = new OllamaProvider(
    {
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
      model: process.env.OLLAMA_MODEL ?? "qwen2.5:3b",
      timeoutMs: z.coerce
        .number()
        .int()
        .min(10)
        .max(120000)
        .parse(process.env.AI_TIMEOUT_MS ?? 30000),
    },
    transport,
  );
  if (process.env.AI_FALLBACK !== "mock") return provider;
  let active = "ollama";
  return {
    name: "ollama-with-explicit-fallback",
    status: () => ({
      ...provider.status(),
      active,
      state: active === "mock" ? "fallback" : provider.status().state,
    }),
    async hint(input: HintInput) {
      try {
        const result = await provider.hint(input);
        active = "ollama";
        return result;
      } catch {
        active = "mock";
        return {
          text: input.approvedHint,
          provider: "mock",
          model: "approved-hints",
          promptVersion: "approved-hints-v1",
          focus: "concept" as const,
        };
      }
    },
  };
}
