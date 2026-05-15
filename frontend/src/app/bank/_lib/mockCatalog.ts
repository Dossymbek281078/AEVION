// Single source for mock catalog strings used by royalties / ecosystem / chess
// synthesisers. Until backend ecosystem endpoints land, these drive the demo UI;
// move each block behind a real API once the corresponding endpoint ships.

import type { IPKind } from "./royalties";

export const QRIGHT_WORKS_BY_KIND: Record<IPKind, readonly string[]> = {
  music: [
    "Cosmic Journey OST",
    "Ambient Chill Vol. 3",
    "Piano Study in C Minor",
    "Synthwave Memories",
    "Jazz Café Nights",
    "Lo-fi Study Loop",
  ],
  photo: [
    "Urban Sunset",
    "Mountain Solitude",
    "Street Life Tokyo",
    "Coastal Dawn",
    "Architecture Series",
    "Night Markets",
  ],
  code: [
    "React Animation Hooks",
    "ML Tutorial Series",
    "CLI Toolkit",
    "WebGL Shader Lib",
    "API Rate Limiter",
    "Vector Search Demo",
  ],
  design: [
    "Digital Brush Pack v2",
    "Neon Grid Wallpapers",
    "Minimal UI Kit",
    "Icon Set Modern",
    "Pattern Library",
    "3D Mockup Bundle",
  ],
  writing: [
    "Startup Pitch Template",
    "Fantasy Short Story",
    "Technical Whitepaper",
    "Poetry Collection",
    "Screenplay Draft",
    "Interview Scripts",
  ],
  video: [
    "3D Character Rig",
    "Cinematic LUT Pack",
    "Stock Footage Pack",
    "Motion Graphics",
    "Short Film Director's Cut",
    "Tutorial Episode 4",
  ],
};

export const QRIGHT_FLAT_WORKS: readonly string[] = Object.values(QRIGHT_WORKS_BY_KIND).flat();

export const CHESS_TOURNAMENT_NAMES: readonly string[] = [
  "AEVION Arena",
  "Grand Swiss Open",
  "Rapid Classic Weekly",
  "Endgame Masters Cup",
  "Opening Theory Invitational",
  "Sunday Bullet Championship",
  "Blitz Marathon",
  "Classical Challenge",
  "Puzzle Rush Derby",
  "Knight's Gambit",
];

export const PLANET_TASKS: readonly string[] = [
  "Verified 5 creative works",
  "Trust Graph level 3",
  "Weekly consistency bonus",
  "Quantum Shield signature",
  "Peer review contribution",
  "Ecosystem onboarding done",
];
