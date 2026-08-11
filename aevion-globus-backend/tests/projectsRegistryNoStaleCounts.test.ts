import { describe, test, expect } from "vitest";
import { projects } from "../src/data/projects";

// Guard: the registry must not describe itself with counts — 2026-08-11.
//
// Two of its own descriptions had drifted:
//   • Globus said "реестр 29 проектов" while this very file held 41 entries;
//   • Smeta Trainer said "222 расценки" while the trainer's corpus held 500
//     (and its page was promising 499 — three places, three numbers).
//
// A count written into a description that lives INSIDE the registry goes
// stale the moment a module is added, and nothing fails when it does: the
// text still renders, it just quietly stops being true. The API already
// answers how many there are, so descriptions say what a module IS.
//
// This test is deliberately narrow. It bans counts of the things the registry
// itself enumerates (projects/modules) and of corpus sizes owned by a module
// (rates/lessons/puzzles) — not every number. "5 уровней", "12 недель",
// "Ed25519", "6 правовых рамок" are stable facts and stay allowed.

/** Words whose count belongs to a live source, never to a static string. */
const DRIFTING_NOUNS = [
  "проект",
  "модул",
  "module",
  "расцен",
  "урок",
  "пазл",
  "puzzle",
];

const COUNT_PATTERN = new RegExp(
  String.raw`\b\d[\d\s]{0,7}\+?\s*(?:${DRIFTING_NOUNS.join("|")})[а-яёa-z]*`,
  "gi",
);

/**
 * Known exception, kept explicit rather than silently excluded.
 *
 * CyberChess counts its own subsystems ("22 модуля (Tournaments/Variants/…)"),
 * which is a different thing from counting registry entries, and that module
 * belongs to another session's zone. If someone verifies or fixes it, drop
 * the id from here — the point is that the exception is visible, not that it
 * is permanent.
 */
const ALLOWED_IDS = new Set(["cyberchess"]);

describe("registry descriptions carry no counts that can drift", () => {
  test("no project describes itself with a module/project/corpus count", () => {
    const offenders: string[] = [];
    for (const p of projects) {
      if (ALLOWED_IDS.has(p.id)) continue;
      const hits = (p.description || "").match(COUNT_PATTERN);
      if (hits) offenders.push(`${p.id}: ${hits.join(", ")}`);
    }
    // A failure here is not cosmetic: it means a number is being published
    // that nothing keeps in sync with reality.
    expect(offenders).toEqual([]);
  });

  test("the two that had drifted stay clean", () => {
    const globus = projects.find((p) => p.id === "globus");
    const smeta = projects.find((p) => p.id === "smeta-trainer");
    expect(globus?.description).not.toMatch(/\d+\s*проект/i);
    expect(smeta?.description).not.toMatch(/\d+\s*расцен/i);
    // Still describing what they are, not reduced to nothing.
    expect(globus?.description).toMatch(/реестр/i);
    expect(smeta?.description).toMatch(/расценки ЭСН/i);
  });

  test("the guard does not fire on stable facts", () => {
    // Guards that over-reach get deleted, so prove this one lets normal
    // descriptions through.
    const sample = [
      "5 уровней, расценки ЭСН РК, AI-советник",
      "Ed25519 + HMAC-SHA256, 6 правовых рамок, PDF-сертификаты",
      "12-недельный протокол, 26 маркеров",
    ];
    for (const s of sample) expect(s.match(COUNT_PATTERN)).toBeNull();
  });

  test("the guard does fire on what it is meant to catch", () => {
    const bad = [
      "реестр 29 проектов, 3D-карта",
      "5 уровней, 222 расценки ЭСН РК",
      "Все живые продукты AEVION (30+ модулей)",
      "10 818 пазлов в банке",
    ];
    for (const s of bad) expect(s.match(COUNT_PATTERN)).not.toBeNull();
  });
});
