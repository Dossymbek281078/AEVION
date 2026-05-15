import type { FintechClient } from "./client";
import type {
  ZTideEvent,
  ZTideLeaderboardRow,
  ZTideRank,
  ZTideRankId,
} from "./types";

/** Body for {@link ZTideModule.emitEvent} (admin / service-key only). */
export interface EmitZTideEventBody {
  userId: string;
  /** Event kind from the server-side whitelist (e.g. `"helpful-comment"`). */
  kind: string;
  /** Source module emitting the event (e.g. `"qgood"`, `"cyberchess"`). */
  sourceModule: string;
  /** Override the default weight for this kind. Range 1..1000. */
  weightOverride?: number;
  meta?: Record<string, unknown>;
}

/** Response from {@link ZTideModule.me}. */
export interface ZTideMeResponse {
  userId: string;
  score: number;
  eventCount: number;
  lastEventAt: string | null;
  rank: ZTideRank;
  recentEvents: ZTideEvent[];
}

/** Response from {@link ZTideModule.rank}. */
export interface ZTideRankResponse {
  userId: string;
  score: number;
  eventCount: number;
  rank: ZTideRank;
  lastEventAt?: string | null;
}

/** Response from {@link ZTideModule.loginStreak}. */
export interface ZTideLoginStreakResponse {
  ok: true;
  userId: string;
  kind: "login-streak";
  weight: number;
  score: number;
  rank: ZTideRank;
}

/** Response from {@link ZTideModule.stats}. */
export interface ZTideStatsResponse {
  active_users: number;
  total_events: number;
  total_weight: string;
  top_score: number | null;
  service: "ztide";
  ranks: ZTideRank[];
}

/**
 * Z-Tide — reputation / standing scoring across the AEVION ecosystem.
 *
 * Endpoints: `/api/ztide/*`. Read-only endpoints are public; emitting events
 * requires either an admin JWT (email in `ZTIDE_ADMIN_EMAILS`) or the service
 * key header. The `/me` and `/me/login-streak` endpoints take the user JWT.
 *
 * Ranks (low → high): seedling, current, wave, stream, tide, river, ocean.
 */
export class ZTideModule {
  constructor(private readonly client: FintechClient) {}

  /**
   * Emit a Z-Tide event on behalf of a user. Requires admin JWT or service
   * key — partners and untrusted callers cannot self-award.
   */
  emitEvent(body: EmitZTideEventBody): Promise<{
    id: string;
    userId: string;
    kind: string;
    weight: number;
    score: number;
    rank: ZTideRank;
  }> {
    return this.client.request("POST", `/api/ztide/events`, body);
  }

  /** Fetch the authenticated user's current Z-Tide standing. */
  me(): Promise<ZTideMeResponse> {
    return this.client.request("GET", `/api/ztide/me`);
  }

  /**
   * Claim today's login streak bonus. Subject to a 20-hour cooldown — on
   * cooldown the call throws `SDKError` with `status: 429` and
   * `code: "streak_cooldown"`.
   */
  loginStreak(): Promise<ZTideLoginStreakResponse> {
    return this.client.request("POST", `/api/ztide/me/login-streak`);
  }

  /** Get the top-N leaderboard. Default 50, max 200. */
  leaderboard(
    limit = 50,
  ): Promise<{ leaderboard: ZTideLeaderboardRow[]; total: number }> {
    return this.client.request(
      "GET",
      `/api/ztide/leaderboard?limit=${encodeURIComponent(String(limit))}`,
    );
  }

  /** Public rank lookup for any userId. Returns score 0 + seedling if unknown. */
  rank(userId: string): Promise<ZTideRankResponse> {
    return this.client.request(
      "GET",
      `/api/ztide/rank/${encodeURIComponent(userId)}`,
    );
  }

  /** Aggregate stats + the full rank ladder. */
  stats(): Promise<ZTideStatsResponse> {
    return this.client.request("GET", `/api/ztide/stats`);
  }
}

/**
 * Re-exported for convenience — partners typing rank-aware UIs frequently want
 * `ZTideRankId` near the rest of the Z-Tide types.
 */
export type { ZTideRankId };
