import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

/**
 * Очередь ручной проверки в /admin/bureau (21.10.2026).
 *
 * Сторожим: выключенный флаг не выглядит пустой очередью; одобрение уходит в
 * /decide с именем; отказ без причины не уходит вовсе (бэк ответил бы 400).
 */
import { KycManualQueue } from "../KycManualQueue";

const ID = "kyc-man-0123456789abcdef0123456789abcdef";
let ответы: { status: number; body: unknown }[] = [];
let запросы: { url: string; init?: RequestInit }[] = [];
const notify = vi.fn();
const auth = () => ({ Authorization: "Bearer t" });

beforeEach(() => {
  ответы = [];
  запросы = [];
  notify.mockReset();
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    запросы.push({ url: String(url), init });
    const o = ответы.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(o.body), { status: o.status });
  }) as typeof fetch;
});

const item = {
  id: ID,
  email: "a@b.kz",
  declaredName: "Asel Nurlanovna",
  declaredCountry: "KZ",
  status: "review",
  docType: "passport",
  hasFiles: true,
  submittedAt: "2026-10-21T05:00:00.000Z",
  purgeAfter: "2026-11-20T05:00:00.000Z",
  purgedAt: null,
  decidedAt: null,
  decidedBy: null,
  reason: null,
  verifiedName: null,
};

describe("очередь ручной проверки", () => {
  test("флаг выключен — сказано словами, а не «заявок нет»", async () => {
    ответы.push({ status: 404, body: { error: "kyc_manual_disabled" } });
    const { container } = render(<KycManualQueue authHeaders={auth} notify={notify} />);
    await waitFor(() => expect(container.querySelector("[data-admin-kyc-manual-disabled]")).not.toBeNull());
    expect(container.textContent).not.toMatch(/No sessions/);
  });

  test("одобрение уходит в /decide с именем, страной и типом документа", async () => {
    ответы.push({ status: 200, body: { items: [item], count: 1 } });
    ответы.push({ status: 200, body: { ...item, status: "approved" } });
    ответы.push({ status: 200, body: { items: [], count: 0 } });
    const { container, getByText } = render(<KycManualQueue authHeaders={auth} notify={notify} />);
    await waitFor(() => expect(container.querySelector(`[data-admin-kyc-item="${ID}"]`)).not.toBeNull());
    expect(запросы[0].url).toMatch(/\/api\/bureau\/admin\/kyc-manual\?status=review$/);
    fireEvent.click(getByText("Approve"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Identity approved", "success"));
    const d = запросы[1];
    expect(d.url).toMatch(new RegExp(`/api/bureau/admin/kyc-manual/${ID}/decide$`));
    expect((d.init?.headers as Record<string, string>).Authorization).toBe("Bearer t");
    expect(JSON.parse(String(d.init?.body))).toEqual({
      decision: "approved",
      verifiedName: "Asel Nurlanovna",
      verifiedCountry: "KZ",
      verifiedDocType: "passport",
    });
  });

  test("отказ без причины не отправляется", async () => {
    ответы.push({ status: 200, body: { items: [item], count: 1 } });
    const { container, getByText } = render(<KycManualQueue authHeaders={auth} notify={notify} />);
    await waitFor(() => expect(container.querySelector(`[data-admin-kyc-item="${ID}"]`)).not.toBeNull());
    fireEvent.click(getByText("Reject"));
    expect(notify).toHaveBeenCalledWith("Reason is required to reject", "error");
    expect(запросы).toHaveLength(1);
  });
});
