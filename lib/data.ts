import type { Account, MedicalRecord, Member, Prefs, RecordType } from "./types";

export const RECORD_TYPES: RecordType[] = [
  "Laboratory",
  "Cardiology",
  "Radiology",
  "Prescription",
  "Consultation",
  "Vaccination",
  "Other",
];

export const RELATIONS = [
  "Self",
  "Mother",
  "Father",
  "Spouse",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Grandmother",
  "Grandfather",
  "Other",
];

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const MEMBER_COLORS = [
  "#0878b8",
  "#15965d",
  "#7c5cd6",
  "#d9822b",
  "#d6457a",
  "#2a9db0",
];

export const SELF_ID = "self";

export const SEED_MEMBERS: Member[] = [
  {
    id: SELF_ID,
    name: "User",
    relation: "Self",
    dob: "",
    gender: "",
    bloodGroup: "",
    heightCm: "",
    weightKg: "",
    allergies: [],
    conditions: [],
    medications: [],
    primaryDoctor: "",
    insurance: "",
    organDonor: false,
    contacts: [],
    color: MEMBER_COLORS[0],
  },
];

export const SEED_RECORDS: MedicalRecord[] = [];

export const SEED_ACCOUNT: Account = {
  email: "",
  phone: "",
  avatar: "",
};

export const SEED_PREFS: Prefs = {
  shareWithAI: true,
  analytics: false,
  twoFactor: false,
  notifyFollowUps: true,
  notifyReports: true,
  notifyProduct: false,
  notifyEmail: true,
};

// Sample vitals for the overview chart (replace with real device data later).
export const SAMPLE_VITALS = {
  heart: {
    label: "Resting heart rate",
    unit: "bpm",
    months: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    values: [76, 74, 73, 71, 69, 68],
  },
  glucose: {
    label: "Fasting glucose",
    unit: "mg/dL",
    months: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    values: [99, 97, 98, 95, 94, 93],
  },
  sleep: {
    label: "Sleep",
    unit: "hrs",
    months: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    values: [6.8, 7.0, 7.2, 7.6, 8.0, 8.2],
  },
} as const;
