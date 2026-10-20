"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractClientIp = extractClientIp;
exports.resolveGeo = resolveGeo;
const geoip_lite_1 = __importDefault(require("geoip-lite"));
const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1$|fc|fd|fe80:)/i;
function extractClientIp(req) {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.length > 0) {
        const first = xff.split(",")[0].trim();
        if (first)
            return first;
    }
    return req.socket?.remoteAddress ?? null;
}
function lookupIp(ip) {
    if (!ip)
        return null;
    const normalized = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
    if (PRIVATE_IP.test(normalized))
        return null;
    try {
        const rec = geoip_lite_1.default.lookup(normalized);
        if (!rec)
            return null;
        const [lat, lng] = rec.ll || [null, null];
        return {
            country: rec.country || null,
            city: rec.city || null,
            lat: typeof lat === "number" ? lat : null,
            lng: typeof lng === "number" ? lng : null,
        };
    }
    catch {
        return null;
    }
}
function sanitizeGps(input) {
    if (!input || typeof input !== "object")
        return null;
    const obj = input;
    const lat = typeof obj.lat === "number" ? obj.lat : Number(obj.lat);
    const lng = typeof obj.lng === "number" ? obj.lng : Number(obj.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
        return null;
    if (lat < -90 || lat > 90)
        return null;
    if (lng < -180 || lng > 180)
        return null;
    return { lat, lng };
}
/**
 * Compose geo data from the request.
 *
 * @param bodyGps optional client-supplied GPS, shape `{ lat: number, lng: number }`
 * @param req Express request (used for IP extraction)
 */
function resolveGeo(bodyGps, req) {
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
