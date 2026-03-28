"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
const pg_1 = __importDefault(require("pg"));
let pool = null;
/** Единый пул Postgres для всех роутов (меньше соединений, проще отладка). */
function getPool() {
    if (!pool) {
        pool = new pg_1.default.Pool({
            connectionString: process.env.DATABASE_URL,
        });
    }
    return pool;
}
