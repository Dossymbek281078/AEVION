import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Страница ручной проверки личности (бюро «Проверено», 21.10.2026).
 *
 * Что сторожим: (1) обещание ровно одно — документ смотрит сотрудник вручную,
 * на трёх языках, без «юридической идентификации»; (2) форма шлёт в ручку
 * /submit то, что бэк принимает; (3) отказ показывается отказом: выключенный
 * флаг и чужой id — словами, не пустой формой; 409 перечитывает статус.
 */

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "kyc-man-0123456789abcdef0123456789abcdef" }) }));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/ProductPageShell", () => ({ ProductPageShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
const { prepMock } = vi.hoisted(() => ({ prepMock: vi.fn() }));
vi.mock("../prepareFile", async (orig) => ({ ...(await orig<typeof import("../prepareFile")>()), подготовитьФайл: prepMock }));

// eslint-disable-next-line import/first
import KycManualPage from "../[id]/page";
// eslint-disable-next-line import/first
import ru from "@/lib/i18n-lang/ru";
// eslint-disable-next-line import/first
import en from "@/lib/i18n-lang/en";
// eslint-disable-next-line import/first
import kk from "@/lib/i18n-lang/kk";
// eslint-disable-next-line import/first
import { сжатьКартинку, KYC_MAX_FILE_BYTES } from "../prepareFile";

const ID = "kyc-man-0123456789abcdef0123456789abcdef";
type Ответ = { status: number; body: unknown };
let ответы: Ответ[] = [];
let запросы: { url: string; init?: RequestInit }[] = [];

beforeEach(() => {
  ответы = [];
  запросы = [];
  prepMock.mockReset();
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    запросы.push({ url: String(url), init });
    const o = ответы.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(o.body), { status: o.status });
  }) as typeof fetch;
});

const pending = { sessionId: ID, status: "pending", reason: null, filesDeleteAfter: null };

describe("обещание страницы", () => {
  test("на ru/en/kk сказано, что проверяет сотрудник вручную, и нет юридических слов", () => {
    expect(ru["bureau.kycm.manual"]).toMatch(/сотрудник AEVION вручную/);
    expect(en["bureau.kycm.manual"]).toMatch(/AEVION staff member checks your document manually/);
    expect(kk["bureau.kycm.manual"]).toMatch(/қызметкері қолмен/);
    for (const d of [ru, en, kk] as Record<string, string>[]) {
      const все = Object.entries(d)
        .filter(([k]) => k.startsWith("bureau.kycm."))
        .map(([, v]) => v)
        .join(" ");
      expect(все).not.toMatch(/юридич|legal|attestation|заң/i);
    }
  });

  test("все ключи страницы есть во всех трёх словарях", () => {
    const keys = Object.keys(ru).filter((k) => k.startsWith("bureau.kycm."));
    expect(keys.length).toBe(26);
    for (const k of keys) {
      expect(en[k as keyof typeof en], k).toBeTruthy();
      expect(kk[k as keyof typeof kk], k).toBeTruthy();
    }
  });
});

describe("путь человека", () => {
  test("pending → форма → POST /submit с тем, что принимает бэк → статус и дата удаления", async () => {
    ответы.push({ status: 200, body: pending });
    ответы.push({
      status: 201,
      body: { ...pending, status: "review", filesDeleteAfter: "2026-11-20T10:00:00.000Z" },
    });
    prepMock
      .mockResolvedValueOnce({ ok: true, mime: "application/pdf", base64: "UERG", bytes: 3 })
      .mockResolvedValueOnce({ ok: true, mime: "image/jpeg", base64: "SlBH", bytes: 3 });

    const { container } = render(<KycManualPage />);
    await waitFor(() => expect(container.querySelector("[data-kycm-form]")).not.toBeNull());
    const submit = container.querySelector("[data-kycm-submit]") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(container.querySelector("#kycm-doctype")!, { target: { value: "id_card" } });
    fireEvent.change(container.querySelector("#kycm-doc")!, { target: { files: [new File(["x"], "d.pdf", { type: "application/pdf" })] } });
    fireEvent.change(container.querySelector("#kycm-selfie")!, { target: { files: [new File(["x"], "s.jpg", { type: "image/jpeg" })] } });
    expect(submit.disabled).toBe(false);
    fireEvent.submit(container.querySelector("[data-kycm-form]")!);

    await waitFor(() => expect(container.querySelector('[data-kycm-state="review"]')).not.toBeNull());
    const post = запросы[1];
    expect(post.url).toMatch(new RegExp(`/api/bureau/kyc-manual/${ID}/submit$`));
    expect(post.init?.method).toBe("POST");
    expect(JSON.parse(String(post.init?.body))).toEqual({
      docType: "id_card",
      docMime: "application/pdf",
      docBase64: "UERG",
      selfieMime: "image/jpeg",
      selfieBase64: "SlBH",
    });
    expect(container.querySelector("[data-kycm-delete]")).not.toBeNull();
    expect(prepMock.mock.calls[1][1]).toBe(false); // селфи — только фото, PDF нельзя
  });

  test("файл не влез — отказ словами, запроса /submit нет", async () => {
    ответы.push({ status: 200, body: pending });
    prepMock.mockResolvedValueOnce({ ok: false, error: "tooBig" }).mockResolvedValueOnce({ ok: true, mime: "image/jpeg", base64: "SlBH", bytes: 3 });
    const { container } = render(<KycManualPage />);
    await waitFor(() => expect(container.querySelector("[data-kycm-form]")).not.toBeNull());
    fireEvent.change(container.querySelector("#kycm-doc")!, { target: { files: [new File(["x"], "d.pdf", { type: "application/pdf" })] } });
    fireEvent.change(container.querySelector("#kycm-selfie")!, { target: { files: [new File(["x"], "s.jpg", { type: "image/jpeg" })] } });
    fireEvent.submit(container.querySelector("[data-kycm-form]")!);
    await waitFor(() => expect(container.querySelector("[data-kycm-error]")?.textContent).toBe("bureau.kycm.err.tooBig"));
    expect(запросы).toHaveLength(1);
  });

  test("409 при подаче — перечитываем статус, а не показываем ошибку", async () => {
    ответы.push({ status: 200, body: pending });
    ответы.push({ status: 409, body: { error: "not_pending", status: "review" } });
    ответы.push({ status: 200, body: { ...pending, status: "review", filesDeleteAfter: "2026-11-20T10:00:00.000Z" } });
    prepMock.mockResolvedValue({ ok: true, mime: "image/jpeg", base64: "SlBH", bytes: 3 });
    const { container } = render(<KycManualPage />);
    await waitFor(() => expect(container.querySelector("[data-kycm-form]")).not.toBeNull());
    fireEvent.change(container.querySelector("#kycm-doc")!, { target: { files: [new File(["x"], "d.jpg", { type: "image/jpeg" })] } });
    fireEvent.change(container.querySelector("#kycm-selfie")!, { target: { files: [new File(["x"], "s.jpg", { type: "image/jpeg" })] } });
    fireEvent.submit(container.querySelector("[data-kycm-form]")!);
    await waitFor(() => expect(container.querySelector('[data-kycm-state="review"]')).not.toBeNull());
    expect(container.querySelector("[data-kycm-error]")).toBeNull();
  });

  test("флаг выключен — так и сказано, формы нет", async () => {
    ответы.push({ status: 404, body: { error: "kyc_manual_disabled" } });
    const { container } = render(<KycManualPage />);
    await waitFor(() => expect(container.querySelector('[data-kycm-state="disabled"]')).not.toBeNull());
    expect(container.querySelector("[data-kycm-form]")).toBeNull();
  });

  test("чужой id — «не найдена», не пустая форма", async () => {
    ответы.push({ status: 404, body: { error: "session_not_found" } });
    const { container } = render(<KycManualPage />);
    await waitFor(() => expect(container.querySelector('[data-kycm-state="notFound"]')).not.toBeNull());
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("сжатие фото", () => {
  test("берётся первая ступень, что влезла в 3,5 МБ", async () => {
    const размеры = [KYC_MAX_FILE_BYTES + 1, KYC_MAX_FILE_BYTES - 1, 10];
    const вызовы: number[] = [];
    const b = await сжатьКартинку(async (side) => {
      вызовы.push(side);
      return new Blob([new Uint8Array(размеры.shift() ?? 1)]);
    });
    expect(b?.size).toBe(KYC_MAX_FILE_BYTES - 1);
    expect(вызовы).toEqual([2400, 2000]);
  });

  test("не влезла ни одна ступень — null, а не обрезанный файл", async () => {
    const b = await сжатьКартинку(async () => new Blob([new Uint8Array(KYC_MAX_FILE_BYTES + 1)]));
    expect(b).toBeNull();
  });
});
