"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadsFile = leadsFile;
const node_path_1 = require("node:path");
/**
 * Путь к журналу заявок leads.jsonl — тот же, что у routes/pricing.ts (LEADS_FILE →
 * том Railway → data/leads.jsonl). Вынесен отдельно (129, 13.10.2026): импорт
 * routes/pricing ради одной функции тянул весь модуль цен, и сторож ручки заказа
 * пилота висел 35 с на его загрузке.
 */
function leadsFile() {
    const fromEnv = process.env.LEADS_FILE?.trim();
    if (fromEnv)
        return fromEnv;
    const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
    if (mount)
        return (0, node_path_1.join)(mount, "leads.jsonl");
    return (0, node_path_1.join)(process.cwd(), "data", "leads.jsonl");
}
