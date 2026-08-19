import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Spectator streams — who is allowed to be the broadcaster. 2026-08-12.
//
// A published game is identified by a gameId that is printed in the viewer link
// the host shares around. Everything about the stream was keyed on that id and
// nothing else, so anyone who opened the link could:
//
//   * publish into the same gameId and rewrite the board every viewer is
//     watching — including sending `result`, which ends the game and files a
//     replay under whatever outcome they named;
//   * DELETE it and cut the broadcast off mid-game;
//   * post chat with `isHost: true`, a field taken straight from the body,
//     which the UI draws with a crown and the broadcaster's colour.
//
// There are no accounts, so the fix is not authentication: the first publish
// mints a secret, returns it to that publisher only, and every later action on
// the stream has to carry it.

// Imported statically: a cold dynamic import does not fit the per-test timeout.
import spectatorRouter from "../src/routes/cyberchessSpectator";

/** Адрес, с которого якобы пришёл запрос. null = как есть (петля). */
let peerAddress: string | null = null;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  if (peerAddress) {
    Object.defineProperty(req.socket, "remoteAddress", {
      value: peerAddress,
      configurable: true,
    });
  }
  next();
});
app.use("/api/cyberchess-spectator", spectatorRouter);

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FEN2 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

let n = 0;
// Идентификатор обязан подходить под GAME_ID_RE: латиница, цифры, дефис.
const freshId = () => `game-${Date.now().toString(36)}-${++n}`;

/**
 * Состояние стрима читаем через каталог: `GET /:gameId` — это SSE-поток, он не
 * завершается, и запрос к нему висит до таймаута теста.
 */
async function liveGame(gameId: string): Promise<any | undefined> {
  const list = await request(app).get("/api/cyberchess-spectator/list");
  return (list.body.games ?? []).find((g: any) => g.gameId === gameId);
}

function publish(body: Record<string, unknown>, token?: string) {
  const r = request(app).post("/api/cyberchess-spectator/publish");
  if (token) r.set("x-host-token", token);
  return r.send(body);
}

async function startStream() {
  const gameId = freshId();
  const res = await publish({ gameId, fen: FEN, hist: [], hostName: "Streamer" });
  expect(res.status).toBe(200);
  return { gameId, token: res.body.hostToken as string };
}

beforeEach(() => {
  n += 1;
  peerAddress = null;
});

describe("a stream belongs to whoever started it", () => {
  test("the first publish hands back a secret", async () => {
    const { token } = await startStream();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
  });

  test("two streams get different secrets", async () => {
    const a = await startStream();
    const b = await startStream();
    expect(a.token).not.toBe(b.token);
  });

  test("a stranger cannot rewrite the board being watched", async () => {
    const { gameId } = await startStream();

    const res = await publish({ gameId, fen: FEN2, hist: ["e4"] });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_the_host");

    expect((await liveGame(gameId))?.fen).toBe(FEN);
  });

  test("a stranger cannot end the game with an invented result", async () => {
    const { gameId } = await startStream();

    const res = await publish({ gameId, fen: FEN, hist: [], result: "0-1" });

    expect(res.status).toBe(403);
    // Still live: a refused publish must not archive a replay either.
    expect(await liveGame(gameId)).toBeDefined();
  });

  test("the host, carrying the secret, still publishes normally", async () => {
    const { gameId, token } = await startStream();

    const res = await publish({ gameId, fen: FEN2, hist: ["e4"] }, token);

    expect(res.status).toBe(200);
    expect((await liveGame(gameId))?.fen).toBe(FEN2);
  });

  test("the secret also travels in the body, for clients that cannot set headers", async () => {
    const { gameId, token } = await startStream();

    const res = await publish({ gameId, fen: FEN2, hist: ["e4"], hostToken: token });

    expect(res.status).toBe(200);
  });

  test("a wrong secret is refused", async () => {
    const { gameId } = await startStream();

    const res = await publish({ gameId, fen: FEN2, hist: ["e4"] }, "not-the-real-one");

    expect(res.status).toBe(403);
  });
});

describe("only the host can stop the broadcast", () => {
  test("a stranger's DELETE is refused and the stream stays up", async () => {
    const { gameId } = await startStream();

    const res = await request(app).delete(`/api/cyberchess-spectator/${gameId}`);

    expect(res.status).toBe(403);
    expect(await liveGame(gameId)).toBeDefined();
  });

  test("the host's DELETE works", async () => {
    const { gameId, token } = await startStream();

    const res = await request(app)
      .delete(`/api/cyberchess-spectator/${gameId}`)
      .set("x-host-token", token);

    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(true);
  });
});

describe("the crown in chat is decided by the server", () => {
  test("claiming isHost in the body earns nothing", async () => {
    const { gameId } = await startStream();

    const res = await request(app)
      .post(`/api/cyberchess-spectator/chat/${gameId}`)
      .send({ author: "Impostor", text: "слушайте меня, я ведущий", isHost: true });

    expect(res.status).toBe(200);
    // Accepted as an ordinary message — with no crown.
    expect(res.body.message.isHost).toBeUndefined();
  });

  test("the host, carrying the secret, gets the crown", async () => {
    const { gameId, token } = await startStream();

    const res = await request(app)
      .post(`/api/cyberchess-spectator/chat/${gameId}`)
      .set("x-host-token", token)
      .send({ author: "Streamer", text: "привет всем" });

    expect(res.status).toBe(200);
    expect(res.body.message.isHost).toBe(true);
  });
});

describe("viewers are never shown the secret", () => {
  test("the public view of a game does not carry it", async () => {
    const { gameId, token } = await startStream();

    expect(JSON.stringify(await liveGame(gameId))).not.toContain(token);
  });

  test("the directory does not carry it either", async () => {
    const { token } = await startStream();

    const list = await request(app).get("/api/cyberchess-spectator/list");
    expect(JSON.stringify(list.body)).not.toContain(token);
  });
});

describe("commentary is not something a viewer can put in someone's stream", () => {
  const voice = (gameId: string, token?: string) => {
    const r = request(app).post(`/api/cyberchess-spectator/voice/${gameId}`);
    if (token) r.set("x-host-token", token);
    return r.send({ text: "белые зевнули ферзя", fromHost: true });
  };

  test("an outside caller is refused", async () => {
    const { gameId } = await startStream();
    // The endpoint is internal — our own voice coach calls it over loopback —
    // but it is mounted publicly, so anyone holding the viewer link could
    // broadcast text and an audio link into the stream, marked as the host's.
    peerAddress = "203.0.113.7";
    const res = await voice(gameId);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_the_host");
  });

  test("the host, carrying the secret, may speak from outside", async () => {
    const { gameId, token } = await startStream();
    peerAddress = "203.0.113.7";
    const res = await voice(gameId, token);

    expect(res.status).toBe(200);
  });

  test("our own in-process call still works — it has no token to give", async () => {
    const { gameId } = await startStream();
    peerAddress = null; // loopback, as the voice coach calls it
    const res = await voice(gameId);

    expect(res.status).toBe(200);
  });

  test("a forwarded header cannot pass for the in-process call", async () => {
    const { gameId } = await startStream();
    peerAddress = "203.0.113.7";
    const res = await request(app)
      .post(`/api/cyberchess-spectator/voice/${gameId}`)
      .set("x-forwarded-for", "127.0.0.1")
      .send({ text: "я тут главный" });

    expect(res.status).toBe(403);
  });
});

describe("the secret does not survive into the public replay", () => {
  test("a finished game is archived without it", async () => {
    // The replay is served to anyone by gameId. The archive builds its record
    // field by field today; the day someone writes `{...game}` instead, the
    // broadcaster's secret becomes public and nothing else would notice.
    const { gameId, token } = await startStream();

    const ended = await publish(
      { gameId, fen: FEN2, hist: ["e4"], result: "1-0" },
      token,
    );
    expect(ended.status).toBe(200);

    const replay = await request(app).get(`/api/cyberchess-spectator/replays/${gameId}`);
    expect(replay.status).toBe(200);
    expect(JSON.stringify(replay.body)).not.toContain(token);
    expect(replay.body.replay.hostToken).toBeUndefined();
  });

  test("the replay directory does not carry it either", async () => {
    const { gameId, token } = await startStream();
    await publish({ gameId, fen: FEN2, hist: ["e4"], result: "1-0" }, token);

    const list = await request(app).get("/api/cyberchess-spectator/replays");
    expect(JSON.stringify(list.body)).not.toContain(token);
  });
});
