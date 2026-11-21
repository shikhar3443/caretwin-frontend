"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, HeartPulse, Loader2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { btnPrimary } from "@/components/ui/Field";
import { Stagger, StaggerItem } from "@/components/ui/Motion";
import RiskTrendChart, { type RiskTrendRun } from "@/components/Dashboard/RiskTrendChart";
import { useCareData } from "@/lib/useCareData";
import {
  ageOnDate,
  extractMortalityLabValues,
  extractMortalityReportDate,
  extractMortalityReportMetadata,
} from "@/lib/mortalityReport";
import {
  getRecordOcr,
  getPredictionSchema,
  predictMortality,
  type ApiMortalityResult,
  type ApiPredictionSchema,
} from "@/lib/api";

const inputCls =
  "mt-1.5 h-11 w-full rounded-lg border border-[#dfe3ea] bg-white px-3 text-sm font-normal text-ink";
const labelCls = "text-[13px] font-semibold text-[#374151]";

const CATEGORY_FIELDS = [
  { key: "admission_type", prop: "admissionType", label: "Admission type" },
  { key: "admission_location", prop: "admissionLocation", label: "Admission location" },
  { key: "insurance", prop: "insurance", label: "Insurance" },
  { key: "language", prop: "language", label: "Language" },
  { key: "marital_status", prop: "maritalStatus", label: "Marital status" },
] as const;

// Parse "4.1, 3.8" into [4.1, 3.8]; blank means "not measured".
function parseValues(raw: string): number[] | null {
  const parts = raw.split(/[,\s]+/).filter(Boolean);
  if (!parts.length) return null;
  const nums = parts.map(Number);
  return nums.every(Number.isFinite) ? nums : [];
}

export default function MortalityRiskPage() {
  const { records, members, user, hydrated, recordsState, familyState, updateRecord } = useCareData();
  const [schema, setSchema] = useState<ApiPredictionSchema | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [reportDateSource, setReportDateSource] = useState("");
  const [reportDateAmbiguous, setReportDateAmbiguous] = useState(false);
  const [dateConflict, setDateConflict] = useState<{
    recordId: string;
    dashboardDate: string;
    reportDate: string;
  } | null>(null);
  const [importingRecord, setImportingRecord] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [admissionDate, setAdmissionDate] = useState("");
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [labs, setLabs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ApiMortalityResult | null>(null);
  const [runs, setRuns] = useState<RiskTrendRun[]>([]);
  const [autoEstimateStatus, setAutoEstimateStatus] = useState<string | null>(null);
  const processedReportIds = useRef(new Set<string>());
  const inFlightReportIds = useRef(new Set<string>());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPredictionSchema()
      .then(setSchema)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load the form."));
  }, []);

  useEffect(() => {
    if (
      !schema ||
      !user ||
      !hydrated ||
      recordsState.status !== "ready" ||
      familyState.status !== "ready"
    ) {
      return;
    }

    const pendingReports = records.filter(
      (record) =>
        (record.hasFile || Boolean(record.fileName)) &&
        !processedReportIds.current.has(record.id) &&
        !inFlightReportIds.current.has(record.id),
    );
    if (!pendingReports.length) return;

    for (const record of pendingReports) inFlightReportIds.current.add(record.id);
    setAutoEstimateStatus(`Checking ${pendingReports.length} uploaded ${pendingReports.length === 1 ? "report" : "reports"} for completed text extraction…`);

    const scoreReports = async () => {
      let added = 0;
      const failures: string[] = [];
      const newRuns: RiskTrendRun[] = [];

      await Promise.all(
        pendingReports.map(async (record) => {
          try {
            let ocr = await getRecordOcr(record.id);
            const deadline = Date.now() + 3 * 60 * 1000;
            while (
              (ocr.status === "queued" || ocr.status === "processing") &&
              Date.now() < deadline
            ) {
              await new Promise((resolve) => setTimeout(resolve, 2_000));
              ocr = await getRecordOcr(record.id);
            }
            if (ocr.status !== "succeeded" || !ocr.text) {
              throw new Error(
                ocr.status === "failed"
                  ? "text extraction failed"
                  : "text extraction is still processing",
              );
            }

            const metadata = extractMortalityReportMetadata(ocr.text);
            const reportDate = metadata.date?.value ?? null;
            if (reportDate && record.date && reportDate !== record.date) {
              throw new Error("report date differs from the dashboard date; select this report and confirm which date to use");
            }
            const riskDate = reportDate ?? record.date;
            if (!riskDate) throw new Error("no report date or dashboard date was provided");

            const member = members.find((item) => item.id === record.memberId);
            const dateOfBirth =
              member?.dob || (member?.relation === "Self" || member?.id === "self" ? user.dateOfBirth ?? "" : "");
            const gender = member?.gender || (member?.relation === "Self" || member?.id === "self" ? user.gender ?? "" : "");
            const age = ageOnDate(dateOfBirth, riskDate);
            if (age === null) throw new Error("the patient's profile needs a valid date of birth");

            const extracted = extractMortalityLabValues(ocr.text, schema);
            const labs = Object.fromEntries(
              Object.entries(extracted).map(([name, candidate]) => [
                name,
                [Number(candidate.value)],
              ]),
            );
            const prediction = await predictMortality({
              age,
              admissionDate: riskDate,
              ...((gender === "female" || gender === "male") && {
                gender: gender === "female" ? "F" : "M",
              }),
              labs,
            });
            newRuns.push({
              id: `report-${record.id}`,
              createdAt: (record as any).createdAt ?? record.date ?? new Date().toISOString(),
              admissionTime: riskDate,
              probability: prediction.result.probability,
              threshold: prediction.result.threshold,
              flagged: prediction.result.flagged,
              labsSupplied: Object.keys(labs).length,
              labs: Object.fromEntries(
                Object.entries(labs).map(([name, values]) => [name, [...values]]),
              ),
            });
            added += 1;
          } catch (cause) {
            const reason = cause instanceof Error ? cause.message : "prediction unavailable";
            failures.push(`${record.title}: ${reason}`);
          } finally {
            processedReportIds.current.add(record.id);
            inFlightReportIds.current.delete(record.id);
          }
        }),
      );

      if (newRuns.length) {
        setRuns((current) =>
          [...current, ...newRuns].sort(
            (a, b) =>
              a.admissionTime.localeCompare(b.admissionTime) ||
              a.createdAt.localeCompare(b.createdAt),
          ),
        );
      }
      setAutoEstimateStatus(
        [
          added ? `Added ${added} estimate${added === 1 ? "" : "s"} from uploaded reports.` : "",
          failures.length
            ? `Could not score ${failures.length} report${failures.length === 1 ? "" : "s"}: ${failures.join("; ")}.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    };

    void scoreReports();
  }, [schema, user, hydrated, recordsState.status, familyState.status, records, members]);

  const importReport = async (recordId: string) => {
    setSelectedRecordId(recordId);
    setImportMessage(null);
    setImportError(null);
    if (!recordId || !schema) return;

    setImportingRecord(true);
    try {
      const ocr = await getRecordOcr(recordId);
      if (ocr.status !== "succeeded" || !ocr.text) {
        throw new Error(
          ocr.status === "failed"
            ? "Text extraction failed for this report. Try re-uploading it from Medical Records."
            : "Text extraction is still processing. Try selecting this report again in a moment.",
        );
      }

      const extracted = extractMortalityLabValues(ocr.text, schema);
      const reportDate = extractMortalityReportDate(ocr.text);
      const selectedRecord = records.find((record) => record.id === recordId);
      const dashboardDate = selectedRecord?.date ?? "";
      const dateDiffers = Boolean(
        reportDate && dashboardDate && reportDate.value !== dashboardDate,
      );
      const values = Object.fromEntries(
        Object.entries(extracted).map(([lab, candidate]) => [lab, candidate.value]),
      );
      setLabs(values);
      setAdmissionDate(dashboardDate || reportDate?.value || "");
      setReportDateSource(reportDate?.sourceValue ?? "");
      setReportDateAmbiguous(reportDate?.ambiguousNumericFormat ?? false);
      setDateConflict(
        dateDiffers && reportDate
          ? { recordId, dashboardDate, reportDate: reportDate.value }
          : null,
      );
      const adjustedLabs = Object.entries(extracted)
        .filter(([, candidate]) => candidate.decimalAdjusted)
        .map(([lab]) => lab);
      const count = Object.keys(extracted).length;
      setImportMessage(
        [
          dateDiffers
            ? `The report date (${reportDate?.value}) differs from the dashboard date (${dashboardDate}). Choose which date to use before estimating.`
            : reportDate
              ? `Report date recognized as ${reportDate.value}; verify it below.`
              : dashboardDate
                ? `No report date was recognized; using the dashboard date ${dashboardDate}.`
                : "No report date was recognized; enter it below.",
          reportDate?.ambiguousNumericFormat ? `The numeric date “${reportDate.sourceValue}” is ambiguous; it was read as MM/DD/YYYY. Verify it against the report.` : "",
          adjustedLabs.length
            ? `OCR may have dropped a decimal for ${adjustedLabs.join(", ")}; confirm these values against the report.`
            : count
              ? `Recognized ${count} lab ${count === 1 ? "value" : "values"}. Review and correct them below.`
              : "No supported lab values were recognized. Enter the values manually.",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : "Could not read this report.");
    } finally {
      setImportingRecord(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schema) return;
    setError(null);
    setResult(null);
    if (dateConflict) {
      setError("Choose whether to replace the dashboard date with the report date before estimating.");
      return;
    }

    const labPayload: Record<string, number[]> = {};
    for (const [name, raw] of Object.entries(labs)) {
      const values = parseValues(raw);
      if (values === null) continue;
      if (!values.length) return setError(`${name}: enter numbers separated by commas.`);
      labPayload[name] = values;
    }

    const age = ageOnDate(user?.dateOfBirth, admissionDate);
    if (age === null) {
      setError(
        user?.dateOfBirth
          ? "The date of birth and report date do not produce a valid age. Update your profile or verify the report date."
          : "Add your date of birth in your profile before estimating risk.",
      );
      return;
    }
    if (!admissionDate) {
      setError("Enter or verify the report date.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await predictMortality({
        age,
        ...((user?.gender === "female" || user?.gender === "male") && {
          gender: user.gender === "female" ? "F" : "M",
        }),
        admissionDate,
        ...(categories.admissionType && { admissionType: categories.admissionType }),
        ...(categories.admissionLocation && { admissionLocation: categories.admissionLocation }),
        ...(categories.insurance && { insurance: categories.insurance }),
        ...(categories.language && { language: categories.language }),
        ...(categories.maritalStatus && { maritalStatus: categories.maritalStatus }),
        labs: labPayload,
      });
      setResult(response.result);
      const run: RiskTrendRun = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        admissionTime: admissionDate,
        probability: response.result.probability,
        threshold: response.result.threshold,
        flagged: response.result.flagged,
        labsSupplied: Object.keys(labPayload).length,
        labs: Object.fromEntries(
          Object.entries(labPayload).map(([name, values]) => [name, [...values]]),
        ),
      };
      setRuns((current) =>
        [...current, run].sort(
          (a, b) =>
            a.admissionTime.localeCompare(b.admissionTime) ||
            a.createdAt.localeCompare(b.createdAt),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediction failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const pct = result ? `${(result.probability * 100).toFixed(1)}%` : "";
  const ageAtReport = ageOnDate(user?.dateOfBirth, admissionDate);

  const resolveDateConflict = async (replaceDashboardDate: boolean) => {
    if (!dateConflict) return;
    if (replaceDashboardDate) {
      try {
        await updateRecord(dateConflict.recordId, {
          date: dateConflict.reportDate,
        });
        setAdmissionDate(dateConflict.reportDate);
        setImportMessage(`Dashboard date replaced with ${dateConflict.reportDate}.`);
      } catch (cause) {
        setImportError(cause instanceof Error ? cause.message : "The dashboard date could not be updated.");
        return;
      }
    } else {
      setAdmissionDate(dateConflict.dashboardDate);
      setImportMessage(`Keeping the dashboard date ${dateConflict.dashboardDate}.`);
    }
    setDateConflict(null);
    setResult(null);
    setError(null);
  };

  return (
    <Stagger className="mx-auto w-full max-w-[1000px] space-y-5">
      <StaggerItem>
        <PageHeader
          icon={<HeartPulse size={22} />}
          title="Mortality risk (research demo)"
          subtitle="Estimates the chance of in-hospital death within 24 hours from admission details and early lab results."
        />
      </StaggerItem>

      <StaggerItem>
        <div className="flex gap-3 rounded-lg border border-[#f3dcb1] bg-[#fff8eb] px-4 py-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#b7791f]" />
          <p className="text-[13px] leading-5 text-[#7a5a1f]">
            The model was trained on hospital admission data and has not been clinically
            validated. It is not a diagnosis and must not guide care decisions.Always check with a qualified healthcare professional for any medical concerns.
          </p>
        </div>
      </StaggerItem>

      <StaggerItem>
        {loadError ? (
          <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{loadError}</p>
        ) : !schema ? (
          <div className="ct-skeleton h-48 rounded-xl" />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <form onSubmit={(e) => void submit(e)} className="space-y-5 rounded-xl border border-line bg-white p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelCls}>
                  Age on selected date
                  <input readOnly value={ageAtReport ?? ""} placeholder="Add date of birth to profile" className={inputCls} />
                </label>
                <label className={labelCls}>
                  Report / admission date
                  <input required type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className={inputCls} />
                </label>
              </div>
              {!user?.dateOfBirth && (
                <p className="text-xs text-danger">Add your date of birth to your profile before estimating risk.</p>
              )}
              <p className="text-xs text-mute">
                Age is calculated from your profile date of birth and the selected date. The date is used for the model&apos;s calendar features; admission hour is left unspecified. Gender is sent only when your profile selection matches a category supported by the research model.
              </p>
              {reportDateSource && (
                <p className="text-xs text-mute">
                  Date read from report: “{reportDateSource}”. No admission time is needed.
                  {reportDateAmbiguous && " The numeric date is ambiguous and was interpreted as MM/DD/YYYY."}
                </p>
              )}
              {dateConflict && (
                <div className="space-y-2 rounded-lg border border-[#f3dcb1] bg-[#fff8eb] p-3">
                  <p className="text-xs text-[#7a5a1f]">
                    The report date ({dateConflict.reportDate}) differs from the dashboard date ({dateConflict.dashboardDate}). Which should replace the dashboard date?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f8f9fc]"
                      onClick={() => void resolveDateConflict(true)}
                    >
                      Replace dashboard date
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f8f9fc]"
                      onClick={() => void resolveDateConflict(false)}
                    >
                      Keep dashboard date
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls} htmlFor="mortality-report">
                  Fill lab fields from an uploaded report
                </label>
                <select
                  id="mortality-report"
                  value={selectedRecordId}
                  disabled={importingRecord || records.filter((record) => record.hasFile).length === 0}
                  onChange={(event) => void importReport(event.target.value)}
                  className={inputCls}
                >
                  <option value="">Choose an uploaded report…</option>
                  {records
                    .filter((record) => record.hasFile)
                    .map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.title} ({record.date})
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-mute">
                  Recognized lab values fill the editable fields below. Review them before submitting; age and admission time are not inferred.
                </p>
                {importingRecord && <p role="status" className="mt-2 text-sm text-mute">Reading extracted report text…</p>}
                {importMessage && <p role="status" className="mt-2 text-sm text-brand">{importMessage}</p>}
                {importError && <p role="alert" className="mt-2 text-sm text-danger">{importError}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {CATEGORY_FIELDS.map((f) => (
                  <label key={f.key} className={labelCls}>
                    {f.label}
                    <select
                      value={categories[f.prop] ?? ""}
                      onChange={(e) => setCategories((c) => ({ ...c, [f.prop]: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">Not specified</option>
                      {(schema.categories[f.key] ?? [])
                        .filter((v) => v !== "__MISSING__")
                        .map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>

              <div>
                <h2 className="text-[15px] font-bold text-ink">Lab results from the first 24 hours</h2>
                <p className="mt-1 text-[13px] text-mute">
                  Enter one or more values in time order, separated by commas. Leave blank if not measured.
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {Object.entries(schema.labs).map(([name, meta]) => (
                    <label key={name} className={labelCls}>
                      {name} ({meta.unit})
                      <input
                        inputMode="decimal"
                        placeholder="e.g. 4.1, 3.8"
                        value={labs[name] ?? ""}
                        onChange={(e) => setLabs((l) => ({ ...l, [name]: e.target.value }))}
                        className={inputCls}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
              <button type="submit" disabled={submitting} className={`${btnPrimary} w-full justify-center`}>
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? "Estimating…" : "Estimate risk"}
              </button>
            </form>

            <section className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6" aria-live="polite">
              <h2 className="text-[15px] font-bold text-ink">Result</h2>
              {!result ? (
                <p className="rounded-lg bg-[#f8f9fc] p-4 text-sm text-mute">The estimate appears here after you submit the form.</p>
              ) : (
                <div className="space-y-3">
                  <div className={`rounded-lg p-4 ${result.flagged ? "bg-danger-soft text-danger" : "bg-[#f0fbf5] text-[#15965d]"}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      {result.flagged ? "Elevated risk" : "Lower risk"}
                    </p>
                    <p className="mt-1 text-3xl font-bold">{pct}</p>
                    <p className="mt-1 text-xs">
                      Estimated chance within {result.predictionWindowHours} hours. The model flags scores at or above{" "}
                      {(result.threshold * 100).toFixed(1)}%.
                    </p>
                  </div>
                  {result.warnings.map((w) => (
                    <p key={w} className="text-[13px] text-[#7a5a1f]">• {w}</p>
                  ))}
                  <p className="text-xs text-mute">{result.disclaimer}</p>
                </div>
              )}
            </section>
          </div>
        )}
      </StaggerItem>

      {runs.length === 1 && (
        <StaggerItem>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-5 sm:p-6" aria-labelledby="risk-trend-heading">
            <div>
              <h2 id="risk-trend-heading" className="text-[15px] font-bold text-ink">Risk trend</h2>
              <p className="mt-1 text-sm text-mute">Another eligible uploaded report or successful form estimate will add a comparison point.</p>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => setRuns([])}>Clear history</button>
              <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => setRuns([])} aria-label="Remove the estimate from the risk trend">Remove run</button>
            </div>
          </section>
        </StaggerItem>
      )}

      {autoEstimateStatus && (
        <StaggerItem>
          <p role="status" className="rounded-lg border border-line bg-white px-4 py-3 text-sm text-body">
            {autoEstimateStatus}
          </p>
        </StaggerItem>
      )}

      {runs.length >= 2 && (
        <StaggerItem>
          <RiskTrendChart
            runs={runs}
            onRemoveRun={(id) => setRuns((current) => current.filter((run) => run.id !== id))}
            onClearHistory={() => setRuns([])}
          />
        </StaggerItem>
      )}
    </Stagger>
  );
}
