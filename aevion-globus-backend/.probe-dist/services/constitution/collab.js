"use strict";
/**
 * Constitution — real-time collab WebSocket.
 *
 * Per-artifact rooms. Clients connect with:
 *   ws://host/api/constitution/collab?artifact=<id>&name=<display-name>
 *
 * Message protocol (all JSON):
 *   client → server:
 *     { type: "slider",  key: SliderKey, value: 0-100 }
 *     { type: "cursor",  key: SliderKey | null }     // hover signal
 *     { type: "ping" }
 *   server → client (broadcast to OTHER room members):
 *     { type: "presence", peers: [{id, name, color}] }
 *     { type: "slider",   from: id, name, color, key, value }
 *     { type: "cursor",   from: id, name, color, key }
 *     { type: "leave",    from: id }
 *
 * Lean room model: Map<artifactId, Set<Peer>>. Server keeps no state
 * beyond presence — no CRDT, no history. If clients diverge they can
 * reconcile next time the server-of-record artifact is fetched.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachConstitutionCollab = attachConstitutionCollab;
const ws_1 = require("ws");
const node_crypto_1 = require("node:crypto");
const MAX_PAYLOAD = 8 * 1024;
const MAX_PEERS_PER_ROOM = 24;
const PEER_COLORS = [
    "#22d3ee", "#f472b6", "#10b981", "#fbbf24",
    "#a78bfa", "#fb923c", "#34d399", "#60a5fa",
];
const rooms = new Map();
function broadcast(room, except, payload) {
    const data = JSON.stringify(payload);
    for (const p of room) {
        if (p === except)
            continue;
        try {
            p.ws.send(data);
        }
        catch { /* ignore — closed */ }
    }
}
function presence(room) {
    return {
        type: "presence",
        peers: Array.from(room).map((p) => ({ id: p.id, name: p.name, color: p.color })),
    };
}
function safeJson(raw) {
    try {
        const j = JSON.parse(raw);
        return j && typeof j === "object" ? j : null;
    }
    catch {
        return null;
    }
}
const SLIDER_KEYS = new Set([
    "floor", "ruleOfLaw", "rotation", "transparency",
    "multiStatus", "skinInGame", "polycentricity", "positiveSum",
]);
function attachConstitutionCollab(server, path = "/api/constitution/collab") {
    const wss = new ws_1.WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
    server.on("upgrade", (req, socket, head) => {
        try {
            const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
            if (reqUrl.pathname !== path)
                return;
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit("connection", ws, req, reqUrl);
            });
        }
        catch {
            try {
                socket.destroy();
            }
            catch { /* ignore */ }
        }
    });
    wss.on("connection", (ws, _req, reqUrl) => {
        const artifactId = reqUrl.searchParams.get("artifact") || "";
        const rawName = reqUrl.searchParams.get("name") || "anon";
        if (!artifactId || artifactId.length > 64) {
            try {
                ws.close(1008, "missing_artifact_id");
            }
            catch { }
            return;
        }
        let room = rooms.get(artifactId);
        if (!room) {
            room = new Set();
            rooms.set(artifactId, room);
        }
        if (room.size >= MAX_PEERS_PER_ROOM) {
            try {
                ws.close(1008, "room_full");
            }
            catch { }
            return;
        }
        const peer = {
            id: (0, node_crypto_1.randomUUID)().slice(0, 8),
            name: rawName.slice(0, 32).replace(/[^a-zA-Zа-яА-Я0-9 _.-]/g, "") || "anon",
            color: PEER_COLORS[room.size % PEER_COLORS.length],
            ws,
            artifactId,
        };
        room.add(peer);
        // Send current presence to the new peer
        try {
            ws.send(JSON.stringify({ type: "presence-self", self: { id: peer.id, name: peer.name, color: peer.color } }));
            ws.send(JSON.stringify(presence(room)));
        }
        catch { /* ignore */ }
        // Broadcast updated presence to others
        broadcast(room, peer, presence(room));
        ws.on("message", (raw) => {
            if (!room)
                return;
            const buf = typeof raw === "string" ? raw : raw.toString("utf8");
            const msg = safeJson(buf);
            if (!msg)
                return;
            const type = typeof msg.type === "string" ? msg.type : "";
            if (type === "ping") {
                try {
                    ws.send(JSON.stringify({ type: "pong" }));
                }
                catch { }
                return;
            }
            if (type === "slider") {
                const key = typeof msg.key === "string" ? msg.key : "";
                const value = typeof msg.value === "number" ? msg.value : NaN;
                if (!SLIDER_KEYS.has(key) || !Number.isFinite(value) || value < 0 || value > 100)
                    return;
                broadcast(room, peer, {
                    type: "slider",
                    from: peer.id,
                    name: peer.name,
                    color: peer.color,
                    key,
                    value: Math.round(value),
                });
                return;
            }
            if (type === "cursor") {
                const key = typeof msg.key === "string" ? msg.key : null;
                if (key !== null && !SLIDER_KEYS.has(key))
                    return;
                broadcast(room, peer, {
                    type: "cursor",
                    from: peer.id,
                    name: peer.name,
                    color: peer.color,
                    key,
                });
                return;
            }
            // Unknown — silently ignore
        });
        const handleClose = () => {
            if (!room)
                return;
            room.delete(peer);
            if (room.size === 0) {
                rooms.delete(artifactId);
            }
            else {
                broadcast(room, peer, { type: "leave", from: peer.id });
                broadcast(room, peer, presence(room));
            }
        };
        ws.on("close", handleClose);
        ws.on("error", handleClose);
    });
    return wss;
}
