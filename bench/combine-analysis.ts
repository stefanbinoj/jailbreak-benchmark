import { readFileSync, writeFileSync } from "fs";

type BreakdownEntry = {
  name: string;
  total: number;
  jailbreakSuccess: number;
  jailbreakPercentage: number;
  constraintOverrideText: number;
  averageFirstViolationMessage: number | null;
  averageConfidence: number;
};

type AnalysisFile = {
  summary: {
    totalFiles: number;
    jailbreakSuccessFiles: number;
    jailbreakSuccessPercentage: number;
    averageFirstViolationMessage: number | null;
    averageConfidence: number | null;
  };
  modelBreakdown: BreakdownEntry[];
  detailedResults: Record<string, unknown>;
};

function weightedAverage(
  v1: number | null,
  w1: number,
  v2: number | null,
  w2: number
): number | null {
  const totalWeight = (v1 !== null ? w1 : 0) + (v2 !== null ? w2 : 0);
  if (totalWeight === 0) return null;
  return ((v1 ?? 0) * (v1 !== null ? w1 : 0) + (v2 ?? 0) * (v2 !== null ? w2 : 0)) / totalWeight;
}

function mergeBreakdowns(a: BreakdownEntry[], b: BreakdownEntry[]): BreakdownEntry[] {
  const map = new Map<string, BreakdownEntry>();

  for (const item of a) {
    map.set(item.name, { ...item });
  }

  for (const item of b) {
    const existing = map.get(item.name);
    if (!existing) {
      map.set(item.name, { ...item });
      continue;
    }

    const total = existing.total + item.total;
    const jailbreakSuccess = existing.jailbreakSuccess + item.jailbreakSuccess;
    const constraintOverrideText =
      existing.constraintOverrideText + item.constraintOverrideText;

    const avgFirstViolation = weightedAverage(
      existing.averageFirstViolationMessage,
      existing.jailbreakSuccess,
      item.averageFirstViolationMessage,
      item.jailbreakSuccess
    );

    const avgConfidence =
      (existing.averageConfidence * existing.total +
        item.averageConfidence * item.total) /
      total;

    map.set(item.name, {
      name: item.name,
      total,
      jailbreakSuccess,
      jailbreakPercentage: (jailbreakSuccess / total) * 100,
      constraintOverrideText,
      averageFirstViolationMessage: avgFirstViolation,
      averageConfidence: avgConfidence,
    });
  }

  return Array.from(map.values());
}

function main() {
  const [, , fileA = "jailbreak-analysis.json", fileB = "jailbreak-analysis-2.json", outputFile = "combined-jailbreak-analysis.json"] = process.argv;

  const analysis1 = JSON.parse(readFileSync(fileA, "utf8")) as AnalysisFile;
  const analysis2 = JSON.parse(readFileSync(fileB, "utf8")) as AnalysisFile;

  const totalFiles = analysis1.summary.totalFiles + analysis2.summary.totalFiles;
  const jailbreakSuccessFiles =
    analysis1.summary.jailbreakSuccessFiles + analysis2.summary.jailbreakSuccessFiles;

  const combinedSummary = {
    totalFiles,
    jailbreakSuccessFiles,
    jailbreakSuccessPercentage: totalFiles > 0 ? (jailbreakSuccessFiles / totalFiles) * 100 : 0,
    averageFirstViolationMessage: weightedAverage(
      analysis1.summary.averageFirstViolationMessage,
      analysis1.summary.jailbreakSuccessFiles,
      analysis2.summary.averageFirstViolationMessage,
      analysis2.summary.jailbreakSuccessFiles
    ),
    averageConfidence: weightedAverage(
      analysis1.summary.averageConfidence,
      analysis1.summary.totalFiles,
      analysis2.summary.averageConfidence,
      analysis2.summary.totalFiles
    ),
  };

  const combined = {
    summary: combinedSummary,
    modelBreakdown: mergeBreakdowns(
      analysis1.modelBreakdown,
      analysis2.modelBreakdown
    ),
    detailedResults: {
      ...analysis1.detailedResults,
      ...analysis2.detailedResults,
    },
  };

  writeFileSync(outputFile, JSON.stringify(combined, null, 2));

  console.log("Successfully combined analysis files.");
  console.log(`Output: ${outputFile}`);
  console.log(
    `Jailbreak successes: ${combinedSummary.jailbreakSuccessFiles}/${combinedSummary.totalFiles} (${combinedSummary.jailbreakSuccessPercentage.toFixed(2)}%)`
  );
}

main();
