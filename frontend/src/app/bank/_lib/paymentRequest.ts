export type PaymentRequest = {
  to: string;
  amount?: number;
  memo?: string;
};

export function encodePaymentRequest(req: PaymentRequest): string {
  const q = new URLSearchParams();
  q.set("to", req.to);
  if (req.amount && Number.isFinite(req.amount) && req.amount > 0) {
    q.set("amount", String(req.amount));
  }
  if (req.memo && req.memo.trim()) {
    q.set("memo", req.memo.trim());
  }
  return `/bank?${q.toString()}`;
}

export function decodePaymentRequest(sp: URLSearchParams): PaymentRequest | null {
  const to = sp.get("to");
  if (!to || !to.startsWith("acc_")) return null;
  const amountStr = sp.get("amount");
  const parsedAmount = amountStr ? parseFloat(amountStr) : NaN;
  const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined;
  const memo = sp.get("memo")?.trim() || undefined;
  return { to, amount, memo };
}

export function absoluteRequestUrl(req: PaymentRequest): string {
  const path = encodePaymentRequest(req);
  if (typeof window === "undefined") return path;
  try {
    return new URL(path, window.location.origin).toString();
  } catch {
    return path;
  }
}
