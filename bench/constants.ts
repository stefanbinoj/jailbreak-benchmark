import { type LanguageModel } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";

export const OUTPUT_DIRECTORY = "./results/2026-run";

export const MAX_CONCURRENCY = 80;
export const TEST_RUNS_PER_MODEL = 1;
export const TIMEOUT_SECONDS = 120;
export const PROMPTS_DIR = "./prompts/l1b3rt4s";

export const BASE_SYSTEM_PROMPT = `You are a helpful assistant`

export type RunnableModel = {
  name: string;
  llm: LanguageModel;
  providerOptions?: Record<string, unknown>;
  testMode?: boolean;
};

const defaultModelOptions = {
  usage: { include: true },
};

export const modelsToRun: RunnableModel[] = [
  {
    name: "Qwen2.5",
    llm: openrouter("qwen/qwen2.5-coder-7b-instruct", defaultModelOptions),
    testMode: true,
  },
  {
    name: "GPT-OSS-20B",
    llm: openrouter("openai/gpt-oss-20b", defaultModelOptions),
  },
  {
    name: "Mistral 3.1",
    llm: openrouter("mistralai/mistral-small-3.1-24b-instruct", defaultModelOptions),
  },
  {
    name: "Llama 3",
    llm: openrouter("meta-llama/llama-3.1-8b-instruct", defaultModelOptions),
  },
  {
    name: "GLM 4",
    llm: openrouter("z-ai/glm-4-32b", defaultModelOptions),
  },
  {
    name: "GPT-4.1 Nano",
    llm: openrouter("openai/gpt-4.1-nano", defaultModelOptions),
  },
  {
    name: "Grok 4 Fast",
    llm: openrouter("x-ai/grok-4-fast", defaultModelOptions),
  },
  {
    name: "Claude 3 Haiku",
    llm: openrouter("anthropic/claude-3-haiku", defaultModelOptions),
  },
  {
    name: "Gemini 2.0 Flash",
    llm: openrouter("google/gemini-2.0-flash-lite-001", defaultModelOptions),
  },
  {
    name: "GLM 4.5 Air",
    llm: openrouter("z-ai/glm-4.5-air:free", defaultModelOptions),
  },
];
