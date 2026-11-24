"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  HeartPulse,
  Droplets,
  Activity,
  FileText,
  TrendingUp,
  FileCheck2,
} from "lucide-react";
import { useCareData } from "@/lib/useCareData";
import { formatDate } from "@/lib/dates";

export default function HealthSummary() {
  const { records, scopedRecords } = useCareData();

  // Find latest recorded metrics across all records
  const latestVitals = useMemo(() => {
    let glucose: string | null = null;
    let bp: string | null = null;
    let hb: string | null = null;

    for (const r of records) {
      if (!r.metrics) continue;
      for (const m of r.metrics) {
        const lbl = m.label.toLowerCase();
        if (!glucose && (lbl.includes("glucose") || lbl.includes("sugar"))) {
          glucose = m.value;
        }
        if (!bp && (lbl.includes("bp") || lbl.includes("blood pressure") || lbl.includes("systolic"))) {
          bp = m.value;
        }
        if (!hb && lbl.includes("hemoglobin")) {
          hb = m.value;
        }
      }
    }
    return { glucose, bp, hb };
  }, [records]);

  const recentDocs = useMemo(() => {
    return [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  }, [records]);

  return (
    <section className="rounded-xl border border-[#e5e7eb] bg-white p-5">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#111827]">Health Summary</h2>
          <p className="mt-1 text-[11px] text-[#9ca3af]">
            Extracted from your medical records & vitals
          </p>
        </div>

        <Link
          href="/dashboard/reports"
          className="flex items-center gap-1 text-[11px] font-semibold text-[#0878b8] transition hover:text-[#06699f]"
        >
          View Trends
          <TrendingUp size={13} />
        </Link>
      </div>

      {/* Health Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Blood Glucose */}
        <MetricCard
          icon={<Droplets size={16} />}
          label="Blood Glucose"
          value={latestVitals.glucose || "—"}
          status={latestVitals.glucose ? "Latest Reading" : "No data"}
          tone={latestVitals.glucose ? "blue" : "gray"}
        />

        {/* Blood Pressure */}
        <MetricCard
          icon={<HeartPulse size={16} />}
          label="Blood Pressure"
          value={latestVitals.bp || "—"}
          status={latestVitals.bp ? "Latest Reading" : "No data"}
          tone={latestVitals.bp ? "green" : "gray"}
        />

        {/* Hemoglobin */}
        <MetricCard
          icon={<Activity size={16} />}
          label="Hemoglobin"
          value={latestVitals.hb || "—"}
          status={latestVitals.hb ? "Latest Reading" : "No data"}
          tone={latestVitals.hb ? "purple" : "gray"}
        />

        {/* Total Documents */}
        <MetricCard
          icon={<FileText size={16} />}
          label="Total Records"
          value={records.length > 0 ? `${records.length} document${records.length === 1 ? "" : "s"}` : "0"}
          status={records.length > 0 ? "In Locker" : "Empty"}
          tone={records.length > 0 ? "blue" : "gray"}
        />
      </div>

      {/* Recent Records or Empty State */}
      <div className="mt-5 rounded-xl bg-[#f8f9fc] p-4 border border-slate-100">
        {recentDocs.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileCheck2 size={15} className="text-brand" />
                Recent Health Documents
              </span>
              <Link
                href="/dashboard/medical-records"
                className="text-[11px] font-medium text-brand hover:underline"
              >
                View all ({records.length})
              </Link>
            </div>
            <div className="space-y-2">
              {recentDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200/70 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{doc.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {doc.type}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">
                    {formatDate(doc.date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <TrendingUp size={24} className="mx-auto text-slate-300" />
            <p className="mt-2 text-xs font-medium text-slate-600">
              No medical records uploaded yet
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Upload your first lab report or prescription to populate your health twin!
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  status,
  tone = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: string;
  tone?: "blue" | "green" | "purple" | "gray";
}) {
  const tones = {
    blue: "text-[#0878b8] bg-[#eaf5fb]",
    green: "text-[#15965d] bg-[#e5faef]",
    purple: "text-[#7c5cd6] bg-[#f2eefb]",
    gray: "text-[#6b7280] bg-[#f3f4f6]",
  };

  return (
    <div className="rounded-lg border border-[#f3f4f6] bg-[#fafafa] p-3 transition hover:border-[#e5e7eb] hover:bg-white hover:shadow-sm">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${tones[tone]}`}>
          {icon}
        </div>
        <span className="text-[11px] font-semibold text-[#6b7280]">{label}</span>
      </div>

      <div className="mt-2.5">
        <div className="text-base font-bold text-[#111827]">{value}</div>
        <div className="mt-0.5 text-[10px] font-medium text-[#9ca3af]">{status}</div>
      </div>
    </div>
  );
}
