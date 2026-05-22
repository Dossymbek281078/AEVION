# Constitution — Public Read-Only API

Stable read endpoints for third-party integrations (bots, research tools, AI agents). No authentication required. All responses cacheable for 1 hour.

**Base URL:** `https://aevion-api.up.railway.app/api/constitution/public`
(local dev: `http://localhost:4001/api/constitution/public`)

**Versioning:** v1. Keys may be ADDED but never REMOVED within v1. Breaking changes go to a future `/v2/*` namespace.

**Cache:** `Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=21600`. Safe to hit on every request — CDN handles the load.

---

## `GET /`

Root index — lists available endpoints. 10-minute cache.

```json
{
  "version": 1,
  "endpoints": {
    "regimes": "/api/constitution/public/regimes",
    "presets": "/api/constitution/public/presets",
    "countries": "/api/constitution/public/countries",
    "slidersSpec": "/api/constitution/public/sliders-spec"
  },
  "docs": "https://github.com/Dossymbek281078/AEVION/blob/main/docs/constitution-public-api.md"
}
```

---

## `GET /regimes`

The 10 classifiable regimes. Returned by `classify(sliders)` on the simulator.

```json
{
  "version": 1,
  "count": 10,
  "items": [
    {
      "id": "open-access",
      "name": "Open Access Order",
      "name_ru": "Открытый порядок (Open Access)",
      "era": "Ideal — North / Wallis / Weingast",
      "summary": "...",
      "pros": "...",
      "cons": "..."
    }
    /* ... */
  ]
}
```

**Stable regime IDs:** `open-access`, `nordic`, `totalitarian`, `authoritarian`, `extractive-boom`, `network-post-nation`, `feudalism`, `ancient-polis`, `modern-liberal`, `mixed`.

---

## `GET /presets`

10 historical/aspirational presets used in the UI. Each is a complete slider snapshot you can feed back into the classifier.

```json
{
  "version": 1,
  "count": 10,
  "items": [
    {
      "name": "Open Access (ideal)",
      "sliders": {
        "floor": 75, "ruleOfLaw": 85, "rotation": 70, "transparency": 80,
        "multiStatus": 75, "skinInGame": 70, "polycentricity": 65, "positiveSum": 80
      }
    }
    /* ... */
  ]
}
```

---

## `GET /countries`

15 real-world countries with approximate slider calibrations (0–100). **Not a scientific ranking** — a heuristic for intuition. Used by the simulator's world-map scatter.

```json
{
  "version": 1,
  "count": 15,
  "items": [
    {
      "code": "no",
      "flag": "🇳🇴",
      "en": "Norway",
      "name_ru": "Норвегия",
      "sliders": {
        "floor": 90, "ruleOfLaw": 90, "rotation": 50, "transparency": 90,
        "multiStatus": 60, "skinInGame": 55, "polycentricity": 30, "positiveSum": 70
      }
    }
    /* ... */
  ]
}
```

**Available codes:** `us, de, no, jp, sg, ae, sa, ru, cn, ir, kp, ve, in, br, kz`.

---

## `GET /sliders-spec`

The 8 governance dimensions with low/high anchors and weights used in the metrics formulas.

```json
{
  "version": 1,
  "count": 8,
  "items": [
    {
      "key": "floor",
      "label": "Floor below",
      "low": "Everyone for themselves",
      "high": "Nobody falls below",
      "weight": { "stability": 0.3, "legitimacy": 0.2 }
    }
    /* ... */
  ]
}
```

**Slider keys** (stable, never renamed within v1):
`floor, ruleOfLaw, rotation, transparency, multiStatus, skinInGame, polycentricity, positiveSum`.

---

## Metrics formulas

Computed client-side from sliders. Provided here for ports/integrations.

```ts
function computeMetrics(s) {
  const inv = (x) => 100 - x;
  return {
    eliteFear:     Math.round(inv(s.floor)*0.3 + inv(s.ruleOfLaw)*0.3 + inv(s.transparency)*0.2 + inv(s.positiveSum)*0.2),
    intraConflict: Math.round(inv(s.rotation)*0.4 + inv(s.multiStatus)*0.4 + inv(s.ruleOfLaw)*0.2),
    resentment:    Math.round(inv(s.floor)*0.4 + inv(s.transparency)*0.3 + inv(s.skinInGame)*0.3),
    innovation:    Math.round(s.positiveSum*0.5 + s.polycentricity*0.25 + s.multiStatus*0.25),
    stability:     Math.round(s.ruleOfLaw*0.4 + s.floor*0.3 + s.transparency*0.2 + s.rotation*0.1),
    legitimacy:    Math.round(s.transparency*0.3 + s.ruleOfLaw*0.3 + s.floor*0.2 + s.rotation*0.2),
  };
}
```

---

## Example: classify a country in 3 lines

```bash
curl -s https://aevion-api.up.railway.app/api/constitution/public/countries \
  | jq '.items[] | select(.code == "kz") | .sliders'
```

Then POST those sliders to your own classifier, or use the `name_ru` / `regime` flow:

```bash
curl -X POST https://aevion-api.up.railway.app/api/constitution/scenarios \
  -H 'Content-Type: application/json' \
  -d '{"title":"Kazakhstan-2026","sliders":{"floor":50,...}}'
```

---

## Rate limits

- Read endpoints: **240 req/min per IP** (well above what cache layer should permit).
- Cache will absorb the vast majority. If you hit the limit, you're not caching at all — fix that first.

## Stability promise

Within v1:
- Existing keys keep their semantics.
- Numeric ranges stay 0–100.
- Regime IDs stay constant.
- New optional keys may be added.

Breaking changes (slider renamed, regime removed) require `/v2/*` and a 6-month deprecation window for v1.
