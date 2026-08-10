import { describe, test, expect } from "vitest";
import {
  formatTimecode,
  errorText,
  visiblePrivacyOptions,
  publishGate,
  commercialLabel,
  type PublishGateInput,
} from "./publisherRules";

// These pin the two defects that re-reading found in this logic, plus the
// rules TikTok's audit checks for.

const base: PublishGateInput = {
  accountPrivacyOptions: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"],
  privacy: "PUBLIC_TO_EVERYONE",
  discloseCommercial: false,
  brandOrganic: false,
  brandContent: false,
  videoUrl: "https://cdn.example/v.mp4",
  queuedUrl: null,
};

const gate = (over: Partial<PublishGateInput> = {}) => publishGate({ ...base, ...over });

describe("publishGate — when publishing is allowed", () => {
  test("a complete, undisclosed post passes", () => {
    expect(gate()).toEqual({ canPublish: true });
  });

  test("a disclosed post with one kind chosen passes", () => {
    expect(gate({ discloseCommercial: true, brandOrganic: true })).toEqual({ canPublish: true });
  });
});

describe("publishGate — reasons are specific, not the nearest one", () => {
  test("no privacy chosen blocks", () => {
    expect(gate({ privacy: "" })).toEqual({ canPublish: false, reason: "privacy_not_chosen" });
  });

  test("disclosure switched on with neither kind chosen blocks", () => {
    expect(gate({ discloseCommercial: true })).toEqual({
      canPublish: false,
      reason: "disclosure_incomplete",
    });
  });

  test("TikTok returning no levels at all is its own reason", () => {
    expect(gate({ accountPrivacyOptions: [], privacy: "" })).toEqual({
      canPublish: false,
      reason: "no_account_options",
    });
  });

  test("branded content on a pre-audit account (SELF_ONLY only) is NOT reported as missing settings", () => {
    // The defect this pins: the page used to say "TikTok did not return the
    // account settings, reconnect" — settings had arrived, the combination is
    // simply impossible before the audit, and reconnecting changes nothing.
    const g = gate({
      accountPrivacyOptions: ["SELF_ONLY"],
      privacy: "",
      discloseCommercial: true,
      brandContent: true,
    });
    expect(g).toEqual({ canPublish: false, reason: "branded_content_blocked_by_audit" });
  });

  test("the same video cannot be queued twice", () => {
    expect(gate({ queuedUrl: "https://cdn.example/v.mp4" })).toEqual({
      canPublish: false,
      reason: "already_queued",
    });
  });

  test("changing the link after a post re-enables publishing", () => {
    expect(gate({ queuedUrl: "https://cdn.example/old.mp4" })).toEqual({ canPublish: true });
  });
});

describe("visiblePrivacyOptions", () => {
  test("branded content removes SELF_ONLY", () => {
    expect(visiblePrivacyOptions(["SELF_ONLY", "PUBLIC_TO_EVERYONE"], true)).toEqual([
      "PUBLIC_TO_EVERYONE",
    ]);
  });

  test("without branded content every level stays", () => {
    expect(visiblePrivacyOptions(["SELF_ONLY", "PUBLIC_TO_EVERYONE"], false)).toEqual([
      "SELF_ONLY",
      "PUBLIC_TO_EVERYONE",
    ]);
  });

  test("a level TikTok adds in future passes through untouched", () => {
    expect(visiblePrivacyOptions(["FOLLOWER_OF_CREATOR", "SOMETHING_NEW"], true)).toEqual([
      "FOLLOWER_OF_CREATOR",
      "SOMETHING_NEW",
    ]);
  });
});

describe("commercialLabel — what TikTok stamps on the post", () => {
  test("paid partnership wins when both are ticked", () => {
    expect(commercialLabel(true, true)).toBe("Paid partnership");
  });

  test("own business alone is promotional content", () => {
    expect(commercialLabel(true, false)).toBe("Promotional content");
  });

  test("nothing disclosed means no label", () => {
    expect(commercialLabel(false, false)).toBeNull();
  });
});

describe("formatTimecode", () => {
  test("formats seconds and tenths", () => {
    expect(formatTimecode(3200)).toBe("0:03.2");
  });

  test("crosses the minute", () => {
    expect(formatTimecode(65_400)).toBe("1:05.4");
  });

  test("the first frame reads as zero, not as a blank", () => {
    expect(formatTimecode(0)).toBe("0:00.0");
  });

  test("nonsense degrades to zero rather than NaN", () => {
    expect(formatTimecode(Number.NaN)).toBe("0:00.0");
    expect(formatTimecode(-500)).toBe("0:00.0");
  });
});

describe("errorText", () => {
  const dict = { video_url_must_be_https: "Только https-ссылки." };

  test("known code is translated", () => {
    expect(errorText(dict, "video_url_must_be_https")).toBe("Только https-ссылки.");
  });

  test("unknown code shows the code, not undefined", () => {
    expect(errorText(dict, "brand_new_backend_code")).toBe("brand_new_backend_code");
  });

  test("missing code falls back to the given text", () => {
    expect(errorText(dict, undefined, "ошибка 502")).toBe("ошибка 502");
    expect(errorText(dict, "")).toBe("неизвестная ошибка");
  });
});
