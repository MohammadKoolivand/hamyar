export interface TutorContext {
  question: string;
  subjects: string[];
  skills: string[];
  submittedWork?: string;
  previousHints: string[];
  allowedLevel: number;
  remainingAllowance: number;
  candidates: string[];
}
export interface HintInput {
  approvedHint: string;
  level: number;
  context?: TutorContext;
}
export interface HintOutput {
  text: string;
  provider: string;
  model: string;
  promptVersion: string;
  focus: "start" | "concept" | "review";
  usage?: { inputTokens: number; outputTokens: number };
}
export interface HintProvider {
  name: string;
  hint(input: HintInput): Promise<string | HintOutput>;
  status?: () => {
    configured: string;
    active: string;
    state: string;
    model?: string;
  };
}
