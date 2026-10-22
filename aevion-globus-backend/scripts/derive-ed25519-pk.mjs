#!/usr/bin/env node
// Вывод ОТКРЫТОГО ключа Ed25519 из закрытого (base64 PKCS8 DER — формат QSKYWAY_SIGN_SK / AEVION_TRUST_SIGN_SK).
// Нужен при ротации (22.10.2026): отставленный закрытый ключ из окружения удаляется, а его открытая часть
// добавляется в AEVION_RETIRED_SIGN_PKS как "<spki-base64>@<YYYY-MM-DD>", чтобы прежние подписи проверялись.
//
// Закрытый ключ подаётся ТОЛЬКО через stdin и никогда не печатается:
//   railway run -s AEVION -- node -e "process.stdout.write(process.env.QSKYWAY_SIGN_SK||'')" | node scripts/derive-ed25519-pk.mjs [--date 2026-10-22]
// Печатает одну строку: <spki-base64>@<дата> — готовую запись для AEVION_RETIRED_SIGN_PKS, и отпечаток в stderr.
// Коды: 0 выведено; 2 — пустой ввод или ключ не разобран.
import crypto from "node:crypto";

const dateArg = process.argv.indexOf("--date");
const date = dateArg > 0 ? process.argv[dateArg + 1] : new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
  console.error("--date должен быть YYYY-MM-DD");
  process.exit(2);
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  const b64 = raw.trim();
  if (!b64) {
    console.error("пустой ввод: подайте base64 PKCS8 закрытого ключа через stdin");
    process.exit(2);
  }
  try {
    const sk = crypto.createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" });
    if (sk.asymmetricKeyType !== "ed25519") {
      console.error(`ключ не Ed25519: ${sk.asymmetricKeyType}`);
      process.exit(2);
    }
    const der = crypto.createPublicKey(sk).export({ type: "spki", format: "der" });
    const fp = crypto.createHash("sha256").update(der).digest("hex").slice(0, 16);
    process.stdout.write(`${der.toString("base64")}@${date}\n`);
    console.error(`отпечаток открытого ключа: ${fp} (сверьте с keyFingerprint в выданных документах)`);
  } catch (e) {
    console.error("закрытый ключ не разобран:", e instanceof Error ? e.message : e);
    process.exit(2);
  }
});
