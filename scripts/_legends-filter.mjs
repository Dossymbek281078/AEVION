// Pre-filter PGN: keep only games where a known star (Kasparov / Fischer /
// Karpov) plays, overwrite Elo headers with their peak rating on the star's
// side and a 2400 proxy on the opponent's side. Used to boost the top tail
// of the FIDE calibration corpus.

import { readFileSync, writeFileSync } from "node:fs";

// FIDE rating timelines for each star (approximate from FIDE historical lists).
// Used to tag each game with the star's actual rating at the time of play
// instead of a flat peak — single-value Elo on hundreds of rows leaves the
// target with no variance and inflates GM RMSE (see the super-peak commit).
const RATING_TIMELINE = {
  Kasparov: {
    1985: 2700, 1986: 2740, 1987: 2740, 1988: 2750, 1989: 2775,
    1990: 2800, 1991: 2800, 1992: 2820, 1993: 2840, 1994: 2815, 1995: 2820,
  },
  Fischer: {
    1968: 2720, 1969: 2740, 1970: 2760, 1971: 2780, 1972: 2785,
  },
  Karpov: {
    1975: 2705, 1976: 2715, 1977: 2715, 1978: 2725, 1979: 2735,
    1980: 2725, 1981: 2700, 1982: 2720, 1983: 2710, 1984: 2705, 1985: 2720,
  },
};

const STARS = [
  { lastname: "Kasparov", file: "C:/Users/user/AppData/Local/Temp/kasparov.pgn" },
  { lastname: "Fischer",  file: "C:/Users/user/AppData/Local/Temp/fischer.pgn"  },
  { lastname: "Karpov",   file: "C:/Users/user/AppData/Local/Temp/karpov.pgn"   },
];

const out = [];
let total = 0, kept = 0;
const perStarKept = {};

for (const star of STARS) {
  perStarKept[star.lastname] = 0;
  const timeline = RATING_TIMELINE[star.lastname];
  const validYears = Object.keys(timeline).map(Number);
  const yearMin = Math.min(...validYears);
  const yearMax = Math.max(...validYears);
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
    if (year < yearMin || year > yearMax) continue;
    const starInWhite = w[1].includes(star.lastname);
    const starInBlack = b[1].includes(star.lastname);
    if (!starInWhite && !starInBlack) continue;

    // Per-year rating from timeline. Each year gets its own Elo so the
    // 400+ resulting rows span ~150 Elo of variance instead of all being
    // pinned at one peak value.
    const starElo = String(timeline[year]);
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
