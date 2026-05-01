/* AEVION P2P friend play.

   Real-time chess between two browsers — no AEVION backend needed.
   Uses PeerJS (https://peerjs.com) loaded from CDN, which provides:
   - A free public broker for WebRTC signalling (0.peerjs.com)
   - Easy peer-to-peer DataChannel API on top of native RTCPeerConnection

   How it works:
   1. Host clicks "Создать комнату" → we new Peer() with a random short ID,
      build a shareable URL like /cyberchess?room=ABC123&color=w&tc=5+0
   2. Friend opens that URL → we new Peer() and connect(host.id), and
      take the OPPOSITE colour automatically.
   3. After "open" event on the data channel, both sides flip into "playing".
   4. Each move is sent: { t:"mv", uci:"e2e4", san:"e4", at:Date.now() }
   5. Optional ping/pong messages keep latency visible.

   Falls back gracefully if PeerJS CDN is blocked: returns status:"error".
*/

"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// PeerJS types — minimal, we only use what we need
type DataConnection = {
  on: (ev: string, cb: (...args: any[]) => void) => void;
  send: (data: any) => void;
  close: () => void;
  open: boolean;
  peer: string;
};
type PeerInstance = {
  id: string | null;
  on: (ev: string, cb: (...args: any[]) => void) => void;
  connect: (peerId: string, opts?: any) => DataConnection;
  destroy: () => void;
  destroyed?: boolean;
};
type PeerCtor = new (id?: string, opts?: any) => PeerInstance;

declare global { interface Window { Peer?: PeerCtor } }

const PEERJS_CDN = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
let peerLoadPromise: Promise<PeerCtor> | null = null;

function loadPeerJs(): Promise<PeerCtor> {
  if (typeof window === "undefined") return Promise.reject(new Error("server"));
  if (window.Peer) return Promise.resolve(window.Peer);
  if (peerLoadPromise) return peerLoadPromise;
  peerLoadPromise = new Promise<PeerCtor>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PEERJS_CDN;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => {
      if (window.Peer) resolve(window.Peer);
      else reject(new Error("PeerJS loaded but window.Peer missing"));
    };
    s.onerror = () => reject(new Error("CDN unreachable — PeerJS не загрузился"));
    document.head.appendChild(s);
  });
  return peerLoadPromise;
}

/** Friendly short room ID — 6 chars, easy to read aloud */
export function genRoomId(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const ROOM_ID_PREFIX = "aevion-cc-";

export type P2PStatus = "idle" | "loading" | "open" | "connecting" | "connected" | "closed" | "error";
export type P2PMessage =
  | { t: "mv"; uci: string; san: string; at: number }
  | { t: "draw-offer" }
  | { t: "draw-accept" }
  | { t: "resign" }
  | { t: "rematch" }
  | { t: "rematch-accept" }
  | { t: "ping"; at: number }
  | { t: "pong"; at: number }
  | { t: "chat"; text: string; at: number }
  | { t: "hello"; name?: string };

export function useP2P(opts: {
  /** Called for each message received from peer. */
  onMessage: (msg: P2PMessage) => void;
  /** Optional display name to send in hello. */
  myName?: string;
}) {
  const [status, setStatus] = useState<P2PStatus>("idle");
  const [myPeerId, setMyPeerId] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [latencyMs, setLatencyMs] = useState<number>(0);

  const peerRef = useRef<PeerInstance | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const onMessageRef = useRef(opts.onMessage);
  useEffect(() => { onMessageRef.current = opts.onMessage; }, [opts.onMessage]);

  /** Wire up listeners for a fresh connection */
  const wireConnection = useCallback((conn: DataConnection) => {
    connRef.current = conn;
    conn.on("open", () => {
      setStatus("connected");
      try { conn.send({ t: "hello", name: opts.myName || "AEVION player" }); } catch {}
    });
    conn.on("data", (raw: any) => {
      const msg = raw as P2PMessage;
      if (!msg || typeof msg.t !== "string") return;
      if (msg.t === "ping") {
        try { conn.send({ t: "pong", at: msg.at }); } catch {}
        return;
      }
      if (msg.t === "pong") {
        setLatencyMs(Date.now() - msg.at);
        return;
      }
      onMessageRef.current?.(msg);
    });
    conn.on("close", () => setStatus("closed"));
    conn.on("error", (e: any) => { setErrorMsg(String(e?.message || e || "WebRTC error")); setStatus("error"); });
  }, [opts.myName]);

  /** Create as host — returns the room ID to share */
  const host = useCallback(async (roomId: string) => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const Peer = await loadPeerJs();
      const fullId = ROOM_ID_PREFIX + roomId;
      const peer = new Peer(fullId, { debug: 0 });
      peerRef.current = peer;
      peer.on("open", (id: string) => {
        setMyPeerId(id.replace(ROOM_ID_PREFIX, ""));
        setStatus("open");
      });
      peer.on("connection", (conn: DataConnection) => wireConnection(conn));
      peer.on("error", (e: any) => {
        const m = String(e?.message || e || "");
        if (/unavailable-id|taken/i.test(m)) setErrorMsg("Эта комната уже занята — придумай другой код");
        else if (/network|server|disconnected/i.test(m)) setErrorMsg("Сервер сигналинга недоступен");
        else setErrorMsg(m);
        setStatus("error");
      });
    } catch (e: any) {
      setErrorMsg(String(e?.message || e));
      setStatus("error");
    }
  }, [wireConnection]);

  /** Join existing room by ID */
  const join = useCallback(async (roomId: string) => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const Peer = await loadPeerJs();
      const peer = new Peer(undefined, { debug: 0 });
      peerRef.current = peer;
      peer.on("open", (id: string) => {
        setMyPeerId(id);
        setStatus("connecting");
        const conn = peer.connect(ROOM_ID_PREFIX + roomId, { reliable: true, serialization: "json" });
        wireConnection(conn);
      });
      peer.on("error", (e: any) => {
        const m = String(e?.message || e || "");
        if (/peer-unavailable|could not connect/i.test(m)) setErrorMsg("Комната не найдена. Проверь код у создателя.");
        else if (/network|server|disconnected/i.test(m)) setErrorMsg("Сервер сигналинга недоступен");
        else setErrorMsg(m);
        setStatus("error");
      });
    } catch (e: any) {
      setErrorMsg(String(e?.message || e));
      setStatus("error");
    }
  }, [wireConnection]);

  const send = useCallback((msg: P2PMessage) => {
    const conn = connRef.current;
    if (!conn || !conn.open) return false;
    try { conn.send(msg); return true; } catch { return false; }
  }, []);

  const disconnect = useCallback(() => {
    try { connRef.current?.close(); } catch {}
    try { peerRef.current?.destroy(); } catch {}
    connRef.current = null;
    peerRef.current = null;
    setStatus("idle");
    setMyPeerId("");
    setErrorMsg("");
  }, []);

  // Periodic ping for latency, only while connected
  useEffect(() => {
    if (status !== "connected") return;
    const t = setInterval(() => {
      const conn = connRef.current;
      if (conn?.open) { try { conn.send({ t: "ping", at: Date.now() }); } catch {} }
    }, 4000);
    return () => clearInterval(t);
  }, [status]);

  // Cleanup on unmount
  useEffect(() => () => disconnect(), [disconnect]);

  return { status, myPeerId, errorMsg, latencyMs, host, join, send, disconnect };
}
