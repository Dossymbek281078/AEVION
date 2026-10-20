"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.klassUstroystva = klassUstroystva;
function klassUstroystva(ua) {
    const s = String(ua ?? "").trim();
    if (!s)
        return "unknown";
    // Планшеты — до телефонов: у iPad и Android-планшетов нет слова Mobile.
    if (/iPad|Tablet|PlayBook|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s)))
        return "tablet";
    if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini|IEMobile/i.test(s))
        return "mobile";
    return "desktop";
}
