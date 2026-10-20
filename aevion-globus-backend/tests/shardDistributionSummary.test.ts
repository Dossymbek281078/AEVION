/*
 * 🔴 20.10.2026: /api/pipeline/verify/cert-503ab5d6bfc504a7 отдавал realDistributed:true при
 * serverHasCopy:true у долей 2 и 3 и пороге 2 — ложь для интеграторов. Тест держит правду
 * на тех же данных, что отдаёт прод для cert-503 (distributed_v2), и на legacy.
 */
import { describe, test, expect } from "vitest";
import { shardDistributionSummary } from "../src/lib/shamir/shardDistribution";

const V2 = [
  { index: 1, place: "Author Vault", held: "author (offline download)", serverHasCopy: false },
  { index: 2, place: "AEVION Platform", held: "our DB", serverHasCopy: true },
  { index: 3, place: "Public Witness", held: "content-addressed CID", serverHasCopy: true, cid: "bagu…", cidValid: true },
];
const LEGACY = [
  { index: 1, place: "Author Vault (legacy — stored locally)", held: "our DB", serverHasCopy: true },
  { index: 2, place: "AEVION Platform", held: "our DB", serverHasCopy: true },
  { index: 3, place: "Witness Node (legacy — stored locally)", held: "our DB", serverHasCopy: true },
];

describe("shardDistributionSummary: правда о том, может ли сервер собрать ключ один", () => {
  test("cert-503 (distributed_v2, порог 2, у сервера 2 из 3) → realDistributed=false, serverCanReconstructAlone=true, вне сервера 1", () => {
    const s = shardDistributionSummary({ policy: "distributed_v2", threshold: 2, locations: V2, witness: { cid: "bagu…" } });
    expect(s.realDistributed).toBe(false);
    expect(s.serverCanReconstructAlone).toBe(true);
    expect(s.shardsOutsideServer).toBe(1);
    expect(s.serverCopies).toBe(2);
    expect(s.threshold).toBe(2);
    expect(s.locations).toBe(V2);
    expect(s.witness).toEqual({ cid: "bagu…" });
  });
  test("legacy_all_local (3 из 3 у сервера) → false, true, вне сервера 0", () => {
    const s = shardDistributionSummary({ policy: "legacy_all_local", threshold: 2, locations: LEGACY, witness: null });
    expect(s.realDistributed).toBe(false);
    expect(s.serverCanReconstructAlone).toBe(true);
    expect(s.shardsOutsideServer).toBe(0);
  });
  test("КОНТРОЛЬ: если бы свидетель жил вне сервера (serverHasCopy=false у доли 3) — realDistributed=true, сервер один НЕ соберёт", () => {
    const outside = V2.map((l) => (l.index === 3 ? { ...l, serverHasCopy: false } : l));
    const s = shardDistributionSummary({ policy: "distributed_v2", threshold: 2, locations: outside, witness: null });
    expect(s.realDistributed).toBe(true);
    expect(s.serverCanReconstructAlone).toBe(false);
    expect(s.shardsOutsideServer).toBe(2);
  });
  test("порог из базы: null/0/«мусор» → 2; порог 3 при 2 копиях → сервер один не соберёт", () => {
    expect(shardDistributionSummary({ policy: "distributed_v2", threshold: null, locations: V2, witness: null }).threshold).toBe(2);
    expect(shardDistributionSummary({ policy: "distributed_v2", threshold: "x", locations: V2, witness: null }).threshold).toBe(2);
    const s3 = shardDistributionSummary({ policy: "distributed_v2", threshold: 3, locations: V2, witness: null });
    expect(s3.realDistributed).toBe(true);
    expect(s3.serverCanReconstructAlone).toBe(false);
  });
});
