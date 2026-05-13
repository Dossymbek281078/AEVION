// chessSounds.ts — 40 procedural sound presets + silent mode for CyberChess.
// Все звуки синтезируются через Web Audio API. Никаких ассетов не качается —
// пользователь может выбрать любой из 41 варианта (20 классических + 20 нетиповых
// + молчание) прямо в Settings, и фигуры начинают щёлкать по-новому без перезагрузки.

export type ChessSoundEvent = "move" | "capture" | "check" | "castle" | "premove" | "cancel" | "x";

type Voice =
  | { kind: "noise"; lp: number; hp: number; dur: number; vol: number; decay?: number }
  | { kind: "tone"; type: OscillatorType; freq: number; freq2?: number; dur: number; vol: number; lp?: number }
  | { kind: "fm"; carrier: number; mod: number; modIdx: number; dur: number; vol: number }
  | { kind: "pluck"; freq: number; dur: number; vol: number; decay: number }
  | { kind: "click"; freq: number; q: number; dur: number; vol: number };

type EventMap = Partial<Record<ChessSoundEvent, Voice[]>>;

export interface ChessSoundPreset {
  id: string;
  name: string;
  emoji: string;
  category: "classic" | "exotic" | "silent";
  desc: string;
  events: EventMap;
}

// Базовый "move" — короткий хлопок 50-70 ms. Capture обычно громче с двумя ударами.
// Cast/check — отличаются тембром. Cancel — нисходящая пара. Premove — высокий короткий.

function noiseMove(lp: number, vol = 0.22, dur = 0.06): Voice { return { kind: "noise", lp, hp: 180, dur, vol }; }
function tone(type: OscillatorType, freq: number, dur: number, vol: number, freq2?: number): Voice {
  return { kind: "tone", type, freq, freq2, dur, vol };
}

// 20 КЛАССИЧЕСКИХ
const CLASSIC: ChessSoundPreset[] = [
  {
    id: "classic-wood", name: "Дерево классика", emoji: "🪵", category: "classic",
    desc: "Тёплое деревянное «тук» — как в живой партии. По умолчанию.",
    events: {
      move:    [noiseMove(1400, 0.22, 0.06)],
      capture: [noiseMove(700, 0.35, 0.10), noiseMove(1000, 0.15, 0.07)],
      check:   [noiseMove(2400, 0.28, 0.07)],
      castle:  [noiseMove(1200, 0.20, 0.05), noiseMove(1200, 0.18, 0.05)],
      premove: [noiseMove(1800, 0.12, 0.04)],
      cancel:  [noiseMove(900, 0.18, 0.05), noiseMove(500, 0.13, 0.05)],
      x:       [noiseMove(600, 0.15, 0.07), noiseMove(540, 0.15, 0.07), noiseMove(480, 0.15, 0.07), noiseMove(420, 0.15, 0.07)],
    },
  },
  {
    id: "classic-marble", name: "Мрамор", emoji: "🏛", category: "classic",
    desc: "Холодный звонкий мрамор. Каменный полированный звук.",
    events: {
      move:    [{ kind: "click", freq: 2800, q: 8, dur: 0.05, vol: 0.18 }],
      capture: [{ kind: "click", freq: 1100, q: 4, dur: 0.08, vol: 0.28 }, { kind: "click", freq: 2400, q: 6, dur: 0.05, vol: 0.14 }],
      check:   [{ kind: "click", freq: 3400, q: 10, dur: 0.07, vol: 0.22 }],
      castle:  [{ kind: "click", freq: 2200, q: 6, dur: 0.05, vol: 0.16 }, { kind: "click", freq: 2200, q: 6, dur: 0.05, vol: 0.16 }],
      premove: [{ kind: "click", freq: 3200, q: 8, dur: 0.03, vol: 0.10 }],
      cancel:  [{ kind: "click", freq: 1800, q: 5, dur: 0.05, vol: 0.16 }, { kind: "click", freq: 900, q: 5, dur: 0.05, vol: 0.12 }],
    },
  },
  {
    id: "classic-glass", name: "Стекло", emoji: "🔮", category: "classic",
    desc: "Хрустальный «динь» как от хрустальных шахмат.",
    events: {
      move:    [tone("sine", 1800, 0.10, 0.15)],
      capture: [tone("triangle", 900, 0.12, 0.22), tone("sine", 1400, 0.08, 0.10)],
      check:   [tone("sine", 2400, 0.14, 0.18)],
      castle:  [tone("sine", 1600, 0.06, 0.14), tone("sine", 1900, 0.08, 0.14)],
      premove: [tone("sine", 2200, 0.05, 0.10)],
      cancel:  [tone("sine", 1400, 0.06, 0.14), tone("sine", 800, 0.08, 0.12)],
    },
  },
  {
    id: "classic-plastic", name: "Пластик", emoji: "♟", category: "classic",
    desc: "Звонкий пластик — стандартный школьный набор.",
    events: {
      move:    [noiseMove(2200, 0.18, 0.05)],
      capture: [noiseMove(1100, 0.30, 0.08), noiseMove(1700, 0.14, 0.06)],
      check:   [noiseMove(3000, 0.25, 0.06)],
      castle:  [noiseMove(1800, 0.18, 0.04), noiseMove(1800, 0.16, 0.04)],
      premove: [noiseMove(2400, 0.10, 0.03)],
      cancel:  [noiseMove(1400, 0.16, 0.05), noiseMove(800, 0.12, 0.05)],
    },
  },
  {
    id: "classic-bone", name: "Кость", emoji: "🦴", category: "classic",
    desc: "Сухой костяной звук — как от резных фигур.",
    events: {
      move:    [noiseMove(1000, 0.25, 0.05)],
      capture: [noiseMove(600, 0.36, 0.09), noiseMove(800, 0.16, 0.06)],
      check:   [noiseMove(1800, 0.28, 0.06)],
      castle:  [noiseMove(900, 0.20, 0.04), noiseMove(900, 0.18, 0.04)],
      premove: [noiseMove(1400, 0.12, 0.03)],
      cancel:  [noiseMove(800, 0.18, 0.05), noiseMove(400, 0.14, 0.05)],
    },
  },
  {
    id: "classic-metal", name: "Металл", emoji: "⚙", category: "classic",
    desc: "Металлические фигуры — звонкий «тинь».",
    events: {
      move:    [{ kind: "click", freq: 3600, q: 12, dur: 0.06, vol: 0.16 }],
      capture: [{ kind: "click", freq: 1400, q: 6, dur: 0.10, vol: 0.26 }, { kind: "click", freq: 2800, q: 10, dur: 0.05, vol: 0.14 }],
      check:   [{ kind: "click", freq: 4200, q: 14, dur: 0.08, vol: 0.20 }],
      castle:  [{ kind: "click", freq: 2400, q: 8, dur: 0.05, vol: 0.16 }, { kind: "click", freq: 2400, q: 8, dur: 0.05, vol: 0.16 }],
      premove: [{ kind: "click", freq: 3800, q: 10, dur: 0.03, vol: 0.10 }],
      cancel:  [{ kind: "click", freq: 2000, q: 6, dur: 0.05, vol: 0.16 }, { kind: "click", freq: 1000, q: 6, dur: 0.05, vol: 0.12 }],
    },
  },
  {
    id: "classic-soft", name: "Мягкий бархат", emoji: "🧵", category: "classic",
    desc: "Тихий бархатный шорох — для долгих ночных партий.",
    events: {
      move:    [noiseMove(800, 0.12, 0.07)],
      capture: [noiseMove(500, 0.22, 0.10), noiseMove(700, 0.10, 0.07)],
      check:   [noiseMove(1400, 0.18, 0.08)],
      castle:  [noiseMove(700, 0.12, 0.05), noiseMove(700, 0.10, 0.05)],
      premove: [noiseMove(1000, 0.07, 0.04)],
      cancel:  [noiseMove(700, 0.10, 0.05), noiseMove(400, 0.08, 0.05)],
    },
  },
  {
    id: "classic-lichess", name: "Lichess стиль", emoji: "♞", category: "classic",
    desc: "Знакомый сухой клац как у lichess.org.",
    events: {
      move:    [noiseMove(1600, 0.20, 0.05)],
      capture: [noiseMove(800, 0.30, 0.08), noiseMove(1200, 0.14, 0.05)],
      check:   [noiseMove(2600, 0.25, 0.06)],
      castle:  [noiseMove(1400, 0.18, 0.04), noiseMove(1400, 0.16, 0.04)],
      premove: [noiseMove(2000, 0.10, 0.03)],
      cancel:  [noiseMove(1200, 0.15, 0.04), noiseMove(700, 0.12, 0.04)],
    },
  },
  {
    id: "classic-chesscom", name: "Chess.com стиль", emoji: "♕", category: "classic",
    desc: "Более «пупсиковый» клац как у chess.com.",
    events: {
      move:    [noiseMove(1800, 0.24, 0.06), { kind: "click", freq: 2400, q: 6, dur: 0.04, vol: 0.10 }],
      capture: [noiseMove(900, 0.34, 0.09), { kind: "click", freq: 1800, q: 5, dur: 0.06, vol: 0.18 }],
      check:   [{ kind: "click", freq: 3200, q: 10, dur: 0.08, vol: 0.22 }],
      castle:  [noiseMove(1500, 0.20, 0.05), noiseMove(1500, 0.18, 0.05)],
      premove: [{ kind: "click", freq: 2800, q: 8, dur: 0.03, vol: 0.10 }],
      cancel:  [{ kind: "click", freq: 1600, q: 5, dur: 0.05, vol: 0.14 }, { kind: "click", freq: 800, q: 5, dur: 0.05, vol: 0.10 }],
    },
  },
  {
    id: "classic-ivory", name: "Слоновая кость", emoji: "🐘", category: "classic",
    desc: "Антикварные слоновые фигуры — благородный мягкий звук.",
    events: {
      move:    [noiseMove(1200, 0.20, 0.07)],
      capture: [noiseMove(650, 0.32, 0.10), noiseMove(950, 0.14, 0.06)],
      check:   [noiseMove(2000, 0.24, 0.08)],
      castle:  [noiseMove(1100, 0.18, 0.05), noiseMove(1100, 0.16, 0.05)],
      premove: [noiseMove(1600, 0.10, 0.04)],
      cancel:  [noiseMove(1000, 0.16, 0.05), noiseMove(500, 0.12, 0.05)],
    },
  },
  {
    id: "classic-piano", name: "Пианино", emoji: "🎹", category: "classic",
    desc: "Каждый ход — короткая нота на пианино. Шах — аккорд.",
    events: {
      move:    [{ kind: "pluck", freq: 523, dur: 0.20, vol: 0.20, decay: 4 }],
      capture: [{ kind: "pluck", freq: 261, dur: 0.30, vol: 0.30, decay: 3 }],
      check:   [{ kind: "pluck", freq: 659, dur: 0.25, vol: 0.22, decay: 3 }, { kind: "pluck", freq: 784, dur: 0.25, vol: 0.18, decay: 3 }],
      castle:  [{ kind: "pluck", freq: 392, dur: 0.20, vol: 0.18, decay: 4 }, { kind: "pluck", freq: 494, dur: 0.20, vol: 0.16, decay: 4 }],
      premove: [{ kind: "pluck", freq: 880, dur: 0.10, vol: 0.12, decay: 5 }],
      cancel:  [{ kind: "pluck", freq: 440, dur: 0.15, vol: 0.16, decay: 4 }, { kind: "pluck", freq: 330, dur: 0.15, vol: 0.14, decay: 4 }],
    },
  },
  {
    id: "classic-clock", name: "Часовой механизм", emoji: "🕰", category: "classic",
    desc: "Швейцарские часы — точный механический «тик».",
    events: {
      move:    [{ kind: "click", freq: 2400, q: 14, dur: 0.04, vol: 0.16 }],
      capture: [{ kind: "click", freq: 1200, q: 8, dur: 0.07, vol: 0.26 }],
      check:   [{ kind: "click", freq: 3200, q: 16, dur: 0.06, vol: 0.22 }],
      castle:  [{ kind: "click", freq: 1800, q: 10, dur: 0.04, vol: 0.16 }, { kind: "click", freq: 1800, q: 10, dur: 0.04, vol: 0.16 }],
      premove: [{ kind: "click", freq: 2800, q: 12, dur: 0.03, vol: 0.10 }],
      cancel:  [{ kind: "click", freq: 1600, q: 8, dur: 0.04, vol: 0.16 }, { kind: "click", freq: 800, q: 8, dur: 0.04, vol: 0.12 }],
    },
  },
  {
    id: "classic-felt", name: "Войлок", emoji: "🧣", category: "classic",
    desc: "Войлочные подкладки — мягкий шуршащий звук.",
    events: {
      move:    [noiseMove(600, 0.18, 0.07)],
      capture: [noiseMove(400, 0.26, 0.10), noiseMove(550, 0.12, 0.07)],
      check:   [noiseMove(1100, 0.22, 0.08)],
      castle:  [noiseMove(550, 0.16, 0.06), noiseMove(550, 0.14, 0.06)],
      premove: [noiseMove(800, 0.10, 0.04)],
      cancel:  [noiseMove(550, 0.14, 0.05), noiseMove(330, 0.10, 0.05)],
    },
  },
  {
    id: "classic-stone", name: "Камень", emoji: "🪨", category: "classic",
    desc: "Каменные фигуры — глухой массивный «тук».",
    events: {
      move:    [noiseMove(500, 0.30, 0.08)],
      capture: [noiseMove(300, 0.42, 0.12), noiseMove(450, 0.18, 0.08)],
      check:   [noiseMove(900, 0.32, 0.09)],
      castle:  [noiseMove(450, 0.26, 0.06), noiseMove(450, 0.22, 0.06)],
      premove: [noiseMove(700, 0.14, 0.04)],
      cancel:  [noiseMove(500, 0.20, 0.06), noiseMove(280, 0.16, 0.06)],
    },
  },
  {
    id: "classic-ceramic", name: "Керамика", emoji: "🏺", category: "classic",
    desc: "Глазурованная керамика — звонкий, но не резкий.",
    events: {
      move:    [{ kind: "click", freq: 2200, q: 6, dur: 0.06, vol: 0.18 }],
      capture: [{ kind: "click", freq: 1000, q: 4, dur: 0.10, vol: 0.28 }, { kind: "click", freq: 1800, q: 5, dur: 0.06, vol: 0.14 }],
      check:   [{ kind: "click", freq: 2800, q: 8, dur: 0.08, vol: 0.22 }],
      castle:  [{ kind: "click", freq: 1800, q: 5, dur: 0.05, vol: 0.16 }, { kind: "click", freq: 1800, q: 5, dur: 0.05, vol: 0.16 }],
      premove: [{ kind: "click", freq: 2600, q: 6, dur: 0.03, vol: 0.10 }],
      cancel:  [{ kind: "click", freq: 1600, q: 4, dur: 0.05, vol: 0.14 }, { kind: "click", freq: 800, q: 4, dur: 0.05, vol: 0.10 }],
    },
  },
  {
    id: "classic-warm-wood", name: "Тёплый дуб", emoji: "🌳", category: "classic",
    desc: "Дубовые фигуры — низкие, но не глухие, с лёгкой текстурой.",
    events: {
      move:    [noiseMove(900, 0.24, 0.07)],
      capture: [noiseMove(500, 0.38, 0.11), noiseMove(750, 0.16, 0.07)],
      check:   [noiseMove(1700, 0.28, 0.08)],
      castle:  [noiseMove(800, 0.22, 0.05), noiseMove(800, 0.20, 0.05)],
      premove: [noiseMove(1200, 0.12, 0.04)],
      cancel:  [noiseMove(800, 0.18, 0.06), noiseMove(420, 0.14, 0.06)],
    },
  },
  {
    id: "classic-bamboo", name: "Бамбук", emoji: "🎋", category: "classic",
    desc: "Лёгкий бамбуковый стук — азиатская традиция.",
    events: {
      move:    [{ kind: "click", freq: 1800, q: 4, dur: 0.05, vol: 0.18 }],
      capture: [{ kind: "click", freq: 900, q: 3, dur: 0.08, vol: 0.28 }, { kind: "click", freq: 1500, q: 4, dur: 0.05, vol: 0.14 }],
      check:   [{ kind: "click", freq: 2200, q: 6, dur: 0.07, vol: 0.20 }],
      castle:  [{ kind: "click", freq: 1500, q: 4, dur: 0.04, vol: 0.16 }, { kind: "click", freq: 1500, q: 4, dur: 0.04, vol: 0.16 }],
      premove: [{ kind: "click", freq: 2000, q: 5, dur: 0.03, vol: 0.10 }],
      cancel:  [{ kind: "click", freq: 1300, q: 3, dur: 0.04, vol: 0.14 }, { kind: "click", freq: 700, q: 3, dur: 0.04, vol: 0.10 }],
    },
  },
  {
    id: "classic-walnut", name: "Орех", emoji: "🌰", category: "classic",
    desc: "Ореховые фигуры — глубокий низкий бас.",
    events: {
      move:    [noiseMove(700, 0.26, 0.08)],
      capture: [noiseMove(380, 0.40, 0.12), noiseMove(620, 0.18, 0.08)],
      check:   [noiseMove(1400, 0.30, 0.09)],
      castle:  [noiseMove(700, 0.24, 0.06), noiseMove(700, 0.22, 0.06)],
      premove: [noiseMove(1000, 0.14, 0.04)],
      cancel:  [noiseMove(700, 0.20, 0.06), noiseMove(360, 0.16, 0.06)],
    },
  },
  {
    id: "classic-cork", name: "Пробка", emoji: "🍾", category: "classic",
    desc: "Пробковые фигуры — глухой щелчок.",
    events: {
      move:    [noiseMove(400, 0.22, 0.06)],
      capture: [noiseMove(280, 0.32, 0.09), noiseMove(360, 0.14, 0.06)],
      check:   [noiseMove(800, 0.24, 0.07)],
      castle:  [noiseMove(420, 0.20, 0.05), noiseMove(420, 0.18, 0.05)],
      premove: [noiseMove(600, 0.12, 0.04)],
      cancel:  [noiseMove(450, 0.16, 0.05), noiseMove(240, 0.12, 0.05)],
    },
  },
  {
    id: "classic-leather", name: "Кожа", emoji: "🛋", category: "classic",
    desc: "Кожаная подставка — приглушённый шлепок.",
    events: {
      move:    [noiseMove(550, 0.20, 0.07)],
      capture: [noiseMove(350, 0.32, 0.10), noiseMove(480, 0.14, 0.07)],
      check:   [noiseMove(1000, 0.26, 0.08)],
      castle:  [noiseMove(500, 0.18, 0.06), noiseMove(500, 0.16, 0.06)],
      premove: [noiseMove(700, 0.10, 0.04)],
      cancel:  [noiseMove(500, 0.14, 0.05), noiseMove(300, 0.10, 0.05)],
    },
  },
];

// 20 ЭКЗОТИЧЕСКИХ
const EXOTIC: ChessSoundPreset[] = [
  {
    id: "exotic-sci-fi", name: "Sci-Fi", emoji: "🛸", category: "exotic",
    desc: "Звуковые эффекты как из космической оперы.",
    events: {
      move:    [tone("sawtooth", 800, 0.10, 0.10, 1600)],
      capture: [{ kind: "fm", carrier: 200, mod: 400, modIdx: 200, dur: 0.18, vol: 0.22 }],
      check:   [{ kind: "fm", carrier: 1200, mod: 800, modIdx: 400, dur: 0.20, vol: 0.20 }],
      castle:  [tone("sawtooth", 600, 0.08, 0.14, 900), tone("sawtooth", 900, 0.08, 0.12, 1200)],
      premove: [tone("square", 1800, 0.04, 0.08)],
      cancel:  [tone("sawtooth", 1200, 0.06, 0.14, 600), tone("sawtooth", 600, 0.08, 0.12, 300)],
    },
  },
  {
    id: "exotic-blip", name: "8-bit Blip", emoji: "👾", category: "exotic",
    desc: "Аркада 80-х — пиксельные блипы.",
    events: {
      move:    [tone("square", 880, 0.05, 0.12)],
      capture: [tone("square", 440, 0.06, 0.20), tone("square", 220, 0.06, 0.16)],
      check:   [tone("square", 1320, 0.08, 0.18)],
      castle:  [tone("square", 660, 0.05, 0.14), tone("square", 880, 0.05, 0.14)],
      premove: [tone("square", 1760, 0.03, 0.10)],
      cancel:  [tone("square", 880, 0.05, 0.14), tone("square", 440, 0.06, 0.12)],
    },
  },
  {
    id: "exotic-glitch", name: "Glitch", emoji: "📺", category: "exotic",
    desc: "Цифровой глитч — короткий искажённый разряд.",
    events: {
      move:    [{ kind: "noise", lp: 4000, hp: 800, dur: 0.04, vol: 0.18 }],
      capture: [{ kind: "noise", lp: 3000, hp: 1200, dur: 0.08, vol: 0.28 }, tone("square", 200, 0.03, 0.10)],
      check:   [{ kind: "noise", lp: 6000, hp: 2000, dur: 0.06, vol: 0.22 }],
      castle:  [{ kind: "noise", lp: 3500, hp: 1500, dur: 0.04, vol: 0.16 }, { kind: "noise", lp: 3500, hp: 1500, dur: 0.04, vol: 0.16 }],
      premove: [{ kind: "noise", lp: 5000, hp: 2500, dur: 0.03, vol: 0.10 }],
      cancel:  [{ kind: "noise", lp: 2000, hp: 800, dur: 0.05, vol: 0.16 }, tone("sawtooth", 200, 0.05, 0.12)],
    },
  },
  {
    id: "exotic-cyber", name: "Cyberpunk", emoji: "🌃", category: "exotic",
    desc: "Кибер-неон — низкие синтетические pulse.",
    events: {
      move:    [{ kind: "fm", carrier: 220, mod: 110, modIdx: 80, dur: 0.10, vol: 0.20 }],
      capture: [{ kind: "fm", carrier: 110, mod: 220, modIdx: 150, dur: 0.16, vol: 0.30 }],
      check:   [{ kind: "fm", carrier: 440, mod: 220, modIdx: 200, dur: 0.18, vol: 0.24 }],
      castle:  [{ kind: "fm", carrier: 165, mod: 110, modIdx: 80, dur: 0.08, vol: 0.18 }, { kind: "fm", carrier: 220, mod: 110, modIdx: 80, dur: 0.08, vol: 0.16 }],
      premove: [tone("triangle", 440, 0.05, 0.10)],
      cancel:  [{ kind: "fm", carrier: 220, mod: 110, modIdx: 100, dur: 0.06, vol: 0.16 }, { kind: "fm", carrier: 110, mod: 55, modIdx: 60, dur: 0.08, vol: 0.14 }],
    },
  },
  {
    id: "exotic-laser", name: "Лазер", emoji: "🔫", category: "exotic",
    desc: "Бластер из ретро-стрелялки — пиу.",
    events: {
      move:    [tone("sawtooth", 1200, 0.06, 0.12, 200)],
      capture: [tone("sawtooth", 1800, 0.08, 0.22, 100)],
      check:   [tone("sawtooth", 2400, 0.10, 0.22, 400)],
      castle:  [tone("sawtooth", 900, 0.06, 0.14, 200), tone("sawtooth", 1200, 0.06, 0.12, 300)],
      premove: [tone("sawtooth", 2000, 0.03, 0.08, 800)],
      cancel:  [tone("sawtooth", 1500, 0.06, 0.14, 200), tone("sawtooth", 800, 0.08, 0.12, 100)],
    },
  },
  {
    id: "exotic-bubble", name: "Пузырьки", emoji: "🫧", category: "exotic",
    desc: "Подводный «бульк» — фигуры в аквариуме.",
    events: {
      move:    [tone("sine", 600, 0.10, 0.16, 1200)],
      capture: [tone("sine", 300, 0.14, 0.24, 800), tone("sine", 500, 0.10, 0.14, 1000)],
      check:   [tone("sine", 900, 0.12, 0.20, 1800)],
      castle:  [tone("sine", 500, 0.08, 0.16, 900), tone("sine", 700, 0.08, 0.14, 1100)],
      premove: [tone("sine", 1200, 0.05, 0.12, 2000)],
      cancel:  [tone("sine", 800, 0.08, 0.14, 400), tone("sine", 400, 0.10, 0.12, 200)],
    },
  },
  {
    id: "exotic-thump", name: "Тамтам", emoji: "🥁", category: "exotic",
    desc: "Африканский барабан — низкий резонирующий удар.",
    events: {
      move:    [{ kind: "fm", carrier: 80, mod: 60, modIdx: 40, dur: 0.12, vol: 0.30 }],
      capture: [{ kind: "fm", carrier: 60, mod: 50, modIdx: 50, dur: 0.18, vol: 0.40 }],
      check:   [{ kind: "fm", carrier: 120, mod: 80, modIdx: 60, dur: 0.14, vol: 0.32 }],
      castle:  [{ kind: "fm", carrier: 90, mod: 60, modIdx: 40, dur: 0.10, vol: 0.26 }, { kind: "fm", carrier: 90, mod: 60, modIdx: 40, dur: 0.10, vol: 0.24 }],
      premove: [{ kind: "fm", carrier: 140, mod: 100, modIdx: 50, dur: 0.06, vol: 0.18 }],
      cancel:  [{ kind: "fm", carrier: 100, mod: 70, modIdx: 50, dur: 0.08, vol: 0.22 }, { kind: "fm", carrier: 60, mod: 40, modIdx: 40, dur: 0.10, vol: 0.18 }],
    },
  },
  {
    id: "exotic-bell", name: "Колокольчик", emoji: "🔔", category: "exotic",
    desc: "Маленький храмовый колокольчик с долгим затуханием.",
    events: {
      move:    [{ kind: "pluck", freq: 1760, dur: 0.30, vol: 0.18, decay: 3 }],
      capture: [{ kind: "pluck", freq: 880, dur: 0.40, vol: 0.26, decay: 2.5 }],
      check:   [{ kind: "pluck", freq: 2640, dur: 0.35, vol: 0.22, decay: 2.5 }],
      castle:  [{ kind: "pluck", freq: 1320, dur: 0.30, vol: 0.18, decay: 3 }, { kind: "pluck", freq: 1760, dur: 0.30, vol: 0.16, decay: 3 }],
      premove: [{ kind: "pluck", freq: 2200, dur: 0.15, vol: 0.12, decay: 4 }],
      cancel:  [{ kind: "pluck", freq: 1320, dur: 0.20, vol: 0.16, decay: 3 }, { kind: "pluck", freq: 880, dur: 0.25, vol: 0.14, decay: 3 }],
    },
  },
  {
    id: "exotic-zen", name: "Дзен-чаша", emoji: "🪷", category: "exotic",
    desc: "Поющая чаша — медитативный долгий звон.",
    events: {
      move:    [{ kind: "pluck", freq: 220, dur: 0.40, vol: 0.18, decay: 1.8 }],
      capture: [{ kind: "pluck", freq: 165, dur: 0.50, vol: 0.24, decay: 1.5 }],
      check:   [{ kind: "pluck", freq: 330, dur: 0.45, vol: 0.20, decay: 1.6 }],
      castle:  [{ kind: "pluck", freq: 220, dur: 0.30, vol: 0.16, decay: 2 }, { kind: "pluck", freq: 247, dur: 0.30, vol: 0.16, decay: 2 }],
      premove: [{ kind: "pluck", freq: 440, dur: 0.20, vol: 0.10, decay: 3 }],
      cancel:  [{ kind: "pluck", freq: 220, dur: 0.25, vol: 0.14, decay: 2 }, { kind: "pluck", freq: 165, dur: 0.30, vol: 0.12, decay: 2 }],
    },
  },
  {
    id: "exotic-typewriter", name: "Пишмашинка", emoji: "⌨", category: "exotic",
    desc: "Механический печатный аппарат — звонкий удар клавиши.",
    events: {
      move:    [{ kind: "click", freq: 2800, q: 16, dur: 0.04, vol: 0.18 }, noiseMove(800, 0.10, 0.03)],
      capture: [{ kind: "click", freq: 1400, q: 10, dur: 0.06, vol: 0.28 }, noiseMove(600, 0.16, 0.05)],
      check:   [{ kind: "click", freq: 3600, q: 18, dur: 0.05, vol: 0.20 }],
      castle:  [{ kind: "click", freq: 2200, q: 14, dur: 0.04, vol: 0.16 }, { kind: "click", freq: 2200, q: 14, dur: 0.04, vol: 0.16 }],
      premove: [{ kind: "click", freq: 3200, q: 16, dur: 0.03, vol: 0.10 }],
      cancel:  [{ kind: "click", freq: 1800, q: 10, dur: 0.04, vol: 0.16 }, { kind: "click", freq: 900, q: 10, dur: 0.04, vol: 0.12 }],
    },
  },
  {
    id: "exotic-cosmic", name: "Космос", emoji: "🌌", category: "exotic",
    desc: "Эхо в пустоте — дальний звон.",
    events: {
      move:    [tone("sine", 1100, 0.18, 0.14, 800)],
      capture: [tone("sine", 700, 0.24, 0.22, 400), tone("sine", 1100, 0.18, 0.10, 600)],
      check:   [tone("sine", 1500, 0.22, 0.20, 1000)],
      castle:  [tone("sine", 800, 0.16, 0.16, 600), tone("sine", 1000, 0.16, 0.14, 800)],
      premove: [tone("sine", 1800, 0.10, 0.10, 1200)],
      cancel:  [tone("sine", 1200, 0.14, 0.16, 600), tone("sine", 600, 0.18, 0.12, 300)],
    },
  },
  {
    id: "exotic-vinyl", name: "Винил", emoji: "💿", category: "exotic",
    desc: "Виниловая пластинка — лёгкое потрескивание.",
    events: {
      move:    [noiseMove(3000, 0.10, 0.04), { kind: "click", freq: 1200, q: 4, dur: 0.03, vol: 0.14 }],
      capture: [noiseMove(2500, 0.18, 0.06), { kind: "click", freq: 800, q: 3, dur: 0.06, vol: 0.22 }],
      check:   [{ kind: "click", freq: 1800, q: 5, dur: 0.08, vol: 0.20 }, noiseMove(3500, 0.14, 0.05)],
      castle:  [noiseMove(2800, 0.12, 0.04), noiseMove(2800, 0.10, 0.04)],
      premove: [noiseMove(3500, 0.08, 0.03)],
      cancel:  [{ kind: "click", freq: 1400, q: 4, dur: 0.04, vol: 0.14 }, noiseMove(2000, 0.10, 0.04)],
    },
  },
  {
    id: "exotic-rain", name: "Капля", emoji: "💧", category: "exotic",
    desc: "Капля в пруд — нежный «плим».",
    events: {
      move:    [tone("sine", 900, 0.15, 0.16, 1800)],
      capture: [tone("sine", 600, 0.20, 0.24, 1200), tone("sine", 1100, 0.14, 0.14, 1600)],
      check:   [tone("sine", 1400, 0.18, 0.18, 2200)],
      castle:  [tone("sine", 800, 0.12, 0.14, 1500), tone("sine", 1000, 0.12, 0.12, 1700)],
      premove: [tone("sine", 1600, 0.08, 0.10, 2400)],
      cancel:  [tone("sine", 1100, 0.12, 0.14, 700), tone("sine", 700, 0.14, 0.12, 400)],
    },
  },
  {
    id: "exotic-laser-cat", name: "Котов-Laser", emoji: "🐱", category: "exotic",
    desc: "Мява-pew-pew — для лёгких партий.",
    events: {
      move:    [tone("sawtooth", 1400, 0.05, 0.12, 800)],
      capture: [tone("sawtooth", 800, 0.10, 0.22, 200), tone("triangle", 1200, 0.06, 0.14, 600)],
      check:   [tone("sawtooth", 2000, 0.08, 0.22, 800), tone("triangle", 1800, 0.06, 0.16, 1000)],
      castle:  [tone("sawtooth", 1200, 0.05, 0.14, 600), tone("triangle", 1400, 0.05, 0.12, 700)],
      premove: [tone("triangle", 1800, 0.03, 0.10, 1200)],
      cancel:  [tone("sawtooth", 1500, 0.05, 0.14, 400), tone("triangle", 700, 0.07, 0.12, 200)],
    },
  },
  {
    id: "exotic-thunder", name: "Гром", emoji: "⛈", category: "exotic",
    desc: "Гром вдалеке — для драматических партий.",
    events: {
      move:    [{ kind: "noise", lp: 400, hp: 60, dur: 0.18, vol: 0.18, decay: 0.5 }],
      capture: [{ kind: "noise", lp: 300, hp: 40, dur: 0.32, vol: 0.30, decay: 0.4 }],
      check:   [{ kind: "noise", lp: 500, hp: 80, dur: 0.22, vol: 0.26, decay: 0.5 }],
      castle:  [{ kind: "noise", lp: 350, hp: 50, dur: 0.16, vol: 0.20, decay: 0.5 }, { kind: "noise", lp: 350, hp: 50, dur: 0.16, vol: 0.18, decay: 0.5 }],
      premove: [{ kind: "noise", lp: 600, hp: 100, dur: 0.10, vol: 0.12 }],
      cancel:  [{ kind: "noise", lp: 400, hp: 60, dur: 0.14, vol: 0.20 }, { kind: "noise", lp: 250, hp: 40, dur: 0.18, vol: 0.16 }],
    },
  },
  {
    id: "exotic-orbital", name: "Orbital pulse", emoji: "🪐", category: "exotic",
    desc: "Пульсар — ритмичный электронный pulse.",
    events: {
      move:    [tone("square", 200, 0.06, 0.16), tone("square", 400, 0.04, 0.10)],
      capture: [tone("square", 100, 0.10, 0.24), tone("square", 200, 0.08, 0.16)],
      check:   [tone("square", 300, 0.10, 0.22), tone("square", 600, 0.06, 0.14)],
      castle:  [tone("square", 200, 0.06, 0.16), tone("square", 200, 0.06, 0.14)],
      premove: [tone("square", 400, 0.04, 0.10)],
      cancel:  [tone("square", 250, 0.06, 0.14), tone("square", 125, 0.08, 0.12)],
    },
  },
  {
    id: "exotic-quartz", name: "Кварц", emoji: "💎", category: "exotic",
    desc: "Кристалл — высокий сверкающий тон.",
    events: {
      move:    [{ kind: "pluck", freq: 2640, dur: 0.18, vol: 0.16, decay: 5 }],
      capture: [{ kind: "pluck", freq: 1320, dur: 0.24, vol: 0.24, decay: 4 }, { kind: "pluck", freq: 2640, dur: 0.18, vol: 0.14, decay: 5 }],
      check:   [{ kind: "pluck", freq: 3520, dur: 0.20, vol: 0.20, decay: 4 }],
      castle:  [{ kind: "pluck", freq: 2200, dur: 0.18, vol: 0.16, decay: 5 }, { kind: "pluck", freq: 2640, dur: 0.18, vol: 0.14, decay: 5 }],
      premove: [{ kind: "pluck", freq: 3200, dur: 0.10, vol: 0.10, decay: 6 }],
      cancel:  [{ kind: "pluck", freq: 2200, dur: 0.16, vol: 0.14, decay: 5 }, { kind: "pluck", freq: 1100, dur: 0.20, vol: 0.12, decay: 5 }],
    },
  },
  {
    id: "exotic-modem", name: "Модем", emoji: "📞", category: "exotic",
    desc: "Dial-up из 90-х — короткий handshake.",
    events: {
      move:    [tone("square", 1200, 0.04, 0.14), tone("square", 1800, 0.04, 0.10)],
      capture: [tone("square", 800, 0.08, 0.22), tone("square", 1400, 0.06, 0.16), tone("square", 600, 0.04, 0.12)],
      check:   [tone("square", 2400, 0.08, 0.20), tone("square", 1600, 0.06, 0.14)],
      castle:  [tone("square", 1000, 0.06, 0.16), tone("square", 1400, 0.05, 0.14)],
      premove: [tone("square", 1800, 0.03, 0.10)],
      cancel:  [tone("square", 1600, 0.05, 0.14), tone("square", 700, 0.06, 0.12)],
    },
  },
  {
    id: "exotic-water-drop", name: "Капля-эхо", emoji: "🌊", category: "exotic",
    desc: "Капля в гулком колодце — длинный сустейн.",
    events: {
      move:    [tone("sine", 700, 0.22, 0.16, 1400), tone("sine", 700, 0.18, 0.06, 1400)],
      capture: [tone("sine", 500, 0.30, 0.24, 900), tone("sine", 800, 0.20, 0.10, 1200)],
      check:   [tone("sine", 1000, 0.25, 0.20, 1800)],
      castle:  [tone("sine", 600, 0.20, 0.16, 1100), tone("sine", 800, 0.18, 0.14, 1300)],
      premove: [tone("sine", 1200, 0.10, 0.10, 1800)],
      cancel:  [tone("sine", 900, 0.16, 0.16, 500), tone("sine", 500, 0.20, 0.12, 250)],
    },
  },
  {
    id: "exotic-anvil", name: "Наковальня", emoji: "🔨", category: "exotic",
    desc: "Куётся ход — металлический «дзынь».",
    events: {
      move:    [{ kind: "click", freq: 3800, q: 18, dur: 0.08, vol: 0.18 }],
      capture: [{ kind: "click", freq: 1800, q: 10, dur: 0.14, vol: 0.30 }, { kind: "click", freq: 3200, q: 14, dur: 0.10, vol: 0.18 }],
      check:   [{ kind: "click", freq: 4400, q: 22, dur: 0.10, vol: 0.22 }],
      castle:  [{ kind: "click", freq: 2400, q: 12, dur: 0.06, vol: 0.16 }, { kind: "click", freq: 2400, q: 12, dur: 0.06, vol: 0.16 }],
      premove: [{ kind: "click", freq: 3600, q: 16, dur: 0.04, vol: 0.10 }],
      cancel:  [{ kind: "click", freq: 2000, q: 10, dur: 0.06, vol: 0.16 }, { kind: "click", freq: 1000, q: 10, dur: 0.06, vol: 0.12 }],
    },
  },
];

const SILENT: ChessSoundPreset = {
  id: "silent", name: "Молчание", emoji: "🔇", category: "silent",
  desc: "Полная тишина — никаких звуков фигур.",
  events: {},
};

export const CHESS_SOUND_PRESETS: ChessSoundPreset[] = [...CLASSIC, ...EXOTIC, SILENT];

let _audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_audioCtx) { try { _audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { _audioCtx = null; } }
  if (_audioCtx && _audioCtx.state === "suspended") { _audioCtx.resume().catch(() => {}); }
  return _audioCtx;
}

function playVoice(ctx: AudioContext, v: Voice, at: number) {
  const dest = ctx.destination;
  if (v.kind === "noise") {
    const dur = v.dur;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    const decay = v.decay ?? 0.18;
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * decay));
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = v.lp; lp.Q.value = 0.8;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = v.hp;
    const g = ctx.createGain(); g.gain.setValueAtTime(v.vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(dest); src.start(at);
  } else if (v.kind === "tone") {
    const osc = ctx.createOscillator(); osc.type = v.type;
    osc.frequency.setValueAtTime(v.freq, at);
    if (v.freq2 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, v.freq2), at + v.dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(v.vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + v.dur);
    if (v.lp !== undefined) { const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = v.lp; osc.connect(lp); lp.connect(g); }
    else osc.connect(g);
    g.connect(dest); osc.start(at); osc.stop(at + v.dur);
  } else if (v.kind === "fm") {
    const carrier = ctx.createOscillator(); carrier.type = "sine"; carrier.frequency.value = v.carrier;
    const mod = ctx.createOscillator(); mod.type = "sine"; mod.frequency.value = v.mod;
    const modGain = ctx.createGain(); modGain.gain.value = v.modIdx;
    mod.connect(modGain); modGain.connect(carrier.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(v.vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + v.dur);
    carrier.connect(g); g.connect(dest);
    mod.start(at); carrier.start(at); mod.stop(at + v.dur); carrier.stop(at + v.dur);
  } else if (v.kind === "pluck") {
    // Karplus-Strong-ish — sine + быстрая экспонента
    const osc = ctx.createOscillator(); osc.type = "triangle"; osc.frequency.value = v.freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v.vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + v.dur * v.decay * 0.25);
    osc.connect(g); g.connect(dest);
    osc.start(at); osc.stop(at + v.dur * v.decay * 0.3);
  } else if (v.kind === "click") {
    const bufSize = Math.floor(ctx.sampleRate * v.dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.05));
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = v.freq; bp.Q.value = v.q;
    const g = ctx.createGain(); g.gain.setValueAtTime(v.vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + v.dur);
    src.connect(bp); bp.connect(g); g.connect(dest); src.start(at);
  }
}

export function playChessSound(presetId: string, event: ChessSoundEvent) {
  const preset = CHESS_SOUND_PRESETS.find(p => p.id === presetId);
  if (!preset || preset.category === "silent") return;
  const voices = preset.events[event];
  if (!voices || voices.length === 0) {
    // Фолбэк на event "move" если конкретный не описан
    const fallback = preset.events.move;
    if (!fallback) return;
    const ctx = getCtx(); if (!ctx) return;
    const now = ctx.currentTime;
    fallback.forEach((v, i) => playVoice(ctx, v, now + i * 0.05));
    return;
  }
  const ctx = getCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  voices.forEach((v, i) => playVoice(ctx, v, now + i * 0.04));
}

export const SOUND_PRESET_LS_KEY = "cyberchess_sound_preset_v1";
export function loadSoundPreset(): string {
  if (typeof window === "undefined") return "classic-wood";
  try { return localStorage.getItem(SOUND_PRESET_LS_KEY) || "classic-wood"; } catch { return "classic-wood"; }
}
export function saveSoundPreset(id: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SOUND_PRESET_LS_KEY, id); } catch {}
}
