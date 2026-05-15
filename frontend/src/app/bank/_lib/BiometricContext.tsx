"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  assertBiometric,
  enrollBiometric,
  isBiometricSupported,
  loadBiometric,
  saveBiometric,
  type BiometricSettings,
} from "./biometric";

type BiometricContextValue = {
  supported: boolean;
  settings: BiometricSettings | null;
  enroll: (email: string, threshold: number) => Promise<BiometricSettings | null>;
  disable: () => void;
  setThreshold: (n: number) => void;
  // Returns true if amount is below threshold OR biometric assertion succeeds.
  // Returns false if assertion was required and failed/cancelled.
  guard: (amount: number) => Promise<boolean>;
};

const Ctx = createContext<BiometricContextValue | null>(null);

export function BiometricProvider({ children }: { children: ReactNode }) {
  const [supported, setSupported] = useState<boolean>(false);
  const [settings, setSettings] = useState<BiometricSettings | null>(null);

  useEffect(() => {
    setSupported(isBiometricSupported());
    setSettings(loadBiometric());
  }, []);

  const enroll = useCallback(async (email: string, threshold: number) => {
    try {
      const s = await enrollBiometric(email, threshold);
      setSettings(s);
      return s;
    } catch {
      return null;
    }
  }, []);

  const disable = useCallback(() => {
    saveBiometric(null);
    setSettings(null);
  }, []);

  const setThreshold = useCallback((n: number) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, threshold: n };
      saveBiometric(next);
      return next;
    });
  }, []);

  const guard = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!settings) return true;
      if (amount < settings.threshold) return true;
      return assertBiometric(settings);
    },
    [settings],
  );

  return (
    <Ctx.Provider value={{ supported, settings, enroll, disable, setThreshold, guard }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBiometric(): BiometricContextValue {
  const v = useContext(Ctx);
  if (!v) {
    return {
      supported: false,
      settings: null,
      enroll: async () => null,
      disable: () => {},
      setThreshold: () => {},
      guard: async () => true,
    };
  }
  return v;
}
