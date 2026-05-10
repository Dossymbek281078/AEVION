# @aevion/planet-client

Zero-dependency TypeScript client for AEVION Planet — compliance pipeline (validators → evidenceRoot → certificate), public artifact registry, voting, and Music/Film/Code awards.

## Quick start

```ts
import { PlanetClient } from "@aevion/planet-client";

const planet = new PlanetClient({
  baseUrl: "https://aevion-production-a70c.up.railway.app/api/planet",
  token: process.env.AEVION_TOKEN,
});

// Public stats
const stats = await planet.stats();
console.log(stats.eligibleParticipants, stats.shieldedObjects);

// Recent certified artifacts (e.g. for awards page)
const recent = await planet.recentArtifacts({ artifactType: "music", sort: "votes", limit: 10 });

// Public view of a single artifact + vote stats
const view = await planet.publicArtifact(recent.items[0].artifactVersionId);

// Submit a new artifact through the validator pipeline (auth)
const result = await planet.submit({
  artifactType: "code",
  title: "My AI snippet",
  productKey: "planet_prod_v1_code",
  codeFiles: [{ path: "src/index.ts", content: "export const hello='world'" }],
});
console.log(result.status, result.evidenceRoot);
```

## Surface

| Method | Endpoint | Auth |
|---|---|---|
| `health()` | `GET /health` | — |
| `stats(productKeyPrefix?)` | `GET /stats` | — |
| `recentArtifacts(opts)` | `GET /artifacts/recent` | — |
| `publicArtifact(id)` | `GET /artifacts/:id/public` | — |
| `submit(input)` | `POST /submissions` | bearer |
| `vote(input)` | `POST /vote` | bearer |
| `awards(type, opts)` | `GET /awards/:type` | — |

## License

UNLICENSED — proprietary to AEVION.
