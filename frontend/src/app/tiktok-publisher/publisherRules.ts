// Pure rules behind the TikTok publisher form.
//
// These live outside the component because they are where the mistakes were:
// two defects in this logic (a privacy list emptied by branded content that
// blamed the wrong cause, and a cover timestamp that survived a change of
// video) were found by re-reading code, not by any test. Now they are pinned.
//
// No "use client" here on purpose — this is plain logic, imported by the
// client page. Keeping it free of component concerns is what makes it
// testable.

export const SELF_ONLY = "SELF_ONLY";

/** Milliseconds into a video as m:ss.d, e.g. 3200 → "0:03.2". */
export function formatTimecode(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSec = safe / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const tenth = Math.floor((safe % 1000) / 100);
  return `${min}:${String(sec).padStart(2, "0")}.${tenth}`;
}

/**
 * Human text for a backend error code. Unknown codes fall back to the code
 * itself rather than to `undefined`, so a code added on the backend without
 * a translation still says something.
 */
export function errorText(
  dictionary: Record<string, string>,
  code: unknown,
  fallback = "неизвестная ошибка",
): string {
  if (typeof code !== "string" || !code) return fallback;
  return dictionary[code] || code;
}

/**
 * Privacy levels the creator may actually pick. Branded content may not be
 * posted privately, so "only me" leaves the list while that box is ticked.
 */
export function visiblePrivacyOptions(accountOptions: string[], brandContent: boolean): string[] {
  return accountOptions.filter((o) => !(brandContent && o === SELF_ONLY));
}

export type PublishGate =
  | { canPublish: true }
  | {
      canPublish: false;
      /** Why the button is out of reach — one reason, the most specific one. */
      reason:
        | "no_account_options"
        | "branded_content_blocked_by_audit"
        | "disclosure_incomplete"
        | "privacy_not_chosen"
        | "already_queued"
        | "video_too_long";
    };

export interface PublishGateInput {
  /** privacy_level_options exactly as creator_info reported them. */
  accountPrivacyOptions: string[];
  /** The level the creator picked, "" when they have not yet. */
  privacy: string;
  discloseCommercial: boolean;
  brandOrganic: boolean;
  brandContent: boolean;
  /** The video URL currently in the form, trimmed. */
  videoUrl: string;
  /** The URL of the post already queued in this session, if any. */
  queuedUrl: string | null;
  /** Length of the loaded video in seconds, once the browser knows it. */
  videoDurationSec?: number | null;
  /** max_video_post_duration_sec as creator_info reported it. */
  maxDurationSec?: number | null;
}

/**
 * Is the clip longer than this account may post? Both numbers have to be
 * known and finite — an unknown duration or an account without a stated
 * limit is not evidence of a problem, so it must not block publishing.
 * A whole second of slack absorbs rounding between the browser's float
 * duration and TikTok's integer limit.
 */
export function exceedsMaxDuration(
  videoDurationSec: number | null | undefined,
  maxDurationSec: number | null | undefined,
): boolean {
  if (typeof videoDurationSec !== "number" || !Number.isFinite(videoDurationSec)) return false;
  if (typeof maxDurationSec !== "number" || !Number.isFinite(maxDurationSec) || maxDurationSec <= 0) {
    return false;
  }
  return videoDurationSec > maxDurationSec + 1;
}

/**
 * The single place that decides whether publishing is allowed, and — when it
 * is not — which of the reasons applies. Order matters: the reasons are
 * checked most-specific first, because saying "settings did not arrive" when
 * the real cause is branded content sends the creator to reconnect for
 * nothing.
 */
export function publishGate(input: PublishGateInput): PublishGate {
  const { accountPrivacyOptions, privacy, discloseCommercial, brandOrganic, brandContent } = input;

  if (input.queuedUrl && input.queuedUrl === input.videoUrl) {
    return { canPublish: false, reason: "already_queued" };
  }
  if (accountPrivacyOptions.length === 0) {
    return { canPublish: false, reason: "no_account_options" };
  }
  if (visiblePrivacyOptions(accountPrivacyOptions, brandContent).length === 0) {
    // The account has levels, branded content just excluded all of them —
    // which is the normal state before TikTok audits the app (SELF_ONLY only).
    return { canPublish: false, reason: "branded_content_blocked_by_audit" };
  }
  if (exceedsMaxDuration(input.videoDurationSec, input.maxDurationSec)) {
    // TikTok would reject this outright; better to say so before the upload
    // than to let the creator wait for a failure.
    return { canPublish: false, reason: "video_too_long" };
  }
  if (discloseCommercial && !brandOrganic && !brandContent) {
    return { canPublish: false, reason: "disclosure_incomplete" };
  }
  if (!privacy) {
    return { canPublish: false, reason: "privacy_not_chosen" };
  }
  return { canPublish: true };
}

/** The label TikTok will stamp on the post, given what was disclosed. */
export function commercialLabel(brandOrganic: boolean, brandContent: boolean): string | null {
  if (brandContent) return "Paid partnership";
  if (brandOrganic) return "Promotional content";
  return null;
}
