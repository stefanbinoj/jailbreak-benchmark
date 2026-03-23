import { parseArgs } from "util";
import { z } from "zod";
import {
  MAX_CONCURRENCY,
  TEST_RUNS_PER_MODEL,
  TIMEOUT_SECONDS,
  modelsToRun,
  type RunnableModel,
  OUTPUT_DIRECTORY,
  BASE_SYSTEM_PROMPT,
  PROMPTS_DIR,
} from "./constants";
import { generateText, type ModelMessage } from "ai";
import { readdir, readFile, mkdir, writeFile } from "fs/promises";
import { join, extname, basename } from "path";
import {
  runWithConcurrencyLimit,
  getExistingTestResults,
  generateTestResultFilename,
  extractErrorDetails,
  withRetry,
} from "./utils";

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    concurrency: { type: "string" },
    runs: { type: "string" },
    "test-mode": { type: "boolean", default: false },
    "output-dir": { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
  strict: true,
  allowPositionals: true,
});

const ConfigSchema = z
  .object({
    concurrency: z.coerce.number().default(MAX_CONCURRENCY),
    runs: z.coerce.number().default(TEST_RUNS_PER_MODEL),
    testMode: z.boolean().default(false),
    outputDir: z.string().default(OUTPUT_DIRECTORY),
    dryRun: z.boolean().default(false),
  })
  .transform((data) => {
    if (data.dryRun) {
      return {
        ...data,
        concurrency: 5,
        runs: 1,
        testMode: true,
        outputDir:
          data.outputDir === OUTPUT_DIRECTORY
            ? "./results/dry-run"
            : data.outputDir,
        debounce: false,
      };
    }

    return {
      ...data,
      debounce: true,
    };
  });

const config = ConfigSchema.parse({
  concurrency: values.concurrency,
  runs: values.runs,
  testMode: values["test-mode"],
  outputDir: values["output-dir"],
  dryRun: values["dry-run"],
});

type ModelStats = {
  completed: number;
  running: number;
  errors: number;
  total: number;
  totalCost: number;
  totalDuration: number;
};

const modelProgress = new Map<string, ModelStats>();
let globalStartTime = 0;

function getStats(modelName: string): ModelStats {
  let stats = modelProgress.get(modelName);
  if (!stats) {
    stats = {
      completed: 0,
      running: 0,
      errors: 0,
      total: 0,
      totalCost: 0,
      totalDuration: 0,
    };
    modelProgress.set(modelName, stats);
  }
  return stats;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCost(providerMetadata: any): number {
  if (!providerMetadata) return 0;
  const openrouterMeta = providerMetadata.openrouter;
  if (!openrouterMeta?.usage) return 0;
  const usage = openrouterMeta.usage;
  if (usage.costDetails?.upstreamInferenceCost) {
    return Number(usage.costDetails.upstreamInferenceCost);
  }
  if (usage.cost) {
    return Number(usage.cost);
  }
  return 0;
}

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function formatCost(cost: number): string {
  if (cost === 0) return "-";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function progressBar(completed: number, total: number, width = 14): string {
  const ratio = total > 0 ? completed / total : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return `${GREEN}${"█".repeat(filled)}${DIM}${"░".repeat(empty)}${RESET}`;
}

function render() {
  let totalCompleted = 0;
  let totalRunning = 0;
  let totalErrors = 0;
  let totalTasks = 0;
  let totalCost = 0;

  for (const stats of modelProgress.values()) {
    totalCompleted += stats.completed;
    totalRunning += stats.running;
    totalErrors += stats.errors;
    totalTasks += stats.total;
    totalCost += stats.totalCost;
  }

  const elapsed = (performance.now() - globalStartTime) / 1000;
  const lines: string[] = [];

  lines.push("");
  lines.push(
    `${BOLD} JailBench${RESET}  ${DIM}${totalTasks} tests · ${config.concurrency} concurrent${RESET}`
  );
  lines.push(`${DIM} ${"─".repeat(74)}${RESET}`);
  lines.push(
    `${BOLD}  ${"Model".padEnd(16)} ${"Progress".padEnd(22)} ${"Avg Cost".padEnd(11)} ${"Avg Time".padEnd(10)} Err${RESET}`
  );
  lines.push(`${DIM} ${"─".repeat(74)}${RESET}`);

  for (const [name, stats] of modelProgress) {
    const avgCost =
      stats.completed > 0 ? stats.totalCost / stats.completed : 0;
    const avgTime =
      stats.completed > 0 ? stats.totalDuration / stats.completed : 0;

    const bar = progressBar(stats.completed, stats.total);
    const count = `${stats.completed}/${stats.total}`;
    const active =
      stats.running > 0 ? `${YELLOW}${stats.running}▸${RESET}` : " ";
    const cost = formatCost(avgCost).padEnd(11);
    const time = (stats.completed > 0 ? formatDuration(avgTime) : "-").padEnd(
      10
    );
    const err =
      stats.errors > 0
        ? `${RED}${stats.errors}${RESET}`
        : `${DIM}0${RESET}`;

    lines.push(
      `  ${name.padEnd(16)} ${bar} ${count.padEnd(6)} ${active} ${cost} ${time} ${err}`
    );
  }

  lines.push(`${DIM} ${"─".repeat(74)}${RESET}`);

  const doneText = `${GREEN}${totalCompleted}${RESET}/${totalTasks} done`;
  const runText =
    totalRunning > 0 ? ` · ${YELLOW}${totalRunning}${RESET} running` : "";
  const errText =
    totalErrors > 0 ? ` · ${RED}${totalErrors}${RESET} errors` : "";
  lines.push(`  ${doneText}${runText}${errText}`);

  let remainingStr = "-";
  if (totalCompleted > 0 && totalCompleted < totalTasks) {
    const rate = totalCompleted / elapsed;
    const remaining = (totalTasks - totalCompleted) / rate;
    remainingStr = formatDuration(remaining);
  } else if (totalCompleted >= totalTasks && totalTasks > 0) {
    remainingStr = "done";
  }

  lines.push(
    `  ${DIM}Elapsed:${RESET} ${formatDuration(elapsed)}  ${DIM}·${RESET}  ${DIM}Remaining:${RESET} ${remainingStr}  ${DIM}·${RESET}  ${DIM}Cost:${RESET} ${formatCost(totalCost)}`
  );
  lines.push("");

  process.stdout.write("\x1b[H\x1b[2J");
  process.stdout.write(lines.join("\n"));
}

type ContentItem =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string };

type EnhancedMessage = {
  id: string;
  role: "user" | "assistant";
  content: ContentItem[];
  rawText?: string;
};

type TestRun = {
  model: string;
  testRunId: string;
  messages: EnhancedMessage[];
  systemPrompt: string;
  duration: number;
  cost: number;
  error?: {
    message: string;
    stack?: string;
    timestamp: string;
    cause?: unknown;
    data?: unknown;
    responseBody?: unknown;
    statusCode?: number;
    url?: string;
  };
};

type TestParams = {
  testName: string;
  promptFile: string;
  systemPrompt: string;
};

async function buildTestsToRun(): Promise<TestParams[]> {
  const files = await readdir(PROMPTS_DIR);
  const mdFiles = files
    .filter(
      (file) => extname(file) === ".md" && /^\d+\.md$/.test(basename(file))
    )
    .sort((a, b) => {
      const numA = parseInt(basename(a, ".md"), 10);
      const numB = parseInt(basename(b, ".md"), 10);
      return numA - numB;
    });

  return mdFiles.map((file) => ({
    testName: `l1b3rt4s--${basename(file, ".md")}`,
    promptFile: join(PROMPTS_DIR, file),
    systemPrompt: BASE_SYSTEM_PROMPT,
  }));
}

function serializeTestRunToMarkdown(testRun: TestRun): string {
  let markdown = `# Test Run: ${testRun.model} - ${testRun.testRunId}\n\n`;
  markdown += `## Duration\n\n${testRun.duration}s\n\n`;
  markdown += `## Cost\n\n$${testRun.cost.toFixed(4)}\n\n`;

  if (testRun.error) {
    markdown += `## ERROR OCCURRED\n\n`;
    markdown += `**Error Message:** ${testRun.error.message}\n\n`;
    markdown += `**Timestamp:** ${testRun.error.timestamp}\n\n`;
    if (testRun.error.statusCode) {
      markdown += `**Status Code:** ${testRun.error.statusCode}\n\n`;
    }
    if (testRun.error.url) {
      markdown += `**URL:** ${testRun.error.url}\n\n`;
    }
    if (testRun.error.responseBody) {
      markdown += `**Response Body:**\n\`\`\`json\n${JSON.stringify(
        testRun.error.responseBody,
        null,
        2
      )}\n\`\`\`\n\n`;
    }
    if (testRun.error.data) {
      markdown += `**Error Data:**\n\`\`\`json\n${JSON.stringify(
        testRun.error.data,
        null,
        2
      )}\n\`\`\`\n\n`;
    }
    if (testRun.error.cause) {
      markdown += `**Cause:**\n\`\`\`json\n${JSON.stringify(
        testRun.error.cause,
        null,
        2
      )}\n\`\`\`\n\n`;
    }
    if (testRun.error.stack) {
      markdown += `**Stack Trace:**\n\`\`\`\n${testRun.error.stack}\n\`\`\`\n\n`;
    }
    markdown += `**Note:** The messages below were processed before the error occurred.\n\n`;
    markdown += `---\n\n`;
  }

  markdown += `## System Prompt\n\n${testRun.systemPrompt}\n\n`;
  markdown += `---\n\n`;

  for (const message of testRun.messages) {
    markdown += `## ${message.role.toUpperCase()}\n`;
    markdown += `**ID:** ${message.id}\n\n`;

    for (const contentItem of message.content) {
      switch (contentItem.type) {
        case "text":
          markdown += `### Text Content\n\n${contentItem.text}\n\n`;
          break;

        case "reasoning":
          markdown += `### Reasoning\n\n\`\`\`\n${contentItem.text}\n\`\`\`\n\n`;
          break;
      }
    }

    markdown += `---\n\n`;
  }

  return markdown;
}

async function runModel(
  model: RunnableModel,
  testParams: TestParams,
  testRunId: string
): Promise<TestRun> {
  const startTime = performance.now();
  const stats = getStats(model.name);
  stats.running++;

  let enhancedMessages: EnhancedMessage[] = [];
  let error: TestRun["error"] | undefined;
  let runCost = 0;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Test run timed out after ${TIMEOUT_SECONDS} seconds`));
    }, TIMEOUT_SECONDS * 1000);
  });

  const executionPromise = (async () => {
    const promptContent = await readFile(testParams.promptFile, "utf-8");
    const promptId = basename(testParams.promptFile);

    enhancedMessages.push({
      id: promptId,
      role: "user",
      content: [{ type: "text", text: promptContent }],
      rawText: promptContent,
    });

    const messageHistory: ModelMessage[] = [
      { role: "user", content: promptContent },
    ];

    const response = await withRetry(
      () =>
        generateText({
          model: model.llm,
          system: testParams.systemPrompt,
          messages: messageHistory,
          providerOptions: {
            xai: {
              reasoningEffort: "high",
            },
          },
        }),
      {
        maxAttempts: 5,
        initialDelayMs: 1000,
        maxDelayMs: 60000,
      }
    );

    runCost += extractCost(response.providerMetadata);

    for (const responseMessage of response.response.messages) {
      if (
        responseMessage.role === "assistant" &&
        Array.isArray(responseMessage.content)
      ) {
        const contentItems: ContentItem[] = [];

        for (const contentItem of responseMessage.content) {
          if (contentItem.type === "text") {
            contentItems.push({ type: "text", text: contentItem.text });
          } else if (contentItem.type === "reasoning") {
            contentItems.push({
              type: "reasoning",
              text: contentItem.text,
            });
          }
        }

        enhancedMessages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: contentItems,
          rawText: response.text,
        });
      }
    }
  })();

  try {
    await Promise.race([executionPromise, timeoutPromise]);
  } catch (err) {
    const errorDetails = extractErrorDetails(err);
    error = {
      message: errorDetails.message,
      stack: errorDetails.stack,
      timestamp: new Date().toISOString(),
      cause: errorDetails.cause,
      data: errorDetails.data,
      responseBody: errorDetails.responseBody,
      statusCode: errorDetails.statusCode,
      url: errorDetails.url,
    };
  } finally {
    clearTimeout(timeoutId);
  }

  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000;

  stats.running--;
  if (error) {
    stats.errors++;
  } else {
    stats.completed++;
  }
  stats.totalCost += runCost;
  stats.totalDuration += duration;

  const testRun: TestRun = {
    model: model.name,
    testRunId,
    messages: enhancedMessages,
    systemPrompt: testParams.systemPrompt,
    duration,
    cost: runCost,
    error,
  };

  const markdownOutput = serializeTestRunToMarkdown(testRun);

  const outputFilePath = join(
    config.outputDir,
    error
      ? `${model.name}--${testRunId}--error.md`
      : `${model.name}--${testRunId}.md`
  );
  await writeFile(outputFilePath, markdownOutput);

  return testRun;
}

function getTestNameFromRunId(testRunId: string): string {
  const parts = testRunId.split("--");
  return parts.slice(0, -1).join("--");
}

async function runAllTests() {
  globalStartTime = performance.now();

  await mkdir(config.outputDir, { recursive: true });

  const existingResults = getExistingTestResults(config.outputDir);

  const activeModels = config.testMode
    ? modelsToRun.filter((m) => m.testMode)
    : modelsToRun;

  if (activeModels.length === 0) {
    console.error("No models found for the current configuration!");
    return;
  }

  const allTests = await buildTestsToRun();

  type TaskInfo = {
    model: RunnableModel;
    testParams: TestParams;
    testRunId: string;
  };

  const allTasks: TaskInfo[] = [];
  let skippedCount = 0;

  for (let i = 0; i < config.runs; i++) {
    for (const test of allTests) {
      for (const model of activeModels) {
        const testRunId = `${test.testName}--${i + 1}`;
        const expectedFilename = generateTestResultFilename(
          model.name,
          testRunId
        );

        if (config.debounce && existingResults.has(expectedFilename)) {
          skippedCount++;
        } else {
          allTasks.push({ model, testParams: test, testRunId });
        }
      }
    }
  }

  const taskCountPerModel = new Map<string, number>();
  for (const task of allTasks) {
    taskCountPerModel.set(
      task.model.name,
      (taskCountPerModel.get(task.model.name) ?? 0) + 1
    );
  }
  for (const model of activeModels) {
    const stats = getStats(model.name);
    stats.total = taskCountPerModel.get(model.name) ?? 0;
  }

  if (allTasks.length === 0) {
    console.log("All tests have already been completed! No new tests to run.");
    return;
  }

  process.stdout.write("\x1b[?25l");
  const renderInterval = setInterval(render, 500);
  render();

  const taskFns = allTasks.map(
    (task) => () => runModel(task.model, task.testParams, task.testRunId)
  );

  try {
    const testResults = await runWithConcurrencyLimit(
      taskFns,
      config.concurrency
    );

    clearInterval(renderInterval);
    render();
    process.stdout.write("\x1b[?25h");
    console.log("");

    const endTime = performance.now();
    const duration = (endTime - globalStartTime) / 1000;

    const metrics = new Map<
      string,
      {
        successes: number;
        errors: number;
        totalDuration: number;
        totalCost: number;
      }
    >();

    for (const testRun of testResults) {
      const testName = getTestNameFromRunId(testRun.testRunId);
      const key = `${testRun.model}::${testName}`;
      if (!metrics.has(key)) {
        metrics.set(key, {
          successes: 0,
          errors: 0,
          totalDuration: 0,
          totalCost: 0,
        });
      }
      const metric = metrics.get(key)!;
      if (testRun.error) {
        metric.errors++;
      } else {
        metric.successes++;
      }
      metric.totalDuration += testRun.duration;
      metric.totalCost += testRun.cost;
    }

    const finalStats = Array.from(metrics.entries()).map(([key, metric]) => {
      const [model, testName] = key.split("::");
      const total = metric.successes + metric.errors;
      const successRate = total > 0 ? (metric.successes / total) * 100 : 0;
      const avgDuration = total > 0 ? metric.totalDuration / total : 0;
      const avgCost = total > 0 ? metric.totalCost / total : 0;

      return {
        model,
        testName,
        successes: metric.successes,
        errors: metric.errors,
        total,
        successRate: Math.round(successRate * 100) / 100,
        avgDuration: Math.round(avgDuration * 100) / 100,
        totalCost: metric.totalCost,
        avgCost: Math.round(avgCost * 10000) / 10000,
      };
    });

    const metricsOutput = {
      timestamp: new Date().toISOString(),
      totalDuration: Math.round(duration * 100) / 100,
      skippedTests: skippedCount,
      totalRunsPlanned: config.runs * allTests.length * activeModels.length,
      statistics: finalStats,
    };

    await writeFile(
      join(config.outputDir, "metrics.json"),
      JSON.stringify(metricsOutput, null, 2)
    );

    console.log("=== FINAL STATISTICS ===");
    for (const stat of finalStats) {
      console.log(
        `${stat.model} (${stat.testName}): ${stat.successRate}% success, ${stat.avgDuration}s avg, $${stat.avgCost.toFixed(4)}/run`
      );
    }
    console.log(`\nTotal time: ${formatDuration(duration)}`);
  } catch (err) {
    clearInterval(renderInterval);
    process.stdout.write("\x1b[?25h");
    throw err;
  }
}

runAllTests();
