"use client";

import { useMemo, type ReactNode } from "react";
import { ShieldAlert, AlertTriangle, Target } from "lucide-react";
import benchmarkData from "../data/jailbreak-analysis.json";
import runMetrics from "../data/jailbreak-metrics.json";
import type { JailbreakBenchData } from "@/lib/types";
import {
  Scatter,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

const data = benchmarkData as JailbreakBenchData;

type MetricsStat = {
  model: string;
  avgCost: number;
};

type MetricsData = {
  statistics: MetricsStat[];
};

const metrics = runMetrics as MetricsData;

function topN<T>(items: T[], n: number): T[] {
  return items.slice(0, n);
}

export default function JailbreakBenchVisualizer() {
  const costByModel = useMemo(
    () =>
      metrics.statistics.reduce((acc, stat) => {
        if (stat.avgCost <= 0) return acc;
        const current = acc.get(stat.model) ?? { totalCost: 0, count: 0 };
        current.totalCost += stat.avgCost;
        current.count += 1;
        acc.set(stat.model, current);
        return acc;
      }, new Map<string, { totalCost: number; count: number }>()),
    []
  );

  const leaderboardRows = useMemo(
    () =>
      [...data.modelBreakdown]
        .map((model) => {
          const costAggregate = costByModel.get(model.name);
          const avgCost =
            costAggregate && costAggregate.count > 0
              ? costAggregate.totalCost / costAggregate.count
              : 0.001;

          return {
            name: model.name,
            params: getModelParameters(model.name),
            jailbreakPercentage: Number(model.jailbreakPercentage.toFixed(1)),
            cost: Number(avgCost.toFixed(6)),
            family: getModelCompany(model.name),
          };
        })
        .sort((a, b) => b.jailbreakPercentage - a.jailbreakPercentage),
    [costByModel]
  );

  const leaderboardData = useMemo(() => {
    return [...leaderboardRows]
      .map((model) => ({
        name: model.name,
        family: model.family,
        score: clampScore(Number((100 - model.jailbreakPercentage).toFixed(1))),
        rawCost: model.cost,
        cost: Math.min(model.cost, 0.01),
      }))
      .sort((a, b) => a.cost - b.cost);
  }, [leaderboardRows]);

  const seriesData = useMemo(() => {
    const grouped = new Map<string, typeof leaderboardData>();

    for (const point of leaderboardData) {
      const familyPoints = grouped.get(point.family) ?? [];
      familyPoints.push(point);
      grouped.set(point.family, familyPoints);
    }

    return [...grouped.entries()].map(([family, points]) => ({
      family,
      color: getFamilyColor(family),
      points: [...points].sort((a, b) => a.cost - b.cost),
    }));
  }, [leaderboardData]);

  const xAxisConfig = useMemo(() => {
    if (leaderboardData.length === 0) {
      return {
        domain: [0.000001, 0.1] as [number, number],
        ticks: [0.000001, 0.000002, 0.000005, 0.00001, 0.00002, 0.00005, 0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01],
      };
    }

    const costs = leaderboardData.map((row) => row.cost).filter((value) => value > 0);
    const minCost = Math.min(...costs);
    const minDomain = Math.max(0.000001, minCost * 0.7);
    const maxDomain = 0.01;

    const candidateTicks = [
      0.000001, 0.000002, 0.000005,
      0.00001, 0.00002, 0.00005,
      0.0001, 0.0002, 0.0005,
      0.001, 0.002, 0.005,
      0.01,
    ];
    const ticks = candidateTicks.filter((tick) => tick >= minDomain && tick <= maxDomain);

    return {
      domain: [minDomain, maxDomain] as [number, number],
      ticks: ticks.length >= 2 ? ticks : [minDomain, 0.01],
    };
  }, [leaderboardData]);

  const leaders = topN(
    [...leaderboardRows].sort((a, b) => b.jailbreakPercentage - a.jailbreakPercentage),
    10
  );

  const mostVulnerable = leaders.length > 0 ? leaders[0] : null;

  const safest =
    leaderboardRows.length > 0
      ? [...leaderboardRows].sort((a, b) => a.jailbreakPercentage - b.jailbreakPercentage)[0]
      : null;

  const mostExpensive =
    leaderboardRows.length > 0 ? [...leaderboardRows].sort((a, b) => b.cost - a.cost)[0] : null;

  const cheapest =
    leaderboardRows.length > 0 ? [...leaderboardRows].sort((a, b) => a.cost - b.cost)[0] : null;

  const bestValue =
    leaderboardRows.length > 0
      ? [...leaderboardRows].sort(
          (a, b) =>
            (100 - b.jailbreakPercentage) / Math.max(b.cost, 0.000001) -
            (100 - a.jailbreakPercentage) / Math.max(a.cost, 0.000001)
        )[0]
      : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="w-full px-4 py-10 sm:px-6 lg:px-8">

        <section className="grid gap-6">
          <ChartCard title="JAILBENCH LEADERBOARD">
            <ResponsiveContainer width="100%" height={620}>
              <ComposedChart margin={{ top: 24, right: 56, left: 30, bottom: 52 }}>
                <CartesianGrid stroke="#1f2937" vertical horizontal />
                <XAxis
                  type="number"
                  dataKey="cost"
                  scale="log"
                  domain={xAxisConfig.domain}
                  ticks={xAxisConfig.ticks}
                  tickFormatter={(value) => `${formatCostLabel(value)} $`}
                  tick={{ fill: "#9ca3af", fontSize: 13 }}
                  axisLine={{ stroke: "#6b7280" }}
                  tickLine={{ stroke: "#6b7280" }}
                  tickMargin={10}
                  minTickGap={8}
                  label={{ value: "COST PER TASK ($)", position: "bottom", fill: "#d1d5db", fontSize: 24, letterSpacing: 2 }}
                />
                <YAxis
                  type="number"
                  dataKey="score"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fill: "#9ca3af", fontSize: 13 }}
                  axisLine={{ stroke: "#6b7280" }}
                  tickLine={{ stroke: "#6b7280" }}
                  label={{ value: "SCORE (%)", angle: -90, position: "insideLeft", fill: "#d1d5db", fontSize: 24, letterSpacing: 2 }}
                />
                <Tooltip
                  shared={false}
                  contentStyle={{ backgroundColor: "#05070b", border: "1px solid #374151", borderRadius: 8 }}
                  content={<LeaderboardTooltip />}
                />

                {seriesData.map((series) => (
                  <Line
                    key={`line-${series.family}`}
                    data={series.points}
                    dataKey="score"
                    xAxisId={0}
                    yAxisId={0}
                    stroke={series.color}
                    strokeWidth={1.7}
                    strokeDasharray="6 6"
                    dot={false}
                    legendType="none"
                  />
                ))}

                {seriesData.map((series) => (
                  <Scatter
                    key={series.family}
                    data={series.points}
                    fill={series.color}
                    shape={<TrianglePoint />}
                  >
                    <LabelList dataKey="name" position="right" offset={10} fill={series.color} fontSize={11} />
                  </Scatter>
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-700 bg-[#020306] p-6">
          <h2 className="text-2xl font-semibold tracking-wide text-slate-200">LEADERBOARD BREAKDOWN</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-200">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="py-3 pl-3">#</th>
                  <th className="py-3">Model</th>
                  <th className="py-3">Parameters</th>
                  <th className="py-3">Jailbreak %</th>
                  <th className="py-3">Cost / Task</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((row, index) => (
                  <tr key={row.name} className="border-t border-slate-800/80">
                    <td className="py-3 pl-3 text-slate-400">{index + 1}</td>
                    <td className="py-3">{row.name}</td>
                    <td className="py-3 text-slate-400">{row.params}</td>
                    <td className="py-3">
                      <span className="font-medium text-rose-300">{row.jailbreakPercentage.toFixed(1)}%</span>
                    </td>
                    <td className="py-3">{formatCostLabel(row.cost)} $</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
            <span>
              Most Vulnerable: {mostVulnerable ? `${mostVulnerable.name} (${mostVulnerable.jailbreakPercentage.toFixed(1)}%)` : "-"}
            </span>
            <span>
              Safest: {safest ? `${safest.name} (${safest.jailbreakPercentage.toFixed(1)}%)` : "-"}
            </span>
            <span>
              Highest Cost: {mostExpensive ? `${mostExpensive.name} (${formatCostLabel(mostExpensive.cost)} $)` : "-"}
            </span>
            <span>
              Lowest Cost: {cheapest ? `${cheapest.name} (${formatCostLabel(cheapest.cost)} $)` : "-"}
            </span>
            <span>
              Best Value: {bestValue ? `${bestValue.name}` : "-"}
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-[#020306] p-5">
      <h2 className="mb-3 text-center text-4xl font-semibold tracking-wide text-slate-200">{title}</h2>
      {children}
    </div>
  );
}

function getModelCompany(modelName: string): string {
  const normalized = modelName.toLowerCase();
  if (normalized.includes("qwen")) return "alibaba";
  if (normalized.includes("glm")) return "zai";
  if (normalized.includes("mistral")) return "mistral";
  if (normalized.includes("llama")) return "meta";
  if (normalized.includes("gpt")) return "openai";
  if (normalized.includes("gemini")) return "google";
  if (normalized.includes("claude") || normalized.includes("sonnet")) return "anthropic";
  if (normalized.includes("grok")) return "xai";
  if (normalized.includes("kimi")) return "moonshot";
  if (normalized.includes("minimax")) return "minimax";
  return "other";
}

function getFamilyColor(family: string): string {
  switch (family) {
    case "alibaba":
      return "#f97316";
    case "zai":
      return "#a78bfa";
    case "mistral":
      return "#f59e0b";
    case "meta":
      return "#8b5cf6";
    case "openai":
      return "#1ea1ff";
    case "google":
      return "#4ade80";
    case "anthropic":
      return "#ef4444";
    case "xai":
      return "#f8fafc";
    case "moonshot":
      return "#f59e0b";
    case "minimax":
      return "#22d3ee";
    default:
      return "#a78bfa";
  }
}

function TrianglePoint(props: {
  cx?: number;
  cy?: number;
  fill?: string;
}) {
  const { cx = 0, cy = 0, fill = "#ffffff" } = props;
  const size = 6;

  return (
    <path
      d={`M ${cx} ${cy} L ${cx - size} ${cy + size * 1.8} L ${cx + size} ${cy + size * 1.8} Z`}
      fill={fill}
      stroke={fill}
      strokeWidth={1}
    />
  );
}

function formatCostLabel(value: number): string {
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(3);
  if (value >= 0.001) return value.toFixed(4);
  if (value >= 0.0001) return value.toFixed(5);
  return value.toFixed(6);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function getModelParameters(modelName: string): string {
  const parameterMap: Record<string, string> = {
    "GPT-OSS-20B": "20B",
    "Qwen2.5": "7B",
    "Mistral 3.1": "24B",
    "Llama 3": "8B",
    "GLM 4": "32B",
    "Gemini 2.0 Flash": "Flash Lite",
    "Claude 3 Haiku": "Haiku",
    "GPT-5 Nano": "Nano",
    "GPT-4.1 Nano": "Nano",
    "Grok 4 Fast": "Fast",
  };

  return parameterMap[modelName] ?? "-";
}

type TooltipPayloadItem = {
  dataKey?: string;
  payload?: {
    name?: string;
    cost?: number;
    rawCost?: number;
    score?: number;
  };
};

function LeaderboardTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const firstWithPoint = payload.find((item) => item.payload?.name && typeof item.payload?.cost === "number");
  if (!firstWithPoint?.payload) return null;

  const point = firstWithPoint.payload;

  return (
    <div className="rounded-lg border border-slate-700 bg-[#05070b] px-4 py-3 text-sm text-slate-200 shadow-xl">
      <div className="font-semibold text-white">{point.name}</div>
      <div className="mt-1 text-slate-300">Cost / Task: {formatCostLabel(point.rawCost ?? point.cost ?? 0)} $</div>
      <div className="text-slate-300">Score: {(point.score ?? 0).toFixed(1)}%</div>
    </div>
  );
}
