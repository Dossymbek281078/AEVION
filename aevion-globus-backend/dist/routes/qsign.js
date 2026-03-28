"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qsignRouter = void 0;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
exports.qsignRouter = (0, express_1.Router)();
// Секрет подписи (пока MVP)
const SIGN_SECRET = process.env.QSIGN_SECRET || "dev-qsign-secret";
function signPayload(payload) {
    const raw = JSON.stringify(payload);
    return crypto_1.default.createHmac("sha256", SIGN_SECRET).update(raw).digest("hex");
}
// Подписать JSON
exports.qsignRouter.post("/sign", (req, res) => {
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
exports.qsignRouter.post("/verify", (req, res) => {
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
