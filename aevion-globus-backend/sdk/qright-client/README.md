# @aevion/qright-client

Zero-dependency TypeScript client for AEVION QRight — public author/work registry with embed widgets, transparency feed, and webhooks.

## Quick start

```ts
import { QRightClient } from "@aevion/qright-client";

const qr = new QRightClient({
  baseUrl: "https://aevion-production-a70c.up.railway.app/api/qright",
  token: process.env.AEVION_TOKEN,
});

// Browse public registry
const page = await qr.listObjects({ kind: "music", limit: 20 });
console.log(page.objects);

// Render embed widget on your own site
<iframe src={qr.embedUrl(obj.id, { theme: "dark" })} />

// Render SVG badge
<img src={qr.badgeUrl(obj.id, { style: "shield" })} />
```

## Surface

| Method | Endpoint | Auth |
|---|---|---|
| `listObjects(opts)` | `GET /objects` | — |
| `search(q, limit?)` | `GET /objects/search` | — |
| `getObject(id)` | `GET /objects/:id` | — |
| `objectStats(id)` | `GET /objects/:id/stats` | — |
| `createObject(input)` | `POST /objects` | bearer |
| `embedUrl(id, opts)` | URL helper | — |
| `badgeUrl(id, opts)` | URL helper | — |
| `transparency(limit?)` | `GET /transparency` | — |
| `revoke(id, opts)` | `POST /revoke/:id` | bearer |
| `listWebhooks()` | `GET /webhooks` | bearer |
| `createWebhook(input)` | `POST /webhooks` | bearer |
| `deleteWebhook(id)` | `DELETE /webhooks/:id` | bearer |
| `adminAudit(opts)` | `GET /admin/audit` | admin |
| `adminSources()` | `GET /admin/sources` | admin |

## License

UNLICENSED — proprietary to AEVION.
