#!/usr/bin/env node
/**
 * Offline: доказывает, что путь «выставить ключ» реально работает.
 *
 * Зачем. Основателю подавалась развилка «поставить ключ ИЛИ смягчить
 * формулировку» как два равных пути. Равными они являются только если
 * первый работает. Наличие кода это не доказывает: до сих пор проверялось
 * лишь то, что health честно РАПОРТУЕТ режим (qsign-mode-smoke), а не то,
 * что в режиме `real` получается настоящая ML-DSA-65-подпись.
 *
 * Главное здесь — не «verify вернул true». Проверка, которая всегда говорит
 * «валидно», на честном входе выглядит точно так же. Поэтому ниже три
 * случая с подделкой: подпись ОБЯЗАНА их отвергнуть.
 *
 * Работает против dist/, поэтому в оркестраторе offline.
 */
const path = require("path");
const { execFileSync } = require("child_process");

const DIST = path.join(__dirname, "..", "dist", "lib", "qsignV2", "dilithium.js");
const dil = require(DIST);

let ok = true;
function check(label, pass, detail) {
  if (!pass) ok = false;
  console.log(`${pass ? "  ✓" : "  ✘"} ${label}`);
  if (!pass && detail) console.log(`      ${detail}`);
}

// Тестовый сид — не секрет: детерминированный, только для этой проверки.
// Прод-ключ живёт в Railway и сюда не попадает.
const TEST_SEED = "a1".repeat(32); // 64 hex-символа
const PAYLOAD = JSON.stringify({ subject: "aevion-smoke", n: 1 });

async function main() {
  const original = process.env.QSIGN_DILITHIUM_V1_SEED;
  process.env.QSIGN_DILITHIUM_V1_SEED = TEST_SEED;

  const kp = await dil.getActiveDilithium();
  check("ключ принят, пара выведена", !!kp, "getActiveDilithium() вернул null");
  if (!kp) return finish(original);

  check(`kid = ${dil.DILITHIUM_KID_REAL}`, kp.kid === dil.DILITHIUM_KID_REAL, `получено ${kp.kid}`);

  const signed = await dil.signDilithium(PAYLOAD);

  check("mode = real", signed.mode === "real", `получено ${signed.mode}`);
  check(
    `длина подписи = ${dil.DILITHIUM_REAL_HEX_LEN} hex (ML-DSA-65)`,
    signed.signature.length === dil.DILITHIUM_REAL_HEX_LEN,
    `получено ${signed.signature.length} hex-символов`,
  );
  check(
    "это НЕ preview-отпечаток (128 hex)",
    signed.signature.length !== dil.DILITHIUM_PREVIEW_HEX_LEN,
    "подпись длиной с SHA-512 — real-путь не сработал",
  );
  check("публичный ключ отдан вместе с подписью", typeof signed.publicKey === "string" && signed.publicKey.length > 0);

  const good = await dil.verifyDilithium(PAYLOAD, signed.signature, signed.kid);
  check("своя подпись проходит проверку", good.valid === true && good.mode === "real", JSON.stringify(good));

  // --- ДИСКРИМИНИРУЮЩАЯ СИЛА -------------------------------------------
  // Без этих трёх случаев всё выше прошло бы и у заглушки `return true`.

  const otherPayload = JSON.stringify({ subject: "aevion-smoke", n: 2 });
  const r1 = await dil.verifyDilithium(otherPayload, signed.signature, signed.kid);
  check("ПОДМЕНА ТЕЛА отвергается", r1.valid === false, `${JSON.stringify(r1)} — проверка не различает вход`);

  // Портим один hex-символ подписи, длину сохраняем.
  const flipped = (signed.signature[0] === "a" ? "b" : "a") + signed.signature.slice(1);
  const r2 = await dil.verifyDilithium(PAYLOAD, flipped, signed.kid);
  check("ПОДМЕНА ПОДПИСИ отвергается", r2.valid === false, JSON.stringify(r2));

  // Подпись правильной длины, но целиком из нулей.
  const zeros = "0".repeat(dil.DILITHIUM_REAL_HEX_LEN);
  const r3 = await dil.verifyDilithium(PAYLOAD, zeros, signed.kid);
  check("нулевая подпись нужной длины отвергается", r3.valid === false, JSON.stringify(r3));

  // --- СОВМЕСТИМОСТЬ СО СТАРЫМИ СТРОКАМИ -------------------------------
  // Ряды, подписанные в preview до включения ключа, обязаны проверяться и
  // после. Иначе включение ключа тихо обесценит всю прошлую историю.
  // ВАЖНО: сид нельзя просто удалить из process.env — realKeypairCache живёт
  // на процесс, и после первого getActiveDilithium() режим уже не переключить.
  // (На этом упала первая версия проверки: "preview"-подпись выходила real.)
  // В проде это верное поведение — env задаётся на старте. Поэтому preview
  // получаем в чистом процессе БЕЗ сида.
  const previewJson = execFileSync(
    process.execPath,
    [
      "-e",
      `delete process.env.QSIGN_DILITHIUM_V1_SEED;` +
        `require(${JSON.stringify(DIST)}).signDilithium(${JSON.stringify(PAYLOAD)})` +
        `.then(r=>process.stdout.write(JSON.stringify(r)))`,
    ],
    { encoding: "utf8", timeout: 60000, env: { ...process.env, QSIGN_DILITHIUM_V1_SEED: "" } },
  );
  const previewSigned = JSON.parse(previewJson);
  check(
    "чистый процесс без сида даёт именно preview (128 hex)",
    previewSigned.mode === "preview" && previewSigned.signature.length === dil.DILITHIUM_PREVIEW_HEX_LEN,
    `mode=${previewSigned.mode} len=${previewSigned.signature.length}`,
  );
  const legacy = await dil.verifyDilithium(PAYLOAD, previewSigned.signature, previewSigned.kid);
  check(
    "preview-строка проверяется и ПОСЛЕ включения ключа",
    legacy.valid === true && legacy.mode === "preview",
    JSON.stringify(legacy),
  );

  // --- ДЕТЕРМИНИРОВАННОСТЬ ---------------------------------------------
  // Один сид обязан давать один и тот же публичный ключ. Иначе после
  // рестарта Railway все выданные подписи перестанут проверяться.
  // Кеш живёт на процесс, поэтому второй замер — в отдельном процессе.
  let childPub = "";
  try {
    childPub = execFileSync(
      process.execPath,
      [
        "-e",
        `process.env.QSIGN_DILITHIUM_V1_SEED=${JSON.stringify(TEST_SEED)};` +
          `require(${JSON.stringify(DIST)}).getActiveDilithium()` +
          `.then(k=>process.stdout.write(Buffer.from(k.publicKey).toString("hex")))`,
      ],
      { encoding: "utf8", timeout: 60000 },
    ).trim();
  } catch (e) {
    childPub = "<не удалось запустить дочерний процесс: " + (e && e.message) + ">";
  }
  const ourPub = Buffer.from(kp.publicKey).toString("hex");
  check(
    "тот же сид в НОВОМ процессе → тот же публичный ключ (переживёт рестарт)",
    childPub === ourPub,
    `наш ${ourPub.slice(0, 24)}… vs дочерний ${String(childPub).slice(0, 24)}…`,
  );

  finish(original);
}

function finish(original) {
  if (original === undefined) delete process.env.QSIGN_DILITHIUM_V1_SEED;
  else process.env.QSIGN_DILITHIUM_V1_SEED = original;

  console.log(
    ok
      ? "\nPASS — путь «выставить ключ» рабочий: подпись настоящая и отличает подделку"
      : "\nFAIL — путь «выставить ключ» НЕ работает как заявлено",
  );
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.log("  ✘ упало:", e && e.message ? e.message : e);
  console.log("\nFAIL");
  process.exit(1);
});
