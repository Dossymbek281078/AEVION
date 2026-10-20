"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVoiceOfEarthDbReady = isVoiceOfEarthDbReady;
exports.getVoiceOfEarthDbError = getVoiceOfEarthDbError;
exports.ensureVoiceOfEarthTables = ensureVoiceOfEarthTables;
const voiceOfEarthSeed_1 = require("../data/voiceOfEarthSeed");
let ensured = false;
let dbReady = null;
let dbError = null;
function isVoiceOfEarthDbReady() {
    return dbReady === true;
}
function getVoiceOfEarthDbError() {
    return dbError;
}
async function ensureVoiceOfEarthTables(pool) {
    if (ensured)
        return;
    try {
        await pool.query("SELECT 1");
    }
    catch (e) {
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
        // Lazy migration: add content_hash column if not present (QRight-compatible authorship proof)
        await pool.query(`ALTER TABLE voe_tracks ADD COLUMN IF NOT EXISTS content_hash TEXT;`);
        dbReady = true;
        console.log("[VoiceOfEarth] Tables ready");
        // Seed empty table
        try {
            const { rows } = await pool.query(`SELECT COUNT(*)::text AS count FROM voe_tracks`);
            const count = Number(rows[0]?.count ?? "0");
            if (count === 0) {
                for (const t of voiceOfEarthSeed_1.VOICE_OF_EARTH_SEED) {
                    await pool.query(`INSERT INTO voe_tracks (title, artist_alias, language, lyrics, mood, audio_url, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'published')`, [t.title, t.artistAlias, t.language, t.lyrics, t.mood, t.audioUrl]);
                }
                console.log(`[VoiceOfEarth] Seeded ${voiceOfEarthSeed_1.VOICE_OF_EARTH_SEED.length} tracks`);
            }
        }
        catch (e) {
            console.warn(`[VoiceOfEarth] Seed insert failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    catch (e) {
        dbReady = false;
        dbError = e instanceof Error ? e.message : "table creation failed";
        console.warn(`[VoiceOfEarth] Could not create tables — falling back to in-memory: ${dbError}`);
    }
    finally {
        ensured = true;
    }
}
