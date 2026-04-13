import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { verifyToken } from "./auth";

export const mediaRouter = Router();

let prisma: PrismaClient | null = null;

function getPrisma() {
  if (prisma) return prisma;

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL || typeof DATABASE_URL !== "string") {
    throw new Error("DATABASE_URL is missing or not a string. Check .env");
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
  return prisma;
}

function getAuthPayload(req: any) {
  const header = req?.headers?.authorization;
  const m = typeof header === "string" ? header.match(/^Bearer (.+)$/) : null;
  const token = m?.[1];
  if (!token) return null;
  return verifyToken(token);
}

function signContentHash(contentHash: string) {
  const SIGN_SECRET = process.env.QSIGN_SECRET;
  if (!SIGN_SECRET || typeof SIGN_SECRET !== "string") {
    throw new Error("QSIGN_SECRET is missing. Check backend .env");
  }
  return crypto
    .createHmac("sha256", SIGN_SECRET)
    .update(JSON.stringify({ contentHash }))
    .digest("hex");
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl.trim());
  if (!m) throw new Error("Invalid dataUrl");
  const mimeType = m[1];
  const base64 = m[2];
  if (typeof mimeType !== "string" || typeof base64 !== "string") {
    throw new Error("Invalid dataUrl");
  }
  return { mimeType, base64 };
}

function inferExt(fileName: string, mimeType: string) {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot > -1 && dot < lower.length - 1) {
    return lower.slice(dot + 1);
  }

  if (mimeType === "audio/wav") return "wav";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "video/mp4") return "mp4";
  return "bin";
}

function uploadsDir() {
  const dir = path.join(process.cwd(), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// POST /api/media/submissions
// JSON body:
// {
//   type: "music" | "cinema",
//   title: string,
//   description: string,
//   file: { fileName: string, mimeType: string, dataUrl: string }
// }
mediaRouter.post("/submissions", async (req, res) => {
  try {
    const payload = getAuthPayload(req);
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    const { type, title, description, file } = req.body || {};

    const t = typeof type === "string" ? type : "";
    if (t !== "music" && t !== "cinema") {
      return res.status(400).json({ error: "type must be music or cinema" });
    }
    const ttl = typeof title === "string" ? title.trim() : "";
    const desc = typeof description === "string" ? description.trim() : "";

    if (!ttl || !desc) {
      return res.status(400).json({ error: "title and description are required" });
    }

    const fileName = typeof file?.fileName === "string" ? file.fileName : "upload.bin";
    const dataUrl = typeof file?.dataUrl === "string" ? file.dataUrl : "";
    const inputMimeType =
      typeof file?.mimeType === "string" ? file.mimeType : "application/octet-stream";

    if (!dataUrl) return res.status(400).json({ error: "dataUrl is required" });

    const parsed = parseDataUrl(dataUrl);
    const mimeType = parsed.mimeType || inputMimeType;
    const buffer = Buffer.from(parsed.base64, "base64");

    // Резерв: защитим от совсем больших payload'ов (MVP).
    if (buffer.byteLength > 15 * 1024 * 1024) {
      return res.status(400).json({ error: "file too large (max 15MB)" });
    }

    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // 1) Дедупликация прав: если файл уже загружали, QRight переиспользуем.
    const prisma = getPrisma();

    const qrightKind = t;

    const qright = await prisma.qRightObject.upsert({
      where: { contentHash: fileHash },
      create: {
        title: ttl,
        description: desc,
        kind: qrightKind,
        contentHash: fileHash,
        ownerUserId: payload.sub,
        ownerName: payload.email.split("@")[0] || null,
        ownerEmail: payload.email,
      },
      update: {
        title: ttl,
        description: desc,
        kind: qrightKind,
      },
    });

    // 2) Подписываем QRight (signature хранит HMAC contentHash).
    let signedQright = qright;
    if (!qright.signature) {
      const signature = signContentHash(fileHash);
      signedQright = await prisma.qRightObject.update({
        where: { id: qright.id },
        data: { signature },
      });
    }

    // 3) Создаём/переиспользуем MediaSubmission (уникально по qrightObjectId).
    const dir = uploadsDir();
    const ext = inferExt(fileName, mimeType);
    const safeId = signedQright.id.replace(/-/g, "");
    const outFileName = `${t}_${safeId}.${ext}`;
    const outPath = path.join(dir, outFileName);

    // Файл может быть уже сохранён при повторной загрузке.
    if (!fs.existsSync(outPath)) {
      fs.writeFileSync(outPath, buffer);
    }

    const fileUrl = `/uploads/${outFileName}`;

    const submission = await prisma.mediaSubmission.upsert({
      where: { qrightObjectId: signedQright.id },
      create: {
        type: t,
        title: ttl,
        description: desc,
        fileUrl,
        mimeType,
        fileHash,
        qrightObjectId: signedQright.id,
        ownerUserId: payload.sub,
      },
      update: {
        title: ttl,
        description: desc,
        mimeType,
        fileUrl,
        fileHash,
        ownerUserId: payload.sub,
      },
    });

    res.status(201).json(submission);
  } catch (e: any) {
    res.status(500).json({ error: "Upload error", details: e?.message });
  }
});

// GET /api/media/submissions?type=music|cinema
mediaRouter.get("/submissions", async (req, res) => {
  try {
    const t = typeof req.query.type === "string" ? req.query.type : "";
    const where: any = {};
    if (t === "music" || t === "cinema") where.type = t;

    const prisma = getPrisma();
    const submissions = await prisma.mediaSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        votes: {
          select: { rating: true },
        },
      },
    });

    const items = submissions.map((s) => {
      const votes = s.votes.map((v) => v.rating);
      const votesCount = votes.length;
      const avgRating =
        votesCount === 0 ? 0 : votes.reduce((a, b) => a + b, 0) / votesCount;
      return {
        id: s.id,
        type: s.type,
        title: s.title,
        description: s.description,
        fileUrl: s.fileUrl,
        mimeType: s.mimeType,
        createdAt: s.createdAt,
        votesCount,
        avgRating,
      };
    });

    res.json({ items, total: items.length });
  } catch (e: any) {
    res.status(500).json({ error: "DB error", details: e?.message });
  }
});

// POST /api/media/submissions/:id/vote
mediaRouter.post("/submissions/:id/vote", async (req, res) => {
  try {
    const payload = getAuthPayload(req);
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    const id = req.params.id;
    const ratingRaw = req.body?.rating;
    const rating =
      typeof ratingRaw === "number" ? ratingRaw : Number(ratingRaw ?? NaN);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating must be 1..5" });
    }

    const prisma = getPrisma();

    const submission = await prisma.mediaSubmission.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!submission) return res.status(404).json({ error: "Not found" });

    await prisma.mediaVote.upsert({
      where: { submissionId_userId: { submissionId: id, userId: payload.sub } },
      create: { submissionId: id, userId: payload.sub, rating },
      update: { rating },
    });

    const votes = await prisma.mediaVote.findMany({
      where: { submissionId: id },
      select: { rating: true },
    });
    const votesCount = votes.length;
    const avgRating =
      votesCount === 0 ? 0 : votes.reduce((a, b) => a + b.rating, 0) / votesCount;

    res.json({ submissionId: id, votesCount, avgRating, myRating: rating });
  } catch (e: any) {
    res.status(500).json({ error: "Vote error", details: e?.message });
  }
});

