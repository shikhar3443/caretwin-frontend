"use client";

import { useMemo, useState } from "react";
import { btnGhost } from "@/components/ui/Field";

export type RiskTrendRun = {
  id: string;
  createdAt: string;
  admissionTime: string;
  probability: number;
  threshold: number;
  flagged: boolean;
  labsSupplied: number;
  labs: Record<string, number[]>;
};

type Props = {
  runs: RiskTrendRun[];
  onRemoveRun: (id: string) => void;
  onClearHistory: () => void;
};

const MIN_CHART_WIDTH = 760;
const CHART_HEIGHT = 340;
const PLOT = { left: 62, right: 28, top: 44, bottom: 66 };

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatRisk(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatLabs(labs: Record<string, number[]>) {
  const entries = Object.entries(labs);
  return entries.length
    ? entries.map(([name, values]) => `${name}: ${values.join(", ")}`).join("; ")
    : "No labs supplied";
}

export default function RiskTrendChart({ runs, onRemoveRun, onClearHistory }: Props) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const orderedRuns = useMemo(
    () => [...runs].sort((a, b) => a.admissionTime.localeCompare(b.admissionTime) || a.createdAt.localeCompare(b.createdAt)),
    [runs],
  );
  const latest = orderedRuns[orderedRuns.length - 1];
  const previous = orderedRuns[orderedRuns.length - 2];
  const change = latest && previous ? (latest.probability - previous.probability) * 100 : null;
  const threshold = latest?.threshold ?? 0;
  const chartWidth = Math.max(MIN_CHART_WIDTH, orderedRuns.length * 110 + PLOT.left + PLOT.right);
  const maxRisk = Math.max(...orderedRuns.map((run) => Math.max(run.probability, run.threshold)));
  const yMax = Math.min(100, Math.max(10, Math.ceil(maxRisk * 100 / 10) * 10));
  const yStep = yMax <= 20 ? 5 : yMax <= 50 ? 10 : 20;
  const plotWidth = chartWidth - PLOT.left - PLOT.right;
  const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom;
  const x = (index: number) =>
    orderedRuns.length === 1
      ? PLOT.left + plotWidth / 2
      : PLOT.left + (index / (orderedRuns.length - 1)) * plotWidth;
  const y = (probability: number) =>
    PLOT.top + plotHeight - (probability * 100 / yMax) * plotHeight;
  const thresholdY = y(threshold);
  const thresholdArea = `${PLOT.left},${PLOT.top} ${chartWidth - PLOT.right},${PLOT.top} ${chartWidth - PLOT.right},${thresholdY} ${PLOT.left},${thresholdY}`;
  const points = orderedRuns.map((run, index) => ({
    run,
    x: x(index),
    y: y(run.probability),
  }));
  const linePath = points.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
  ).join(" ");
  const activeRun = orderedRuns.find((run) => run.id === (focusedId ?? hoveredId)) ?? null;
  const gapExists = orderedRuns.some((run, index) => {
    if (index === 0) return false;
    const previousTime = Date.parse(`${orderedRuns[index - 1].admissionTime.slice(0, 10)}T00:00:00Z`);
    const currentTime = Date.parse(`${run.admissionTime.slice(0, 10)}T00:00:00Z`);
    return currentTime - previousTime > 24 * 60 * 60 * 1000;
  });

  return (
    <section className="rounded-xl border border-line bg-white p-5 sm:p-6" aria-labelledby="risk-trend-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="risk-trend-heading" className="text-[15px] font-bold text-ink">Risk trend</h2>
          {change !== null && (
            <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
              change > 0 ? "bg-danger-soft text-danger" : change < 0 ? "bg-[#f0fbf5] text-[#15965d]" : "bg-[#f8f9fc] text-mute"
            }`}>
              {change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change).toFixed(1)} percentage points {change > 0 ? "up" : change < 0 ? "down" : "no change"} vs previous
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-line p-1" role="group" aria-label="Risk trend display">
            <button type="button" aria-pressed={view === "chart"} onClick={() => setView("chart")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === "chart" ? "bg-brand text-white" : "text-body"}`}>Chart</button>
            <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === "table" ? "bg-brand text-white" : "text-body"}`}>Table</button>
          </div>
          <button type="button" className={`${btnGhost} py-1.5`} onClick={onClearHistory}>Clear history</button>
        </div>
      </div>

      {gapExists && (
        <p className="mt-4 rounded-lg border border-[#f3dcb1] bg-[#fff8eb] px-3 py-2 text-xs leading-5 text-[#7a5a1f]">
          The model is designed for labs from the first 24 hours of an admission; points this far apart are separate estimates.
        </p>
      )}

      {view === "chart" ? (
        <>
          <div className="mt-4 overflow-x-auto" onMouseLeave={() => setHoveredId(null)}>
            <svg
              className="block h-auto max-w-none"
              style={{ width: `${chartWidth}px` }}
              viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
              role="img"
              aria-label={`Risk trend across ${orderedRuns.length} independent estimates, from ${formatRisk(orderedRuns[0].probability)} to ${formatRisk(latest.probability)}. Model flag threshold ${formatRisk(threshold)}.`}
            >
              <polygon points={thresholdArea} fill="var(--color-danger-soft)" opacity="0.4" />
              {Array.from({ length: Math.floor(yMax / yStep) + 1 }, (_, index) => index * yStep).map((tick) => (
                <g key={tick}>
                  <line x1={PLOT.left} x2={chartWidth - PLOT.right} y1={y(tick / 100)} y2={y(tick / 100)} stroke="var(--color-line)" />
                  <text x={PLOT.left - 10} y={y(tick / 100) + 4} textAnchor="end" fill="var(--color-mute)" fontSize="11">{tick}%</text>
                </g>
              ))}
              <line x1={PLOT.left} x2={PLOT.left} y1={PLOT.top} y2={CHART_HEIGHT - PLOT.bottom} stroke="var(--color-line)" />
              <line x1={PLOT.left} x2={chartWidth - PLOT.right} y1={CHART_HEIGHT - PLOT.bottom} y2={CHART_HEIGHT - PLOT.bottom} stroke="var(--color-line)" />
              <line x1={PLOT.left} x2={chartWidth - PLOT.right} y1={thresholdY} y2={thresholdY} stroke="#b7791f" strokeDasharray="6 5" />
              <text x={chartWidth - PLOT.right} y={Math.max(PLOT.top + 12, thresholdY - 8)} textAnchor="end" fill="#7a5a1f" fontSize="11" fontWeight="600">
                Model flag threshold ({formatRisk(threshold)})
              </text>
              {linePath && <path d={linePath} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
              {points.map(({ run, x: pointX, y: pointY }) => {
                const pointLabelY = Math.max(PLOT.top + 14, pointY - 13);
                return (
                  <g
                    key={run.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${formatDate(run.admissionTime)}: ${formatRisk(run.probability)}, ${run.flagged ? "elevated" : "lower"} risk, ${run.labsSupplied} of 7 labs supplied. ${formatLabs(run.labs)}`}
                    onMouseEnter={() => setHoveredId(run.id)}
                    onFocus={() => setFocusedId(run.id)}
                    onBlur={() => setFocusedId(null)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setFocusedId(null);
                    }}
                    className="cursor-pointer"
                  >
                    <circle cx={pointX} cy={pointY} r="13" fill="transparent" />
                    {run.labsSupplied < 7 && (
                      <circle cx={pointX} cy={pointY} r="10" fill="none" stroke="var(--color-mute)" strokeDasharray="2 2" strokeWidth="1.5" />
                    )}
                    {run.flagged ? (
                      <polygon points={`${pointX},${pointY - 6} ${pointX + 6},${pointY} ${pointX},${pointY + 6} ${pointX - 6},${pointY}`} fill="var(--color-danger)" stroke="white" strokeWidth="1.5" />
                    ) : (
                      <circle cx={pointX} cy={pointY} r="5.5" fill="#15965d" stroke="white" strokeWidth="1.5" />
                    )}
                    <text x={pointX} y={pointLabelY} textAnchor="middle" fill="var(--color-ink)" fontSize="11" fontWeight="700">{formatRisk(run.probability)}</text>
                    <text x={pointX} y={CHART_HEIGHT - PLOT.bottom + 20} textAnchor="middle" fill="var(--color-mute)" fontSize="10">
                      {formatDate(run.admissionTime)}
                    </text>
                    <title>{`${formatDate(run.admissionTime)} · ${formatRisk(run.probability)} · ${run.labsSupplied} of 7 labs supplied`}</title>
                    <desc>{formatLabs(run.labs)}</desc>
                  </g>
                );
              })}
            </svg>
          </div>
          {activeRun && (
            <div role="status" className="mt-3 rounded-lg border border-line bg-[#f8f9fc] p-3 text-xs text-body">
              <p className="font-semibold text-ink">{formatDate(activeRun.admissionTime)} · {formatRisk(activeRun.probability)}</p>
              <p className="mt-1">{activeRun.labsSupplied} of 7 labs supplied</p>
              <p className="mt-1 break-words">{formatLabs(activeRun.labs)}</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-mute" aria-label="Chart legend">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#15965d]" />Lower risk</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 bg-danger" />Elevated risk</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-dashed border-mute" />Partial labs (&lt;7)</span>
          </div>
        </>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <caption className="sr-only">Risk estimates by report date, including flag and lab coverage</caption>
            <thead>
              <tr className="border-b border-line text-mute">
                <th scope="col" className="px-2 py-2">Report date</th>
                <th scope="col" className="px-2 py-2">Risk</th>
                <th scope="col" className="px-2 py-2">Flag</th>
                <th scope="col" className="px-2 py-2">Labs supplied</th>
                <th scope="col" className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {orderedRuns.map((run) => (
                <tr key={run.id} className="border-b border-line">
                  <td className="px-2 py-2 text-body">{formatDate(run.admissionTime)}</td>
                  <td className="px-2 py-2 font-semibold text-ink">{formatRisk(run.probability)}</td>
                  <td className="px-2 py-2">{run.flagged ? "Elevated" : "Lower"}</td>
                  <td className="px-2 py-2">{run.labsSupplied} of 7</td>
                  <td className="px-2 py-2">
                    <button type="button" className="font-semibold text-brand hover:underline" onClick={() => onRemoveRun(run.id)} aria-label={`Remove estimate from ${formatDate(run.admissionTime)}`}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ul className="mt-4 space-y-2 border-t border-line pt-3">
        {orderedRuns.map((run) => (
          <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-body">{formatDate(run.admissionTime)} · {formatRisk(run.probability)} · {run.labsSupplied} of 7 labs</span>
            <button type="button" className="font-semibold text-brand hover:underline" onClick={() => onRemoveRun(run.id)} aria-label={`Remove estimate from ${formatDate(run.admissionTime)}`}>Remove</button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-5 text-mute">
        Each point is scored independently. A trend reflects changing inputs, not a validated forecast. Not medical advice.
      </p>
    </section>
  );
}
