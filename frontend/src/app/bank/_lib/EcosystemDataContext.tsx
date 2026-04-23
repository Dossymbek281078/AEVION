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
    // Reset but render progressive arrivals — each stream appears as soon
    // as its fetch resolves so the UI doesn't wait on the slowest source.
    setData({ royalty: null, chess: null, ecosystem: null, loaded: false });

    const markLoaded = (prev: EcosystemData): EcosystemData => {
      const allArrived = prev.royalty !== null && prev.chess !== null && prev.ecosystem !== null;
      return allArrived ? { ...prev, loaded: true } : prev;
    };

    void fetchRoyaltyStream(accountId).then((royalty) => {
      if (cancelled) return;
      setData((prev) => markLoaded({ ...prev, royalty }));
    });
    void fetchChessSummary(accountId).then((chess) => {
      if (cancelled) return;
      setData((prev) => markLoaded({ ...prev, chess }));
    });
    void fetchEcosystemEarnings({ accountId, operations }).then((ecosystem) => {
      if (cancelled) return;
      setData((prev) => markLoaded({ ...prev, ecosystem }));
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
