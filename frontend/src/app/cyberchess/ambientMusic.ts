// ambientMusic.ts — встроенные ПРОЦЕДУРНЫЕ ambient-треки для CyberChess.
//
// Ноль внешних ассетов: всё синтезируется через Web Audio API (как chessSounds.ts),
// поэтому фоновая музыка играет «из коробки» — без файлов и без вопросов лицензии.
//
// Каждый трек — это генеративная петля: аккордовый пад (медленная атака/релиз,
// сменяется каждый такт) + редкая мелодия по нотам гаммы. Планировщик расставляет
// ноты на ~200 мс вперёд по часам AudioContext (lookahead-scheduling).

export type AmbientTrack = { id: string; name: string; emoji: string; desc: string };

export const AMBIENT_TRACKS: AmbientTrack[] = [
  { id: "amb-lofi",  name: "Lo-Fi Etude",   emoji: "🎧", desc: "Тёплый lo-fi пад + мягкое арпеджио. Для долгих партий." },
  { id: "amb-zen",   name: "Zen Drift",     emoji: "🧘", desc: "Медленный медитативный дрейф — почти без ритма." },
  { id: "amb-night", name: "Night Tactics", emoji: "🌙", desc: "Минорный night-mode эмбиент с лёгким пульсом." },
  { id: "amb-focus", name: "Deep Focus",    emoji: "🎯", desc: "Нейтральный фокус-дрон + редкие высокие ноты." },
];

type TrackDef = {
  bpm: number;
  beats: number;        // долей в такте
  subdiv: number;       // подразбиение доли (2 = восьмые)
  chords: number[][];   // прогрессия: массив тактов, каждый — набор MIDI-нот пада
  scale: number[];      // полутоновые ступени мелодии относительно корня аккорда
  melodyChance: number; // вероятность мелодической ноты на шаг
  padWave: OscillatorType;
  melWave: OscillatorType;
  padVol: number;
  melVol: number;
  lp: number;           // частота среза lowpass (тёплость)
};

// MIDI: 60 = C4. Аккорды записаны во 2-3 октавах для мягкого пада.
const DEFS: Record<string, TrackDef> = {
  "amb-lofi": {
    bpm: 68, beats: 4, subdiv: 2,
    chords: [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 53]], // Cmaj7 Am7 Fmaj7 G7
    scale: [0, 2, 4, 7, 9],   // мажорная пентатоника
    melodyChance: 0.28, padWave: "triangle", melWave: "sine", padVol: 0.10, melVol: 0.11, lp: 2200,
  },
  "amb-zen": {
    bpm: 50, beats: 4, subdiv: 1,
    chords: [[45, 52, 57], [50, 57, 62], [43, 50, 55], [45, 52, 59]], // открытые квинты/сексты
    scale: [0, 2, 5, 7, 9, 12],
    melodyChance: 0.12, padWave: "sine", melWave: "sine", padVol: 0.12, melVol: 0.08, lp: 1500,
  },
  "amb-night": {
    bpm: 76, beats: 4, subdiv: 2,
    chords: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]], // Am F C G(ish)
    scale: [0, 2, 3, 5, 7, 10],  // минорная (дорийско-эолийская)
    melodyChance: 0.22, padWave: "sawtooth", melWave: "triangle", padVol: 0.07, melVol: 0.10, lp: 1700,
  },
  "amb-focus": {
    bpm: 60, beats: 4, subdiv: 1,
    chords: [[50, 57], [50, 57], [48, 55], [50, 57]], // дрон D + квинта
    scale: [0, 7, 12, 14, 19],
    melodyChance: 0.10, padWave: "sine", melWave: "sine", padVol: 0.11, melVol: 0.07, lp: 1300,
  },
};

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export class AmbientPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextNoteTime = 0;
  private def: TrackDef = DEFS["amb-lofi"];
  private vol = 0.5;
  private _trackId = "";

  get trackId(): string { return this._trackId; }
  get isPlaying(): boolean { return this.ctx !== null; }

  play(trackId: string, volume: number) {
    this.stop();
    this.def = DEFS[trackId] || DEFS["amb-lofi"];
    this._trackId = trackId;
    this.vol = volume;
    if (typeof window === "undefined") return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try { this.ctx = new Ctx(); } catch { this.ctx = null; return; }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    this.master = this.ctx.createGain();
    this.master.gain.value = volume * 0.45; // эмбиент тише фигур
    this.master.connect(this.ctx.destination);
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.12;
    this.timer = window.setInterval(() => this.scheduler(), 25);
  }

  stop() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    if (this.ctx) { try { this.ctx.close(); } catch {} this.ctx = null; }
    this.master = null;
    this._trackId = "";
  }

  setVolume(volume: number) {
    this.vol = volume;
    if (this.master && this.ctx) {
      try { this.master.gain.setTargetAtTime(volume * 0.45, this.ctx.currentTime, 0.05); } catch {}
    }
  }

  private scheduler() {
    if (!this.ctx || !this.master) return;
    const spb = 60 / this.def.bpm;
    const stepDur = spb / this.def.subdiv;
    while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
      this.scheduleStep(this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.step++;
    }
  }

  private scheduleStep(t: number, stepDur: number) {
    const def = this.def;
    const stepsPerBar = def.beats * def.subdiv;
    const barIdx = Math.floor(this.step / stepsPerBar) % def.chords.length;
    if (this.step % stepsPerBar === 0) {
      const chord = def.chords[barIdx];
      const barDur = stepsPerBar * stepDur;
      for (const m of chord) this.pad(m, t, barDur);
    }
    if (Math.random() < def.melodyChance) {
      const root = def.chords[barIdx][0];
      const deg = def.scale[Math.floor(Math.random() * def.scale.length)];
      const oct = Math.random() < 0.35 ? 12 : 0;
      this.note(root + 12 + deg + oct, t, stepDur * 1.5);
    }
  }

  // Аккордовый пад: осциллятор + лёгкий detune-двойник, медленная атака/релиз.
  private pad(midi: number, t: number, dur: number) {
    if (!this.ctx || !this.master) return;
    const f = midiToFreq(midi);
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = this.def.lp;
    const g = this.ctx.createGain();
    const peak = this.def.padVol;
    const atk = Math.min(0.7, dur * 0.3), rel = Math.min(1.2, dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + atk);
    g.gain.setValueAtTime(Math.max(0.0002, peak), t + Math.max(atk, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g); g.connect(this.master);
    for (const det of [-4, 4]) {
      const osc = this.ctx.createOscillator();
      osc.type = this.def.padWave;
      osc.frequency.value = f;
      osc.detune.value = det;
      osc.connect(lp);
      osc.start(t); osc.stop(t + dur + 0.05);
    }
  }

  // Мелодическая нота: короткий мягкий pluck.
  private note(midi: number, t: number, dur: number) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    osc.type = this.def.melWave;
    osc.frequency.value = midiToFreq(midi);
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = this.def.lp * 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(this.def.melVol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp); lp.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
}
