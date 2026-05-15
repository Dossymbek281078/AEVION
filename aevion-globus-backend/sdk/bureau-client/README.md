# @aevion/bureau-client

Zero-dependency TypeScript client for AEVION Bureau — verified-author KYC tier upgrade, organizations, embed/badge widgets for certificates.

## Quick start

```ts
import { BureauClient } from "@aevion/bureau-client";

const bureau = new BureauClient({
  baseUrl: "https://aevion-production-a70c.up.railway.app/api/bureau",
  token: process.env.AEVION_TOKEN,
});

// Caller's certificates + KYC verifications + tier pricing
const dash = await bureau.dashboard();

// Embed widget on partner site
<iframe src={bureau.embedUrl(certId, { theme: "dark" })} />
<img src={bureau.badgeUrl(certId, { style: "shield" })} />
```

## Surface

| Method | Endpoint | Auth |
|---|---|---|
| `health()` | `GET /health` | — |
| `dashboard()` | `GET /dashboard` | bearer |
| `startVerification(opts)` | `POST /verify/start` | bearer |
| `verificationStatus(id)` | `GET /verify/status/:id` | bearer |
| `paymentIntent(opts)` | `POST /payment/intent` | bearer |
| `upgrade(certId)` | `POST /upgrade/:certId` | bearer |
| `notaries(opts)` / `notary(id)` | `GET /notaries(/...)` | — |
| `createOrg`/`myOrgs`/`getOrg`/`inviteToOrg`/`acceptInvite` | `/org/*` | bearer |
| `transparency()` | `GET /transparency` | — |
| `embedUrl(certId, opts)` | URL helper | — |
| `badgeUrl(certId, opts)` | URL helper | — |

## License

UNLICENSED — proprietary to AEVION.
