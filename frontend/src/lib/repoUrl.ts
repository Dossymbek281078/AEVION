/**
 * Единственное место, где записан адрес публичного репозитория.
 *
 * Зачем отдельный модуль: 27.07.2026 аккаунт GitHub оказался заблокирован, и
 * все ссылки на репозиторий разом стали отдавать 404 — включая те, что стоят на
 * странице для инвестора рядом со словами «verifiable in public GitHub
 * history». Адрес при этом был вписан руками в 21 файл, поэтому переключить его
 * на зеркало одним движением было нельзя.
 *
 * Теперь можно: меняется одна переменная окружения `NEXT_PUBLIC_REPO_URL` —
 * например, на Gitee-зеркало, — и все страницы едут за ней.
 */

const DEFAULT_REPO = "https://github.com/Dossymbek281078/AEVION";

/** Базовый адрес репозитория, без завершающего слэша. */
export function repoUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_REPO_URL?.trim();
  return (fromEnv || DEFAULT_REPO).replace(/\/+$/, "");
}

/** Путь внутри репозитория: `repoPath("issues")`, `repoPath("blob/main/README.md")`. */
export function repoPath(path: string): string {
  const p = path.replace(/^\/+/, "");
  return p ? `${repoUrl()}/${p}` : repoUrl();
}

/** Адрес без схемы — для показа текстом («github.com/…»). */
export function repoLabel(): string {
  return repoUrl().replace(/^https?:\/\//, "");
}
