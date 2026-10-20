process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const звать = (router, path, query = {}, params = {}) => new Promise((ok) => {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods.get);
  const res = { statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { ok({ code: this.statusCode, b }); return this; } };
  layer.route.stack[layer.route.stack.length - 1].handle({ query, params, headers: {}, get() {} }, res, (e) => ok({ code: "next", b: String(e) }));
});
(async () => {
  const { ensureVoiceOfEarthTables } = require("./lib/ensureVoiceOfEarthTables.js");
  await ensureVoiceOfEarthTables(require("./lib/dbPool.js").getPool()).catch((e) => console.log("ensure", e.message));
  const { voiceOfEarthRouter } = require("./routes/voiceOfEarth.js");
  const s = await звать(voiceOfEarthRouter, "/stats");
  console.log("stats", s.code, JSON.stringify({ total: s.b.total, examples: s.b.examples, byLanguage: s.b.byLanguage, top: (s.b.topTracks || []).length }));
  const t = await звать(voiceOfEarthRouter, "/tracks", { limit: "30" });
  console.log("tracks", t.code, t.b.backend, "всего", t.b.items?.length, "примеров", t.b.items?.filter((x) => x.example).length);
  process.exit(0);
})();
