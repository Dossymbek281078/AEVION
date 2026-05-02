import type { Request, Response } from "express";

/**
 * ETag + 304 handling for OG SVG endpoints.
 *
 * Crawlers (Discord, Slack, Facebook, Twitter, LinkedIn, Telegram) re-fetch
 * the og:image when caches expire. Without ETag they have to download the
 * full SVG every time — typically 2-3 KB but multiplied across millions of
 * scrapes this adds up. With a weak ETag derived from the underlying data
 * fingerprint, repeat fetches return 304 Not Modified with no body.
 *
 * Returns true if the response was sent as 304 (caller should `return`).
 * Returns false if the caller should proceed with rendering the SVG; the
 * ETag and Cache-Control headers have already been set on the response.
 */
export function applyOgEtag(
  req: Request,
  res: Response,
  fingerprint: string,
  maxAgeSec = 300,
): boolean {
  const etag = `W/"og-${fingerprint}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", `public, max-age=${maxAgeSec}`);
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return true;
  }
  return false;
}
