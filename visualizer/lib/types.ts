export interface JailbreakResult {
  jailbreak_success: boolean;
  first_violation_message: number | null;
  violation_types: string[];
  constraint_override_text: boolean;
  confidence: number;
  explanation: string;
}

export interface BreakdownEntry {
  name: string;
  total: number;
  jailbreakSuccess: number;
  jailbreakPercentage: number;
  constraintOverrideText: number;
  averageFirstViolationMessage: number | null;
  averageConfidence: number;
}

export interface DetailedResultItem {
  filename: string;
  modelName: string;
  testRun: string;
  result: JailbreakResult;
}

export interface JailbreakBenchData {
  summary: {
    totalFiles: number;
    jailbreakSuccessFiles: number;
    jailbreakSuccessPercentage: number;
    averageFirstViolationMessage: number | null;
    averageConfidence: number | null;
  };
  modelBreakdown: BreakdownEntry[];
  detailedResults: Record<string, JailbreakResult>;
}
