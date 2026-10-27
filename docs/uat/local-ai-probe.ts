import { OllamaQuestionGenerator } from "../../src/server/ai/question-generator";
const generator = new OllamaQuestionGenerator({
  url: "http://127.0.0.1:11434",
  model: "qwen2.5:3b",
  timeoutMs: 90000,
});
const results = [];
for (let i = 0; i < 3; i++) {
  const start = Date.now();
  try {
    const result = await generator.generate({
      topic: "جمع دو عدد",
      curriculum: ["ریاضی پایه دوم، داده آزمایشی"],
      type: "numeric",
      brief:
        "فقط یک سؤال ساده جمع سه و چهار بساز. پاسخ مرجع فقط عدد 7 باشد. راهنما جواب را افشا نکند.",
    });
    results.push({
      index: i + 1,
      parsed: true,
      milliseconds: Date.now() - start,
      ...result,
    });
  } catch {
    results.push({
      index: i + 1,
      parsed: false,
      milliseconds: Date.now() - start,
      error: "provider_contract_rejected_or_unavailable",
    });
  }
}
console.log(
  JSON.stringify(
    {
      provider: "local_ollama",
      scientificReview: "MANUAL_REQUIRED",
      runs: results,
      parsed: results.filter((x) => x.parsed).length,
      published: 0,
    },
    null,
    2,
  ),
);
