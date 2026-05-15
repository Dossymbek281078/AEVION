#!/usr/bin/env node
/**
 * HealthAI smoke test — quick regression check для основных endpoints.
 *
 * Usage:
 *   BASE=http://localhost:4000 node scripts/healthai-smoke.js
 *
 * По умолчанию BASE = http://localhost:4000. Скрипт создаёт временный
 * профиль, пишет лог, тянет trends/risks/score/hydration и проверяет
 * базовые инварианты. Exit code != 0 — что-то поломалось.
 *
 * Не требует БД: backend сам падает в in-memory mode если DATABASE_URL
 * не сконфигурирован.
 */

const BASE = (process.env.BASE || "http://localhost:4000").replace(/\/$/, "");
const PREFIX = "/api/healthai";

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  const tag = ok ? "OK  " : "FAIL";
  const msg = detail ? `${name} :: ${detail}` : name;
  console.log(`[${tag}] ${msg}`);
}

async function req(method, path, body) {
  const r = await fetch(`${BASE}${PREFIX}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await r.json();
  } catch {
    /* ignore */
  }
  return { status: r.status, ok: r.ok, data };
}

async function main() {
  console.log(`HealthAI smoke test → ${BASE}${PREFIX}`);
  console.log("");

  // 1) /health.
  {
    const r = await req("GET", "/health");
    check(
      "health endpoint",
      r.ok && r.data && r.data.status === "ok",
      `status=${r.status}, persistence=${r.data && r.data.persistence}`,
    );
  }

  // 2) Create profile.
  let profileId = null;
  {
    const r = await req("POST", "/profile", {
      age: 32,
      sex: "M",
      heightCm: 178,
      weightKg: 75,
      conditions: [],
      allergies: [],
      medications: [],
      memberLabel: "smoke-test",
    });
    check(
      "create profile",
      r.ok && r.data && r.data.profile && r.data.profile.id,
      `status=${r.status}, id=${r.data && r.data.profile && r.data.profile.id}`,
    );
    profileId = r.data && r.data.profile && r.data.profile.id;
    if (r.data && typeof r.data.bmi === "number") {
      const expectedBmi = Math.round((75 / (1.78 * 1.78)) * 10) / 10;
      check(
        "bmi calculation",
        Math.abs(r.data.bmi - expectedBmi) < 0.5,
        `got=${r.data.bmi}, expected=~${expectedBmi}`,
      );
    }
  }

  if (!profileId) {
    console.log("Cannot continue without profileId — aborting.");
    process.exit(1);
  }

  // 3) GET profile back.
  {
    const r = await req("GET", `/profile/${profileId}`);
    check(
      "fetch profile",
      r.ok && r.data && r.data.profile && r.data.profile.id === profileId,
      `status=${r.status}`,
    );
  }

  // 4) Symptom check.
  {
    const r = await req("POST", "/check", {
      profileId,
      symptoms: ["головная боль", "усталость"],
      severity: 5,
      durationH: 24,
      notes: "smoke test",
    });
    check(
      "symptom check",
      r.ok && r.data && Array.isArray(r.data.matched) && r.data.disclaimer,
      `status=${r.status}, matched=${r.data && r.data.matched && r.data.matched.length}`,
    );
  }

  // 5) Log a few days backwards.
  const today = new Date();
  for (let i = 0; i < 5; i++) {
    const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
    const iso = d.toISOString().slice(0, 10);
    const r = await req("POST", "/log", {
      profileId,
      date: iso,
      sleepHours: 7 + (i % 2),
      moodScore: 6 + (i % 3),
      weightKg: 75,
      waterL: 2.2,
      exerciseMin: 30,
    });
    check(
      `log day ${iso}`,
      r.ok && r.data && r.data.log,
      `status=${r.status}`,
    );
  }

  // 6) Trends.
  {
    const r = await req("GET", `/trends/${profileId}`);
    const avg7d = r.data && r.data.avg7d;
    check(
      "trends has 7d averages",
      r.ok && avg7d && avg7d.sleep != null && avg7d.mood != null,
      `sleep=${avg7d && avg7d.sleep}, mood=${avg7d && avg7d.mood}, streak=${r.data && r.data.streak}`,
    );
  }

  // 7) Risks.
  {
    const r = await req("GET", `/risks/${profileId}`);
    check(
      "risks endpoint",
      r.ok && r.data && Array.isArray(r.data.risks) && typeof r.data.bmi === "number",
      `status=${r.status}, total=${r.data && r.data.summary && r.data.summary.total}`,
    );
  }

  // 8) Hydration (new).
  {
    const r = await req("GET", `/hydration/${profileId}`);
    const okShape =
      r.ok &&
      r.data &&
      typeof r.data.targetL === "number" &&
      typeof r.data.targetBaseL === "number" &&
      Array.isArray(r.data.tips) &&
      ["on-track", "below", "well-below", "no-data"].includes(r.data.status);
    check(
      "hydration endpoint",
      okShape,
      `target=${r.data && r.data.targetL}L, avg7d=${r.data && r.data.avgWater7d}L, status=${r.data && r.data.status}`,
    );
    // Для 75кг ожидаем targetBase ≈ 2.625L (+ возможно exercise bonus).
    if (r.data && typeof r.data.targetBaseL === "number") {
      check(
        "hydration target reasonable",
        r.data.targetBaseL >= 1.5 && r.data.targetBaseL <= 5,
        `targetBaseL=${r.data.targetBaseL}`,
      );
    }
  }

  // 9) Wellness Score (new).
  {
    const r = await req("GET", `/score/${profileId}`);
    const okShape =
      r.ok &&
      r.data &&
      typeof r.data.score === "number" &&
      r.data.score >= 0 &&
      r.data.score <= 100 &&
      ["excellent", "good", "fair", "low", "insufficient"].includes(r.data.band) &&
      r.data.pillars &&
      r.data.pillars.sleep &&
      r.data.pillars.mood &&
      r.data.pillars.water &&
      r.data.pillars.exercise;
    check(
      "wellness score endpoint",
      okShape,
      `score=${r.data && r.data.score}/100, band=${r.data && r.data.band}, streak=${r.data && r.data.streak}`,
    );
  }

  // 10) Cleanup (best-effort).
  {
    const r = await req("DELETE", `/profile/${profileId}`);
    check(
      "cleanup profile",
      r.ok || r.status === 404,
      `status=${r.status}`,
    );
  }

  console.log("");
  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`Result: ${passed} passed, ${failed} failed (${checks.length} total)`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Smoke test crashed:", e && e.message ? e.message : e);
  process.exit(2);
});
