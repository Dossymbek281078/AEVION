"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { loadCurrency, saveCurrency, type CurrencyCode } from "./currency";

type CurrencyContextValue = {
  code: CurrencyCode;
  setCode: (c: CurrencyCode) => void;
};

const Ctx = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCodeState] = useState<CurrencyCode>("AEC");

  useEffect(() => {
    setCodeState(loadCurrency());
  }, []);

  const setCode = useCallback((c: CurrencyCode) => {
    setCodeState(c);
    saveCurrency(c);
  }, []);

  return <Ctx.Provider value={{ code, setCode }}>{children}</Ctx.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const v = useContext(Ctx);
  if (!v) return { code: "AEC", setCode: () => {} };
  return v;
}
