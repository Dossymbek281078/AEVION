"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fetchChessSummary, type ChessSummary } from "./chess";
import { fetchEcosystemEarnings, type EcosystemEarningsSummary } from "./ecosystem";
import { fetchRoyaltyStream, type RoyaltyStreamSummary } from "./royalties";
import type { Operation } from "./types";

export type EcosystemData = {
  royalty: RoyaltyStreamSummary | null;
  chess: ChessSummary | null;
  ecosystem: EcosystemEarningsSummary | null;
  loaded: boolean;
};

const EMPTY: EcosystemData = {
  royalty: null,
  chess: null,
  ecosystem: null,
  loaded: false,
};

const EcosystemCtx = createContext<EcosystemData>(EMPTY);

export function EcosystemDataProvider({
  accountId,
  operations,
  children,
}: {
  accountId: string | null;
  operations: Operation[];
  children: ReactNode;
}) {
  const [data, setData] = useState<EcosystemData>(EMPTY);

  useEffect(() => {
    if (!accountId) {
      setData(EMPTY);
      return;
    }
    let cancelled = false;
    void Promise.all([
      fetchRoyaltyStream(accountId),
      fetchChessSummary(accountId),
      fetchEcosystemEarnings({ accountId, operations }),
    ]).then(([royalty, chess, ecosystem]) => {
      if (cancelled) return;
      setData({ royalty, chess, ecosystem, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, operations]);

  return <EcosystemCtx.Provider value={data}>{children}</EcosystemCtx.Provider>;
}

export function useEcosystemData(): EcosystemData {
  return useContext(EcosystemCtx);
}
