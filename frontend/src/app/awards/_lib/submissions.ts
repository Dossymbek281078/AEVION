/**
 * AEVION Awards — local submission + voting store.
 *
 * Demo-mode only. No backend POST yet (Planet endpoint coming in next sprint).
 * Persists user-submitted works + a per-session vote tally in localStorage,
 * blended with a small seeded set so the leaderboard is never empty.
 */

export type AwardTrack = "music" | "film";

export const MUSIC_GENRES = [
  "Electronic",
  "Vocal",
  "Instrumental",
  "Hybrid",
  "AI-only",
] as const;
export type MusicGenre = (typeof MUSIC_GENRES)[number];

export const FILM_GENRES = [
  "Short",
  "Feature",
  "Documentary",
  "Animation",
  "AI-only",
] as const;
export type FilmGenre = (typeof FILM_GENRES)[number];

export type AwardSubmission = {
  id: string;
  track: AwardTrack;
  title: string;
  author: string;
  description?: string;
  mediaUrl: string;
  year: number;
  genre: string;
  votes: number;
  createdAt: number; // ms epoch
  seeded?: boolean;
};

const SUBMISSIONS_KEY = (track: AwardTrack) =>
  `aevion_awards_${track}_submissions_v1`;
const VOTED_KEY = (track: AwardTrack) => `aevion_awards_${track}_voted_v1`;

/* ── Seeded demo data ─────────────────────────────────────── */

const SEED_MUSIC: AwardSubmission[] = [
  {
    id: "seed-music-1",
    track: "music",
    title: "Aurora Bloom",
    author: "Vega Choir",
    description: "Generative ambient with vocoder leads, 4-bar stems.",
    mediaUrl: "https://soundcloud.com/aevion/aurora-bloom",
    year: 2026,
    genre: "Electronic",
    votes: 47,
    createdAt: Date.now() - 1000 * 60 * 60 * 72,
    seeded: true,
  },
  {
    id: "seed-music-2",
    track: "music",
    title: "Quiet Frequencies",
    author: "Mira Solano",
    description: "Hand-played piano + AI string arrangement.",
    mediaUrl: "https://ipfs.io/ipfs/bafyqfdemo01",
    year: 2026,
    genre: "Hybrid",
    votes: 31,
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
    seeded: true,
  },
  {
    id: "seed-music-3",
    track: "music",
    title: "Synthetic Lullaby",
    author: "NEU.WAV",
    description: "Fully generative composition, no human samples.",
    mediaUrl: "https://www.youtube.com/watch?v=demo-synth-lullaby",
    year: 2026,
    genre: "AI-only",
    votes: 22,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    seeded: true,
  },
  {
    id: "seed-music-4",
    track: "music",
    title: "Cathedral Drone",
    author: "Atlas Hum",
    description: "Live cello multitracked through latent diffusion.",
    mediaUrl: "https://soundcloud.com/aevion/cathedral-drone",
    year: 2025,
    genre: "Instrumental",
    votes: 14,
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
    seeded: true,
  },
];

const SEED_FILM: AwardSubmission[] = [
  {
    id: "seed-film-1",
    track: "film",
    title: "Lighthouse / 2199",
    author: "Studio Halberd",
    description: "12-min generative short, single-take camera move.",
    mediaUrl: "https://www.youtube.com/watch?v=demo-lighthouse-2199",
    year: 2026,
    genre: "Short",
    votes: 53,
    createdAt: Date.now() - 1000 * 60 * 60 * 80,
    seeded: true,
  },
  {
    id: "seed-film-2",
    track: "film",
    title: "Field Recordings of a City That Doesn't Exist",
    author: "Anouk Vega",
    description: "Documentary-style essay, AI b-roll + real interviews.",
    mediaUrl: "https://ipfs.io/ipfs/bafyqfdemofilm02",
    year: 2026,
    genre: "Documentary",
    votes: 39,
    createdAt: Date.now() - 1000 * 60 * 60 * 50,
    seeded: true,
  },
  {
    id: "seed-film-3",
    track: "film",
    title: "Glasshouse",
    author: "Tarek Roy",
    description: "Hand-animated key frames, AI inbetweens.",
    mediaUrl: "https://www.youtube.com/watch?v=demo-glasshouse",
    year: 2026,
    genre: "Animation",
    votes: 18,
    createdAt: Date.now() - 1000 * 60 * 60 * 30,
    seeded: true,
  },
];

export function getSeed(track: AwardTrack): AwardSubmission[] {
  return track === "music" ? SEED_MUSIC : SEED_FILM;
}

/* ── Storage helpers (SSR-safe) ───────────────────────────── */

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readUserSubmissions(track: AwardTrack): AwardSubmission[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY(track));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is AwardSubmission =>
        x &&
        typeof x === "object" &&
        typeof x.id === "string" &&
        typeof x.title === "string"
    );
  } catch {
    return [];
  }
}

function writeUserSubmissions(track: AwardTrack, items: AwardSubmission[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(SUBMISSIONS_KEY(track), JSON.stringify(items));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

export function readVotedIds(track: AwardTrack): Set<string> {
  if (!isBrowser()) return new Set();
  try {
    const raw = localStorage.getItem(VOTED_KEY(track));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeVotedIds(track: AwardTrack, ids: Set<string>): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(VOTED_KEY(track), JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

/* ── Public API ───────────────────────────────────────────── */

/** Read all submissions (seed + user) for a track, sorted by votes desc. */
export function listSubmissions(track: AwardTrack): AwardSubmission[] {
  const seed = getSeed(track);
  const user = readUserSubmissions(track);
  const merged = [...seed, ...user];
  return merged.sort((a, b) => b.votes - a.votes);
}

/** Cross-track top-N (used by the Awards hub leaderboard widget). */
export function topN(track: AwardTrack, n = 3): AwardSubmission[] {
  return listSubmissions(track).slice(0, n);
}

export type SubmitInput = {
  track: AwardTrack;
  title: string;
  author: string;
  description?: string;
  mediaUrl: string;
  year: number;
  genre: string;
};

export function generateSubmissionId(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `usr-${ts}-${rnd}`;
}

export function addSubmission(input: SubmitInput): AwardSubmission {
  const sub: AwardSubmission = {
    id: generateSubmissionId(),
    track: input.track,
    title: input.title.trim(),
    author: input.author.trim(),
    description: input.description?.trim() || undefined,
    mediaUrl: input.mediaUrl.trim(),
    year: input.year,
    genre: input.genre,
    votes: 0,
    createdAt: Date.now(),
  };
  const next = [...readUserSubmissions(input.track), sub];
  writeUserSubmissions(input.track, next);
  return sub;
}

/**
 * Increment vote count for a submission. Seeded entries are upgraded into the
 * user store so their vote count persists. Returns the new vote count or null
 * if the submission could not be found.
 */
export function castVote(track: AwardTrack, submissionId: string): number | null {
  const voted = readVotedIds(track);
  if (voted.has(submissionId)) return null;

  const user = readUserSubmissions(track);
  const seed = getSeed(track);

  const userIdx = user.findIndex((x) => x.id === submissionId);
  if (userIdx >= 0) {
    user[userIdx] = { ...user[userIdx], votes: user[userIdx].votes + 1 };
    writeUserSubmissions(track, user);
    voted.add(submissionId);
    writeVotedIds(track, voted);
    return user[userIdx].votes;
  }

  const seedItem = seed.find((x) => x.id === submissionId);
  if (seedItem) {
    // Upgrade seed → user store (so the bumped vote sticks).
    const upgraded: AwardSubmission = {
      ...seedItem,
      votes: seedItem.votes + 1,
    };
    user.push(upgraded);
    writeUserSubmissions(track, user);
    voted.add(submissionId);
    writeVotedIds(track, voted);
    return upgraded.votes;
  }

  return null;
}

/** Reset all user submissions + votes for a track (admin/testing). */
export function resetTrack(track: AwardTrack): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(SUBMISSIONS_KEY(track));
    localStorage.removeItem(VOTED_KEY(track));
  } catch {
    /* ignore */
  }
}

/* ── AEC payout schedule (used by the payout preview box) ── */

export const AEC_PAYOUTS = {
  first: 500,
  second: 250,
  third: 100,
} as const;

/* ── Genre presets (re-exported for convenience) ──────────── */

export function genresFor(track: AwardTrack): readonly string[] {
  return track === "music" ? MUSIC_GENRES : FILM_GENRES;
}
