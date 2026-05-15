"use client";

import { useEffect, useState, useCallback } from "react";

const KEY = "aevion-smeta-student-v1";

export interface StudentInfo {
  name: string;
  group: string;
}

const EMPTY: StudentInfo = { name: "", group: "" };

export function useStudent() {
  const [student, setStudentState] = useState<StudentInfo>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setStudentState({ ...EMPTY, ...JSON.parse(raw) });
    } catch {}
    setHydrated(true);
  }, []);

  const setStudent = useCallback((next: StudentInfo) => {
    setStudentState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, []);

  return { student, setStudent, hydrated };
}
