import type pg from "pg";
import { VOICE_OF_EARTH_SEED } from "../data/voiceOfEarthSeed";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isVoiceOfEarthDbReady(): boolean {
  return dbReady === true;
}

export function getVoiceOfEarthDbError(): string | null {
  return dbError;
}

export async function ensureVoiceOfEarthTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(`[VoiceOfEarth] Database unavailable — falling back to in-memory: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS voe_tracks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        artist_alias TEXT NOT NULL,
        language TEXT NOT NULL,
        lyrics TEXT NOT NULL,
        mood TEXT NOT NULL CHECK (mood IN ('hopeful','peaceful','joyful','reflective','uplifting')),
        audio_url TEXT,
        votes INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('pending','published','flagged')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voe_tracks_lang ON voe_tracks(language);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voe_tracks_mood ON voe_tracks(mood);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voe_tracks_votes ON voe_tracks(votes DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voe_tracks_status ON voe_tracks(status);`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS voe_votes (
        id SERIAL PRIMARY KEY,
        track_id INTEGER NOT NULL REFERENCES voe_tracks(id) ON DELETE CASCADE,
        voter_alias TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(track_id, voter_alias)
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_voe_votes_track ON voe_votes(track_id);`);

    dbReady = true;
    console.log("[VoiceOfEarth] Tables ready");

    // Seed empty table
    try {
      const { rows } = await pool.query(`SELECT COUNT(*)::text AS count FROM voe_tracks`);
      const count = Number(rows[0]?.count ?? "0");
      if (count === 0) {
        for (const t of VOICE_OF_EARTH_SEED) {
          await pool.query(
            `INSERT INTO voe_tracks (title, artist_alias, language, lyrics, mood, audio_url, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'published')`,
            [t.title, t.artistAlias, t.language, t.lyrics, t.mood, t.audioUrl],
          );
        }
        console.log(`[VoiceOfEarth] Seeded ${VOICE_OF_EARTH_SEED.length} tracks`);
      }
    } catch (e: unknown) {
      console.warn(`[VoiceOfEarth] Seed insert failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[VoiceOfEarth] Could not create tables — falling back to in-memory: ${dbError}`);
  } finally {
    ensured = true;
  }
}
