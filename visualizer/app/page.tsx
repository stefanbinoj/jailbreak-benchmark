"use client";

import { useMemo, type ReactNode } from "react";
import { ShieldAlert, AlertTriangle, Target } from "lucide-react";
import benchmarkData from "../data/jailbreak-analysis.json";
import type { JailbreakBenchData } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = benchmarkData as JailbreakBenchData;

function topN<T>(items: T[], n: number): T[] {
  return items.slice(0, n);
}

export default function JailbreakBenchVisualizer() {
  const modelChartData = useMemo(
    () =>
      [...data.modelBreakdown]
        .sort((a, b) => b.jailbreakPercentage - a.jailbreakPercentage)
        .map((x) => ({
          name: x.name,
          jailbreakRate: Number(x.jailbreakPercentage.toFixed(1)),
          overrideRate: Number(((x.constraintOverrideText / x.total) * 100).toFixed(1)),
        })),
    []
  );

  const attackTypeData = useMemo(
    () =>
      [...data.attackTypeBreakdown]
        .sort((a, b) => b.jailbreakPercentage - a.jailbreakPercentage)
        .map((x) => ({
          name: x.name,
          jailbreakRate: Number(x.jailbreakPercentage.toFixed(1)),
        })),
    []
  );

  const toolsetData = useMemo(
    () =>
      [...data.toolsetBreakdown]
        .sort((a, b) => b.jailbreakPercentage - a.jailbreakPercentage)
        .map((x) => ({
          name: x.name,
          jailbreakRate: Number(x.jailbreakPercentage.toFixed(1)),
        })),
    []
  );

  const leaders = topN(
    [...data.modelBreakdown].sort((a, b) => b.jailbreakPercentage - a.jailbreakPercentage),
    5
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-slate-800 bg-gradient-to-r from-red-950/40 via-slate-900 to-orange-950/30 p-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-red-400" />
            <h1 className="text-3xl font-bold tracking-tight">JailBench Visualizer</h1>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            End-to-end jailbreak and prompt-injection benchmark report.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <StatCard
              label="Total Runs"
              value={String(data.summary.totalFiles)}
              icon={<Target className="h-4 w-4 text-cyan-400" />}
            />
            <StatCard
              label="Jailbreak Success"
              value={`${data.summary.jailbreakSuccessFiles} (${data.summary.jailbreakSuccessPercentage.toFixed(1)}%)`}
              icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
            />
            <StatCard
              label="Avg First Violation"
              value={
                data.summary.averageFirstViolationMessage === null
                  ? "-"
                  : data.summary.averageFirstViolationMessage.toFixed(2)
              }
              icon={<Target className="h-4 w-4 text-amber-400" />}
            />
            <StatCard
              label="Avg Confidence"
              value={
                data.summary.averageConfidence === null
                  ? "-"
                  : data.summary.averageConfidence.toFixed(3)
              }
              icon={<ShieldAlert className="h-4 w-4 text-emerald-400" />}
            />
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Model Jailbreak Rate">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={modelChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#cbd5e1" }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="jailbreakRate" fill="#ef4444" radius={[0, 4, 4, 0]} />
                <Bar dataKey="overrideRate" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="space-y-6">
            <ChartCard title="Attack Type Success Rate">
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={attackTypeData} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#cbd5e1" }} />
                  <Tooltip />
                  <Bar dataKey="jailbreakRate" fill="#fb7185" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Toolset Success Rate">
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={toolsetData} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#cbd5e1" }} />
                  <Tooltip />
                  <Bar dataKey="jailbreakRate" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold">Top 5 Most Vulnerable Models</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-2">Model</th>
                  <th className="py-2">Jailbreak Rate</th>
                  <th className="py-2">Override Count</th>
                  <th className="py-2">Avg First Violation</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((row) => (
                  <tr key={row.name} className="border-t border-slate-800">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2">{row.jailbreakPercentage.toFixed(1)}%</td>
                    <td className="py-2">{row.constraintOverrideText}/{row.total}</td>
                    <td className="py-2">
                      {row.averageFirstViolationMessage === null
                        ? "-"
                        : row.averageFirstViolationMessage.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      {children}
    </div>
  );
}
