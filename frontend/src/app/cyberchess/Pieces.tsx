/* AEVION CyberChess piece sets.

   Two sets shipped:
   1. "Cburnett" — classic Wikimedia set (CC BY-SA 3.0), kept for users who prefer it.
   2. "AEVION" — our own geometric set, original SVG paths, designed for the AEVION
      brand. Recognizable silhouettes, modern flat-with-soft-3D look, friendlier
      than Cburnett on small/mobile boards. Free-to-use under MIT (project licence).
*/

import React from "react";

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type PieceColor = "w" | "b";
export type PieceSet = "cburnett" | "aevion";

type Props = { type: PieceType; color: PieceColor; size?: number | string; set?: PieceSet };

/* ─────────── Cburnett (kept) ─────────── */

const PIECES_CBURNETT: Record<string, string> = {
  wp: `<g style="opacity:1;fill:#fff;stroke:#000;stroke-width:1.5;stroke-linecap:round"><path d="M 22,9 C 19.79,9 18,10.79 18,13 C 18,13.89 18.29,14.71 18.78,15.38 C 16.83,16.5 15.5,18.59 15.5,21 C 15.5,23.03 16.44,24.84 17.91,26.03 C 14.91,27.09 10.5,31.58 10.5,39.5 L 33.5,39.5 C 33.5,31.58 29.09,27.09 26.09,26.03 C 27.56,24.84 28.5,23.03 28.5,21 C 28.5,18.59 27.17,16.5 25.22,15.38 C 25.71,14.71 26,13.89 26,13 C 26,10.79 24.21,9 22,9 z" style="stroke-linejoin:miter"/></g>`,
  wn: `<g style="opacity:1;fill:#fff;fill-rule:evenodd;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:#fff"/><path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,5.5 16.5,4.5 16.5,4.5 C 18.5,4.5 18.5,7.5 18.5,7.5 L 18.5,8.5 C 18.5,8.5 20.5,9 22.5,10 L 24,18 z" style="fill:#fff"/><path d="M 9.5,25.5 A 0.5,0.5 0 1 1 8.5,25.5 A 0.5,0.5 0 1 1 9.5,25.5 z" style="fill:#000;stroke:#000"/><path d="M 15,15.5 A 0.5,1.5 0 1 1 14,15.5 A 0.5,1.5 0 1 1 15,15.5 z" style="fill:#000;stroke:#000;stroke-width:1.49999988;stroke-dasharray:none" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)"/></g>`,
  wb: `<g style="opacity:1;fill:none;fill-rule:evenodd;fill-opacity:1;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><g style="fill:#fff;stroke:#000;stroke-linecap:butt"><path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z"/><path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z"/><path d="M 25,8 A 2.5,2.5 0 1 1 20,8 A 2.5,2.5 0 1 1 25,8 z"/></g><path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" style="fill:none;stroke:#000;stroke-linejoin:miter"/></g>`,
  wr: `<g style="opacity:1;fill:#fff;fill-opacity:1;fill-rule:evenodd;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" style="stroke-linecap:butt"/><path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" style="stroke-linecap:butt"/><path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" style="stroke-linecap:butt"/><path d="M 34,14 L 31,17 L 14,17 L 11,14"/><path d="M 31,17 L 31,29.5 L 14,29.5 L 14,17" style="stroke-linecap:butt;stroke-linejoin:miter"/><path d="M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5"/><path d="M 11,14 L 34,14" style="fill:none;stroke:#000;stroke-linejoin:miter"/></g>`,
  wq: `<g style="fill:#fff;stroke:#000;stroke-width:1.5;stroke-linejoin:round"><path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z"/><path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z"/><path d="M 11.5,30 C 15,29 30,29 33.5,30 M 12,33.5 C 18,32.5 27,32.5 33,33.5" style="fill:none"/><circle cx="6" cy="12" r="2"/><circle cx="14" cy="9" r="2"/><circle cx="22.5" cy="8" r="2"/><circle cx="31" cy="9" r="2"/><circle cx="39" cy="12" r="2"/></g>`,
  wk: `<g style="fill:none;fill-opacity:1;fill-rule:evenodd;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 22.5,11.63 L 22.5,6" style="fill:none;stroke:#000;stroke-linejoin:miter"/><path d="M 20,8 L 25,8" style="fill:none;stroke:#000;stroke-linejoin:miter"/><path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" style="fill:#fff;stroke:#000;stroke-linecap:butt;stroke-linejoin:miter"/><path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 19,16 9.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37 z" style="fill:#fff;stroke:#000"/><path d="M 12.5,30 C 18,27 27,27 32.5,30 M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5 M 12.5,37 C 18,34 27,34 32.5,37" style="fill:none;stroke:#000"/></g>`,
  bp: `<g style="opacity:1;fill:#000;stroke:#000;stroke-width:1.5;stroke-linecap:round"><path d="M 22,9 C 19.79,9 18,10.79 18,13 C 18,13.89 18.29,14.71 18.78,15.38 C 16.83,16.5 15.5,18.59 15.5,21 C 15.5,23.03 16.44,24.84 17.91,26.03 C 14.91,27.09 10.5,31.58 10.5,39.5 L 33.5,39.5 C 33.5,31.58 29.09,27.09 26.09,26.03 C 27.56,24.84 28.5,23.03 28.5,21 C 28.5,18.59 27.17,16.5 25.22,15.38 C 25.71,14.71 26,13.89 26,13 C 26,10.79 24.21,9 22,9 z" style="stroke-linejoin:miter"/></g>`,
  bn: `<g style="opacity:1;fill:#000;fill-rule:evenodd;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:#000"/><path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,5.5 16.5,4.5 16.5,4.5 C 18.5,4.5 18.5,7.5 18.5,7.5 L 18.5,8.5 C 18.5,8.5 20.5,9 22.5,10 L 24,18 z" style="fill:#000"/><path d="M 9.5,25.5 A 0.5,0.5 0 1 1 8.5,25.5 A 0.5,0.5 0 1 1 9.5,25.5 z" style="fill:#fff;stroke:#fff"/><path d="M 15,15.5 A 0.5,1.5 0 1 1 14,15.5 A 0.5,1.5 0 1 1 15,15.5 z" style="fill:#fff;stroke:#fff;stroke-width:1.49999988;stroke-dasharray:none" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)"/><path d="M 24.55,10.4 L 24.1,11.85 L 24.6,12 C 27.75,13 30.25,14.49 32.5,18.75 C 34.75,23.01 35.75,29.06 35.25,39 L 35.2,39.5 L 37.45,39.5 L 37.5,39 C 38,28.94 36.62,22.15 34.25,17.66 C 31.88,13.17 28.46,11.02 25.06,10.5 L 24.55,10.4 z" style="fill:#fff;stroke:none"/></g>`,
  bb: `<g style="opacity:1;fill:none;fill-rule:evenodd;fill-opacity:1;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><g style="fill:#000;stroke:#000;stroke-linecap:butt"><path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z"/><path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z"/><path d="M 25,8 A 2.5,2.5 0 1 1 20,8 A 2.5,2.5 0 1 1 25,8 z"/></g><path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" style="fill:none;stroke:#fff;stroke-linejoin:miter"/></g>`,
  br: `<g style="opacity:1;fill:#000;fill-opacity:1;fill-rule:evenodd;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" style="stroke-linecap:butt"/><path d="M 12.5,32 L 14,29.5 L 31,29.5 L 32.5,32 L 12.5,32 z" style="stroke-linecap:butt"/><path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" style="stroke-linecap:butt"/><path d="M 14,29.5 L 14,16.5 L 31,16.5 L 31,29.5 L 14,29.5 z" style="stroke-linecap:butt;stroke-linejoin:miter"/><path d="M 14,16.5 L 11,14 L 34,14 L 31,16.5 L 14,16.5 z" style="stroke-linecap:butt"/><path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 L 11,14 z" style="stroke-linecap:butt"/><path d="M 12,35.5 L 33,35.5 L 33,35.5" style="fill:none;stroke:#fff;stroke-width:1;stroke-linejoin:miter"/><path d="M 13,31.5 L 32,31.5" style="fill:none;stroke:#fff;stroke-width:1;stroke-linejoin:miter"/><path d="M 14,29.5 L 31,29.5" style="fill:none;stroke:#fff;stroke-width:1;stroke-linejoin:miter"/><path d="M 14,16.5 L 31,16.5" style="fill:none;stroke:#fff;stroke-width:1;stroke-linejoin:miter"/><path d="M 11,14 L 34,14" style="fill:none;stroke:#fff;stroke-width:1;stroke-linejoin:miter"/></g>`,
  bq: `<g style="fill:#000;stroke:#000;stroke-width:1.5;stroke-linejoin:round"><path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z" style="stroke-linecap:butt;fill:#000"/><path d="m 9,26 c 0,2 1.5,2 2.5,4 1,1.5 1,1 0.5,3.5 -1.5,1 -1,2.5 -1,2.5 -1.5,1.5 0,2.5 0,2.5 6.5,1 16.5,1 23,0 0,0 1.5,-1 0,-2.5 0,0 0.5,-1.5 -1,-2.5 -0.5,-2.5 -0.5,-2 0.5,-3.5 1,-2 2.5,-2 2.5,-4 -8.5,-1.5 -18.5,-1.5 -27,0 z" style="stroke-linecap:butt"/><path d="M 11,38.5 A 35,35 1 0 0 34,38.5" style="fill:none; stroke:#000;stroke-linecap:butt"/><path d="M 11,29 A 35,35 1 0 1 34,29" style="fill:none;stroke:#fff"/><path d="M 12.5,31.5 L 32.5,31.5" style="fill:none;stroke:#fff"/><path d="M 11.5,34.5 A 35,35 1 0 0 33.5,34.5" style="fill:none;stroke:#fff"/><path d="M 10.5,37.5 A 35,35 1 0 0 34.5,37.5" style="fill:none;stroke:#fff"/><circle cx="6" cy="12" r="2" style="fill:#000"/><circle cx="14" cy="9" r="2" style="fill:#000"/><circle cx="22.5" cy="8" r="2" style="fill:#000"/><circle cx="31" cy="9" r="2" style="fill:#000"/><circle cx="39" cy="12" r="2" style="fill:#000"/></g>`,
  bk: `<g style="fill:none;fill-opacity:1;fill-rule:evenodd;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"><path d="M 22.5,11.63 L 22.5,6" style="fill:none;stroke:#000;stroke-linejoin:miter"/><path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" style="fill:#000;fill-opacity:1;stroke-linecap:butt;stroke-linejoin:miter"/><path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 19,16 9.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37 z" style="fill:#000;stroke:#000"/><path d="M 20,8 L 25,8" style="fill:none;stroke:#000;stroke-linejoin:miter"/><path d="M 32,29.5 C 32,29.5 40.5,25.5 38.03,19.85 C 34.15,14 25,18 22.5,24.5 L 22.5,26.6 L 22.5,24.5 C 20,18 10.85,14 6.97,19.85 C 4.5,25.5 13,29.5 13,29.5" style="fill:none;stroke:#fff"/><path d="M 12.5,30 C 18,27 27,27 32.5,30 M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5 M 12.5,37 C 18,34 27,34 32.5,37" style="fill:none;stroke:#fff"/></g>`,
};

/* ─────────── AEVION (original geometric set) ───────────
   Design language:
   - Strong, single-fill silhouettes — clear at any size
   - Each piece sits on a wide oval base (consistent ground line ≈ y=40)
   - Subtle inner highlight via gradient stop — gives "3D-ish" cleanliness
   - White: warm off-white #f8fafc with deep slate stroke
   - Black: deep navy #1e293b with slate-light stroke for inner detail
   Paths designed from scratch; no derivative of Cburnett / Lichess. */

// Path templates use {{F}} = fill, {{S}} = stroke, {{D}} = darker accent
function aevionTemplate(type: PieceType): string {
  switch (type) {
    case "p":
      return `
<ellipse cx="22.5" cy="40" rx="11" ry="2.5" fill="{{D}}" opacity="0.3"/>
<path d="M22.5 8 a4.5 4.5 0 1 0 0.001 0 z M16 17 q-1.6 1.7 -1.6 4.2 q0 2.8 2.1 4.6 q-3.6 2.1 -5.4 5.7 q-1.6 3.2 -1.7 7 h25.2 q-0.1 -3.8 -1.7 -7 q-1.8 -3.6 -5.4 -5.7 q2.1 -1.8 2.1 -4.6 q0 -2.5 -1.6 -4.2 z" fill="{{F}}" stroke="{{S}}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M16 17 q-1.6 1.7 -1.6 4.2 q0 2.8 2.1 4.6" fill="none" stroke="{{H}}" stroke-width="0.9" opacity="0.55"/>`;
    case "r":
      return `
<ellipse cx="22.5" cy="40" rx="13" ry="2.5" fill="{{D}}" opacity="0.3"/>
<path d="M9 8 v6 h5 v-3 h4 v3 h4 v-3 h4 v3 h4 v-3 h5 v6 z" fill="{{F}}" stroke="{{S}}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M11 14 q-0.5 1.5 0.5 3 l1.5 2 v9 l-1.5 2 q-0.8 1.2 -0.5 2.5 v5 h22 v-5 q0.3 -1.3 -0.5 -2.5 l-1.5 -2 v-9 l1.5 -2 q1 -1.5 0.5 -3 z" fill="{{F}}" stroke="{{S}}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M11 14 v3 h23 v-3" fill="none" stroke="{{H}}" stroke-width="0.9" opacity="0.5"/>
<path d="M14 28 h17" fill="none" stroke="{{H}}" stroke-width="0.9" opacity="0.5"/>`;
    case "b":
      return `
<ellipse cx="22.5" cy="40" rx="12" ry="2.5" fill="{{D}}" opacity="0.3"/>
<circle cx="22.5" cy="8" r="2.4" fill="{{F}}" stroke="{{S}}" stroke-width="1.2"/>
<path d="M22.5 11.5 q-7 4 -7 12.5 q0 4 3 6.2 q-2.5 1.5 -3 4 q-0.5 1.7 0 3 q-1.2 0.5 -2 1.5 q-0.8 1 -0.5 2.3 h19 q0.3 -1.3 -0.5 -2.3 q-0.8 -1 -2 -1.5 q0.5 -1.3 0 -3 q-0.5 -2.5 -3 -4 q3 -2.2 3 -6.2 q0 -8.5 -7 -12.5 z" fill="{{F}}" stroke="{{S}}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M22.5 16 v8 M19 20 h7" stroke="{{H}}" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/>
<path d="M15.5 33 h14" stroke="{{H}}" stroke-width="0.9" opacity="0.55"/>`;
    case "n":
      return `
<ellipse cx="22.5" cy="40" rx="13" ry="2.5" fill="{{D}}" opacity="0.3"/>
<path d="M14.5 9.5 q-1.6 1.4 -1.6 3.4 q0 1.5 0.7 2.7 q-3.5 4 -4.6 8.7 q-1 4.2 0.4 7.4 l2.6 0.5 l1.5 -2.5 l-1 3.4 l2 0.6 l-1 3 v3 h-2 v3 h25 v-3 q0 -10.5 -2 -16.5 q-2.4 -7.5 -8.5 -10.7 q1 -1.4 0.4 -3 q-0.7 -1.7 -2.6 -2 q-1.5 -0.2 -2.7 0.7 q-1 -1.6 -2.7 -1.6 q-1.5 0 -2.5 0.9 z" fill="{{F}}" stroke="{{S}}" stroke-width="1.2" stroke-linejoin="round"/>
<circle cx="14.5" cy="14" r="0.9" fill="{{S}}"/>
<path d="M22 16 q3 1 5 4 q2.5 4 3.2 9" fill="none" stroke="{{H}}" stroke-width="0.9" opacity="0.55"/>`;
    case "q":
      return `
<ellipse cx="22.5" cy="40" rx="14" ry="2.5" fill="{{D}}" opacity="0.3"/>
<circle cx="6" cy="11" r="1.8" fill="{{F}}" stroke="{{S}}" stroke-width="1"/>
<circle cx="14" cy="8" r="1.8" fill="{{F}}" stroke="{{S}}" stroke-width="1"/>
<circle cx="22.5" cy="7" r="1.8" fill="{{F}}" stroke="{{S}}" stroke-width="1"/>
<circle cx="31" cy="8" r="1.8" fill="{{F}}" stroke="{{S}}" stroke-width="1"/>
<circle cx="39" cy="11" r="1.8" fill="{{F}}" stroke="{{S}}" stroke-width="1"/>
<path d="M6 13 l3 13 q14 -2 27 0 l3 -13 l-7 11 l-1 -13 l-5 13 l-3.5 -14 l-3.5 14 l-5 -13 l-1 13 z" fill="{{F}}" stroke="{{S}}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M9 26 q1.5 2 2.5 3.8 q0.7 1.6 0 3.2 q-1.5 0.8 -1 2.6 q-1.2 0.6 -1.5 1.8 q-0.3 1.1 0.5 1.9 q12 1.2 25 0 q0.8 -0.8 0.5 -1.9 q-0.3 -1.2 -1.5 -1.8 q0.5 -1.8 -1 -2.6 q-0.7 -1.6 0 -3.2 q1 -1.8 2.5 -3.8 q-13.5 -2 -27 0 z" fill="{{F}}" stroke="{{S}}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M11 30.5 h23 M11 33.5 h23" fill="none" stroke="{{H}}" stroke-width="0.8" opacity="0.55"/>`;
    case "k":
      return `
<ellipse cx="22.5" cy="40" rx="14" ry="2.5" fill="{{D}}" opacity="0.3"/>
<path d="M22.5 4 v3 h-3 v2.5 h3 v4 h2.5 v-4 h3 v-2.5 h-3 v-3 z" fill="{{F}}" stroke="{{S}}" stroke-width="1" stroke-linejoin="round"/>
<path d="M22.5 16 q-1.5 -3 -3 -3 q-2.4 0 -3 3 q-0.7 3 1.5 6.5 q1.7 2.5 4.5 2.5 q2.8 0 4.5 -2.5 q2.2 -3.5 1.5 -6.5 q-0.6 -3 -3 -3 q-1.5 0 -3 3 z" fill="{{F}}" stroke="{{S}}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M11 25 q-3.5 5 -1 9 q3 4 11 4 v-2 q-7 0 -9.5 -3 q-1.5 -3 1 -6.5 q3 -2.5 6.5 -1.5 q2 0.5 3.5 3 q1.5 -2.5 3.5 -3 q3.5 -1 6.5 1.5 q2.5 3.5 1 6.5 q-2.5 3 -9.5 3 v2 q8 0 11 -4 q2.5 -4 -1 -9 q-4 -4.5 -8.5 -3 q-2 0.7 -3 2.5 q-1 -1.8 -3 -2.5 q-4.5 -1.5 -8.5 3 z" fill="{{F}}" stroke="{{S}}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M11.5 38 q11 1.5 22 0 q0 -2 -1 -2 q-10 1 -20 0 q-1 0 -1 2 z" fill="{{F}}" stroke="{{S}}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M14 32 q8.5 -2 17 0" fill="none" stroke="{{H}}" stroke-width="0.9" opacity="0.55"/>`;
  }
}

function aevionInner(type: PieceType, color: PieceColor): string {
  // Rich palette per side, derived from AEVION brand
  const palette = color === "w"
    ? { F: "#f8fafc", S: "#1e293b", H: "#334155", D: "#0f172a" }   // white piece
    : { F: "#1e293b", S: "#020617", H: "#94a3b8", D: "#020617" };  // black piece
  return aevionTemplate(type)
    .replace(/\{\{F\}\}/g, palette.F)
    .replace(/\{\{S\}\}/g, palette.S)
    .replace(/\{\{H\}\}/g, palette.H)
    .replace(/\{\{D\}\}/g, palette.D);
}

/* ─────────── public ─────────── */

export default function Piece({ type, color, size = "100%", set = "aevion" }: Props) {
  const inner = set === "cburnett"
    ? PIECES_CBURNETT[`${color}${type}`]
    : aevionInner(type, color);
  if (!inner) return null;
  return (
    <svg
      viewBox="0 0 45 45"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", pointerEvents: "none" }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
