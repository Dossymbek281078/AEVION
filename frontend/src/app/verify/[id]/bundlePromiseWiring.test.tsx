// Обещание про офлайн-пакет соответствует тому, что в пакете БУДЕТ.
//
// Логику решает bundleContents.ts (5 тестов). Здесь один вопрос: доехала ли
// оговорка до экрана — и не появилась ли она там, где не нужна.
//
// Замер на проде 28.08.2026: подпись AEVION лежит в пакете у ДВУХ записей из
// семи. У остальных `proofs.aevionEd25519` равен null, а страница обещала
// «every proof» безусловно.

import { describe, test, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "AEV-TEST-0002" }),
}));

import VerifyPage from "./page";

function reply(reason: "OK" | "NO_SIGNED_AT") {
  return {
    valid: true,
    verified: true,
    integrityVerified: true,
    verifiedAt: "2026-08-27T10:00:00.000Z",
    certificate: {
      id: "AEV-TEST-0002",
      objectId: "obj-2",
      title: "Степной рассвет",
      kind: "photo",
      description: "фотография",
      author: "Автор",
      contentHash: "a".repeat(64),
      signatureHmac: "b".repeat(64),
      signatureEd25519: "c".repeat(64) + "...",
      algorithm: "SHA-256",
      protectedAt: "2026-04-01T10:00:00.000Z",
      status: "active",
    },
    integrity: {
      contentHashValid: true,
      signatureHmacValid: reason === "OK" ? true : null,
      signatureHmacReason: reason,
      qsignKeyVersion: 2,
      currentKeyVersion: 2,
      keyRotatedSinceSigning: false,
      quantumShieldStatus: "active",
      shieldLegacy: false,
      shards: 3,
      threshold: 2,
      authorCosign: { present: false },
    },
    legalBasis: { framework: "Berne", type: "copyright", international: [], digitalSignature: [], disclaimer: "—" },
    stats: { verifiedCount: 1, lastVerifiedAt: "2026-08-27T10:00:00.000Z" },
  };
}

function stubFetch(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));
}

afterEach(() => vi.unstubAllGlobals());

const caveat = () => screen.queryByText(/predates AEVION's signing timestamp/i);

describe("обещание про пакет доезжает до экрана в нужном виде", () => {
  test("нет отметки подписи — оговорка ВИДНА рядом со скачиванием", async () => {
    stubFetch(reply("NO_SIGNED_AT"));
    render(<VerifyPage />);
    await waitFor(() => expect(caveat()).not.toBeNull());
    expect(caveat()!.textContent).toMatch(/skipped/i);
  });

  test("контроль: подпись есть — оговорки НЕТ", async () => {
    stubFetch(reply("OK"));
    render(<VerifyPage />);
    // Якорь берём через getAllBy*: фраза встречается на странице дважды,
    // и getByText на ней падает «Found multiple elements» — это про прибор,
    // а не про предмет проверки.
    await waitFor(() => expect(screen.getAllByText("Independent of AEVION").length).toBeGreaterThan(0));
    expect(caveat(), "оговорка показана там, где подпись в пакете будет").toBeNull();
  });

  test("обещание больше не безусловное", async () => {
    stubFetch(reply("NO_SIGNED_AT"));
    render(<VerifyPage />);
    await waitFor(() => expect(caveat()).not.toBeNull());
    // Прежний текст обещал «every proof» независимо от содержимого пакета.
    expect(document.body.textContent).not.toMatch(/\.json.*with every proof/i);
  });
});

describe("подпись под полем Ed25519 доезжает до экрана в нужном виде", () => {
  // InfoTip показывает текст ТОЛЬКО по нажатию (см. src/components/InfoTip.tsx:
  // {text} рисуется под условием open). Первая версия этой проверки читала
  // атрибуты и body — и мутация «отдать старой схеме текст про пакет» её
  // ПЕРЕЖИЛА: проверка была пустой. Поэтому здесь кнопка нажимается.
  async function openTip(): Promise<string> {
    const btn = await screen.findByLabelText("What is Ed25519?");
    fireEvent.click(btn);
    const panel = await screen.findByText(/asymmetric digital signature/i);
    return panel.textContent || "";
  }

  test("старая схема — поле не зовёт в пакет за подписью, которой там нет", async () => {
    stubFetch(reply("NO_SIGNED_AT"));
    render(<VerifyPage />);
    await waitFor(() => expect(caveat()).not.toBeNull());
    const t = await openTip();
    expect(t, "поле зовёт за подписью в пакет, где её нет").not.toMatch(/download the verification bundle/i);
    expect(t).toMatch(/cannot be reconstructed/i);
  });

  test("контроль: нынешняя схема — зовёт в пакет", async () => {
    stubFetch(reply("OK"));
    render(<VerifyPage />);
    await waitFor(() => expect(screen.getAllByText("Independent of AEVION").length).toBeGreaterThan(0));
    const t = await openTip();
    expect(t).toMatch(/download the verification bundle/i);
    expect(t).not.toMatch(/cannot be reconstructed/i);
  });
});
