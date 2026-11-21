import type { ApiPredictionSchema } from "./api";

const LAB_LABELS: Record<string, RegExp> = {
  Hemoglobin: /\b(?:hemoglobin|haemoglobin|hgb|hb)\b/i,
  Creatinine: /\b(?:creatinine|creat)\b/i,
  Potassium: /(?:\bpotassium\b|\bK\s*\+)/i,
  "Urea Nitrogen": /\b(?:blood\s+)?urea\s+nitrogen\b|\bBUN\b/i,
  Sodium: /\b(?:sodium|Na)\b/i,
  Glucose: /\b(?:glucose|blood\s+sugar|sugar)\b/i,
  "Calcium, Total": /\b(?:calcium(?:\s*,?\s*total)?|total\s+calcium)\b/i,
};

export type ExtractedLabValue = {
  value: string;
  sourceValue: string;
  decimalAdjusted: boolean;
};

export type ExtractedReportDate = {
  value: string;
  sourceValue: string;
  ambiguousNumericFormat: boolean;
};

export type ExtractedReportField = {
  value: string;
  sourceValue: string;
};

export type ExtractedReportMetadata = {
  date: ExtractedReportDate | null;
  doctor: ExtractedReportField | null;
  hospital: ExtractedReportField | null;
};

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function extractMortalityReportDate(text: string): ExtractedReportDate | null {
  const dateLabel =
    /\b(?:report|collection|specimen|sample|lab|test|result|admission)?\s*date\b\s*[:#=-]?\s*((?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2})|(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{4})|(?:[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}))\b/i;
  const match = dateLabel.exec(text.replace(/\s+/g, " "));
  if (!match) return null;

  const sourceValue = match[1].replace(/,$/, "");
  const iso = sourceValue.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    const value = validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return value ? { value, sourceValue, ambiguousNumericFormat: false } : null;
  }

  const named = sourceValue.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (named) {
    const month = new Date(`${named[1]} 1, 2000`).getMonth() + 1;
    const value = validDate(Number(named[3]), month, Number(named[2]));
    return value ? { value, sourceValue, ambiguousNumericFormat: false } : null;
  }

  const numeric = sourceValue.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!numeric) return null;
  const first = Number(numeric[1]);
  const second = Number(numeric[2]);
  const year = Number(numeric[3]);
  const ambiguousNumericFormat = first <= 12 && second <= 12;
  const month = first > 12 ? second : first;
  const day = first > 12 ? first : second;
  const value = validDate(year, month, day);
  return value ? { value, sourceValue, ambiguousNumericFormat } : null;
}

function extractLabeledName(text: string, labels: string): ExtractedReportField | null {
  const nextField = String.raw`(?=\s+\b(?:report|collection|specimen|sample|lab|test|result)?\s*(?:date|doctor|physician|attending(?:\s+physician)?|hospital|facility|clinic|patient)\s*(?:name)?\s*[:#=-]|\s*$)`;
  const match = new RegExp(
    String.raw`\b(?:${labels})\s*(?:name)?\s*[:#=-]\s*([A-Za-z][A-Za-z .'-]{1,79}?)${nextField}`,
    "i",
  ).exec(text.replace(/\s+/g, " "));
  const value = match?.[1]?.trim().replace(/[.,;:]+$/, "");
  if (!value || value.length < 2) return null;
  return { value, sourceValue: value };
}

export function extractMortalityReportMetadata(text: string): ExtractedReportMetadata {
  return {
    date: extractMortalityReportDate(text),
    doctor: extractLabeledName(text, "doctor|physician|attending(?:\\s+physician)?"),
    hospital: extractLabeledName(text, "hospital|facility|clinic"),
  };
}

export function ageOnDate(dateOfBirth: string | null | undefined, referenceDate: string): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) return null;
  const [birthYear, birthMonth, birthDay] = dateOfBirth.slice(0, 10).split("-").map(Number);
  const [year, month, day] = referenceDate.split("-").map(Number);
  if (![birthYear, birthMonth, birthDay, year, month, day].every(Number.isInteger)) return null;

  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

export function extractMortalityLabValues(
  text: string,
  schema: ApiPredictionSchema,
): Record<string, ExtractedLabValue> {
  const extracted: Record<string, ExtractedLabValue> = {};
  const normalizedText = text.replace(/\s+/g, " ");

  for (const [lab, pattern] of Object.entries(LAB_LABELS)) {
    const label = pattern.exec(normalizedText);
    if (!label) continue;

    const remainder = normalizedText.slice(label.index + label[0].length, label.index + label[0].length + 80);
    const valueMatch = remainder.match(
      /^[\s:|=]*(?:(?:result|value)\b[\s:=]*)?(?:(?:[a-zµμ%/().,*_+\-]+\s*){0,5})[\s:|=]*(-?\d+(?:[.,]\d+)?)/i,
    );
    if (!valueMatch) continue;

    const sourceValue = valueMatch[1].replace(",", ".");
    let value = Number(sourceValue);
    const range = schema.labs[lab];
    if (!Number.isFinite(value) || !range) continue;

    let decimalAdjusted = false;
    if (value < range.min || value > range.max) {
      const adjusted = value / 10;
      if (!Number.isInteger(value) || adjusted < range.min || adjusted > range.max) continue;
      value = adjusted;
      decimalAdjusted = true;
    }

    extracted[lab] = { value: String(value), sourceValue, decimalAdjusted };
  }

  return extracted;
}
