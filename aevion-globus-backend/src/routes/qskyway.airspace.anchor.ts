// QSkyway — Bitcoin-anchoring the airspace layer's content hash.
//
// The Ed25519 attestation over the ceiling layer proves *AEVION signed this
// exact rule set*. It does not prove *when*: the edition date comes from the
// regulator's own field, but "we were already routing against it on date X" is
// asserted by our server's clock and nothing else. For a claim whose whole value
// is regulatory ("this corridor obeyed the airspace as published at the time"),
// self-asserted time is the weak link.
//
// So the same contentHash goes to the OpenTimestamps calendar network and, from
// there, into Bitcoin. Two proofs over ONE hash:
//   Ed25519  → who + integrity  (AEVION signed this exact cell set and edition)
//   OpenTimestamps → trustless time (this rule set existed no later than block N)
//
// Stateless, exactly like the Trust Score anchor: the `.ots` proof IS the
// artifact. We hand it back, the caller keeps it, and a later verify upgrades a
// still-pending proof on the fly. No table, no cron.

import { AIRSPACE, airspaceContentHash } from "./qskyway.airspace";
import { stampHash, upgradeProof, verifyProof, type AnchorStatus, ANCHOR_STATUS_MEANING, type AnchorStatusMeaning } from "../lib/opentimestamps/anchor";

export interface AnchorRecipe {
  steps: string[];
  stepsEn: string[];
  /** Честная граница: что штамп доказывает, а что НЕТ. */
  limit: string;
  limitEn: string;
}

export interface AirspaceAnchor {
  status: AnchorStatus;
  city: string;
  authority: string;
  /** the regulator's own edition marker, carried alongside the anchored hash */
  effective: string;
  /** the hash submitted — identical to the one the Ed25519 signature covers */
  contentHash: string;
  otsProofB64: string | null;
  bitcoinBlockHeight: number | null;
  calendars: string[];
  error: string | null;
  note: string;
  /**
   * Как проверить это доказательство БЕЗ нас — вместе с ним самим.
   *
   * 29.08.2026: ответ нёс доказательство и хэш и ни слова о том, что с ними
   * делать. Биткоин-штамп существует ради ТРЕТЬЕЙ стороны; отдать его без
   * инструкции — то же, что отдать подпись без ключа.
   */
  verifyYourself: AnchorRecipe;
}

/** Рецепт один на оба ответа: свежая привязка и уже готовое доказательство.
 *  Разные инструкции для одного и того же артефакта — это два наших ответа
 *  об одном, отличающиеся тем, когда спросили. */
export function anchorRecipe(cityId: string): AnchorRecipe {
  return {
      steps: [
        "1. otsProofB64 — это обычный detached-таймстамп OpenTimestamps НАД ДАЙДЖЕСТОМ contentHash, а не над файлом",
        "2. раскодируйте base64 в файл .ots и проверьте любым клиентом OpenTimestamps по этому дайджесту",
        "3. байты, из которых взят contentHash, отдаёт GET /api/qskyway/airspace/edition?city=" + cityId,
        "4. сверьте: sha256(payload из шага 3) обязан совпасть с contentHash здесь",
      ],
      stepsEn: [
        "1. otsProofB64 is a plain detached OpenTimestamps proof OVER THE DIGEST contentHash, not over a file",
        "2. decode the base64 into a .ots file and verify it with any OpenTimestamps client against that digest",
        "3. the bytes the contentHash is taken over: GET /api/qskyway/airspace/edition?city=" + cityId,
        "4. check that sha256(payload from step 3) equals the contentHash here",
      ],
      limit: "Штамп доказывает, что редакция СУЩЕСТВОВАЛА к этому времени, и НИЧЕГО не говорит о её правильности: что потолки списаны у регулятора верно — отдельный вопрос, см. поля authority и effective.",
      limitEn: "The timestamp proves the edition EXISTED by that time and says NOTHING about its correctness: whether the ceilings match the regulator is a separate question - see the authority and effective fields.",
    };
}

export async function anchorAirspace(cityId: string): Promise<AirspaceAnchor | null> {
  const src = AIRSPACE[cityId];
  if (!src) return null;
  const contentHash = airspaceContentHash(src);
  const r = await stampHash(contentHash);
  return {
    status: r.status,
    city: cityId,
    authority: src.authority,
    effective: src.effective,
    contentHash,
    otsProofB64: r.otsProof ? r.otsProof.toString("base64") : null,
    bitcoinBlockHeight: r.bitcoinBlockHeight,
    calendars: r.calendars,
    error: r.error,
    verifyYourself: anchorRecipe(cityId),
    note:
      r.status === "pending"
        ? "Отправлено в календари OpenTimestamps. Подтверждение Bitcoin приходит через ~1-6ч — сохраните otsProofB64 и вернитесь на /airspace/anchor/verify."
        : r.status === "bitcoin-confirmed"
          ? "Слой ограничений привязан к Bitcoin — дата использования этой редакции доказуема без доверия к нам."
          : "Отправка в календари не удалась (сеть). Подпись Ed25519 не затронута; якорь можно повторить позже.",
  };
}

export interface AirspaceAnchorVerify {
  city: string | null;
  /** the snapshot currently served still hashes to the anchored value */
  matchesCurrentSnapshot: boolean;
  ots: {
    verified: boolean;
    status: AnchorStatus;
    /** Что это значит и что делать — рядом со словом, а не в документации. */
    statusMeaning: AnchorStatusMeaning;
    upgraded: boolean;
    bitcoinBlockHeight: number | null;
    attestations: string[];
    otsProofB64: string | null;
    error: string | null;
    /**
     * Английская половина `error`. Отдельным полем, а не заменой: русский текст
     * уже читают наши же страницы и смоки, менять его молча нельзя.
     */
    errorEn: string | null;
  };
  fullyProven: boolean;
  note: string;
  noteEn: string;
}

/**
 * Verify an anchored airspace layer.
 *
 * Deliberately checks two separate things and reports them separately:
 *  - the OTS proof anchors the given hash into Bitcoin (trustless time), and
 *  - that hash is still the hash of the snapshot we serve today.
 *
 * They come apart on purpose. Once the FAA reissues and we regenerate, an old
 * proof stays perfectly valid for the edition it covered while no longer
 * matching what we serve — that is a correct historical record, not a failure,
 * and collapsing both into one boolean would hide it.
 */
export async function verifyAnchoredAirspace(body: unknown): Promise<AirspaceAnchorVerify> {
  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const city = typeof obj.city === "string" ? obj.city : null;
  const contentHash = typeof obj.contentHash === "string" ? obj.contentHash : null;
  const otsProofB64 = typeof obj.otsProofB64 === "string" ? obj.otsProofB64 : null;

  // Отказ несёт обе половины. Текст приходит парой ИМЕННО СЮДА, а не строится
  // где-то у вызывающего: три причины отказа — три места, где легко забыть одну.
  const fail = (error: string, errorEn: string): AirspaceAnchorVerify => ({
    city,
    matchesCurrentSnapshot: false,
    ots: { verified: false, status: "not-submitted", statusMeaning: ANCHOR_STATUS_MEANING["not-submitted"], upgraded: false, bitcoinBlockHeight: null, attestations: [], otsProofB64, error, errorEn },
    fullyProven: false,
    note: "Проверка не завершена — см. поле error.",
    noteEn: "Verification did not complete — see the error field.",
  });

  if (!contentHash) return fail("нужен contentHash", "contentHash is required");
  if (!otsProofB64) return fail("нужен otsProofB64", "otsProofB64 is required");

  const src = city ? AIRSPACE[city] : undefined;
  const matchesCurrentSnapshot = Boolean(src) && airspaceContentHash(src!) === contentHash;

  // ⚠️ `Buffer.from(x, "base64")` НЕ БРОСАЕТ: недопустимые символы молча
  // отбрасываются, поэтому прежний try/catch не мог сработать ни разу — защита
  // была на вид, а мусор уезжал вглубь и падал уже в сверке доказательства.
  // ⚠️ Нормализуем ДО проверки, и это не удобство, а исправление регрессии,
  // которую я же и внёс. `Buffer.from(x, "base64")` в Node принимает URL-safe
  // (`-` и `_`) и декодирует ИДЕНТИЧНО стандартному — проверено опытом. Значит
  // до появления строгого шаблона такие доказательства проверялись успешно, а
  // после стали получать «не является корректным base64»: формально верный и
  // бесполезный ответ для третьей стороны, которую мы сами зовём проверять нас.
  //
  // Урок общий: ужесточение поверх ТЕРПИМОГО декодера отсекает входы, которые
  // раньше работали. Прежде чем сузить приём, спроси, что принимал слой ниже.
  const b64 = otsProofB64
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const looksBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(b64);
  if (!looksBase64) {
    return fail("otsProofB64 не является корректным base64", "otsProofB64 is not valid base64");
  }
  const proof = Buffer.from(b64, "base64");
  if (proof.length === 0) {
    return fail("otsProofB64 декодируется в пустоту", "otsProofB64 decodes to nothing");
  }

  const up = await upgradeProof(proof);
  const currentProof = up.otsProof ?? proof;
  const v = await verifyProof(contentHash, currentProof);

  // Статус и его пояснение считаются из ОДНОГО значения: разойтись они
  // не могут по устройству, а не по внимательности.
  const otsStatus: AnchorStatus =
    v.reason === "proof-error"
      ? "invalid"
      : v.bitcoinBlockHeight !== null
        ? "bitcoin-confirmed"
        : "pending";

  return {
    city,
    matchesCurrentSnapshot,
    ots: {
      verified: v.ok,
      // Сперва спрашиваем, ПРОШЛА ли проверка, и только потом — подтверждена ли
      // она Bitcoin. Прежняя версия смотрела лишь на высоту блока, поэтому
      // непрошедшее доказательство докладывалось как "pending" — «зайдите
      // позже» вместо «недействительно». Та же строка была и в lib/trustAnchor.
      // Различаем по ПРИЧИНЕ из источника, а не по `ok`: он ложен и когда
      // привязки к блоку ещё нет (честное ожидание), и когда доказательство
      // не сходится вовсе. Первое — «повторите позже», второе — «ждать
      // бессмысленно», и звать оба "pending" значит советовать ждать зря.
      status: otsStatus,
      statusMeaning: ANCHOR_STATUS_MEANING[otsStatus],
      upgraded: up.upgraded,
      bitcoinBlockHeight: v.bitcoinBlockHeight,
      attestations: v.attestations,
      otsProofB64: currentProof.toString("base64"),
      error: v.error,
      // Здесь обе половины совпадают НАМЕРЕННО: текст приходит из библиотеки
      // OpenTimestamps и уже английский («no Bitcoin attestation yet…» либо
      // message исключения). Переводить его нам нечем и незачем — свой перевод
      // разошёлся бы с тем, что человек найдёт в документации библиотеки.
      errorEn: v.error,
    },
    fullyProven: v.ok,
    note: v.reason === "proof-error"
      ? "Доказательство не сходится с этим хэшем — см. поле error. Ждать бессмысленно."
      : !v.ok
        ? "Bitcoin-подтверждение ещё не получено (pending) — повторите проверку позже."
      : matchesCurrentSnapshot
        ? `Доказано: этот набор ограничений существовал не позднее блока ${v.bitcoinBlockHeight} и совпадает с тем, что отдаётся сейчас.`
        : `Доказано для прошлой редакции: хэш привязан к блоку ${v.bitcoinBlockHeight}, но текущий снимок уже другой (регулятор перевыпустил карту). Это корректная историческая запись, а не ошибка.`,
    noteEn: v.reason === "proof-error"
      ? "The proof does not check out against this hash — see error. Waiting will not help."
      : !v.ok
        ? "Bitcoin confirmation has not arrived yet (pending) — re-verify later."
      : matchesCurrentSnapshot
        ? `Proven: this set of restrictions existed no later than block ${v.bitcoinBlockHeight} and matches what is served now.`
        : `Proven for an earlier edition: the hash is anchored to block ${v.bitcoinBlockHeight}, but the current snapshot differs (the regulator reissued the map). This is a correct historical record, not an error.`,
  };
}
