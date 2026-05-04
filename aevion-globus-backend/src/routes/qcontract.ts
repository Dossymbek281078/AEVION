import { Router } from "express";
import { randomUUID, createHash } from "node:crypto";
import { getPool } from "../lib/dbPool";
import { verifyBearerOptional } from "../lib/authJwt";

export const qcontractRouter = Router();

// ── Table bootstrap ──────────────────────────────────────────────────────────

let tablesReady = false;

async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qcontract_documents (
        id                 TEXT PRIMARY KEY,
        owner_id           TEXT NOT NULL,
        title              TEXT NOT NULL,
        content            TEXT NOT NULL,
        content_type       TEXT NOT NULL DEFAULT 'text',
        access_token       TEXT UNIQUE NOT NULL,
        password_hash      TEXT,
        max_views          INTEGER,
        expires_at         TIMESTAMPTZ,
        view_count         INTEGER NOT NULL DEFAULT 0,
        revoked_at         TIMESTAMPTZ,
        require_signature  BOOLEAN NOT NULL DEFAULT false,
        qright_id          TEXT,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qc_docs_owner ON qcontract_documents (owner_id);
      CREATE INDEX IF NOT EXISTS idx_qc_docs_token ON qcontract_documents (access_token);

      CREATE TABLE IF NOT EXISTS qcontract_views (
        id           TEXT PRIMARY KEY,
        document_id  TEXT NOT NULL,
        viewer_ip    TEXT,
        viewer_ua    TEXT,
        viewer_email TEXT,
        signed_at    TIMESTAMPTZ,
        viewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_qc_views_doc ON qcontract_views (document_id, viewed_at DESC);
    `);
    // Safe migrations for existing tables
    await pool.query(`
      ALTER TABLE qcontract_documents ADD COLUMN IF NOT EXISTS require_signature BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE qcontract_documents ADD COLUMN IF NOT EXISTS qright_id TEXT;
      ALTER TABLE qcontract_views ADD COLUMN IF NOT EXISTS viewer_email TEXT;
      ALTER TABLE qcontract_views ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
    `).catch(() => {});
    tablesReady = true;
  } catch (err) {
    console.warn("[qcontract] table init skipped:", err instanceof Error ? err.message : err);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashPassword(pw: string): string {
  return createHash("sha256").update(pw).digest("hex");
}

function isExpired(row: {
  expires_at?: Date | null;
  max_views?: number | null;
  view_count: number;
  revoked_at?: Date | null;
}): boolean {
  if (row.revoked_at) return true;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return true;
  if (row.max_views != null && row.view_count >= row.max_views) return true;
  return false;
}

// ── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "nda",
    title: "Соглашение о неразглашении (NDA)",
    description: "Стандартный NDA для бизнес-партнёров",
    contentType: "text" as const,
    content: `СОГЛАШЕНИЕ О НЕРАЗГЛАШЕНИИ КОНФИДЕНЦИАЛЬНОЙ ИНФОРМАЦИИ

Дата: _______________
Стороны: _______________ (Раскрывающая сторона) и _______________ (Получающая сторона)

1. ПРЕДМЕТ СОГЛАШЕНИЯ
Стороны договорились о неразглашении конфиденциальной информации, передаваемой в ходе сотрудничества.

2. КОНФИДЕНЦИАЛЬНАЯ ИНФОРМАЦИЯ
Под конфиденциальной информацией понимается любая информация технического, коммерческого или финансового характера.

3. ОБЯЗАТЕЛЬСТВА СТОРОН
Получающая сторона обязуется:
- не разглашать полученную информацию третьим лицам
- использовать информацию исключительно в целях сотрудничества
- уведомить Раскрывающую сторону о любой утечке

4. СРОК ДЕЙСТВИЯ
Настоящее соглашение вступает в силу с момента подписания и действует 3 (три) года.

5. ОТВЕТСТВЕННОСТЬ
Нарушение настоящего соглашения влечёт возмещение причинённых убытков.

Подписи сторон:

Раскрывающая сторона: _______________________
Получающая сторона:  _______________________`,
  },
  {
    id: "offer",
    title: "Оффер сотруднику",
    description: "Предложение о работе с условиями",
    contentType: "text" as const,
    content: `ПРЕДЛОЖЕНИЕ О ТРУДОУСТРОЙСТВЕ

Дорогой(ая) _______________,

Мы рады предложить Вам позицию _______________ в компании _______________.

УСЛОВИЯ ПРЕДЛОЖЕНИЯ:
• Должность:     _______________
• Отдел:         _______________
• Начало работы: _______________
• Заработная плата: _______________ тенге/мес. (до вычета налогов)
• Испытательный срок: 3 месяца

ДОПОЛНИТЕЛЬНЫЕ УСЛОВИЯ:
• График работы: пн–пт, 09:00–18:00
• Формат: _______________
• Социальный пакет: _______________

Пожалуйста, подтвердите принятие оффера до _______________.

С уважением,
_______________
HR-менеджер, _______________`,
  },
  {
    id: "service",
    title: "Договор об оказании услуг",
    description: "Шаблон договора для фрилансеров",
    contentType: "text" as const,
    content: `ДОГОВОР ОБ ОКАЗАНИИ УСЛУГ №___

г. _______________, «___» _______________ 2026 г.

_______________ (Исполнитель) и _______________ (Заказчик) заключили настоящий договор:

1. ПРЕДМЕТ ДОГОВОРА
Исполнитель обязуется оказать следующие услуги: _______________.

2. СРОКИ
Начало: _______________. Окончание: _______________.

3. СТОИМОСТЬ И ПОРЯДОК ОПЛАТЫ
Стоимость услуг составляет _______________ тенге.
Оплата производится: _______________.

4. ОБЯЗАТЕЛЬСТВА СТОРОН
Исполнитель обязуется выполнить работу в установленный срок.
Заказчик обязуется принять и оплатить результат работы.

5. ОТВЕТСТВЕННОСТЬ
Стороны несут ответственность в соответствии с законодательством РК.

Реквизиты и подписи:
Исполнитель: _______________________
Заказчик:    _______________________`,
  },
  {
    id: "construction",
    title: "Договор строительного подряда",
    description: "Шаблон для строительных и ремонтных работ",
    contentType: "text" as const,
    content: `ДОГОВОР СТРОИТЕЛЬНОГО ПОДРЯДА №___

г. _______________, «___» _______________ 2026 г.

_______________ (Подрядчик) и _______________ (Заказчик):

1. ПРЕДМЕТ ДОГОВОРА
Подрядчик обязуется выполнить строительно-монтажные работы согласно проектной документации:
Объект: _______________
Вид работ: _______________
Адрес объекта: _______________

2. СРОКИ ВЫПОЛНЕНИЯ РАБОТ
Начало: _______________. Окончание: _______________.
При неисполнении сроков — пеня 0.1% в день от стоимости задержанных работ.

3. СТОИМОСТЬ И ПОРЯДОК РАСЧЁТОВ
Общая стоимость: _______________ тенге (включая НДС 12%).
Авансовый платёж (30%): _______________ тенге до _______________.
Промежуточный расчёт: по актам КС-2 ежемесячно.
Окончательный расчёт: в течение 10 рабочих дней после подписания КС-2 итогового.

4. СМЕТА И ПРОЕКТНАЯ ДОКУМЕНТАЦИЯ
Сметная документация: Приложение №1 к настоящему договору.
Изменения сметы возможны только по доп. соглашению.

5. ГАРАНТИЙНЫЕ ОБЯЗАТЕЛЬСТВА
Гарантийный срок: 2 (два) года с момента сдачи объекта.

6. ПОРЯДОК СДАЧИ РАБОТ
Приёмка производится по актам КС-2 (приёмка за период) и КС-3 (справка о стоимости).

Подписи:
Подрядчик: _______________________
Заказчик:  _______________________`,
  },
  {
    id: "equipment-lease",
    title: "Договор аренды оборудования",
    description: "Для аренды техники и оборудования",
    contentType: "text" as const,
    content: `ДОГОВОР АРЕНДЫ ОБОРУДОВАНИЯ №___

г. _______________, «___» _______________ 2026 г.

_______________ (Арендодатель) и _______________ (Арендатор):

1. ПРЕДМЕТ ДОГОВОРА
Арендодатель предоставляет Арендатору во временное возмездное пользование:
Наименование: _______________
Инвентарный №: _______________
Техническое состояние на момент передачи: _______________

2. СРОК АРЕНДЫ
С: _______________ по: _______________

3. АРЕНДНАЯ ПЛАТА
Стоимость аренды: _______________ тнг/___
Порядок оплаты: _______________

4. ОБЯЗАННОСТИ АРЕНДАТОРА
- Использовать оборудование строго по назначению
- Поддерживать в исправном техническом состоянии
- Немедленно уведомить о неисправностях
- Вернуть в срок и в том же состоянии (с учётом нормального износа)

5. ОТВЕТСТВЕННОСТЬ
При повреждении оборудования по вине Арендатора — полное возмещение ущерба.

Подписи:
Арендодатель: _______________________
Арендатор:    _______________________`,
  },
];

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/qcontract/templates
qcontractRouter.get("/templates", (_req, res) => {
  res.json({ templates: TEMPLATES.map(({ content: _, ...t }) => t) });
});

// GET /api/qcontract/templates/:id
qcontractRouter.get("/templates/:id", (req, res) => {
  const t = TEMPLATES.find((t) => t.id === req.params.id);
  if (!t) return res.status(404).json({ error: "template_not_found" });
  res.json(t);
});

// POST /api/qcontract/documents
qcontractRouter.post("/documents", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const {
    title,
    content,
    contentType = "text",
    password,
    maxViews,
    expiresAt,
    requireSignature = false,
    qrightId,
  } = req.body as {
    title?: string;
    content?: string;
    contentType?: "text" | "url" | "html";
    password?: string;
    maxViews?: number;
    expiresAt?: string;
    requireSignature?: boolean;
    qrightId?: string;
  };

  if (!title?.trim()) return res.status(400).json({ error: "title_required" });
  if (!content?.trim()) return res.status(400).json({ error: "content_required" });

  const id = randomUUID();
  const accessToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const passwordHash = password ? hashPassword(password) : null;
  const pool = getPool();

  await pool.query(
    `INSERT INTO qcontract_documents
       (id, owner_id, title, content, content_type, access_token, password_hash,
        max_views, expires_at, require_signature, qright_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      auth.sub ?? auth.email ?? "unknown",
      title.trim(),
      content.trim(),
      contentType,
      accessToken,
      passwordHash,
      maxViews ?? null,
      expiresAt ?? null,
      requireSignature,
      qrightId?.trim() || null,
    ],
  );

  const frontendBase = (process.env.FRONTEND_URL ?? "https://aevion.kz").replace(/\/$/, "");
  res.status(201).json({
    id,
    accessToken,
    shareUrl: `${frontendBase}/qcontract/v/${accessToken}`,
  });
});

// GET /api/qcontract/documents
qcontractRouter.get("/documents", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "unknown";
  const result = await pool.query(
    `SELECT id, title, content_type, max_views, view_count, expires_at, revoked_at,
            require_signature, qright_id, (password_hash IS NOT NULL) as has_password,
            access_token, created_at
     FROM qcontract_documents
     WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [ownerId],
  );

  const frontendBase = (process.env.FRONTEND_URL ?? "https://aevion.kz").replace(/\/$/, "");
  res.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documents: result.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      contentType: r.content_type,
      maxViews: r.max_views,
      viewCount: r.view_count,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at,
      hasPassword: r.has_password,
      requireSignature: r.require_signature,
      qrightId: r.qright_id,
      expired: isExpired({ expires_at: r.expires_at, max_views: r.max_views, view_count: r.view_count, revoked_at: r.revoked_at }),
      shareUrl: `${frontendBase}/qcontract/v/${r.access_token}`,
      createdAt: r.created_at,
    })),
    total: result.rowCount ?? 0,
  });
});

// DELETE /api/qcontract/documents/:id
qcontractRouter.delete("/documents/:id", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "unknown";
  const result = await pool.query(
    `UPDATE qcontract_documents SET revoked_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND owner_id = $2 AND revoked_at IS NULL RETURNING id`,
    [req.params.id, ownerId],
  );

  if ((result.rowCount ?? 0) === 0) return res.status(404).json({ error: "not_found_or_already_revoked" });
  res.json({ ok: true, revokedAt: new Date().toISOString() });
});

// GET /api/qcontract/documents/:id/log
qcontractRouter.get("/documents/:id/log", async (req, res) => {
  await ensureTables();
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth_required" });

  const pool = getPool();
  const ownerId = auth.sub ?? auth.email ?? "unknown";

  const doc = await pool.query(
    `SELECT id, title, view_count, max_views, expires_at, revoked_at, require_signature, qright_id
     FROM qcontract_documents WHERE id = $1 AND owner_id = $2`,
    [req.params.id, ownerId],
  );
  if (!doc.rows[0]) return res.status(404).json({ error: "not_found" });

  const views = await pool.query(
    `SELECT id, viewer_ip, viewer_ua, viewer_email, signed_at, viewed_at
     FROM qcontract_views WHERE document_id = $1 ORDER BY viewed_at DESC LIMIT 200`,
    [req.params.id],
  );

  const d = doc.rows[0];
  res.json({
    documentId: req.params.id,
    title: d.title,
    viewCount: d.view_count,
    maxViews: d.max_views,
    expiresAt: d.expires_at,
    revokedAt: d.revoked_at,
    requireSignature: d.require_signature,
    qrightId: d.qright_id,
    expired: isExpired(d),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    views: views.rows.map((v: any) => ({
      id: v.id,
      viewerIp: v.viewer_ip,
      viewerUa: v.viewer_ua,
      viewerEmail: v.viewer_email,
      signedAt: v.signed_at,
      viewedAt: v.viewed_at,
    })),
  });
});

// POST /api/qcontract/view/:token — record view + return content
qcontractRouter.post("/view/:token", async (req, res) => {
  await ensureTables();
  const pool = getPool();
  const { password, viewerEmail } = req.body as { password?: string; viewerEmail?: string };

  const result = await pool.query(
    `SELECT id, title, content, content_type, password_hash, max_views,
            view_count, expires_at, revoked_at, require_signature, qright_id
     FROM qcontract_documents WHERE access_token = $1`,
    [req.params.token],
  );
  const doc = result.rows[0];
  if (!doc) return res.status(404).json({ error: "document_not_found" });

  if (isExpired(doc)) return res.status(410).json({ error: "document_expired", title: doc.title });

  if (doc.password_hash) {
    if (!password) return res.status(401).json({ error: "password_required", title: doc.title });
    if (hashPassword(password) !== doc.password_hash) return res.status(403).json({ error: "wrong_password" });
  }

  if (doc.require_signature && !viewerEmail?.trim()) {
    return res.status(401).json({ error: "signature_required", title: doc.title });
  }

  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null;
  const ua = req.headers["user-agent"] ?? null;
  const signedAt = doc.require_signature && viewerEmail ? new Date().toISOString() : null;

  await pool.query(
    `INSERT INTO qcontract_views (id, document_id, viewer_ip, viewer_ua, viewer_email, signed_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), doc.id, ip, ua, viewerEmail?.trim() ?? null, signedAt],
  );
  await pool.query(
    `UPDATE qcontract_documents SET view_count = view_count + 1, updated_at = NOW() WHERE id = $1`,
    [doc.id],
  );

  const newCount = doc.view_count + 1;
  const isLastView = doc.max_views != null && newCount >= doc.max_views;

  res.json({
    title: doc.title,
    content: doc.content,
    contentType: doc.content_type,
    viewCount: newCount,
    maxViews: doc.max_views,
    expiresAt: doc.expires_at,
    qrightId: doc.qright_id,
    viewerEmail: viewerEmail?.trim() ?? null,
    selfDestructed: isLastView,
  });
});

// GET /api/qcontract/view/:token — meta only
qcontractRouter.get("/view/:token", async (req, res) => {
  await ensureTables();
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, title, content_type, max_views, view_count, expires_at, revoked_at,
            (password_hash IS NOT NULL) as has_password, require_signature, qright_id
     FROM qcontract_documents WHERE access_token = $1`,
    [req.params.token],
  );
  const doc = result.rows[0];
  if (!doc) return res.status(404).json({ error: "document_not_found" });

  res.json({
    id: doc.id,
    title: doc.title,
    contentType: doc.content_type,
    maxViews: doc.max_views,
    viewCount: doc.view_count,
    expiresAt: doc.expires_at,
    hasPassword: doc.has_password,
    requireSignature: doc.require_signature,
    qrightId: doc.qright_id,
    expired: isExpired(doc),
  });
});

// GET /api/qcontract/stats
qcontractRouter.get("/stats", async (_req, res) => {
  await ensureTables();
  try {
    const pool = getPool();
    const [docs, views, signed] = await Promise.all([
      pool.query("SELECT COUNT(*) AS n FROM qcontract_documents"),
      pool.query("SELECT COUNT(*) AS n FROM qcontract_views"),
      pool.query("SELECT COUNT(*) AS n FROM qcontract_views WHERE viewer_email IS NOT NULL"),
    ]);
    res.json({
      totalDocuments: Number(docs.rows[0]?.n ?? 0),
      totalViews: Number(views.rows[0]?.n ?? 0),
      signedViews: Number(signed.rows[0]?.n ?? 0),
    });
  } catch {
    res.json({ totalDocuments: 0, totalViews: 0, signedViews: 0 });
  }
});

// GET /api/qcontract/health
qcontractRouter.get("/health", async (_req, res) => {
  try {
    await ensureTables();
    const pool = getPool();
    const r = await pool.query("SELECT COUNT(*) AS n FROM qcontract_documents");
    res.json({ status: "ok", service: "qcontract", documents: Number(r.rows[0]?.n ?? 0) });
  } catch (err) {
    res.status(503).json({ status: "error", service: "qcontract", error: err instanceof Error ? err.message : String(err) });
  }
});
