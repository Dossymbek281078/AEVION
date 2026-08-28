/**
 * Карточка пересланной ссылки на публичную страницу автора.
 *
 * Замер 29.08.2026: `/bureau/author/<любой>` отдаёт один и тот же заголовок —
 * «AEVION Bureau — public verified registry for creators and orgs». То есть
 * автор пересылает ссылку на СВОЙ реестр, а получатель видит карточку про
 * платформу вообще.
 *
 * Проверено настоящим адресом, а не выдуманным: ручка `/api/pipeline/authors/
 * dosymbek` отвечает 200 и отдаёт автора с одной работой. (Днём я на этом уже
 * ошибся — подставил идентификатор сертификата в маршрут, ждущий идентификатор
 * работы, и получил законный запасной заголовок, который чуть не записал в
 * находки.)
 */

export type AuthorForPreview = {
  name?: string | null;
  stats?: { certificates?: number | null; verifications?: number | null; countries?: string[] | null } | null;
} | null;

export type AuthorPreview = { title: string; description: string };

const FALLBACK: AuthorPreview = {
  title: "AEVION Bureau — creator registry",
  description:
    "Public AEVION Bureau registry: registered works with content hashes, signatures and Bitcoin anchors — verifiable without an account.",
};

/** Русское/английское слово во множественном числе без выдумок про склонение. */
function works(n: number): string {
  return n === 1 ? "1 registered work" : `${n} registered works`;
}

export function buildAuthorPreview(a: AuthorForPreview): AuthorPreview {
  if (!a) return FALLBACK;
  const name = String(a.name || "").trim();
  if (!name) return FALLBACK;

  const certs = Number(a.stats?.certificates);
  const n = Number.isFinite(certs) && certs > 0 ? certs : 0;
  // Ноль работ — карточка всё равно именная, но числа не выдумываем.
  const countLine = n > 0 ? `${works(n)} on the AEVION Bureau registry. ` : "";

  return {
    title: `${name} — AEVION Bureau registry`,
    description:
      `${countLine}Each entry carries a SHA-256 content hash and AEVION's Ed25519 signature; ` +
      `anyone can verify them without an AEVION account.`,
  };
}

export const AUTHOR_PREVIEW_FALLBACK = FALLBACK;
