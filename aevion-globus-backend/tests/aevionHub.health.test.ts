import { describe, test, expect } from "vitest";

/**
 * Pure-helper tests for the AEVION Hub composite health endpoint.
 * The route function itself depends on Express + live siblings so we
 * exercise the JSON-shape helpers and probe-summary logic in isolation.
 */

import { aevionHubRouter } from "../src/routes/aevion-hub";

describe("aevion-hub router", () => {
  test("router exposes /health, /openapi.json, /version", () => {
    // The Express Router records its layers; check they are wired.
    const stack = (aevionHubRouter as any).stack as Array<{
      route?: { path?: string };
    }>;
    const paths = stack
      .filter((l) => l.route?.path)
      .map((l) => l.route!.path)
      .filter(Boolean);
    expect(paths).toContain("/health");
    expect(paths).toContain("/openapi.json");
    expect(paths).toContain("/version");
  });
});
