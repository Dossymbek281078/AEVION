# QBuild — Google Search Console submission

> Closes the loop on PR #433 (`feat(qbuild): per-page SEO metadata + JSON-LD for 5 public /build pages`). Code is shipped; this is the one-time GSC submission that turns it into actual organic traffic.

## What was shipped (recap)

PR #433 added `export const metadata` + JSON-LD schema.org markup to the five public, high-intent QBuild landings:

| Page | Schema type | Why indexed |
|---|---|---|
| `/build/pricing` | `Product` / `Offer` | commercial intent — paid recruiter plans |
| `/build/vacancies` | `JobPosting` collection | the public jobs feed |
| `/build/salary` | `FAQPage` / `Dataset` | salary benchmarks — high informational intent |
| `/build/ai-match` | `WebPage` / `Service` | AI matching pitch — top-of-funnel |
| `/build/interviews` | `HowTo` | interview prep content — long-tail SEO |

Sitemap + robots already enumerate all of `/build/*` (see `frontend/src/app/sitemap.ts:37-47`).

## Submission checklist (do once per environment)

### 1. Verify domain ownership

1. Open https://search.google.com/search-console
2. Add property → **Domain** (not URL prefix). Enter `aevion.app`.
3. GSC will show a TXT record like `google-site-verification=AbCd…`. Add it to the DNS provider managing `aevion.app`.
4. Wait 5–60 min, click **Verify**. Repeat for `*.aevion.app` if subdomains matter.

### 2. Submit sitemap

After verification:

1. **Sitemaps** → enter `sitemap.xml` → **Submit**.
2. Also submit the backend-mirrored sitemap: `api-backend/api/aevion/sitemap.xml` (declared in `frontend/src/app/robots.ts:28`).
3. Status should flip to **Success** within ~1 hour. URL count will grow as Google fetches it.

### 3. Request indexing for the 5 QBuild landings

Even with a fresh sitemap, Google can take 1–4 weeks to discover. For high-priority pages, force it:

1. **URL Inspection** → paste each URL one at a time:
   - `https://aevion.app/build/pricing`
   - `https://aevion.app/build/vacancies`
   - `https://aevion.app/build/salary`
   - `https://aevion.app/build/ai-match`
   - `https://aevion.app/build/interviews`
2. Click **Request Indexing** after each.
3. Watch the daily quota — GSC limits to ~10 URLs/day per property.

### 4. Validate structured data

For each page, run https://search.google.com/test/rich-results — paste the live URL. Expected outcomes:

- `/build/pricing` → "Product" detected, **0 errors / 0 warnings**
- `/build/vacancies` → "JobPosting" detected
- `/build/salary` → "FAQPage" + dataset detected
- `/build/ai-match` → "WebPage" detected
- `/build/interviews` → "HowTo" detected

If any page shows errors, run the local smoke (see below) — JSON-LD changes since #433 may have regressed.

## Local smoke (CI + manual)

Run the QBuild SEO smoke to verify the deployed metadata still looks correct:

```bash
# default: live prod (aevion.app)
node aevion-globus-backend/scripts/qbuild-seo-smoke.js

# against a preview deploy
BASE=https://<preview>.vercel.app node aevion-globus-backend/scripts/qbuild-seo-smoke.js
```

Exit codes: `0` = all five pages have title + description + JSON-LD; `1` = at least one regression; `2` = crash.

It's wired into `npm run smoke:all` as the `qbuild-seo` step (read-only — safe to run against prod).

## Ongoing monitoring

- **Coverage report** (GSC → Pages): watch for "Discovered – currently not indexed". A spike means the sitemap stopped reaching Google.
- **Performance report** (GSC → Performance): once the five landings rank, this surfaces the actual query distribution — the keyword list to keep optimizing for.
- **Rich Results report**: if Google drops a structured-data type (e.g., JobPosting → no enhancement), the smoke will catch it before GSC does.

## Followups (not blocking submission)

- Add `BreadcrumbList` JSON-LD to `/build/*` for sitelinks
- Add `Organization` JSON-LD to root `/` so brand searches surface a knowledge panel
- Submit a separate `news-sitemap.xml` once the QBuild blog launches
