"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { btnGhost, btnPrimary } from "@/components/ui/Field";
import type { MedicalRecord, Member } from "@/lib/types";
import { formatDate } from "@/lib/dates";
import { Download, Sparkles, Loader2, FileText, Paperclip, CheckCircle2 } from "lucide-react";
import { processRecordOCR, downloadMedicalRecord } from "@/lib/api";

const flagStyle = {
  normal: "bg-[#e5faef] text-[#15965d]",
  watch: "bg-[#fff6e5] text-[#b7791f]",
  abnormal: "bg-danger-soft text-danger",
};
const flagLabel = { normal: "Normal", watch: "Watch", abnormal: "Abnormal" };

export default function RecordDetailModal({
  record,
  member,
  onClose,
  onDownload,
  onUpdate,
}: {
  record: MedicalRecord | null;
  member?: Member;
  onClose: () => void;
  onDownload: (r: MedicalRecord) => void;
  onUpdate?: (updates: Partial<MedicalRecord>) => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(false);

  const handleAnalyze = async () => {
    if (!record || !record.backendId || !onUpdate) return;
    setAnalyzing(true);
    try {
      const ocrData: any = await processRecordOCR(record.backendId);
      const metrics = (ocrData?.extracted_fields || []).map((f: any) => ({
        label: f.metric_type.replace(/_/g, " "),
        value: `${f.value_numeric} ${f.unit || ""}`.trim(),
        flag: "normal" as const,
      }));
      const analysis =
        metrics.length > 0
          ? `AI extracted ${metrics.length} clinical metric${metrics.length === 1 ? "" : "s"} from document.`
          : "Report analyzed with OCR pipeline. Stored in secure locker.";

      onUpdate({
        metrics: metrics.length > 0 ? metrics : undefined,
        analysis,
        ocrStatus: ocrData?.status || "COMPLETED",
      });
    } catch (err) {
      console.warn("OCR analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadOriginalFile = async () => {
    if (!record) return;
    if (record.backendId) {
      setDownloadingFile(true);
      try {
        await downloadMedicalRecord(record.backendId, record.fileName);
      } catch (err: any) {
        console.warn("Could not download file directly from server:", err);
        // Fallback to text summary if physical file fails
        onDownload(record);
      } finally {
        setDownloadingFile(false);
      }
    } else {
      // Local demo fallback
      onDownload(record);
    }
  };

  return (
    <Modal
      open={!!record}
      onClose={onClose}
      title={record?.title ?? ""}
      description={record ? `${record.type} · ${formatDate(record.date)}` : undefined}
      footer={
        record && (
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            {/* Download Original Uploaded File Button */}
            {(record.backendId || record.fileName) ? (
              <button
                type="button"
                disabled={downloadingFile}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0878b8] text-white hover:bg-[#06699f] transition disabled:opacity-60 shadow-sm"
                onClick={handleDownloadOriginalFile}
              >
                {downloadingFile ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {downloadingFile ? "Downloading..." : "Download Original Report"}
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={btnGhost}
                onClick={() => onDownload(record)}
                title="Download text summary of metrics & doctor notes"
              >
                <FileText size={14} /> Summary (.txt)
              </button>
              <button type="button" className={btnGhost} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )
      }
    >
      {record && (
        <div className="space-y-5 text-sm">
          {/* Patient & Doctor Metadata */}
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-semibold text-mute">Patient</dt>
              <dd className="mt-0.5 font-semibold text-ink">{member?.name ?? "Unknown"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-mute">Doctor</dt>
              <dd className="mt-0.5 font-semibold text-ink">{record.doctor || "Not added"}</dd>
            </div>
          </dl>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-mute">Notes</p>
            <p className="mt-1 leading-6 text-body">{record.description}</p>
          </div>

          {/* Dedicated Original File Download Card */}
          {(record.backendId || record.fileName) && (
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-blue-100 bg-blue-50/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[#0878b8]">
                  <Paperclip size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {record.fileName || "Uploaded Medical Document"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Original document stored securely in medical locker
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={downloadingFile}
                onClick={handleDownloadOriginalFile}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-[#0878b8] transition shadow-2xs"
              >
                {downloadingFile ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                {downloadingFile ? "Saving..." : "Download File"}
              </button>
            </div>
          )}

          {/* Trigger OCR if not yet analyzed */}
          {record.backendId && (!record.metrics || record.metrics.length === 0) && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-xs font-bold text-slate-800">AI Medical Extraction</p>
                <p className="text-[11px] text-slate-500">
                  Extract clinical lab values & diagnosis using OCR.
                </p>
              </div>
              <button
                type="button"
                disabled={analyzing}
                onClick={handleAnalyze}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0878b8] text-white hover:bg-[#06699f] transition disabled:opacity-60"
              >
                {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {analyzing ? "Extracting..." : "Run AI OCR"}
              </button>
            </div>
          )}

          {/* Key Results / Metrics */}
          {record.metrics && record.metrics.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-mute">Key results</p>
              <ul className="mt-2 divide-y divide-[#f0f2f6] rounded-lg border border-line">
                {record.metrics.map((m) => (
                  <li key={m.label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <span className="text-body">{m.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{m.value}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${flagStyle[m.flag]}`}>
                        {flagLabel[m.flag]}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Insight */}
          {record.analysis && (
            <div className="rounded-lg bg-mint-soft p-3.5">
              <p className="text-xs font-bold text-[#15965d]">AI insight</p>
              <p className="mt-1 leading-6 text-[#317354]">{record.analysis}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
