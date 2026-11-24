"use client";

import { useEffect, useMemo } from "react";
import { usePersistentState, useHydrated, useNow } from "./store";
import { getCurrentUser, getMedicalRecords, getFamilyMembers, getAuthToken } from "./api";
import {
  SEED_ACCOUNT,
  SEED_MEMBERS,
  SEED_PREFS,
  SEED_RECORDS,
  SELF_ID,
} from "./data";
import type { Account, MedicalRecord, Member, Prefs } from "./types";

export const ALL_ID = "all";

/** Single entry point for everything the dashboard stores locally. */
export function useCareData() {
  const hydrated = useHydrated();
  const now = useNow();
  const [members, setMembers] = usePersistentState<Member[]>("ct:members", SEED_MEMBERS);
  const [records, setRecords] = usePersistentState<MedicalRecord[]>("ct:records", SEED_RECORDS);
  const [activeId, setActiveId] = usePersistentState<string>("ct:active", ALL_ID);
  const [account, setAccount] = usePersistentState<Account>("ct:account", SEED_ACCOUNT);
  const [prefs, setPrefs] = usePersistentState<Prefs>("ct:prefs", SEED_PREFS);

  const self = useMemo(
    () => members.find((m) => m.id === SELF_ID) ?? members[0],
    [members],
  );

  // Sync real authenticated user profile & permanent records from FastAPI backend
  useEffect(() => {
    if (!hydrated || !getAuthToken()) return;

    getCurrentUser()
      .then((u) => {
        if (u && (account.email !== u.email || self.name !== u.full_name)) {
          setAccount((prev) => ({ ...prev, email: u.email }));
          setMembers((prev) =>
            prev.map((m) => (m.id === SELF_ID ? { ...m, name: u.full_name } : m))
          );
        }
      })
      .catch(() => null);

    // Fetch permanent uploaded records from PostgreSQL database
    getMedicalRecords()
      .then((backendRecs: any[]) => {
        if (!backendRecs || backendRecs.length === 0) return;

        const mapped: MedicalRecord[] = backendRecs.map((br: any) => ({
          id: `backend-${br.id}`,
          backendId: br.id,
          memberId: SELF_ID,
          title: br.title,
          type: (br.document_type || "Laboratory") as any,
          date: br.upload_date ? br.upload_date.split("T")[0] : new Date().toISOString().split("T")[0],
          doctor: br.diagnosis ? `Diagnosed: ${br.diagnosis}` : "Clinic / Hospital",
          description: br.diagnosis ? `Primary diagnosis: ${br.diagnosis}` : "Medical document uploaded to locker.",
          fileName: br.file_path ? br.file_path.split(/[/\\]/).pop() : "document.pdf",
          hasFile: true,
          ocrStatus: br.ocr_status || "COMPLETED",
          analysis: (br.measurements && br.measurements.length > 0)
            ? `AI extracted ${br.measurements.length} clinical metric(s) via OCR.`
            : "Document analyzed with OCR pipeline. Stored in medical locker.",
          metrics: (br.measurements || []).map((m: any) => ({
            label: m.metric_type.replace(/_/g, " "),
            value: `${m.value_numeric} ${m.unit || ""}`.trim(),
            flag: "normal" as const,
          })),
        }));

        setRecords((prev) => {
          const map = new Map<string, MedicalRecord>();
          prev.forEach((r) => map.set(r.backendId ? `b-${r.backendId}` : r.id, r));
          mapped.forEach((r) => {
            const key = `b-${r.backendId}`;
            const existing = map.get(key);
            // Keep local richer metrics if present, otherwise use backend
            if (existing && existing.metrics && existing.metrics.length > 0) {
              map.set(key, { ...r, metrics: existing.metrics, analysis: existing.analysis });
            } else {
              map.set(key, r);
            }
          });
          return Array.from(map.values());
        });
      })
      .catch(() => null);
  }, [hydrated]);

  // If the active member was deleted, fall back to everyone.
  const safeActiveId =
    activeId === ALL_ID || members.some((m) => m.id === activeId) ? activeId : ALL_ID;

  const memberById = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const scopedRecords = useMemo(
    () =>
      safeActiveId === ALL_ID
        ? records
        : records.filter((r) => r.memberId === safeActiveId),
    [records, safeActiveId],
  );

  const updateRecord = (id: string, updates: Partial<MedicalRecord>) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const user = useMemo(() => ({
    name: self.name,
    email: account.email,
    dateOfBirth: self.dob,
    gender: self.gender,
  }), [account, self]);

  const recordsState = { status: hydrated ? "ready" : "loading" };
  const familyState = { status: hydrated ? "ready" : "loading" };

  return {
    hydrated,
    now,
    members,
    setMembers,
    records,
    setRecords,
    scopedRecords,
    activeId: safeActiveId,
    setActiveId,
    account,
    setAccount,
    prefs,
    setPrefs,
    self,
    memberById,
    user,
    recordsState,
    familyState,
    updateRecord,
  };
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
