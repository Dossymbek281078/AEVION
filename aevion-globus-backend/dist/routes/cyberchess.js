import { Router } from "express";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Chess } from "chess.js";
export const cyberchessRouter = Router();
let prisma = null;
function getPrisma() {
    if (prisma)
        return prisma;
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL || typeof DATABASE_URL !== "string") {
        throw new Error("DATABASE_URL is missing or not a string. Check .env");
    }
    const pool = new Pool({ connectionString: DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
    return prisma;
}
function ensureString(v) {
    if (typeof v === "string")
        return v;
    return String(v ?? "");
}
function computeQRightContentHash(input) {
    const raw = JSON.stringify({
        title: input.title,
        description: input.description,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
        kind: input.kind,
    });
    return crypto.createHash("sha256").update(raw).digest("hex");
}
function computeQRightSignature(contentHash) {
    const SIGN_SECRET = process.env.QSIGN_SECRET || "dev-qsign-secret-change-me-in-prod";
    return crypto
        .createHmac("sha256", SIGN_SECRET)
        .update(JSON.stringify({ contentHash }))
        .digest("hex");
}
cyberchessRouter.post("/players", async (req, res) => {
    try {
        const { name } = req.body || {};
        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ error: "name is required" });
        }
        const prisma = getPrisma();
        const created = await prisma.cyberPlayer.create({
            data: { name: name.trim() },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(500).json({ error: "DB error", details: e?.message });
    }
});
cyberchessRouter.get("/players", async (_req, res) => {
    try {
        const prisma = getPrisma();
        const players = await prisma.cyberPlayer.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json({ items: players, total: players.length });
    }
    catch (e) {
        res.status(500).json({ error: "DB error", details: e?.message });
    }
});
cyberchessRouter.post("/games", async (req, res) => {
    try {
        const { whitePlayerId, blackPlayerId } = req.body || {};
        const wp = ensureString(whitePlayerId);
        const bp = ensureString(blackPlayerId);
        if (!wp || !bp)
            return res.status(400).json({ error: "players required" });
        if (wp === bp) {
            return res.status(400).json({ error: "whitePlayerId != blackPlayerId required" });
        }
        const prisma = getPrisma();
        const white = await prisma.cyberPlayer.findUnique({ where: { id: wp } });
        const black = await prisma.cyberPlayer.findUnique({ where: { id: bp } });
        if (!white || !black)
            return res.status(404).json({ error: "Player not found" });
        const chess = new Chess();
        const created = await prisma.cyberGame.create({
            data: {
                whitePlayerId: wp,
                blackPlayerId: bp,
                fen: chess.fen(),
                status: "in_progress",
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(500).json({ error: "DB error", details: e?.message });
    }
});
cyberchessRouter.get("/games/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!id)
            return res.status(400).json({ error: "id is required" });
        const prisma = getPrisma();
        const game = await prisma.cyberGame.findUnique({
            where: { id },
            include: {
                whitePlayer: true,
                blackPlayer: true,
                moves: { orderBy: { ply: "asc" } },
            },
        });
        if (!game)
            return res.status(404).json({ error: "Game not found", id });
        res.json({
            game,
            moves: game.moves,
            totalMoves: game.moves.length,
        });
    }
    catch (e) {
        res.status(500).json({ error: "DB error", details: e?.message });
    }
});
cyberchessRouter.post("/games/:id/moves", async (req, res) => {
    try {
        const { id } = req.params;
        if (!id)
            return res.status(400).json({ error: "id is required" });
        const { uci, san } = req.body || {};
        const hasUci = typeof uci === "string" && uci.trim().length >= 4;
        const hasSan = typeof san === "string" && san.trim().length > 0;
        if (!hasUci && !hasSan) {
            return res.status(400).json({ error: "Provide either uci or san" });
        }
        const prisma = getPrisma();
        const game = await prisma.cyberGame.findUnique({
            where: { id },
        });
        if (!game)
            return res.status(404).json({ error: "Game not found", id });
        const chess = new Chess(game.fen);
        let move = null;
        let uciToStore = null;
        if (hasUci) {
            const raw = uci.trim();
            const from = raw.slice(0, 2);
            const to = raw.slice(2, 4);
            const promotionChar = raw.length >= 5 ? raw.charAt(4).toLowerCase() : "";
            const promotion = promotionChar === "q" ||
                promotionChar === "r" ||
                promotionChar === "b" ||
                promotionChar === "n"
                ? promotionChar
                : undefined;
            const moveOptions = {
                from,
                to,
            };
            if (promotion)
                moveOptions.promotion = promotion;
            move = chess.move(moveOptions);
            uciToStore = raw;
        }
        else if (hasSan) {
            move = chess.move(san.trim());
            if (!move)
                return res.status(400).json({ error: "Illegal move" });
            // chess.js can expose from/to, but we keep san-only store for MVP.
            uciToStore = null;
        }
        if (!move)
            return res.status(400).json({ error: "Illegal move" });
        const nextFen = chess.fen();
        let status = "in_progress";
        if (chess.isCheckmate && chess.isCheckmate())
            status = "checkmate";
        else if (chess.isDraw && chess.isDraw())
            status = "draw";
        else if (chess.isStalemate && chess.isStalemate())
            status = "stalemate";
        else if (chess.isGameOver && chess.isGameOver())
            status = "game_over";
        const nextPly = (await prisma.cyberMove.count({ where: { gameId: id } })) + 1;
        // Сохраняем ход; fenAfter и san — для простого восстановления состояния.
        await prisma.cyberMove.create({
            data: {
                gameId: id,
                ply: nextPly,
                san: move.san || null,
                uci: uciToStore,
                fenAfter: nextFen,
            },
        });
        const updatedGame = await prisma.cyberGame.update({
            where: { id },
            data: {
                fen: nextFen,
                status,
            },
        });
        // Proof-of-play: сохраняем подписанное “доказательство хода” в QRightObject.
        // Это позволит потом проверять ход через QSign и отличаться от обычных chess-сайтов.
        const proofTitle = `CyberChess:${id}:ply:${nextPly}`;
        const proofKind = "cyberchess";
        const proofDescObj = {
            gameId: id,
            ply: nextPly,
            uci: uciToStore,
            san: move.san || null,
            fenAfter: nextFen,
        };
        const proofDescription = JSON.stringify(proofDescObj);
        const contentHash = computeQRightContentHash({
            title: proofTitle,
            description: proofDescription,
            kind: proofKind,
            ownerName: "",
            ownerEmail: "",
        });
        const signature = computeQRightSignature(contentHash);
        try {
            await prisma.qRightObject.create({
                data: {
                    title: proofTitle,
                    description: proofDescription,
                    kind: proofKind,
                    contentHash,
                    ownerName: null,
                    ownerEmail: null,
                    ownerUserId: null,
                    signature,
                },
            });
        }
        catch (e) {
            // Если proof уже есть (повторный вызов), просто игнорируем.
            if (typeof e?.message === "string" &&
                e.message.includes("Unique constraint")) {
                // noop
            }
            else {
                throw e;
            }
        }
        res.json({
            game: updatedGame,
            move: {
                ply: nextPly,
                san: move.san || null,
                uci: uciToStore,
                fenAfter: nextFen,
            },
        });
    }
    catch (e) {
        res.status(500).json({ error: "DB error", details: e?.message });
    }
});
//# sourceMappingURL=cyberchess.js.map