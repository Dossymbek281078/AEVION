"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildZip = buildZip;
exports.readZip = readZip;
/**
 * Минимальный писатель ZIP (PKWARE APPNOTE 6.3) на встроенном zlib.
 *
 * Зачем свой: в бэке нет ни одной zip-библиотеки, а ставить зависимость ради
 * выгрузки записей аккаунта (до 500 файлов по несколько КБ) незачем. Формат
 * прост: на каждый файл — local file header + данные, затем central directory
 * и end of central directory record. Без ZIP64 (предел 65535 файлов и 4 ГБ —
 * для выгрузки с лимитом 500 записей недостижим; превышение — исключение,
 * а не битый архив).
 *
 * Имена — UTF-8 с флагом 0x800 (bit 11), иначе распаковщики Windows читают
 * их в OEM-кодировке. Сжатие — deflate (метод 8), если оно уменьшает файл,
 * иначе store (метод 0).
 *
 * Проверен сторонними распаковщиками (bsdtar / Expand-Archive) в
 * tests/certificatesExportZip.test.ts — побайтное сравнение файлов.
 */
const zlib_1 = __importDefault(require("zlib"));
/** DOS-время и дата (локальные поля zip без часового пояса — пишем UTC). */
function dosDateTime(d) {
    const year = Math.max(1980, d.getUTCFullYear());
    const time = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2);
    const date = ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
    return { time, date };
}
function buildZip(entries, when = new Date()) {
    if (entries.length > 0xffff)
        throw new Error("zip: too many entries without ZIP64");
    const { time, date } = dosDateTime(when);
    const locals = [];
    const centrals = [];
    let offset = 0;
    const seen = new Set();
    for (const e of entries) {
        if (seen.has(e.name))
            throw new Error(`zip: duplicate entry name ${e.name}`);
        seen.add(e.name);
        const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, "utf8");
        const nameBuf = Buffer.from(e.name, "utf8");
        const crc = zlib_1.default.crc32(raw) >>> 0;
        const deflated = zlib_1.default.deflateRawSync(raw);
        const useDeflate = deflated.length < raw.length;
        const body = useDeflate ? deflated : raw;
        const method = useDeflate ? 8 : 0;
        if (body.length > 0xfffffffe || raw.length > 0xfffffffe || offset > 0xfffffffe) {
            throw new Error("zip: entry too large without ZIP64");
        }
        const flags = 0x0800; // имя в UTF-8
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4); // version needed
        local.writeUInt16LE(flags, 6);
        local.writeUInt16LE(method, 8);
        local.writeUInt16LE(time, 10);
        local.writeUInt16LE(date, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(body.length, 18);
        local.writeUInt32LE(raw.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28); // extra length
        locals.push(local, nameBuf, body);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4); // version made by (MS-DOS, 2.0)
        central.writeUInt16LE(20, 6); // version needed
        central.writeUInt16LE(flags, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt16LE(time, 12);
        central.writeUInt16LE(date, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(body.length, 20);
        central.writeUInt32LE(raw.length, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt16LE(0, 30); // extra
        central.writeUInt16LE(0, 32); // comment
        central.writeUInt16LE(0, 34); // disk number start
        central.writeUInt16LE(0, 36); // internal attrs
        central.writeUInt32LE(0, 38); // external attrs
        central.writeUInt32LE(offset, 42);
        centrals.push(central, nameBuf);
        offset += local.length + nameBuf.length + body.length;
    }
    const cdStart = offset;
    const cdSize = centrals.reduce((n, b) => n + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(cdSize, 12);
    end.writeUInt32LE(cdStart, 16);
    end.writeUInt16LE(0, 20);
    return Buffer.concat([...locals, ...centrals, end]);
}
/**
 * Читатель ровно этого подмножества формата (для тестов и самопроверки):
 * идёт по central directory, сверяет CRC каждого файла. Битый CRC — исключение.
 */
function readZip(buf) {
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0)
        throw new Error("zip: no end record");
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    const out = new Map();
    for (let i = 0; i < count; i++) {
        if (buf.readUInt32LE(p) !== 0x02014b50)
            throw new Error("zip: bad central header");
        const method = buf.readUInt16LE(p + 10);
        const crc = buf.readUInt32LE(p + 16);
        const csize = buf.readUInt32LE(p + 20);
        const nlen = buf.readUInt16LE(p + 28);
        const xlen = buf.readUInt16LE(p + 30);
        const clen = buf.readUInt16LE(p + 32);
        const lho = buf.readUInt32LE(p + 42);
        const name = buf.subarray(p + 46, p + 46 + nlen).toString("utf8");
        const lnlen = buf.readUInt16LE(lho + 26);
        const lxlen = buf.readUInt16LE(lho + 28);
        const dataStart = lho + 30 + lnlen + lxlen;
        const body = buf.subarray(dataStart, dataStart + csize);
        const raw = method === 8 ? zlib_1.default.inflateRawSync(body) : method === 0 ? Buffer.from(body) : null;
        if (!raw)
            throw new Error(`zip: unsupported method ${method}`);
        if ((zlib_1.default.crc32(raw) >>> 0) !== crc)
            throw new Error(`zip: crc mismatch in ${name}`);
        out.set(name, raw);
        p += 46 + nlen + xlen + clen;
    }
    return out;
}
