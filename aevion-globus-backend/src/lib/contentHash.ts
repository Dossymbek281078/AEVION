import crypto from "crypto";
import { stableStringify } from "./stableStringify";

export interface ContentHashInput {
  title: string;
  description: string;
  kind: string;
  country?: string | null;
  city?: string | null;
}

function nfc(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return String(v).normalize("NFC");
}

export function canonicalizeContentInput(
  input: ContentHashInput,
): Record<string, string | null> {
  return {
    title: nfc(input.title) ?? "",
    description: nfc(input.description) ?? "",
    kind: nfc(input.kind) ?? "other",
    country: nfc(input.country ?? null),
    city: nfc(input.city ?? null),
  };
}

export function canonicalContentHash(input: ContentHashInput): string {
  const canonical = canonicalizeContentInput(input);
  return crypto
    .createHash("sha256")
    .update(stableStringify(canonical))
    .digest("hex");
}

/**
 * ПРАВИЛО v1 — то, которым считались хеши до перехода на канонический вид.
 *
 * Отличий от нынешнего два, и оба важны при проверке:
 *   1) обычный JSON.stringify, порядок ключей — как в литерале, без сортировки;
 *   2) в хеш входят ТОЛЬКО три поля: страна и город не покрыты.
 *
 * Здесь оно воспроизведено НЕ для выдачи, а только для проверки: сертификат,
 * выданный по этому правилу, обязан проверяться по нему же. Новые сертификаты
 * считаются исключительно `canonicalContentHash`.
 *
 * Замер 27.08.2026 по публичному реестру: 4 сертификата из 5 совпали именно
 * с этим правилом, пятый («Test Patent») не совпал ни с одним из десяти
 * перебранных — его хеш остаётся невоспроизводимым, и это честный «не сошлось».
 */
export function legacyContentHashV1(input: ContentHashInput): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        title: input.title,
        description: input.description,
        kind: input.kind,
      }),
    )
    .digest("hex");
}

export type ContentHashRule =
  /** Нынешнее каноническое правило: NFC, сортировка ключей, страна и город. */
  | "v2"
  /** Правило выдачи до канонизации. Страна и город хешем НЕ покрыты. */
  | "v1";

/**
 * Подпись под хешем в PDF-сертификате.
 *
 * Вынесено сюда, потому что проверить это в самом PDF нельзя: PDFKit кодирует
 * текст подмножеством шрифта, и в потоке документа нет ASCII — извлекатель,
 * который «ищет надпись в байтах», молча сравнивал бы пустоту. Решение
 * отделено от рисования и проверяется напрямую.
 */
export function pdfContentHashLabel(
  verdict: ContentHashVerdict,
  todayIso: string,
): string {
  if (!verdict.valid)
    return "CONTENT HASH (SHA-256) — DOES NOT MATCH THE FIELDS ABOVE";
  const day = todayIso.slice(0, 10);
  return (
    `CONTENT HASH (SHA-256) — re-verified ${day}` +
    (verdict.rule === "v1" ? " under the v1 rule (location not covered)" : "")
  );
}

export type ContentHashVerdict =
  | { valid: true; rule: ContentHashRule }
  | { valid: false; rule: null };

/**
 * Проверка хеша под тем правилом, которое действовало при выдаче.
 *
 * Порядок проб намеренный: сперва нынешнее правило, и только если оно не
 * сошлось — прежнее. Иначе новый сертификат, у которого сошлись оба (такое
 * возможно при пустых стране и городе), отчитался бы как «выдан по v1».
 *
 * ⚠️ Совпадение по v1 — это НЕ то же самое, что совпадение по v2, и вызывающий
 * обязан показать разницу человеку: под v1 страна и город в хеш не входили,
 * значит их правка таким сертификатом не обнаруживается.
 */
export function verifyContentHash(
  input: ContentHashInput,
  storedHash: string,
): ContentHashVerdict {
  if (canonicalContentHash(input) === storedHash)
    return { valid: true, rule: "v2" };
  if (legacyContentHashV1(input) === storedHash)
    return { valid: true, rule: "v1" };
  return { valid: false, rule: null };
}
