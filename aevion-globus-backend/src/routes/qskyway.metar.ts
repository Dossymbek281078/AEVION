// QSkyway — real ground-wind feed via aviationweather.gov's public METAR API
// (no API key, no registration — https://aviationweather.gov/data/api/).
//
// Replaces the illustrative ground-level wind reading with the nearest
// airport's actual current METAR observation. Altitude-growth above ground
// stays a simplified model (METAR has no winds-aloft data); see windAt() in
// qskyway.ts. Fails soft: on any fetch/parse error the cache entry is left
// as-is (or absent), and callers fall back to the synthetic WindConfig.

const CITY_STATION: Record<string, string> = {
  astana: "UACC", // Astana Nazarbayev Intl
  nyc: "KJFK", // JFK Intl
  tokyo: "RJTT", // Tokyo Haneda Intl
};

interface MetarWind { fromDeg: number; speedMs: number; obsTime: string; station: string; }

const cache = new Map<string, MetarWind>();
let lastFetchOk = false;
let lastFetchAt: string | null = null;

const KT_TO_MS = 0.514444;

async function refresh(): Promise<void> {
  const ids = Object.values(CITY_STATION).join(",");
  try {
    const res = await fetch(`https://aviationweather.gov/api/data/metar?ids=${ids}&format=json`);
    if (!res.ok) throw new Error("metar http " + res.status);
    const rows: Array<{ icaoId: string; wdir: number | string; wspd: number; reportTime: string }> = await res.json();
    const byStation = new Map(rows.map((r) => [r.icaoId, r]));
    for (const [cityId, station] of Object.entries(CITY_STATION)) {
      const row = byStation.get(station);
      if (!row) continue;
      // wdir is the string "VRB" when direction is variable — no usable bearing, skip this refresh for the city.
      if (typeof row.wdir !== "number" || typeof row.wspd !== "number") continue;
      cache.set(cityId, {
        fromDeg: row.wdir,
        speedMs: +(row.wspd * KT_TO_MS).toFixed(2),
        obsTime: row.reportTime,
        station,
      });
    }
    lastFetchOk = true;
  } catch (err) {
    lastFetchOk = false;
    console.warn("[qskyway] METAR wind refresh failed — using illustrative fallback:", err instanceof Error ? err.message : err);
  } finally {
    lastFetchAt = new Date().toISOString();
  }
}

// Fire on module load, then every 10 minutes — matches METAR's own ~1/min
// station update cadence closely enough without hammering the public API.
refresh();
setInterval(refresh, 10 * 60 * 1000).unref?.();

export function getMetarWind(cityId: string): MetarWind | null {
  return cache.get(cityId) ?? null;
}

export function metarStatus(): { lastFetchOk: boolean; lastFetchAt: string | null; cities: Record<string, MetarWind | null> } {
  const cities: Record<string, MetarWind | null> = {};
  for (const cityId of Object.keys(CITY_STATION)) cities[cityId] = cache.get(cityId) ?? null;
  return { lastFetchOk, lastFetchAt, cities };
}
