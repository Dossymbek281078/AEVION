// Pre-filter PGN: keep only games where a known star (Kasparov / Fischer /
// Karpov) plays, overwrite Elo headers with their peak rating on the star's
// side and a 2400 proxy on the opponent's side. Used to boost the top tail
// of the FIDE calibration corpus.

import { readFileSync, writeFileSync } from "node:fs";

const STARS = [
  { lastname: "Kasparov", peak: 2851, file: "C:/Users/user/AppData/Local/Temp/kasparov.pgn" },
  { lastname: "Fischer",  peak: 2785, file: "C:/Users/user/AppData/Local/Temp/fischer.pgn"  },
  { lastname: "Karpov",   peak: 2780, file: "C:/Users/user/AppData/Local/Temp/karpov.pgn"   },
];

const out = [];
let total = 0, kept = 0;

for (const star of STARS) {
  const raw = readFileSync(star.file, "utf8");
  const games = raw.replace(/\r\n/g, "\n").split(/\n(?=\[Event )/);
  for (const g of games) {
    total++;
    const w = g.match(/\[White "([^"]+)"\]/);
    const b = g.match(/\[Black "([^"]+)"\]/);
    const r = g.match(/\[Result "([^"]+)"\]/);
    if (!w || !b || !r) continue;
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
  }
}

writeFileSync("C:/Users/user/AppData/Local/Temp/legends.pgn", out.join("\n\n"));
console.log(`scanned: ${total}  kept: ${kept}`);
