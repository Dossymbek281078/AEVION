import type { Request } from "express";

// Shared cursor-based pagination — same shape as qtrade's helpers, lifted
// into a lib so ecosystem routes can stay consistent (?limit=&cursor=) and
// future routes don't reinvent the contract.

export type PageOpts = { limit: number; cursor: string | null };

export function parsePageOpts(req: Request): PageOpts {
  const rawLimit = Number(req.query.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 200)
      : 50;
  const c = req.query.cursor;
  const cursor = typeof c === "string" && c.length > 0 ? c : null;
  return { limit, cursor };
}

export function paginate<T extends { id: string }>(
  items: T[],
  { limit, cursor }: PageOpts,
): { page: T[]; nextCursor: string | null } {
  let start = 0;
  if (cursor) {
    const idx = items.findIndex((x) => x.id === cursor);
    if (idx >= 0) start = idx + 1;
  }
  const page = items.slice(start, start + limit);
  const nextCursor =
    page.length === limit && start + limit < items.length
      ? page[page.length - 1].id
      : null;
  return { page, nextCursor };
}
