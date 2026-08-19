#!/usr/bin/env node
/**
 * QSkyway — drift detection for the committed FAA airspace snapshot.
 *
 * The HTTP smoke exercises the real network path (it asks the live FAA feed and
 * asserts the verdict shape). What it cannot do is make the regulator disagree:
 * the interesting branches — a ceiling that moved, a cell that appeared or
 * vanished — only exist when the snapshot is stale, which is precisely the state
 * we are trying to avoid. So the comparator is exercised here against
 * constructed feed responses, on top of the committed NYC snapshot.
 *
 *   npm run smoke:airspace-freshness
 */

import { AIRSPACE_NYC } from "../src/routes/qskyway.airspace.nyc";
import { compareSnapshot, type LiveCell } from "../src/routes/qskyway.airspace.freshness";
import { airspaceContentHash, signablePayload } from "../src/routes/qskyway.airspace";
import { stableCellId } from "../src/lib/airspaceCellId";

let step = 0, failed = 0;
const assert = (cond: boolean, name: string, detail = ""): void => {
  step++;
  if (cond) console.log(`  ${String(step).padStart(2, "0")}  PASS  ${name}${detail ? "  " + detail : ""}`);
  else { failed++; console.error(`  ${String(step).padStart(2, "0")}  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
};

const snap = AIRSPACE_NYC;
// Живая ячейка приходит с ключом, выведенным из ГЕОМЕТРИИ, а не из `OBJECTID`:
// тот — номер строки в базе публикатора и меняется на каждой перепубликации. В
// отгруженном слое в `c.id` всё ещё лежит старый `faa-<OBJECTID>` (пересобирать
// его нельзя дёшево — id входит в подписываемое содержимое), и сверка это
// переживает, выводя ключ из геометрии с обеих сторон. Копировать сюда `c.id`
// значило бы проверять контракт, которого больше нет.
const asLive = (): LiveCell[] =>
  snap.cells.map((c) => ({ id: stableCellId(c), ceilingFt: c.ceilingFt, effective: c.effective }));

console.log(`QSkyway airspace freshness smoke — snapshot ${snap.effective}, ${snap.cells.length} cells\n`);

// identical feed → up to date
const same = compareSnapshot(snap, asLive());
assert(same.upToDate === true && same.cellsAdded === 0 && same.cellsRemoved === 0 && same.cellsChanged === 0,
  "identical feed reports up to date");
assert(same.publishedEffective === snap.effective, "published edition read back from the feed", `${same.publishedEffective}`);

// a ceiling that moved → drift, counted as a change (not an add/remove)
const moved = asLive();
moved[0] = { ...moved[0], ceilingFt: moved[0].ceilingFt === 400 ? 300 : 400 };
const movedDiff = compareSnapshot(snap, moved);
assert(movedDiff.upToDate === false && movedDiff.cellsChanged === 1 && movedDiff.cellsAdded === 0 && movedDiff.cellsRemoved === 0,
  "a changed ceiling is detected as drift", `changed=${movedDiff.cellsChanged}`);

// a cell the regulator withdrew → removal
const withdrawn = asLive().slice(1);
const withdrawnDiff = compareSnapshot(snap, withdrawn);
assert(withdrawnDiff.upToDate === false && withdrawnDiff.cellsRemoved === 1 && withdrawnDiff.cellsAdded === 0,
  "a withdrawn cell is detected", `removed=${withdrawnDiff.cellsRemoved}`);

// a newly published cell → addition
const extended = [...asLive(), // Новая ячейка — новый участок неба, а не новый номер строки.
  { id: stableCellId({ minLat: 41.5, minLon: -73.1, airportIcao: "KHPN" }), ceilingFt: 200, effective: snap.effective }];
const extendedDiff = compareSnapshot(snap, extended);
assert(extendedDiff.upToDate === false && extendedDiff.cellsAdded === 1 && extendedDiff.cellsRemoved === 0,
  "a newly published cell is detected", `added=${extendedDiff.cellsAdded}`);

// a pure reissue (new effective date, same ceilings) must NOT be reported as drift:
// crying wolf on every republication trains everyone to ignore the warning.
const reissued = asLive().map((c) => ({ ...c, effective: "9/3/2026" }));
const reissuedDiff = compareSnapshot(snap, reissued);
assert(reissuedDiff.upToDate === true, "a reissue with identical ceilings is not drift");
assert(reissuedDiff.publishedEffective === "9/3/2026", "reissue still surfaces the newer edition date", `${reissuedDiff.publishedEffective}`);

// the signed payload must cover what routing obeys, and nothing localized
const payload = signablePayload(snap);
assert(/^[\x20-\x7e]*$/.test(payload), "signable payload is pure ASCII (survives any JSON escaping)");
assert(payload.includes(String(snap.cells[0].ceilingFt)) && payload.includes(snap.effective),
  "signable payload carries ceilings and the edition");
assert(!payload.includes("Реальные") && !payload.includes("регулятора"),
  "signable payload excludes localized prose");

// hashing is stable and order-independent (the feed does not promise an order)
const shuffled: typeof snap = { ...snap, cells: [...snap.cells].reverse() };
assert(airspaceContentHash(shuffled) === airspaceContentHash(snap),
  "content hash is independent of feed ordering");
const tampered: typeof snap = { ...snap, cells: snap.cells.map((c, i) => (i === 0 ? { ...c, ceilingFt: c.ceilingFt + 100 } : c)) };
assert(airspaceContentHash(tampered) !== airspaceContentHash(snap),
  "content hash changes when a ceiling is tampered with");

console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"}  (${step} checks)`);
process.exit(failed === 0 ? 0 : 1);
