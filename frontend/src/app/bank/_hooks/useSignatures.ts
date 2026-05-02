"use client";

import { useCallback, useEffect, useState } from "react";
import { verifySignature } from "../_lib/api";
import {
  clearSignatures,
  loadSignatures,
  SIGNATURE_EVENT,
  updateSignatureStatus,
  type SignedOperation,
} from "../_lib/signatures";

export function useSignatures() {
  const [items, setItems] = useState<SignedOperation[]>([]);
  const [verifying, setVerifying] = useState<boolean>(false);

  useEffect(() => {
    setItems(loadSignatures());
    if (typeof window === "undefined") return;
    const reload = () => setItems(loadSignatures());
    window.addEventListener(SIGNATURE_EVENT, reload);
    return () => window.removeEventListener(SIGNATURE_EVENT, reload);
  }, []);

  const verifyOne = useCallback(async (sig: SignedOperation) => {
    try {
      const r = await verifySignature(sig.payload, sig.signature);
      updateSignatureStatus(sig.id, r.valid ? "valid" : "invalid");
    } catch {
      updateSignatureStatus(sig.id, "error");
    }
  }, []);

  const verifyAll = useCallback(async () => {
    if (verifying) return;
    setVerifying(true);
    try {
      for (const sig of items) {
        await verifyOne(sig);
      }
    } finally {
      setVerifying(false);
    }
  }, [items, verifyOne, verifying]);

  const clear = useCallback(() => {
    clearSignatures();
  }, []);

  return { items, verifyOne, verifyAll, verifying, clear };
}
