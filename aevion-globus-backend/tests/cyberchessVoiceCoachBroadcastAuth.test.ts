import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

// POST /api/cyberchess-voice-coach/broadcast — 2026-08-12.
//
// This is the endpoint the streamer's own page calls to have the AI comment on
// the position; it then pushes the result into the spectator stream. It took a
// gameId and nothing else, so anyone who opened a viewer link could make the
// commentary speak into someone else's broadcast — and every such call runs an
// LLM request and a text-to-speech synthesis, billed to us. Cost abuse and
// impersonation through the same door.
//
// It now requires the stream's host secret, the same one publish hands out.

import spectatorRouter from "../src/routes/cyberchessSpectator";
import voiceCoachRouter from "../src/routes/cyberchessVoiceCoach";

const app = express();
app.use(express.json());
app.use("/api/cyberchess-spectator", spectatorRouter);
app.use("/api/cyberchess-voice-coach", voiceCoachRouter);

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

let n = 0;

async function startStream() {
  const gameId = `vc-game-${Date.now().toString(36)}-${++n}`;
  const res = await request(app)
    .post("/api/cyberchess-spectator/publish")
    .send({ gameId, fen: FEN, hist: [], hostName: "Streamer" });
  expect(res.status).toBe(200);
  return { gameId, token: res.body.hostToken as string };
}

describe("only the broadcaster can make the AI speak into their stream", () => {
  test("without the secret the call is refused", async () => {
    const { gameId } = await startStream();

    const res = await request(app)
      .post("/api/cyberchess-voice-coach/broadcast")
      .send({ gameId, fen: FEN, moveNumber: 1, llm: true, tts: true });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_the_host");
  });

  test("a wrong secret is refused too", async () => {
    const { gameId } = await startStream();

    const res = await request(app)
      .post("/api/cyberchess-voice-coach/broadcast")
      .set("x-host-token", "not-the-real-one")
      .send({ gameId, fen: FEN, moveNumber: 1 });

    expect(res.status).toBe(403);
  });

  test("the refusal happens before any paid work is started", async () => {
    // The point of the gate is not only who speaks but what it costs: an LLM
    // call plus a speech synthesis per request. A 403 that arrived after them
    // would fix the impersonation and leave the bill.
    const { gameId } = await startStream();
    const started = Date.now();

    const res = await request(app)
      .post("/api/cyberchess-voice-coach/broadcast")
      .send({ gameId, fen: FEN, moveNumber: 1, llm: true, tts: true });

    expect(res.status).toBe(403);
    // No provider round-trip could fit in this; if one ever does happen before
    // the check, this is the assertion that notices.
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test("an unknown game still answers not_found, not forbidden", async () => {
    // A game that was never published has no owner to check against, and the
    // caller should learn which of the two problems they have.
    const res = await request(app)
      .post("/api/cyberchess-voice-coach/broadcast")
      .send({ gameId: "no-such-game-here", fen: FEN, moveNumber: 1 });

    expect(res.status).toBe(404);
  });
});
