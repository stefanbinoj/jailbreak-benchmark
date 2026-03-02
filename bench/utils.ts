interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error(
      "An error occurred while fetching the data."
    ) as ApplicationError;

    error.info = await res.json();
    error.status = res.status;

    throw error;
  }

  return res.json();
};

export async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    if (index >= tasks.length) return;

    const taskIndex = index++;
    const task = tasks[taskIndex];

    try {
      const result = await task();
      results[taskIndex] = result;
    } catch (error) {
      console.error(`Task ${taskIndex} failed:`, error);
      throw error;
    }

    await runNext();
  }

  const workers = Array(Math.min(limit, tasks.length))
    .fill(null)
    .map(() => runNext());

  await Promise.all(workers);
  return results;
}

export function extractErrorDetails(err: unknown): {
  message: string;
  stack?: string;
  cause?: unknown;
  data?: unknown;
  responseBody?: unknown;
  statusCode?: number;
  url?: string;
  requestBodyValues?: unknown;
} {
  if (!(err instanceof Error)) {
    return { message: String(err) };
  }

  const details: ReturnType<typeof extractErrorDetails> = {
    message: err.message,
    stack: err.stack,
  };

  const anyErr = err as unknown as Record<string, unknown>;

  if ("cause" in anyErr && anyErr.cause !== undefined) {
    details.cause = anyErr.cause;
  }
  if ("data" in anyErr && anyErr.data !== undefined) {
    details.data = anyErr.data;
  }
  if ("responseBody" in anyErr && anyErr.responseBody !== undefined) {
    details.responseBody = anyErr.responseBody;
  }
  if ("statusCode" in anyErr && anyErr.statusCode !== undefined) {
    details.statusCode = anyErr.statusCode as number;
  }
  if ("url" in anyErr && anyErr.url !== undefined) {
    details.url = anyErr.url as string;
  }
  if ("requestBodyValues" in anyErr && anyErr.requestBodyValues !== undefined) {
    details.requestBodyValues = anyErr.requestBodyValues;
  }

  return details;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 5,
    initialDelayMs = 1000,
    maxDelayMs = 60000,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      const delayMs = Math.min(
        initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
        maxDelayMs
      );

      onRetry?.(attempt, error, delayMs);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

export function getExistingTestResults(outputDirectory: string): Set<string> {
  const fs = require("fs");

  if (!fs.existsSync(outputDirectory)) {
    return new Set();
  }

  const files = fs.readdirSync(outputDirectory);
  const markdownFiles = files.filter((file: string) => file.endsWith(".md"));
  return new Set(markdownFiles);
}

export function generateTestResultFilename(
  modelName: string,
  testRunId: string
): string {
  return `${modelName}--${testRunId}.md`;
}
