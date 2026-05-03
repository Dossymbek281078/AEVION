import { Router } from "express";
import crypto from "crypto";

export const qsignRouter = Router();

qsignRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "qsign-legacy",
    note: "v1 HMAC stub; production traffic should use /api/qsign/v2",
    timestamp: new Date().toISOString(),
  });
});

// Секрет подписи (пока MVP)
const SIGN_SECRET = process.env.QSIGN_SECRET || "dev-qsign-secret";

function signPayload(payload: unknown): string {
  const raw = JSON.stringify(payload);
  return crypto.createHmac("sha256", SIGN_SECRET).update(raw).digest("hex");
}

// Подписать JSON
qsignRouter.post("/sign", (req, res) => {
  const payload = req.body;
  const signature = signPayload(payload);

  res.json({
    payload,
    signature,
    algo: "HMAC-SHA256",
    createdAt: new Date().toISOString(),
  });
});

// Проверить подпись
qsignRouter.post("/verify", (req, res) => {
  const { payload, signature } = req.body || {};

  if (!payload || !signature) {
    return res.status(400).json({
      error: "payload and signature are required",
    });
  }

  const expected = signPayload(payload);

  res.json({
    valid: expected === signature,
    expected,
    provided: signature,
  });
});
