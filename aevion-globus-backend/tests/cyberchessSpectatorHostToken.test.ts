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

const app = express();
app.use(express.json());
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
