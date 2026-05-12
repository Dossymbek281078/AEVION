import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { ensureQStoreTables, isQStoreDbReady } from "../lib/ensureQStoreTables";

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
qstoreRouter.get("/products", async (req: Request, res: Response) => {
  const q = req.query.q ? String(req.query.q) : undefined;
  const category = req.query.category ? String(req.query.category) : undefined;
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  if (isQStoreDbReady()) {
    try {
      const conditions: string[] = ['"isPublic" = TRUE'];
      const params: unknown[] = [];
      if (category) { params.push(category); conditions.push(`"category" = $${params.length}`); }
      if (q) { params.push(`%${q}%`); conditions.push(`("title" ILIKE $${params.length} OR "description" ILIKE $${params.length})`); }
      params.push(limit);
      const where = `WHERE ${conditions.join(" AND ")}`;
      const rows = await pool.query(
        `SELECT * FROM "QStoreProduct" ${where} ORDER BY "salesCount" DESC LIMIT $${params.length}`,
        params,
      );
      res.json({ products: rows.rows, total: rows.rowCount ?? rows.rows.length });
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
  products.sort((a, b) => b.salesCount - a.salesCount);
  products = products.slice(0, limit);
  res.json({ products, total: products.length });
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
      await pool.query(
        `INSERT INTO "QStorePurchase" ("id","productId","buyerId","amount","createdAt")
         VALUES ($1,$2,$3,$4,NOW())`,
        [purchaseId, pRow.id, auth.sub, pRow.price],
      );
      await pool.query(
        `UPDATE "QStoreProduct" SET "salesCount" = "salesCount" + 1 WHERE "id" = $1`,
        [pRow.id],
      );
      res.status(201).json({ purchaseId });
      return;
    } catch {
      // fall through
    }
  }
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
  res.status(201).json({ purchaseId });
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

// GET /api/qstore/featured — top 5 by salesCount + 5 newest
qstoreRouter.get("/featured", (_req: Request, res: Response) => {
  const allPublic = Array.from(memProducts.values()).filter((p) => p.isPublic);
  const popular = [...allPublic]
    .sort((a, b) => b.salesCount - a.salesCount)
    .slice(0, 5);
  const newest = [...allPublic]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  res.json({ popular, newest });
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
