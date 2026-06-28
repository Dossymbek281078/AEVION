# QBuild — Google Search Console submission

> Closes the loop on PR #433 (`feat(qbuild): per-page SEO metadata + JSON-LD for 5 public /build pages`). Code is shipped; this is the one-time GSC submission that turns it into actual organic traffic.

## TL;DR action plan

A single sitting (≈20 min). Each step has a verification command — run it first, then click the corresponding GSC button.

| Step | What you do (in browser) | Verify locally first (terminal) |
|---|---|---|
| **1** | Add property `aevion.app` in GSC → copy verification TXT token | `dig +short TXT aevion.app \| grep google-site-verification` |
| **2** | Add the TXT record to aevion.app DNS, wait for propagation | repeat the `dig` until it returns the token |
| **3** | Click **Verify** in GSC | (GSC shows ✓) |
| **4** | GSC → Sitemaps → submit `sitemap.xml` and `api-backend/api/aevion/sitemap.xml` | `node aevion-globus-backend/scripts/qbuild-seo-smoke.js` → expect "7 passed, 0 failed" |
| **5** | GSC → URL Inspection → paste each of the 5 /build URLs → **Request Indexing** | `for p in pricing vacancies salary ai-match interviews; do curl -s "https://aevion.app/build/$p" \| grep -oE '<title>[^<]+' \| head -1; done` |
| **6** | https://search.google.com/test/rich-results → paste each URL → expect 0 errors | (Step 4 smoke already verified ≥1 JSON-LD per page) |

If any verification command fails, **don't click the corresponding button** — the metadata is regressed and the submission will produce a bad index entry that needs a re-crawl later.

The detailed walkthrough follows.

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

**Verify locally before clicking Verify in GSC:**

```bash
# DNS TXT must resolve and contain the GSC token
dig +short TXT aevion.app | grep google-site-verification
# expected: "google-site-verification=AbCd..."  (matches the token GSC showed)

# Optional belt-and-braces — the same token can also be installed via meta tag
curl -s https://aevion.app/ | grep -o '<meta name="google-site-verification"[^>]*>'
```

If `dig` returns nothing, the DNS hasn't propagated — wait 5–10 min and retry.

### 2. Submit sitemap

After verification:

1. **Sitemaps** → enter `sitemap.xml` → **Submit**.
2. Also submit the backend-mirrored sitemap: `api-backend/api/aevion/sitemap.xml` (declared in `frontend/src/app/robots.ts:28`).
3. Status should flip to **Success** within ~1 hour. URL count will grow as Google fetches it.

**Pre-submission self-check (must pass before clicking Submit):**

```bash
# 1. sitemap must serve as XML and list every page you expect indexed
curl -sI https://aevion.app/sitemap.xml | head -1
# expected: HTTP/2 200

curl -s https://aevion.app/sitemap.xml | grep -c '<loc>'
# expected: ≥ 70 URLs (full TOP_LEVEL_ROUTES + dynamic /build/*)

# 2. robots.txt must reference both sitemaps
curl -s https://aevion.app/robots.txt | grep -i sitemap
# expected:
#   Sitemap: https://aevion.app/sitemap.xml
#   Sitemap: https://aevion.app/api-backend/api/aevion/sitemap.xml

# 3. our smoke ties it all together (sitemap + robots + 5 build pages with JSON-LD)
node aevion-globus-backend/scripts/qbuild-seo-smoke.js
# expected: "Result: 7 passed, 0 failed"
```

If any of these fail, **do not submit** — the sitemap or metadata is regressed. Re-check the most recent merges to `frontend/src/app/sitemap.ts` / `robots.ts`.

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

**Pre-Rich-Results-Test self-check:** Each page must have ≥1 parseable `<script type="application/ld+json">` block. The smoke verifies this:

```bash
# already covered by the local smoke (step 2 above), but if you want
# per-page detail without leaving the terminal:
for p in pricing vacancies salary ai-match interviews; do
  echo "--- /build/$p ---"
  curl -s "https://aevion.app/build/$p" \
    | grep -oE '<script[^>]*application/ld\+json[^>]*>' \
    | wc -l
done
# expected: each line shows ≥1
```

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
