import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { ensureQStoreTables, isQStoreDbReady } from "../lib/ensureQStoreTables";
import { applyOgEtag } from "../lib/ogEtag";
import { PADDLE_KEY, paddlePost, paddleGet, IS_PADDLE_SANDBOX } from "../lib/paddleClient";

const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || "https://aevion.app").replace(/\/$/, "");

export const qstoreRouter = Router();

const pool = getPool();

// Bootstrap tables
(async () => {
  try {
    await ensureQStoreTables(pool);
  } catch {
    // silent — in-memory fallback active
  }
})();

/** Safely extract a route param as plain string */
function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : String(v ?? "");
}

interface Product {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  previewUrl: string;
  tags: string[];
  salesCount: number;
  avgRating: number;
  reviewCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Purchase {
  id: string;
  productId: string;
  buyerId: string;
  amount: number;
  createdAt: string;
}

interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

// In-memory fallback
const memProducts = new Map<string, Product & { featured?: boolean }>();
const memPurchases = new Map<string, Purchase>();
// key: `${productId}:${userId}`
const memReviews = new Map<string, Review>();

const CATEGORIES = [
  { id: "template", name: "Templates" },
  { id: "preset", name: "Presets" },
  { id: "music", name: "Music" },
  { id: "video", name: "Video" },
  { id: "design", name: "Design" },
  { id: "code", name: "Code" },
  { id: "other", name: "Other" },
];

// GET /api/qstore/health
qstoreRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    module: "qstore",
    db: isQStoreDbReady() ? "postgres" : "in-memory",
    timestamp: new Date().toISOString(),
  });
});

// GET /api/qstore/categories
qstoreRouter.get("/categories", (_req: Request, res: Response) => {
  res.json({ categories: CATEGORIES });
});

// GET /api/qstore/products
//   ?q=...               full-text search
//   ?category=xxx        filter by category id
//   ?sort=popular|newest|trending|rating  (default: popular)
//   ?limit=N             max 50
qstoreRouter.get("/products", async (req: Request, res: Response) => {
  const q = req.query.q ? String(req.query.q) : undefined;
  const category = req.query.category ? String(req.query.category) : undefined;
  const sort = req.query.sort ? String(req.query.sort) : "popular";
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  const orderBySql: Record<string, string> = {
    popular: `"salesCount" DESC`,
    newest: `"createdAt" DESC`,
    trending: `"salesCount" DESC, "createdAt" DESC`,
    rating: `"avgRating" DESC NULLS LAST, "salesCount" DESC`,
  };
  const orderClause = orderBySql[sort] ?? orderBySql.popular;

  if (isQStoreDbReady()) {
    try {
      const conditions: string[] = ['"isPublic" = TRUE'];
      const params: unknown[] = [];
      if (category) { params.push(category); conditions.push(`"category" = $${params.length}`); }
      if (q) { params.push(`%${q}%`); conditions.push(`("title" ILIKE $${params.length} OR "description" ILIKE $${params.length})`); }
      params.push(limit);
      const where = `WHERE ${conditions.join(" AND ")}`;
      const rows = await pool.query(
        `SELECT * FROM "QStoreProduct" ${where} ORDER BY ${orderClause} LIMIT $${params.length}`,
        params,
      );
      res.json({ products: rows.rows, total: rows.rowCount ?? rows.rows.length, sort });
      return;
    } catch {
      // fall through to in-memory
    }
  }

  let products = Array.from(memProducts.values()).filter((p) => p.isPublic);
  if (category) products = products.filter((p) => p.category === category);
  if (q) products = products.filter((p) =>
    p.title.toLowerCase().includes(q.toLowerCase()) ||
    p.description.toLowerCase().includes(q.toLowerCase()),
  );
  // In-memory sort
  if (sort === "newest") {
    products.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else if (sort === "rating") {
    products.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0) || b.salesCount - a.salesCount);
  } else if (sort === "trending") {
    // crude trending: sales weighted by recency
    products.sort((a, b) => {
      const ageA = Date.now() - new Date(a.createdAt).getTime();
      const ageB = Date.now() - new Date(b.createdAt).getTime();
      const scoreA = a.salesCount / Math.max(1, ageA / 86400000);
      const scoreB = b.salesCount / Math.max(1, ageB / 86400000);
      return scoreB - scoreA;
    });
  } else {
    products.sort((a, b) => b.salesCount - a.salesCount);
  }
  products = products.slice(0, limit);
  res.json({ products, total: products.length, sort });
});

// GET /api/qstore/products/:id
qstoreRouter.get("/products/:id", async (req: Request, res: Response) => {
  const id = param(req, "id");
  if (isQStoreDbReady()) {
    try {
      const row = await pool.query(`SELECT * FROM "QStoreProduct" WHERE "id" = $1`, [id]);
      if (row.rows.length === 0) { res.status(404).json({ error: "Product not found" }); return; }
      res.json({ product: row.rows[0] });
      return;
    } catch {
      // fall through
    }
  }
  const product = memProducts.get(id);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json({ product });
});

// POST /api/qstore/me/products — create product
qstoreRouter.post("/me/products", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }

  const { title, description, category, price, previewUrl, tags } = req.body as {
    title?: string;
    description?: string;
    category?: string;
    price?: number;
    previewUrl?: string;
    tags?: string[];
  };

  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
  if (!category) { res.status(400).json({ error: "category is required" }); return; }

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  const product: Product = {
    id: newId,
    sellerId: auth.sub,
    title: title.trim(),
    description: description?.trim() || "",
    category,
    price: Number(price) || 0,
    currency: "usd",
    previewUrl: previewUrl || "",
    tags: tags || [],
    salesCount: 0,
    avgRating: 0,
    reviewCount: 0,
    isPublic: true,
    createdAt: now,
    updatedAt: now,
  };

  if (isQStoreDbReady()) {
    try {
      await pool.query(
        `INSERT INTO "QStoreProduct"
         ("id","sellerId","title","description","category","price","currency","previewUrl","tags","salesCount","isPublic","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [product.id, product.sellerId, product.title, product.description, product.category,
         product.price, product.currency, product.previewUrl, product.tags,
         product.salesCount, product.isPublic, product.createdAt, product.updatedAt],
      );
      res.status(201).json({ product });
      return;
    } catch {
      // fall through
    }
  }
  memProducts.set(newId, product);
  res.status(201).json({ product });
});

// PATCH /api/qstore/me/products/:id
qstoreRouter.patch("/me/products/:id", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = param(req, "id");

  if (isQStoreDbReady()) {
    try {
      const row = await pool.query(`SELECT * FROM "QStoreProduct" WHERE "id" = $1`, [id]);
      if (row.rows.length === 0) { res.status(404).json({ error: "Product not found" }); return; }
      if (row.rows[0].sellerId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }
      const { title, description, category, price, previewUrl, tags, isPublic } = req.body;
      const updated = await pool.query(
        `UPDATE "QStoreProduct" SET
          "title" = COALESCE($2, "title"),
          "description" = COALESCE($3, "description"),
          "category" = COALESCE($4, "category"),
          "price" = COALESCE($5, "price"),
          "previewUrl" = COALESCE($6, "previewUrl"),
          "tags" = COALESCE($7, "tags"),
          "isPublic" = COALESCE($8, "isPublic"),
          "updatedAt" = NOW()
         WHERE "id" = $1 RETURNING *`,
        [id, title, description, category, price, previewUrl, tags, isPublic],
      );
      res.json({ product: updated.rows[0] });
      return;
    } catch {
      // fall through
    }
  }
  const product = memProducts.get(id);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  if (product.sellerId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }
  const updated = { ...product, ...req.body, updatedAt: new Date().toISOString() };
  memProducts.set(id, updated);
  res.json({ product: updated });
});

// DELETE /api/qstore/me/products/:id
qstoreRouter.delete("/me/products/:id", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = param(req, "id");

  if (isQStoreDbReady()) {
    try {
      const row = await pool.query(`SELECT "sellerId" FROM "QStoreProduct" WHERE "id" = $1`, [id]);
      if (row.rows.length === 0) { res.status(404).json({ error: "Product not found" }); return; }
      if (row.rows[0].sellerId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }
      await pool.query(`DELETE FROM "QStoreProduct" WHERE "id" = $1`, [id]);
      res.json({ ok: true });
      return;
    } catch {
      // fall through
    }
  }
  const product = memProducts.get(id);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  if (product.sellerId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }
  memProducts.delete(id);
  res.json({ ok: true });
});

// POST /api/qstore/products/:id/purchase
qstoreRouter.post("/products/:id/purchase", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = param(req, "id");

  if (isQStoreDbReady()) {
    try {
      const row = await pool.query(`SELECT * FROM "QStoreProduct" WHERE "id" = $1`, [id]);
      if (row.rows.length === 0) { res.status(404).json({ error: "Product not found" }); return; }
      const pRow = row.rows[0];
      const purchaseId = crypto.randomUUID();

      // Paddle Checkout: if Paddle is configured and product has non-zero price
      if (PADDLE_KEY() && pRow.price > 0) {
        const currency = (pRow.currency || "KZT").toUpperCase();
        const amountCents = currency === "KZT"
          ? Math.round(pRow.price)       // QStore stores KZT as integer tenge
          : Math.round(pRow.price * 100); // USD/other — cents

        try {
          const txBody: Record<string, unknown> = {
            items: [{
              price: {
                description: (pRow.description || pRow.title).slice(0, 255),
                unit_price: { amount: String(amountCents), currency_code: currency },
                product: { name: pRow.title.slice(0, 255), tax_category: "standard" },
              },
              quantity: 1,
            }],
            checkout: { url: `${FRONTEND_URL}/qstore?purchase=success&id=${purchaseId}` },
            custom_data: { purchaseId, productId: pRow.id, buyerId: auth.sub, source: "qstore" },
          };

          const tx = await paddlePost("/transactions", txBody) as {
            data?: { id: string; checkout?: { url: string } };
          } | null;

          if (tx?.data) {
            await pool.query(
              `INSERT INTO "QStorePurchase" ("id","productId","buyerId","amount","status","stripeSessionId","createdAt")
               VALUES ($1,$2,$3,$4,'pending',$5,NOW())`,
              [purchaseId, pRow.id, auth.sub, pRow.price, tx.data.id],
            );
            const checkoutUrl = tx.data.checkout?.url
              ?? `${FRONTEND_URL}/qstore?purchase=success&id=${purchaseId}`;
            res.status(201).json({ purchaseId, checkoutUrl, mode: "paddle", status: "pending", sandbox: IS_PADDLE_SANDBOX() });
            return;
          }
          console.warn("[QStore] Paddle transaction failed, falling back to direct");
        } catch (paddleErr) {
          console.warn("[QStore] Paddle error, falling back to direct:", paddleErr instanceof Error ? paddleErr.message : paddleErr);
        }
      }

      // Direct purchase (free items or Stripe not configured)
      await pool.query(
        `INSERT INTO "QStorePurchase" ("id","productId","buyerId","amount","status","paidAt","createdAt")
         VALUES ($1,$2,$3,$4,'paid',NOW(),NOW())`,
        [purchaseId, pRow.id, auth.sub, pRow.price],
      );
      await pool.query(
        `UPDATE "QStoreProduct" SET "salesCount" = "salesCount" + 1 WHERE "id" = $1`,
        [pRow.id],
      );
      res.status(201).json({ purchaseId, mode: "direct", status: "paid" });
      return;
    } catch (e) {
      console.error("[QStore] purchase error:", e instanceof Error ? e.message : e);
      res.status(500).json({ error: "purchase_failed" });
      return;
    }
  }

  // In-memory fallback
  const product = memProducts.get(id);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  const purchaseId = crypto.randomUUID();
  memPurchases.set(purchaseId, {
    id: purchaseId,
    productId: product.id,
    buyerId: auth.sub,
    amount: product.price,
    createdAt: new Date().toISOString(),
  });
  product.salesCount += 1;
  res.status(201).json({ purchaseId, mode: "memory", status: "paid" });
});

// GET /api/qstore/me/purchases
qstoreRouter.get("/me/purchases", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }

  if (isQStoreDbReady()) {
    try {
      const rows = await pool.query(
        `SELECT p.*, pr."title" AS "productTitle", pr."category"
         FROM "QStorePurchase" p
         JOIN "QStoreProduct" pr ON pr."id" = p."productId"
         WHERE p."buyerId" = $1
         ORDER BY p."createdAt" DESC`,
        [auth.sub],
      );
      res.json({ purchases: rows.rows, total: rows.rowCount ?? rows.rows.length });
      return;
    } catch {
      // fall through
    }
  }
  const purchases = Array.from(memPurchases.values()).filter((p) => p.buyerId === auth.sub);
  res.json({ purchases, total: purchases.length });
});

// POST /api/qstore/products/:id/review — add/update review (one per user per product)
qstoreRouter.post("/products/:id/review", async (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const productId = param(req, "id");
  const { rating, comment } = req.body as { rating?: number; comment?: string };
  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    res.status(400).json({ error: "rating must be 1-5" });
    return;
  }

  const reviewKey = `${productId}:${auth.sub}`;
  const reviewId = crypto.randomUUID();
  const review: Review = {
    id: reviewId,
    productId,
    userId: auth.sub,
    rating,
    comment: comment ? String(comment).trim() : null,
    createdAt: new Date().toISOString(),
  };
  memReviews.set(reviewKey, review);

  // Recalculate average rating for product
  const product = memProducts.get(productId);
  if (product) {
    const productReviews = Array.from(memReviews.values()).filter((r) => r.productId === productId);
    product.reviewCount = productReviews.length;
    product.avgRating = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
    product.updatedAt = new Date().toISOString();
  }

  res.status(201).json({ reviewId, rating });
});

// GET /api/qstore/products/:id/reviews — list reviews for a product
qstoreRouter.get("/products/:id/reviews", (req: Request, res: Response) => {
  const productId = param(req, "id");
  const reviews = Array.from(memReviews.values())
    .filter((r) => r.productId === productId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ reviews, total: reviews.length });
});

// GET /api/qstore/featured — curated buckets: popular, newest, trending, topRated
//   ?limit=N (default 5, max 12) per bucket
qstoreRouter.get("/featured", async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 12);

  // Try DB first
  if (isQStoreDbReady()) {
    try {
      const [popRes, newRes, ratedRes] = await Promise.all([
        pool.query(
          `SELECT * FROM "QStoreProduct" WHERE "isPublic" = TRUE ORDER BY "salesCount" DESC LIMIT $1`,
          [limit],
        ),
        pool.query(
          `SELECT * FROM "QStoreProduct" WHERE "isPublic" = TRUE ORDER BY "createdAt" DESC LIMIT $1`,
          [limit],
        ),
        pool.query(
          `SELECT * FROM "QStoreProduct" WHERE "isPublic" = TRUE AND "avgRating" > 0 ORDER BY "avgRating" DESC, "salesCount" DESC LIMIT $1`,
          [limit],
        ),
      ]);
      const popular = popRes.rows;
      const newest = newRes.rows;
      const topRated = ratedRes.rows;
      // Trending: sales weighted by recency
      const allPublicRes = await pool.query(
        `SELECT * FROM "QStoreProduct" WHERE "isPublic" = TRUE`,
      );
      const trending = [...allPublicRes.rows]
        .map((p: any) => {
          const ageDays = Math.max(1, (Date.now() - new Date(p.createdAt).getTime()) / 86400000);
          return { ...p, _score: (p.salesCount || 0) / ageDays };
        })
        .sort((a: any, b: any) => b._score - a._score)
        .slice(0, limit)
        .map(({ _score, ...rest }: any) => rest);
      res.json({ popular, newest, trending, topRated });
      return;
    } catch {
      // fall through
    }
  }

  const allPublic = Array.from(memProducts.values()).filter((p) => p.isPublic);
  const popular = [...allPublic]
    .sort((a, b) => b.salesCount - a.salesCount)
    .slice(0, limit);
  const newest = [...allPublic]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
  const topRated = [...allPublic]
    .filter((p) => (p.avgRating || 0) > 0)
    .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0) || b.salesCount - a.salesCount)
    .slice(0, limit);
  const trending = [...allPublic]
    .map((p) => {
      const ageDays = Math.max(1, (Date.now() - new Date(p.createdAt).getTime()) / 86400000);
      return { ...p, _score: (p.salesCount || 0) / ageDays };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...rest }) => rest as typeof allPublic[number]);
  res.json({ popular, newest, trending, topRated });
});

// GET /api/qstore/me/sales — products I own that have been purchased
qstoreRouter.get("/me/sales", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }

  const myProductIds = new Set(
    Array.from(memProducts.values())
      .filter((p) => p.sellerId === auth.sub)
      .map((p) => p.id),
  );
  const sales = Array.from(memPurchases.values())
    .filter((pu) => myProductIds.has(pu.productId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalRevenue = sales.reduce((sum, s) => sum + s.amount, 0);
  res.json({ sales, total: sales.length, totalRevenue });
});

// GET /api/qstore/me/dashboard — seller analytics dashboard
qstoreRouter.get("/me/dashboard", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }

  const myProducts = Array.from(memProducts.values()).filter((p) => p.sellerId === auth.sub);
  const myProductIds = new Set(myProducts.map((p) => p.id));
  const allSales = Array.from(memPurchases.values()).filter((pu) => myProductIds.has(pu.productId));

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthlySales = allSales.filter((s) => s.createdAt >= startOfMonth);

  const totalRevenue = allSales.reduce((sum, s) => sum + s.amount, 0);
  const monthlyRevenue = monthlySales.reduce((sum, s) => sum + s.amount, 0);

  // Top product by salesCount
  const topProduct = myProducts.sort((a, b) => b.salesCount - a.salesCount)[0] ?? null;

  // Recent sales (last 5)
  const recentSales = allSales
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((s) => {
      const product = memProducts.get(s.productId);
      return {
        purchaseId: s.id,
        productTitle: product?.title ?? "Unknown",
        amount: s.amount,
        createdAt: s.createdAt,
      };
    });

  res.json({
    products: {
      total: myProducts.length,
      public: myProducts.filter((p) => p.isPublic).length,
    },
    sales: {
      total: allSales.length,
      thisMonth: monthlySales.length,
    },
    revenue: {
      total: totalRevenue,
      thisMonth: monthlyRevenue,
      currency: "usd",
    },
    topProduct: topProduct
      ? { id: topProduct.id, title: topProduct.title, salesCount: topProduct.salesCount }
      : null,
    recentSales,
  });
});

// GET /api/qstore/sellers/:userId — public seller profile
qstoreRouter.get("/sellers/:userId", (req: Request, res: Response) => {
  const userId = req.params.userId;
  const products = Array.from(memProducts.values())
    .filter((p) => p.sellerId === userId && p.isPublic)
    .map(({ id, title, category, price, salesCount }) => ({ id, title, category, price, salesCount }));

  const totalSales = products.reduce((sum, p) => sum + p.salesCount, 0);

  const productIds = new Set(Array.from(memProducts.values()).filter((p) => p.sellerId === userId).map((p) => p.id));
  const reviews = Array.from(memReviews.values()).filter((r) => productIds.has(r.productId));
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  res.json({ userId, products, totalSales, avgRating: Math.round(avgRating * 10) / 10 });
});

// GET /api/qstore/me/dashboard/chart — daily sales & revenue for last N days (default 7)
qstoreRouter.get("/me/dashboard/chart", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }

  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
  const myProducts = Array.from(memProducts.values()).filter((p) => p.sellerId === auth.sub);
  const myProductIds = new Set(myProducts.map((p) => p.id));
  const allSales = Array.from(memPurchases.values()).filter((pu) => myProductIds.has(pu.productId));

  const now = new Date();
  const buckets: { date: string; sales: number; revenue: number }[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    const dateStr = day.toISOString().slice(0, 10);
    const dayStart = dateStr;
    const dayEnd = dateStr + "T23:59:59.999Z";
    const daySales = allSales.filter((s) => s.createdAt >= dayStart && s.createdAt <= dayEnd);
    buckets.push({
      date: dateStr,
      sales: daySales.length,
      revenue: daySales.reduce((sum, s) => sum + s.amount, 0),
    });
  }

  const totalRevenue = buckets.reduce((s, b) => s + b.revenue, 0);
  const totalSales = buckets.reduce((s, b) => s + b.sales, 0);
  const peakDay = buckets.reduce((best, b) => (b.revenue > best.revenue ? b : best), buckets[0]);

  res.json({ days, buckets, summary: { totalRevenue, totalSales, peakDay: peakDay?.date ?? null } });
});

// POST /api/qstore/products/:id/feature — mark product as featured (owner only)
qstoreRouter.post("/products/:id/feature", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const id = param(req, "id");

  const product = memProducts.get(id);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  if (product.sellerId !== auth.sub) { res.status(403).json({ error: "Forbidden" }); return; }

  (product as Product & { featured: boolean }).featured = !(product as any).featured;
  const featured = (product as any).featured as boolean;
  res.json({ featured });
});

// ─── OG image helpers (SVG, no external deps) ────────────────────────────────

function qstoreEsc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function qstoreWrap(text: string, perLine: number, maxLines: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > perLine) {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (consumed < words.length && lines.length === maxLines) {
    lines[maxLines - 1] = (lines[maxLines - 1] || "").replace(/\s+\S+$/, "") + "…";
  }
  return lines;
}

function qstoreCategoryName(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.name || id || "Other";
}

function qstoreFormatPrice(price: number, currency: string): string {
  const c = (currency || "USD").toUpperCase();
  const symbol = c === "USD" ? "$" : c === "EUR" ? "€" : c === "AEC" ? "ÆC" : "";
  const value = Math.round(Number(price) * 100) / 100;
  if (symbol) return `${symbol}${value}`;
  return `${value} ${c}`;
}

function qstoreInitial(s: string): string {
  const v = String(s || "").trim();
  if (!v) return "?";
  const ch = v.charAt(0).toUpperCase();
  return /[A-ZА-ЯЁ0-9]/i.test(ch) ? ch : "?";
}

function qstoreCategoryAccent(category: string): string {
  switch (category) {
    case "template": return "#7dd3fc";
    case "preset":   return "#a78bfa";
    case "music":    return "#f472b6";
    case "video":    return "#fb923c";
    case "design":   return "#f59e0b";
    case "code":     return "#34d399";
    default:         return "#94a3b8";
  }
}

/**
 * Render the default QStore marketplace card.
 * Used when no `id` / `seller` query is provided, or when lookup fails.
 */
function renderQStoreDefaultSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="qs-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#020617"/>
      <stop offset="0.5" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="qs-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7dd3fc"/>
      <stop offset="0.5" stop-color="#a78bfa"/>
      <stop offset="1" stop-color="#f472b6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#qs-bg)"/>
  <rect width="1200" height="6" fill="url(#qs-accent)"/>
  <g font-family="Inter, system-ui, -apple-system, sans-serif" fill="#e2e8f0">
    <text x="60" y="84" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="6">AEVION QSTORE</text>
    <text x="60" y="220" font-size="92" font-weight="900" letter-spacing="-2">Marketplace</text>
    <text x="60" y="320" font-size="92" font-weight="900" letter-spacing="-2" fill="#a78bfa">для модулей.</text>
    <text x="60" y="400" font-size="28" font-weight="500" fill="#cbd5e1">Templates · Presets · Music · Video · Design · Code</text>
    <g transform="translate(60, 470)" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
      <rect width="260" height="64" rx="12" fill="#7dd3fc" fill-opacity="0.12" stroke="#7dd3fc" stroke-width="2"/>
      <text x="20" y="40" font-size="22" font-weight="800" fill="#7dd3fc">Buy &amp; sell modules</text>
    </g>
    <text x="60" y="585" font-size="20" font-weight="700" fill="#64748b" font-family="ui-monospace, monospace">aevion.app / qstore</text>
  </g>
</svg>`;
}

/**
 * GET /api/qstore/og.svg
 *
 * Query:
 *   ?id=<itemId>       → product detail card (title, price, category, sales)
 *   ?seller=<userId>   → seller profile card (initial, id, product count, total sales)
 *   (none)             → default marketplace card
 *
 * 1200×630 inline SVG. Weak ETag fingerprint + 5-minute Cache-Control so social
 * crawlers (Discord, Slack, Telegram, X, Facebook, LinkedIn) return 304 on
 * repeat scrapes.
 */
qstoreRouter.get("/og.svg", async (req: Request, res: Response) => {
  try {
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const id = req.query.id ? String(req.query.id) : "";
    const sellerId = req.query.seller ? String(req.query.seller) : "";

    // ── Product detail card ──────────────────────────────────────────────────
    if (id) {
      let product: Product | null = null;

      if (isQStoreDbReady()) {
        try {
          const row = await pool.query(
            `SELECT "id","title","category","price","currency","salesCount","sellerId"
             FROM "QStoreProduct" WHERE "id" = $1 LIMIT 1`,
            [id],
          );
          if (row.rows.length > 0) {
            product = row.rows[0] as Product;
          }
        } catch {
          // fall through to mem
        }
      }
      if (!product) {
        const mem = memProducts.get(id);
        if (mem) product = mem;
      }

      if (!product) {
        if (applyOgEtag(req, res, `qstore-item-missing-${id.slice(0, 24)}`, 60)) return;
        res.send(renderQStoreDefaultSvg());
        return;
      }

      const fingerprint = `qstore-item-${product.id}-${product.salesCount}-${product.price}`;
      if (applyOgEtag(req, res, fingerprint)) return;

      const accent = qstoreCategoryAccent(product.category);
      const titleLines = qstoreWrap(product.title || "Untitled module", 22, 2);
      const categoryName = qstoreCategoryName(product.category);
      const priceText = qstoreFormatPrice(product.price, product.currency);
      const salesText = `${product.salesCount} sale${product.salesCount === 1 ? "" : "s"}`;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="qs-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#020617"/>
      <stop offset="0.5" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="qs-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#qs-bg)"/>
  <rect width="1200" height="6" fill="url(#qs-accent)"/>
  <g font-family="Inter, system-ui, -apple-system, sans-serif" fill="#e2e8f0">
    <text x="60" y="84" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="6">AEVION QSTORE</text>
    <g transform="translate(60, 170)">
      ${titleLines
        .map(
          (line, i) =>
            `<text y="${i * 92}" font-size="80" font-weight="900" letter-spacing="-2">${qstoreEsc(line)}</text>`,
        )
        .join("\n      ")}
    </g>
    <g transform="translate(60, ${170 + titleLines.length * 92 + 30})">
      <rect width="${categoryName.length * 14 + 56}" height="44" rx="22" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="2"/>
      <text x="22" y="30" font-size="20" font-weight="800" fill="${accent}" letter-spacing="2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${qstoreEsc(categoryName.toUpperCase())}</text>
    </g>
    <g transform="translate(60, 500)" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
      <text font-size="56" font-weight="900" fill="#f8fafc">${qstoreEsc(priceText)}</text>
      <text x="0" y="34" font-size="18" font-weight="700" fill="#64748b" letter-spacing="2">${qstoreEsc(salesText.toUpperCase())}</text>
    </g>
    <text x="${1200 - 60}" y="585" text-anchor="end" font-size="20" font-weight="700" fill="#64748b" font-family="ui-monospace, monospace">aevion.app / qstore / ${qstoreEsc(product.id.slice(0, 12))}</text>
  </g>
</svg>`;

      res.send(svg);
      return;
    }

    // ── Seller profile card ──────────────────────────────────────────────────
    if (sellerId) {
      let products: { id: string; salesCount: number; isPublic: boolean }[] = [];

      if (isQStoreDbReady()) {
        try {
          const r = await pool.query(
            `SELECT "id","salesCount","isPublic" FROM "QStoreProduct" WHERE "sellerId" = $1`,
            [sellerId],
          );
          products = r.rows as typeof products;
        } catch {
          // fall through
        }
      }
      if (products.length === 0) {
        products = Array.from(memProducts.values())
          .filter((p) => p.sellerId === sellerId)
          .map(({ id: pid, salesCount, isPublic }) => ({ id: pid, salesCount, isPublic }));
      }

      const publicProducts = products.filter((p) => p.isPublic !== false);
      const productCount = publicProducts.length;
      const totalSales = publicProducts.reduce((sum, p) => sum + (p.salesCount || 0), 0);

      const fingerprint = `qstore-seller-${sellerId}-${productCount}-${totalSales}`;
      if (applyOgEtag(req, res, fingerprint)) return;

      const initial = qstoreInitial(sellerId);
      const displayId = sellerId.length > 22 ? `${sellerId.slice(0, 10)}…${sellerId.slice(-8)}` : sellerId;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="qs-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#020617"/>
      <stop offset="0.5" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="qs-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#a78bfa"/>
      <stop offset="1" stop-color="#f472b6"/>
    </linearGradient>
    <linearGradient id="qs-avatar" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7dd3fc"/>
      <stop offset="1" stop-color="#a78bfa"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#qs-bg)"/>
  <rect width="1200" height="6" fill="url(#qs-accent)"/>
  <g font-family="Inter, system-ui, -apple-system, sans-serif" fill="#e2e8f0">
    <text x="60" y="84" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="6">AEVION QSTORE · SELLER</text>
    <g transform="translate(60, 160)">
      <rect width="180" height="180" rx="40" fill="url(#qs-avatar)"/>
      <text x="90" y="125" text-anchor="middle" font-size="110" font-weight="900" fill="#020617">${qstoreEsc(initial)}</text>
    </g>
    <g transform="translate(280, 220)">
      <text font-size="56" font-weight="900" letter-spacing="-1" fill="#f8fafc">Creator</text>
      <text y="56" font-size="24" font-weight="600" fill="#94a3b8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${qstoreEsc(displayId)}</text>
    </g>
    <g transform="translate(60, 430)" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
      <g>
        <rect width="260" height="120" rx="18" fill="#a78bfa" fill-opacity="0.12" stroke="#a78bfa" stroke-width="2"/>
        <text x="22" y="62" font-size="56" font-weight="900" fill="#c4b5fd">${qstoreEsc(String(productCount))}</text>
        <text x="22" y="96" font-size="14" font-weight="700" fill="#a78bfa" letter-spacing="2">PRODUCTS</text>
      </g>
      <g transform="translate(280, 0)">
        <rect width="260" height="120" rx="18" fill="#f472b6" fill-opacity="0.12" stroke="#f472b6" stroke-width="2"/>
        <text x="22" y="62" font-size="56" font-weight="900" fill="#f9a8d4">${qstoreEsc(String(totalSales))}</text>
        <text x="22" y="96" font-size="14" font-weight="700" fill="#f472b6" letter-spacing="2">TOTAL SALES</text>
      </g>
    </g>
    <text x="${1200 - 60}" y="585" text-anchor="end" font-size="20" font-weight="700" fill="#64748b" font-family="ui-monospace, monospace">aevion.app / qstore / seller</text>
  </g>
</svg>`;

      res.send(svg);
      return;
    }

    // ── Default marketplace card ─────────────────────────────────────────────
    if (applyOgEtag(req, res, "qstore-default-v1")) return;
    res.send(renderQStoreDefaultSvg());
  } catch (_err) {
    try {
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=60");
      res.status(500).send(renderQStoreDefaultSvg());
    } catch {
      res.status(500).json({ error: "qstore og failed" });
    }
  }
});
