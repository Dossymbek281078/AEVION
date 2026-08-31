/**
 * Что на самом деле окажется в офлайн-пакете ЭТОГО сертификата.
 *
 * Страница проверки обещает безусловно: «A single .json containing every proof
 * — the canonical inputs, AEVION's Ed25519 signature, …» и «anyone can verify
 * the certificate forever without contacting AEVION».
 *
 * Замер на проде 28.08.2026 по всем семи записям публичного реестра:
 * подпись AEVION лежит в пакете у ДВУХ из семи. У пяти поле
 * `proofs.aevionEd25519` равно null.
 *
 * Причина в коде, а не в данных: пакет собирает подпись только когда у записи
 * есть `signedAt` — подписанный текст восстанавливается байт в байт, и без
 * отметки времени восстановить его нечем (pipeline.ts, сборка bundle.json).
 * У сертификатов, выданных до появления этой отметки, её нет и не появится.
 *
 * Офлайн-проверка ведёт себя честно — пишет «Bundle contains no AEVION Ed25519
 * signature» и ставит «пропущено». Лжёт не она, а ОБЕЩАНИЕ на странице: оно
 * дано безусловно, а выполняется у двух записей из семи.
 *
 * Признак у страницы уже есть: ручка проверки возвращает
 * `integrity.signatureHmacReason = "NO_SIGNED_AT"` ровно в этом случае.
 */

export type HmacReason = "OK" | "NO_SIGNED_AT" | "MISMATCH" | "ERROR" | undefined;

export type BundleContents = {
  /** Будет ли в пакете подпись AEVION. */
  hasAevionSignature: boolean;
  /** Оговорка под обещанием; null — оговаривать нечего. */
  note: string | null;
};

export function bundleContents(reason: HmacReason): BundleContents {
  if (reason === "NO_SIGNED_AT") {
    return {
      hasAevionSignature: false,
      note:
        "This certificate predates AEVION's signing timestamp, so its bundle carries the content hash, the shard witness and the Bitcoin anchor — but not AEVION's Ed25519 signature. The offline verifier will mark that check as skipped rather than passed.",
    };
  }
  // OK, MISMATCH, ERROR и «поля нет» — во всех этих случаях отметка времени
  // ЕСТЬ, значит подпись в пакет попадёт. MISMATCH означает, что она не
  // сойдётся, и это как раз то, что офлайн-проверка обязана показать.
  return { hasAevionSignature: true, note: null };
}

/**
 * Подпись под полем «Ed25519 Signature» на странице проверки.
 *
 * ⚠️ Это ПОПРАВКА к собственной правке, сделанной часом раньше 28.08.2026.
 * Тогда текст под полем стал звать за проверкой в офлайн-пакет — и это было
 * безусловное обещание ровно того же рода, которое я в тот же вечер чинил
 * этажом ниже: у пяти записей из семи подписи в пакете НЕТ.
 *
 * И причина глубже, чем «поля не положили». Апрельская форма подписи была
 * такой (git eb94351bf, 12.04.2026):
 *
 *     JSON.stringify({ objectId, title, contentHash, signatureHmac,
 *                      timestamp: Date.now() })
 *
 * `Date.now()` НИГДЕ НЕ СОХРАНЯЛСЯ. Значит подписанный текст этих сертификатов
 * восстановить нельзя ни нам, ни кому-либо ещё: байты подписи есть, а сообщение,
 * которое они покрывают, утрачено. Такую подпись не проверить в принципе.
 *
 * Отсюда следует, что нынешнее поведение пакета ПРАВИЛЬНО: класть в него
 * подпись, которую заведомо не с чем сверить, значило бы приглашать к проверке,
 * обязанной провалиться. Единственное, что здесь можно сделать честно, — сказать
 * это словами.
 */
export function ed25519FieldNote(reason: HmacReason): string {
  if (reason === "NO_SIGNED_AT") {
    return (
      "An asymmetric digital signature. This page shows only its beginning. " +
      "This certificate was issued under an earlier scheme whose signed payload " +
      "included a timestamp that was never stored, so the exact signed message " +
      "cannot be reconstructed — by us or by anyone. The signature bytes are kept " +
      "for the record, but this layer cannot be re-verified; the content hash, the " +
      "shard witness and the Bitcoin anchor can."
    );
  }
  return (
    "An asymmetric digital signature. This page shows only the beginning of it. " +
    "To check it yourself, download the verification bundle below: it carries the " +
    "full signature and AEVION's public key, and the offline verifier validates " +
    "them without contacting us."
  );
}
