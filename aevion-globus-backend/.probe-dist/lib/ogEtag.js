"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyEtag = applyEtag;
exports.applyOgEtag = applyOgEtag;
/**
 * ETag + 304 handling for crawler-facing public endpoints.
 *
 * Crawlers (Discord, Slack, Facebook, Twitter, LinkedIn, Telegram, Google,
 * RSS readers) re-fetch the same OG card / sitemap / RSS feed every time
 * their cache expires. Without ETag they download the whole body — typically
 * 2-30 KB — and across millions of repeat scrapes that adds up. With a weak
 * ETag derived from the underlying data fingerprint, repeat fetches return
 * 304 Not Modified with no body.
 *
 * Returns true if the response was sent as 304 (caller should `return`).
 * Returns false if the caller should proceed; ETag and Cache-Control headers
 * have already been set.
 */
function applyEtag(req, res, fingerprint, opts = {}) {
    const prefix = opts.prefix ?? "og";
    const maxAgeSec = opts.maxAgeSec ?? 300;
    const etag = `W/"${prefix}-${fingerprint}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", `public, max-age=${maxAgeSec}`);
    if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return true;
    }
    return false;
}
/** OG-card-specific alias — kept so existing 13 callsites don't churn. */
function applyOgEtag(req, res, fingerprint, maxAgeSec = 300) {
    return applyEtag(req, res, fingerprint, { maxAgeSec });
}
