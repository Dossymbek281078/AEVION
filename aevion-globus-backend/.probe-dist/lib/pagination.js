"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePageOpts = parsePageOpts;
exports.paginate = paginate;
function parsePageOpts(req) {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), 200)
        : 50;
    const c = req.query.cursor;
    const cursor = typeof c === "string" && c.length > 0 ? c : null;
    return { limit, cursor };
}
function paginate(items, { limit, cursor }) {
    let start = 0;
    if (cursor) {
        const idx = items.findIndex((x) => x.id === cursor);
        if (idx >= 0)
            start = idx + 1;
    }
    const page = items.slice(start, start + limit);
    const nextCursor = page.length === limit && start + limit < items.length
        ? page[page.length - 1].id
        : null;
    return { page, nextCursor };
}
