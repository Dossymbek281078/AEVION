/**
 * Что видит человек, которому ПЕРЕСЛАЛИ ссылку на сертификат.
 *
 * Замер 29.08.2026: у всех сертификатов предпросмотр одинаков —
 * «AEVION · Verify certificate» без названия работы, автора и намёка на то,
 * чем она подтверждена. А `/verify/<id>` — это адрес из QR-кода каждого
 * сертификата и то, что автор пересылает, когда доказывает авторство. Смысл
 * продукта в пересылке, и ровно в этот момент карточка ссылки пуста.
 *
 * Что здесь НЕ делается:
 *
 *   • не трогается запрет индексации. У родительского макета стоит
 *     `robots: index: false`, и это осознанное решение — страница сертификата
 *     содержит имя автора. Предпросмотр ссылки работает независимо от
 *     индексации, поэтому одно чинится без другого.
 *   • не берётся ручка проверки. Она НАРАЩИВАЕТ публичный счётчик
 *     «verified N×», и тогда каждый показ карточки в мессенджере накручивал бы
 *     число. Данные берутся из офлайн-пакета — он только читает
 *     (проверено по коду: 0 записей на 195 строках обработчика).
 */

export type CertForPreview = {
  title?: string | null;
  kind?: string | null;
  author?: string | null;
  protectedAt?: string | null;
  bitcoinAnchor?: { status?: string | null; bitcoinBlockHeight?: number | null } | null;
} | null;

export type VerifyPreview = { title: string; description: string };

const FALLBACK: VerifyPreview = {
  title: "AEVION · Verify certificate",
  description:
    "Public verification of an AEVION certificate: content hash, signature and Bitcoin anchor — checkable without an account.",
};

/** Дата в виде, понятном человеку; при мусоре — молча ничего. */
function humanDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Фраза про якорь. Обещать «закреплено в биткойне» можно ТОЛЬКО при
 * подтверждении: у пяти записей из семи якоря нет и не будет, и предпросмотр
 * не должен утверждать обратное.
 */
function anchorPhrase(a: CertForPreview extends null ? never : NonNullable<CertForPreview>["bitcoinAnchor"]): string {
  const st = a?.status;
  if (st === "bitcoin-confirmed") {
    const h = a?.bitcoinBlockHeight;
    return typeof h === "number" && Number.isFinite(h)
      ? ` Anchored in Bitcoin block ${h}.`
      : " Anchored in Bitcoin.";
  }
  if (st === "pending") return " Bitcoin anchoring in progress.";
  return "";
}

export function buildVerifyPreview(cert: CertForPreview): VerifyPreview {
  // «Спросить не удалось» — это не повод выдумывать: остаётся общая карточка.
  if (!cert) return FALLBACK;
  const title = String(cert.title || "").trim();
  if (!title) return FALLBACK;

  const author = String(cert.author || "").trim();
  const kind = String(cert.kind || "").trim();
  const date = humanDate(cert.protectedAt);

  const who = author && author.toLowerCase() !== "anonymous" ? ` by ${author}` : "";
  const what = kind ? `${kind.charAt(0).toUpperCase()}${kind.slice(1)}` : "Work";
  const when = date ? `, registered ${date}` : "";

  return {
    title: `${title} — AEVION certificate`,
    description:
      `${what}${who}${when}. Content hash and AEVION's Ed25519 signature are published;` +
      `${anchorPhrase(cert.bitcoinAnchor)} Anyone can verify this certificate without an AEVION account.`,
  };
}

export const VERIFY_PREVIEW_FALLBACK = FALLBACK;
