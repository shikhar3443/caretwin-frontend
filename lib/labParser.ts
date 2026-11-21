export type LabTest =
  | "Hemoglobin"
  | "Creatinine"
  | "Potassium"
  | "Urea Nitrogen"
  | "Sodium"
  | "Glucose"
  | "Calcium"
  | "RBC Count"
  | "WBC Count"
  | "Platelet Count"
  | "Hematocrit"
  | "Albumin";

export type LabCandidate = {
  test: LabTest;
  value: string;
  unit: string;
  unitReported: boolean;
  rawLine: string;
  referenceRange?: string;
  normalizedValue: number | null;
  normalizedUnit: string;
  converted: boolean;
  reliable: boolean;
  bloodUrea: boolean;
  possibleConversion?: {
    value: string;
    sourceUnit: string;
    targetUnit: string;
  };
  withinReferenceRange?: boolean;
};

type LabRule = {
  test: LabTest;
  pattern: RegExp;
  standardUnit: string;
  min: number;
  max: number;
};

const RULES: LabRule[] = [
  { test: "Hemoglobin", pattern: /\b(?:haemoglobin|hemoglobin|hb)\b/gi, standardUnit: "g/dL", min: 0, max: 25 },
  { test: "Creatinine", pattern: /\b(?:serum\s+creatinine|s\.?\s*creatinine|creatinine)\b/gi, standardUnit: "mg/dL", min: 0, max: 30 },
  { test: "Potassium", pattern: /\b(?:serum\s+potassium|potassium)\b|\bK\s*\+/gi, standardUnit: "mEq/L", min: 0.5, max: 12 },
  { test: "Urea Nitrogen", pattern: /\b(?:blood\s+urea\s+nitrogen|urea\s+nitrogen|BUN)\b/gi, standardUnit: "mg/dL", min: 0, max: 300 },
  { test: "Urea Nitrogen", pattern: /\bblood\s+urea\b(?!\s+nitrogen)/gi, standardUnit: "mg/dL", min: 0, max: 300 },
  { test: "Sodium", pattern: /\b(?:serum\s+sodium|sodium)\b|\bNa\s*\+/gi, standardUnit: "mEq/L", min: 80, max: 200 },
  { test: "Glucose", pattern: /\b(?:fasting\s+glucose|blood\s+sugar|glucose|FBS|RBS)\b/gi, standardUnit: "mg/dL", min: 0, max: 2000 },
  { test: "Calcium", pattern: /\b(?:calcium\s*,?\s*total|s\.?\s*calcium|total\s+calcium|calcium)\b/gi, standardUnit: "mg/dL", min: 0, max: 25 },
  { test: "RBC Count", pattern: /\b(?:RBC|red\s+blood\s+cell|erythrocyte)(?:\s+count)?\b/gi, standardUnit: "million/µL", min: 0, max: 15 },
  { test: "WBC Count", pattern: /\b(?:WBC|white\s+blood\s+cell|leukocyte)(?:\s+count)?\b/gi, standardUnit: "cells/µL", min: 0, max: 500000 },
  { test: "Platelet Count", pattern: /\b(?:platelet|thrombocyte)(?:\s+count)?s?\b/gi, standardUnit: "cells/µL", min: 0, max: 2000000 },
  { test: "Hematocrit", pattern: /\b(?:hematocrit|haematocrit|HCT|PCV)\b/gi, standardUnit: "%", min: 0, max: 100 },
  { test: "Albumin", pattern: /\b(?:serum\s+)?albumin\b/gi, standardUnit: "g/dL", min: 0, max: 10 },
];

type LabelHit = { rule: LabRule; index: number; end: number };

function unitFrom(text: string) {
  const unit = text.match(
    /(?:million\/(?:µ|μ|u|p)?L|cells?\/(?:µ|μ|u|p)?L|µmol\/L|μmol\/L|umol\/L|mmol\/L|mEq\/L|mg\/dL|mg%|g\/dL|g\/L|%)(?![\w])/i,
  )?.[0];
  if (!unit) return "";
  return unit.replace(/µ|μ/g, "u").replace(/\/l$/i, "/L");
}

function numericValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function referenceRangeFrom(text: string) {
  const match = /(?:\(|\[)?\s*(-?\d+(?:[.,]\d+)?)\s*[-–]\s*(-?\d+(?:[.,]\d+)?)\s*(?:\)|\])?/.exec(text);
  if (!match) return undefined;
  return `${match[1].replace(",", ".")} - ${match[2].replace(",", ".")}`;
}

export function normalizeLabValue(test: LabTest, value: string, unit: string, bloodUrea = false) {
  const numeric = numericValue(value);
  const rule = RULES.find((item) => item.test === test);
  if (numeric === null || !rule) {
    return { value: null, unit: rule?.standardUnit ?? "", converted: false, reliable: false };
  }

  const normalizedUnit = unit.toLowerCase().replace(/\s/g, "").replace(/µ|μ/g, "u");
  let convertedValue = numeric;
  let converted = false;

  if (test === "Creatinine" && normalizedUnit === "umol/l") {
    convertedValue = numeric / 88.4;
    converted = true;
  } else if (test === "Glucose" && normalizedUnit === "mmol/l") {
    convertedValue = numeric * 18;
    converted = true;
  } else if (test === "Calcium" && normalizedUnit === "mmol/l") {
    convertedValue = numeric * 4;
    converted = true;
  } else if (test === "Hemoglobin" && normalizedUnit === "g/l") {
    convertedValue = numeric / 10;
    converted = true;
  } else if (test === "Urea Nitrogen" && bloodUrea) {
    if (normalizedUnit === "mg/dl") {
      convertedValue = numeric / 2.14;
      converted = true;
    } else if (normalizedUnit === "mmol/l") {
      convertedValue = numeric * 2.8;
      converted = true;
    }
  }

  return {
    value: convertedValue,
    unit: rule.standardUnit,
    converted,
    reliable: convertedValue >= rule.min && convertedValue <= rule.max,
  };
}

function isWithinReference(value: string, referenceRange?: string) {
  if (!referenceRange) return undefined;
  const range = referenceRange.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  const numeric = numericValue(value);
  if (!range || numeric === null) return undefined;
  return numeric >= Number(range[1]) && numeric <= Number(range[2]);
}

export function parseLabs(ocrText: string): LabCandidate[] {
  const candidates: LabCandidate[] = [];

  for (const rawLine of ocrText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const hits: LabelHit[] = [];
    for (const rule of RULES) {
      const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
      for (const match of line.matchAll(pattern)) {
        if (match.index === undefined) continue;
        hits.push({ rule, index: match.index, end: match.index + match[0].length });
      }
    }
    hits.sort((a, b) => a.index - b.index || b.end - a.end);

    const distinctHits = hits.filter((hit, index) => {
      if (index && hit.index < hits[index - 1].end) return false;
      return !hits.slice(0, index).some((prior) => prior.rule.test === hit.rule.test);
    });

    for (const [index, hit] of distinctHits.entries()) {
      const nextLabelIndex = distinctHits[index + 1]?.index ?? line.length;
      const remainder = line.slice(hit.end, nextLabelIndex);
      const valueMatch = /(?:^|[^\p{L}\d])(-?\d+(?:[.,]\d+)?)/u.exec(remainder);
      const value = valueMatch?.[1]?.replace(",", ".") ?? "";
      const valueEnd = valueMatch ? valueMatch.index + valueMatch[0].length : 0;
      const tail = valueMatch ? remainder.slice(valueEnd) : remainder;
      const reportedUnit = unitFrom(tail);
      const numeric = numericValue(value);
      const inferredHemoglobinUnit =
        hit.rule.test === "Hemoglobin" &&
        !reportedUnit &&
        numeric !== null &&
        numeric > 25 &&
        numeric <= 250;
      const unit = reportedUnit || (inferredHemoglobinUnit ? "g/L" : hit.rule.standardUnit);
      const referenceRange = referenceRangeFrom(tail);
      const bloodUrea = hit.rule.test === "Urea Nitrogen" &&
        /^blood\s+urea\b/i.test(line.slice(hit.index, hit.end));
      const normalized = normalizeLabValue(hit.rule.test, value, unit, bloodUrea);
      const possibleConversion =
        inferredHemoglobinUnit
          ? {
              value: String(Number((numeric / 10).toFixed(2))),
              sourceUnit: "g/L",
              targetUnit: "g/dL",
            }
          : undefined;
      candidates.push({
        test: hit.rule.test,
        value,
        unit,
        unitReported: !!reportedUnit,
        rawLine: line,
        ...(referenceRange && { referenceRange }),
        normalizedValue: normalized.value,
        normalizedUnit: normalized.unit,
        converted: normalized.converted,
        reliable: !!value && normalized.reliable,
        bloodUrea,
        ...(possibleConversion && { possibleConversion }),
        ...(referenceRange && {
          withinReferenceRange: isWithinReference(value, referenceRange),
        }),
      });
    }
  }
  return candidates;
}
