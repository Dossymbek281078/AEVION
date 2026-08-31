/**
 * Offline verification of an AEVION bundle.
 *
 * Runs entirely in the browser using WebCrypto. Does NOT contact AEVION.
 * Returns a per-check verdict so the UI can show exactly which layer
 * passed and which failed — so a verifier sees the full picture.
 *
 * Trust anchors after this module runs:
 *   - SHA-256 (verifier recomputes the hash from canonical inputs)
 *   - Ed25519 (verifier checks AEVION's and the author's signatures)
 *   - Bitcoin (verifier optionally runs an OT client against
 *     proofs.openTimestamps.proofBase64; we only flag presence here)
 */

export interface AevionBundle {
  version: number;
  bundleType: string;
  exportedAt?: string;
  certificate: {
    id: string;
    title: string;
    kind: string;
    description: string;
    author?: string | null;
    contentHash: string;
    protectedAt?: string | null;
    status?: string;
  };
  proofs: {
    contentHash: {
      algo: string;
      value: string;
      canonicalInputs: {
        title: string;
        description: string;
        kind: string;
        country: string | null;
        city: string | null;
      };
    };
    aevionEd25519: {
      algo: "Ed25519";
      publicKeyRawHex: string;
      publicKeySpkiHex?: string;
      signedPayload: string;
      signature: string;
    } | null;
    qsignHmac?: unknown;
    authorCosign: {
      algo: string;
      publicKeyBase64: string;
      signature: string;
    } | null;
    openTimestamps: {
      status: string;
      bitcoinBlockHeight: number | null;
      stampedAt: string | null;
      upgradedAt: string | null;
      proofBase64: string | null;
    } | null;
  };
}

export type CheckStatus = "pass" | "fail" | "skip";

export interface BundleVerificationResult {
  bundleShape: { status: CheckStatus; detail: string };
  contentHash: { status: CheckStatus; detail: string };
  aevionSignature: { status: CheckStatus; detail: string };
  authorCosignature: { status: CheckStatus; detail: string };
  platformAttestation: { status: CheckStatus; detail: string };
  bitcoinAnchor: { status: CheckStatus; detail: string };
  overall: CheckStatus;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function sha256Hex(input: ArrayBufferLike | Uint8Array): Promise<string> {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new Uint8Array(buf);
  // crypto.subtle.digest returns ArrayBuffer when given a BufferSource.
  // Pass the underlying buffer + byteOffset/byteLength to avoid copies.
  const hash = await crypto.subtle.digest(
    "SHA-256",
    view,
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function nfc(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return String(v).normalize("NFC");
}

/**
 * Открытые ключи платформы, ЗАКРЕПЛЁННЫЕ в самом верификаторе.
 *
 * Смысл именно в закреплении. Всё остальное в пакете самосогласовано: подпись
 * проверяется ключом, который приехал в том же файле. Ключ ниже приехал НЕ с
 * пакетом — он часть этой страницы, и потому способен отличить наш сертификат
 * от собранного посторонним.
 *
 * Сверить можно самому: тот же ключ публикуется на
 * https://api.aevion.app/api/qsign/v2/keys (kid + publicKey). Сверка — шаг
 * добровольный: она обращается к нам, а обещание страницы в том, что БЕЗ НАС
 * проверка тоже работает.
 *
 * При смене ключа сюда добавляется НОВАЯ строка, старая остаётся: сертификаты,
 * выпущенные прежним ключом, обязаны проверяться и после ротации.
 */
const PLATFORM_PUBLIC_KEYS: Record<string, string> = {
  "qsign-ed25519-v1":
    "63fd4f60e1839498443a99cd69710fe3c7089606fb2188b75246f9903c0b36b8",
};

async function recomputeContentHash(inputs: {
  title: string;
  description: string;
  kind: string;
  country: string | null;
  city: string | null;
}): Promise<string> {
  const canonical: Record<string, string | null> = {
    title: nfc(inputs.title) ?? "",
    description: nfc(inputs.description) ?? "",
    kind: nfc(inputs.kind) ?? "other",
    country: nfc(inputs.country),
    city: nfc(inputs.city),
  };
  const sorted: Record<string, string | null> = {};
  for (const k of Object.keys(canonical).sort()) sorted[k] = canonical[k];
  return sha256Hex(new TextEncoder().encode(JSON.stringify(sorted)));
}

/**
 * ПРАВИЛО v1 — то, которым считались хеши до канонизации: обычный
 * JSON.stringify трёх полей, страна и город в хеш НЕ входили.
 *
 * Зачем оно здесь. Офлайн-проверка — вторая поверхность того же обещания
 * («проверяемо, даже если AEVION исчезнет»), и до 27.08.2026 она знала
 * только нынешнее правило. То есть четыре сертификата из пяти в публичном
 * реестре в автономном пакете читались как подделка — ровно тот же дефект,
 * что был на сервере, только чинить его пришлось бы отдельно.
 *
 * Воспроизведено ТОЛЬКО для проверки. Ничего нового этим правилом не
 * считается и не выдаётся.
 */
async function legacyContentHashV1(inputs: {
  title: string;
  description: string;
  kind: string;
}): Promise<string> {
  return sha256Hex(
    new TextEncoder().encode(
      JSON.stringify({
        title: inputs.title,
        description: inputs.description,
        kind: inputs.kind,
      }),
    ),
  );
}

const SPKI_ED25519_PREFIX_BYTES = hexToBytes("302a300506032b6570032100");

async function importEd25519Spki(spki: Uint8Array): Promise<CryptoKey> {
  // Strip generic narrowing: Next.js builds with stricter lib.dom types
  // where the BufferSource overload requires Uint8Array<ArrayBuffer>,
  // not Uint8Array<ArrayBufferLike>.
  return crypto.subtle.importKey(
    "spki",
    spki as BufferSource,
    { name: "Ed25519" },
    true,
    ["verify"],
  );
}

function wrapRawAsSpki(raw32: Uint8Array): Uint8Array {
  const out = new Uint8Array(SPKI_ED25519_PREFIX_BYTES.length + raw32.length);
  out.set(SPKI_ED25519_PREFIX_BYTES, 0);
  out.set(raw32, SPKI_ED25519_PREFIX_BYTES.length);
  return out;
}

export function isAevionBundle(value: unknown): value is AevionBundle {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.bundleType === "aevion-verification-bundle" &&
    typeof v.version === "number" &&
    !!v.certificate &&
    !!v.proofs
  );
}

export async function verifyAevionBundle(
  bundle: AevionBundle,
): Promise<BundleVerificationResult> {
  const result: BundleVerificationResult = {
    bundleShape: { status: "pass", detail: "Recognized AEVION bundle v" + bundle.version },
    contentHash: { status: "skip", detail: "" },
    aevionSignature: { status: "skip", detail: "" },
    authorCosignature: { status: "skip", detail: "" },
    platformAttestation: { status: "skip", detail: "" },
    bitcoinAnchor: { status: "skip", detail: "" },
    overall: "pass",
  };

  /* ── 1) Content hash ── */
  try {
    const inputs = bundle.proofs.contentHash.canonicalInputs;
    const stored = bundle.proofs.contentHash.value;
    const recomputed = await recomputeContentHash(inputs);
    if (recomputed === stored) {
      result.contentHash = {
        status: "pass",
        detail: "SHA-256 of canonical inputs matches the stored contentHash",
      };
    } else if ((await legacyContentHashV1(inputs)) === stored) {
      // Сертификат выдан до канонизации. Проверяем правилом времени выдачи —
      // и сразу говорим, чего это правило НЕ покрывало: молча принять старое
      // правило значило бы обещать защиту полей, которой у него не было.
      result.contentHash = {
        status: "pass",
        detail:
          "SHA-256 matches under the v1 rule this certificate was issued with " +
          "(title, description and work type only — country and city are recorded " +
          "on the certificate but not covered by this hash)",
      };
    } else {
      result.contentHash = {
        status: "fail",
        detail: `Recomputed ${recomputed.slice(0, 12)}... but bundle says ${stored.slice(0, 12)}...`,
      };
    }
  } catch (e) {
    result.contentHash = { status: "fail", detail: (e as Error).message };
  }

  /* ── 2) AEVION Ed25519 signature ── */
  const aevion = bundle.proofs.aevionEd25519;
  if (!aevion) {
    result.aevionSignature = {
      status: "skip",
      detail: "Bundle contains no AEVION Ed25519 signature",
    };
  } else {
    try {
      const rawPub = hexToBytes(aevion.publicKeyRawHex);
      if (rawPub.length !== 32) {
        throw new Error(`expected 32-byte raw Ed25519, got ${rawPub.length}`);
      }
      const spki = wrapRawAsSpki(rawPub);
      const pubKey = await importEd25519Spki(spki);
      const sigBytes = hexToBytes(aevion.signature);
      const messageBytes = new TextEncoder().encode(aevion.signedPayload);
      const ok = await crypto.subtle.verify(
        { name: "Ed25519" },
        pubKey,
        sigBytes as BufferSource,
        messageBytes as BufferSource,
      );
      result.aevionSignature = ok
        ? {
            status: "pass",
            detail:
              "The Ed25519 signature validates against the signed payload, using the " +
              "public key carried in this bundle. Note what that does and does not show: " +
              "the payload has not been altered since it was signed. It does not prove the " +
              "key was AEVION's — the signing key is generated per certificate and its " +
              "public half travels inside the bundle. Independent proof of time comes from " +
              "the Bitcoin anchor below.",
          }
        : {
            status: "fail",
            detail: "AEVION signature does not validate — bundle has been tampered",
          };
    } catch (e) {
      result.aevionSignature = { status: "fail", detail: (e as Error).message };
    }
  }

  /* ── 3) Author co-signature ── */
  const co = bundle.proofs.authorCosign;
  if (!co) {
    result.authorCosignature = {
      status: "skip",
      detail: "Bundle has no author co-signature (legacy single-party cert)",
    };
  } else {
    try {
      const rawPub = base64ToBytes(co.publicKeyBase64);
      if (rawPub.length !== 32) {
        throw new Error(`expected 32-byte raw Ed25519 author key, got ${rawPub.length}`);
      }
      const sig = base64ToBytes(co.signature);
      if (sig.length !== 64) {
        throw new Error(`expected 64-byte Ed25519 signature, got ${sig.length}`);
      }
      const spki = wrapRawAsSpki(rawPub);
      const pubKey = await importEd25519Spki(spki);
      const messageBytes = new TextEncoder().encode(
        bundle.proofs.contentHash.value,
      );
      const ok = await crypto.subtle.verify(
        { name: "Ed25519" },
        pubKey,
        sig as BufferSource,
        messageBytes as BufferSource,
      );
      const fpHash = await sha256Hex(rawPub);
      const fp = fpHash.slice(0, 16);
      result.authorCosignature = ok
        ? {
            status: "pass",
            detail: `Author Ed25519 signature validates · key fingerprint ed25519:${fp}`,
          }
        : {
            status: "fail",
            detail: `Author signature does not validate · purported key ed25519:${fp}`,
          };
    } catch (e) {
      result.authorCosignature = { status: "fail", detail: (e as Error).message };
    }
  }

  /* ── 3.5) Заверение эфемерного ключа постоянным ключом платформы ── */
  const pa = (bundle.proofs as Record<string, unknown>).platformAttestation as
    | { kid?: string; signature?: string }
    | null
    | undefined;
  const aevionRawHex = bundle.proofs.aevionEd25519?.publicKeyRawHex;
  if (!pa || !pa.kid || !pa.signature) {
    result.platformAttestation = {
      status: "skip",
      detail:
        "This bundle carries no platform attestation. Without it, the signatures above " +
        "only show internal consistency: the key that verifies them travels inside this " +
        "same file. Certificates issued before this layer existed have none.",
    };
  } else if (!aevionRawHex) {
    result.platformAttestation = {
      status: "skip",
      detail: "No per-certificate public key to attest.",
    };
  } else {
    const pinned = PLATFORM_PUBLIC_KEYS[pa.kid];
    if (!pinned) {
      // Неизвестный kid — НЕ «пропустим»: подпись, которую нечем сверить,
      // ничем не лучше её отсутствия, а выглядела бы убедительнее.
      result.platformAttestation = {
        status: "fail",
        detail:
          `Attestation references key '${pa.kid}', which this verifier does not know. ` +
          "Either the bundle is not ours, or this page predates a key rotation — " +
          "compare with the key list published by AEVION before trusting it.",
      };
    } else {
      try {
        const pubKey = await importEd25519Spki(wrapRawAsSpki(hexToBytes(pinned)));
        const ok = await crypto.subtle.verify(
          { name: "Ed25519" },
          pubKey,
          hexToBytes(pa.signature) as BufferSource,
          new TextEncoder().encode(aevionRawHex) as BufferSource,
        );
        result.platformAttestation = ok
          ? {
              status: "pass",
              detail:
                `AEVION's long-lived key '${pa.kid}' signs this certificate's key. This is ` +
                "the one layer whose key did NOT come from the bundle — it is pinned in " +
                "this verifier, so a bundle assembled by someone else fails here.",
            }
          : {
              status: "fail",
              detail:
                "The platform attestation does not validate against AEVION's known key: " +
                "this certificate's key was not attested by AEVION.",
            };
      } catch (e) {
        result.platformAttestation = { status: "fail", detail: (e as Error).message };
      }
    }
  }

/**
 * Проверяет, что доказательство OpenTimestamps относится ИМЕННО к этому
 * документу: в его начале лежит зафиксированный дайджест.
 *
 * Формат (проверено на живом доказательстве с прода, 665 байт):
 *   31 байт магии ` OpenTimestamps  Proof ...`
 *    1 байт версии (1)
 *    1 байт алгоритма (0x08 = SHA-256)
 *   32 байта дайджеста
 *
 * Чего эта проверка НЕ делает: не доказывает, что дайджест попал в блок
 * биткойна. Для этого нужны данные сети биткойна — их у страницы нет и по
 * замыслу быть не должно. Но она ловит подмену, которую прежняя проверка
 * пропускала: приложить ЧУЖОЕ доказательство (или любое) и объявить пакет
 * заякоренным.
 *
 * Возвращает null, если разобрать не удалось: неизвестный формат — это «не
 * знаю», и выдавать его за провал нельзя, иначе честные пакеты покраснеют.
 */
/**
 * Есть ли в доказательстве метка подтверждения БИТКОЙНОМ.
 *
 * OpenTimestamps помечает каждое подтверждение восьмибайтовой меткой. Пока
 * доказательство только у календаря, стоит метка календаря; после включения в
 * блок появляется биткойновая. Проверено на живом доказательстве прода со
 * статусом `pending`: метка календаря есть, биткойновой нет.
 *
 * Зачем: пакет может ЗАЯВЛЯТЬ `bitcoin-confirmed`, а везти доказательство,
 * которое до блока ещё не дошло. Тогда наши же два ответа об одном спорят, и
 * верить надо байтам, а не полю.
 */
function otsHasBitcoinAttestation(bytes: Uint8Array): boolean {
  const TAG = [0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01];
  outer: for (let i = 0; i + TAG.length <= bytes.length; i++) {
    for (let k = 0; k < TAG.length; k++) if (bytes[i + k] !== TAG[k]) continue outer;
    return true;
  }
  return false;
}

function otsBytes(proofB64: string): Uint8Array | null {
  try {
    const bin = atob(proofB64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function otsCommitsTo(proofB64: string, contentHash: string): boolean | null {
  try {
    const bin = atob(proofB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const MAGIC = "004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e89294";
    const head = Array.from(bytes.subarray(0, 31))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (head !== MAGIC) return null;
    if (bytes[31] !== 1) return null; // версия, которую мы знаем
    if (bytes[32] !== 0x08) return null; // SHA-256
    const digest = Array.from(bytes.subarray(33, 65))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (digest.length !== 64) return null;
    return digest.toLowerCase() === String(contentHash).toLowerCase();
  } catch {
    return null;
  }
}

  /* ── 4) OpenTimestamps Bitcoin anchor ── */
  const ots = bundle.proofs.openTimestamps;
  if (!ots) {
    result.bitcoinAnchor = {
      status: "skip",
      detail: "Bundle has no OpenTimestamps proof",
    };
  } else if (ots.status === "bitcoin-confirmed") {
    // Байты доказательства ЛЕЖАТ В ПАКЕТЕ, и раньше мы на них не смотрели:
    // плитка зеленела по одному лишь полю `status`. Значит к пакету можно было
    // приложить чужое доказательство — или никакого — и объявить его
    // заякоренным. Теперь сверяем, что доказательство относится к ЭТОМУ
    // документу.
    const committed = ots.proofBase64
      ? otsCommitsTo(ots.proofBase64, bundle.proofs.contentHash?.value ?? "")
      : null;
    if (committed === false) {
      result.bitcoinAnchor = {
        status: "fail",
        detail:
          "The attached OpenTimestamps proof commits to a different document. " +
          "It does not timestamp this certificate, whatever the bundle claims.",
      };
    } else if (
      ots.proofBase64 &&
      committed === true &&
      !otsHasBitcoinAttestation(otsBytes(ots.proofBase64) ?? new Uint8Array())
    ) {
      // Пакет ЗАЯВЛЯЕТ подтверждение биткойном, а приложенное доказательство
      // до блока ещё не дошло: в нём метка календаря, а не биткойна. Два наших
      // собственных ответа об одном и том же спорят — верить надо байтам.
      //
      // Не "fail": сертификат может быть заякорен по-настоящему, а в пакет
      // просто не доехало обновлённое доказательство. Но и не "pass": здесь
      // нечего засчитывать в заверения, и вердикт не должен на это опираться.
      result.bitcoinAnchor = {
        status: "skip",
        detail:
          "The bundle says the timestamp is Bitcoin-confirmed, but the attached .ots " +
          "proof carries only a calendar attestation — it has not reached a block yet, " +
          "or the bundle was built before the proof was upgraded. Ask for a fresh bundle, " +
          "or run this proof through an OpenTimestamps client to see its current state.",
      };
    } else {
      // Высота блока раньше входила в условие, и подтверждённый якорь без неё
      // проваливался в последнюю ветку — то есть отмечался как «проверка не
      // прошла». Отсутствие номера блока в пакете не отменяет якоря: это
      // пробел записи, а не провал доказательства.
      //
      // Текст РАЗНЫЙ для трёх случаев, и это не украшение: «байты сошлись»,
      // «байты не разобрать» и «байтов нет» — разные степени уверенности, и
      // читающий должен видеть, какая у него.
      const where = ots.bitcoinBlockHeight
        ? `Anchored at Bitcoin block #${ots.bitcoinBlockHeight}.`
        : "Anchored to Bitcoin; this bundle does not record the block height.";
      const bytes =
        committed === true
          ? " The attached .ots proof commits to this document's content hash — so the proof is about THIS certificate, not another one. What remains unchecked here is Bitcoin inclusion itself: run the proof through any OpenTimestamps client, which talks to the Bitcoin network, not to AEVION."
          : committed === null && ots.proofBase64
            ? " The .ots proof bytes are present but this page could not parse them, so it cannot confirm they belong to this document. Check them with an OpenTimestamps client."
            : " No .ots proof bytes travel with this bundle, so nothing here ties the claim to a timestamp. Ask for the proof file before relying on this row.";
      result.bitcoinAnchor = { status: "pass", detail: where + bytes };
    }
  } else if (ots.status === "pending") {
    result.bitcoinAnchor = {
      status: "skip",
      detail: "OpenTimestamps proof is pending — submitted to OT calendar, awaiting Bitcoin block inclusion (1–6h after stamping).",
    };
  } else if (ots.status === "not_stamped") {
    // «Не якорили» — это НЕ провал проверки. Такие сертификаты выданы до
    // появления якорения; красная плитка здесь обвиняла бы запись в дефекте,
    // которого нет, и обесценивала бы настоящие красные плитки рядом.
    result.bitcoinAnchor = {
      status: "skip",
      detail:
        "This certificate predates Bitcoin anchoring: no OpenTimestamps proof exists and none will appear. The other proof layers are unaffected.",
    };
  } else {
    result.bitcoinAnchor = {
      status: "fail",
      detail: `OT proof status: ${ots.status}`,
    };
  }

  /* ── Overall ── */
  const allChecks = [
    result.bundleShape,
    result.contentHash,
    result.aevionSignature,
    result.authorCosignature,
    result.platformAttestation,
    result.bitcoinAnchor,
  ];
  /*
   * Вердикт требует хотя бы одного ЗАВЕРЕНИЯ, а не просто «что-то прошло».
   *
   * Прежнее правило («ни одна проверка не пропущена — значит pass») давало
   * ложное «подлинно» на пакете, который может собрать кто угодно: своё
   * содержимое и честно посчитанный от него SHA-256, подписей нет вовсе.
   * Хеш содержимого самосогласован — он доказывает, что содержимое не менялось
   * после подсчёта, но НЕ доказывает, что его заверял AEVION. В подсчёт при
   * этом входил и `bundleShape` («узнали формат»), который проходит всегда, —
   * то есть условие `every(skip)` не выполнялось никогда.
   *
   * Заверение дают только эти три слоя: подпись AEVION, соподпись автора и
   * якорь в биткойне. Ни одного из них не прошло — сказать «подлинно» нельзя.
   */
  const attestations = [
    result.aevionSignature,
    result.authorCosignature,
    result.platformAttestation,
    result.bitcoinAnchor,
  ];
  if (allChecks.some((c) => c.status === "fail")) result.overall = "fail";
  else if (!attestations.some((c) => c.status === "pass")) result.overall = "fail";
  else result.overall = "pass";

  return result;
}
