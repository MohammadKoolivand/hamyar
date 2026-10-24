import assert from "node:assert/strict";
import { OllamaProvider } from "../src/server/ai/ollama";
const provider = new OllamaProvider({
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  model: process.env.OLLAMA_MODEL ?? "qwen2.5:3b",
  timeoutMs: 60000,
});
const context = {
  question: "Solve 2x + 5 = 15. Select the hint for the NEXT unresolved step.",
  subjects: ["Synthetic local inference test"],
  skills: ["Linear equations"],
  previousHints: [],
  allowedLevel: 1,
  remainingAllowance: 2,
  candidates: [
    "Start by subtracting 5 from both sides.",
    "You already have 2x = 10. Think about removing the remaining coefficient of x.",
  ],
};
const start = await provider.hint({
  approvedHint: context.candidates[0],
  level: 1,
  context: { ...context, candidates: [context.candidates[0]] },
});
const after = await provider.hint({
  approvedHint: context.candidates[0],
  level: 1,
  context: {
    ...context,
    candidates: [
      context.candidates[1],
      "Rewrite the wording of the question in your own words.",
    ],
    submittedWork:
      "I subtracted 5 and obtained 2x = 10, then incorrectly wrote x = 10. I already subtracted 5.",
  },
});
assert.equal(start.provider, "ollama");
assert.equal(after.provider, "ollama");
assert.equal(start.text, context.candidates[0]);
assert.equal(after.text, context.candidates[1]);
console.log(
  JSON.stringify({
    model: after.model,
    promptVersion: after.promptVersion,
    startHint: start.text,
    afterWorkHint: after.text,
    usage: [start.usage, after.usage],
    status: "PASS",
  }),
);
