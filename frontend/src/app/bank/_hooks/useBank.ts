"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "../_lib/api";
import type { Account, Me, Operation } from "../_lib/types";

type ErrorHandler = (msg: string) => void;

function extractMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export function useBank(me: Me | null, onError: ErrorHandler) {
  const [account, setAccount] = useState<Account | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [provisioning, setProvisioning] = useState<boolean>(false);

  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    try {
      const [accs, ops] = await Promise.all([api.listAccounts(), api.listOperations()]);
      const mine = accs.find((a) => a.owner === me.email) || null;
      setAccount(mine);
      setOperations(mine ? ops.filter((op) => op.to === mine.id || op.from === mine.id) : []);
    } catch (e) {
      onError(extractMessage(e, "Load failed"));
    } finally {
      setLoading(false);
    }
  }, [me, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const provision = useCallback(async () => {
    if (!me || provisioning) return;
    setProvisioning(true);
    try {
      await api.createAccount(me.email);
      await load();
    } catch (e) {
      onError(extractMessage(e, "Create failed"));
    } finally {
      setProvisioning(false);
    }
  }, [me, provisioning, load, onError]);

  const send = useCallback(
    async (to: string, amount: number): Promise<boolean> => {
      if (!account) {
        onError("No account");
        return false;
      }
      try {
        await api.transfer(account.id, to, amount);
        await load();
        return true;
      } catch (e) {
        onError(extractMessage(e, "Transfer failed"));
        return false;
      }
    },
    [account, load, onError],
  );

  const topup = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!account) {
        onError("No account");
        return false;
      }
      try {
        await api.topUp(account.id, amount);
        await load();
        return true;
      } catch (e) {
        onError(extractMessage(e, "Top-up failed"));
        return false;
      }
    },
    [account, load, onError],
  );

  return { account, operations, loading, provisioning, load, provision, send, topup };
}
