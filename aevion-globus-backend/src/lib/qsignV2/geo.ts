import geoip from "geoip-lite";
import type { Request } from "express";
import type { QSignGeoSource } from "./types";

/**
 * Geo-anchoring for QSign v2.
 *
 * Two sources, combined:
 *   1. IP-based lookup (geoip-lite, free MaxMind-derived DB shipped with the package).
 *   2. Optional client-supplied GPS from the request body (source="gps").
 *
 * If both are present, GPS wins for lat/lng, IP fills country/city if GPS didn't.
 * Loopback / private / unknown IPs are skipped silently.
 */

export type QSignGeo = {
  source: QSignGeoSource | null;
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
};

const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1$|fc|fd|fe80:)/i;

export function extractClientIp(req: Request): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress ?? null;
}

function lookupIp(ip: string | null): Pick<QSignGeo, "country" | "city" | "lat" | "lng"> | null {
  if (!ip) return null;
  const normalized = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (PRIVATE_IP.test(normalized)) return null;
  try {
    const rec = geoip.lookup(normalized);
    if (!rec) return null;
    const [lat, lng] = rec.ll || [null, null];
    return {
      country: rec.country || null,
      city: rec.city || null,
      lat: typeof lat === "number" ? lat : null,
      lng: typeof lng === "number" ? lng : null,
    };
  } catch {
    return null;
  }
}

function sanitizeGps(input: unknown): { lat: number; lng: number } | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const lat = typeof obj.lat === "number" ? obj.lat : Number(obj.lat);
  const lng = typeof obj.lng === "number" ? obj.lng : Number(obj.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Compose geo data from the request.
 *
 * @param bodyGps optional client-supplied GPS, shape `{ lat: number, lng: number }`
 * @param req Express request (used for IP extraction)
 */
export function resolveGeo(bodyGps: unknown, req: Request): QSignGeo {
  const ip = extractClientIp(req);
  const ipLookup = lookupIp(ip);
  const gps = sanitizeGps(bodyGps);

  if (gps) {
    return {
      source: "gps",
      country: ipLookup?.country ?? null,
      city: ipLookup?.city ?? null,
      lat: gps.lat,
      lng: gps.lng,
    };
  }

  if (ipLookup && (ipLookup.lat !== null || ipLookup.country)) {
    return {
      source: "ip",
      country: ipLookup.country,
      city: ipLookup.city,
      lat: ipLookup.lat,
      lng: ipLookup.lng,
    };
  }

  return { source: null, country: null, city: null, lat: null, lng: null };
}
