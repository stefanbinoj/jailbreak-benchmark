export interface ViolationToolCall {
  toolName: string;
  toolCallId: string;
  reason: string;
}

export interface JailbreakResult {
  jailbreak_success: boolean;
  first_violation_message: number | null;
  violation_types: string[];
  violating_tool_calls: ViolationToolCall[];
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
  attackType: string;
  toolset: string;
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
  attackTypeBreakdown: BreakdownEntry[];
  toolsetBreakdown: BreakdownEntry[];
  attackTypeModelBreakdown: Record<string, Record<string, DetailedResultItem[]>>;
  detailedResults: Record<string, JailbreakResult>;
}
