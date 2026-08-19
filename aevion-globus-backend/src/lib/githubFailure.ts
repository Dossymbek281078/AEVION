// Why this exists: DevHub used to answer `connected: true` for every GitHub
// failure — a revoked token, a deleted repo and a GitHub outage all arrived at
// the screen as "connected, 0 branches". With the org's GitHub account
// suspended since 2026-07-27 every token answers 401, so that screen has been
// claiming a link that does not exist for weeks.
//
// One boolean cannot carry three answers, so we never guess: `connected` is
// true ONLY when GitHub actually answered. Everything else is a failure with a
// `kind` the UI can colour differently — "auth"/"not_found" is the user's to
// fix, "unavailable" is GitHub's and will pass on its own.

export type GithubFailureKind = "auth" | "not_found" | "rate_limit" | "unavailable";

export interface GithubFailure {
  connected: false;
  errorKind: GithubFailureKind;
  error: string;
}

/**
 * Classify a non-ok GitHub API response.
 *
 * `headers` is optional so callers holding a plain object in tests can skip it;
 * it is only read to tell a rate-limited 403 from a genuine loss of access,
 * which GitHub reports with the same status code.
 */
export function classifyGithubResponse(
  status: number,
  headers?: { get(name: string): string | null },
): GithubFailure {
  if (status === 401) {
    return {
      connected: false,
      errorKind: "auth",
      error: "GitHub token is invalid or revoked — reconnect the repository",
    };
  }

  if (status === 429 || (status === 403 && isRateLimited(headers))) {
    return {
      connected: false,
      errorKind: "rate_limit",
      error: "GitHub rate limit reached — the link is fine, try again shortly",
    };
  }

  if (status === 403) {
    return {
      connected: false,
      errorKind: "auth",
      error: "GitHub denied access to this repository — check the token's scopes",
    };
  }

  // GitHub answers 404 for a private repo the token cannot see, so this is
  // deliberately worded to cover both rather than asserting the repo is gone.
  if (status === 404) {
    return {
      connected: false,
      errorKind: "not_found",
      error: "Repository not found, or this token cannot see it",
    };
  }

  return {
    connected: false,
    errorKind: "unavailable",
    error: `GitHub is not responding (HTTP ${status}) — this is on GitHub's side, not the link`,
  };
}

/** A thrown fetch (DNS, TLS, timeout) tells us nothing about the token. */
export function githubUnreachable(message?: string): GithubFailure {
  return {
    connected: false,
    errorKind: "unavailable",
    error: message
      ? `Could not reach GitHub: ${message}`
      : "Could not reach GitHub — the link could not be checked",
  };
}

function isRateLimited(headers?: { get(name: string): string | null }): boolean {
  if (!headers || typeof headers.get !== "function") return false;
  return headers.get("x-ratelimit-remaining") === "0";
}
