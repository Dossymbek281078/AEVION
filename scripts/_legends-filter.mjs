// Pre-filter PGN: keep only games where a known star (Kasparov / Fischer /
// Karpov) plays, overwrite Elo headers with their peak rating on the star's
// side and a 2400 proxy on the opponent's side. Used to boost the top tail
// of the FIDE calibration corpus.

import { readFileSync, writeFileSync } from "node:fs";

// Year-of-peak windows: keep games only when the star was actually at the
// rating we're tagging. Outside the window the synthetic peak Elo is pure
// noise (13-year-old Kasparov in 1976 played at ~2000, not 2851).
const STARS = [
  { lastname: "Kasparov", peak: 2851, yearMin: 1985, yearMax: 1995, file: "C:/Users/user/AppData/Local/Temp/kasparov.pgn" },
  { lastname: "Fischer",  peak: 2785, yearMin: 1968, yearMax: 1972, file: "C:/Users/user/AppData/Local/Temp/fischer.pgn"  },
  { lastname: "Karpov",   peak: 2780, yearMin: 1975, yearMax: 1985, file: "C:/Users/user/AppData/Local/Temp/karpov.pgn"   },
];

const out = [];
let total = 0, kept = 0;
const perStarKept = {};

for (const star of STARS) {
  perStarKept[star.lastname] = 0;
  const raw = readFileSync(star.file, "utf8");
  const games = raw.replace(/\r\n/g, "\n").split(/\n(?=\[Event )/);
  for (const g of games) {
    total++;
    const w = g.match(/\[White "([^"]+)"\]/);
    const b = g.match(/\[Black "([^"]+)"\]/);
    const r = g.match(/\[Result "([^"]+)"\]/);
    const d = g.match(/\[Date "(\d{4})/);
    if (!w || !b || !r || !d) continue;
    const year = parseInt(d[1], 10);
    if (year < star.yearMin || year > star.yearMax) continue;
    const starInWhite = w[1].includes(star.lastname);
    const starInBlack = b[1].includes(star.lastname);
    if (!starInWhite && !starInBlack) continue;

    const starElo = String(star.peak);
    const oppElo = "2400";

    let mod = g;
    // WhiteElo
    if (/\[WhiteElo "[^"]*"\]/.test(mod)) {
      mod = mod.replace(/\[WhiteElo "[^"]*"\]/, `[WhiteElo "${starInWhite ? starElo : oppElo}"]`);
    } else {
      mod = mod.replace(/(\[Result "[^"]*"\])/, `$1\n[WhiteElo "${starInWhite ? starElo : oppElo}"]`);
    }
    // BlackElo
    if (/\[BlackElo "[^"]*"\]/.test(mod)) {
      mod = mod.replace(/\[BlackElo "[^"]*"\]/, `[BlackElo "${starInBlack ? starElo : oppElo}"]`);
    } else {
      mod = mod.replace(/(\[WhiteElo "[^"]*"\])/, `$1\n[BlackElo "${starInBlack ? starElo : oppElo}"]`);
    }

    out.push(mod);
    kept++;
    perStarKept[star.lastname]++;
  }
}

writeFileSync("C:/Users/user/AppData/Local/Temp/legends.pgn", out.join("\n\n"));
console.log(`scanned: ${total}  kept: ${kept}`);
for (const [name, n] of Object.entries(perStarKept)) {
  console.log(`  ${name}: ${n}`);
}
