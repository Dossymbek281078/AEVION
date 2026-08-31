/**
 * Что покупатель читает ПЕРЕД тем, как заплатить $19 за тариф Verified.
 *
 * Замер 28.08.2026. Страница обновления (365 строк) обещала прямым текстом:
 *
 *   «Identity check via our KYC partner — passport / national ID upload»
 *   «Raw documents stay with the KYC vendor under their retention policy»
 *
 * На проде поставщик — демонстрационная заглушка: документ не смотрит никто, и
 * вендора, у которого «остаются документы», не существует. То есть конкретное
 * фактическое обещание давалось прямо перед кнопкой оплаты.
 *
 * Карточку тарифа на /bureau я поправил часом раньше — и этого оказалось МАЛО:
 * у каждой записи реестра есть своя кнопка «Обновить до Verified», ведущая
 * сюда напрямую, мимо карточки. Класс был починен на одной поверхности из двух.
 *
 * НАПРАВЛЕНИЕ ОСТОРОЖНОСТИ ЗДЕСЬ ОБРАТНОЕ значку на карточке. Там «не знаю»
 * давало сдержанное «by request»: занизить доступность безобидно. Здесь цена
 * ошибки другая — человек ПЛАТИТ. Поэтому при неизвестном состоянии мы не
 * повторяем сильное утверждение о паспорте: описываем механизм, а глубину
 * проверки называет сам поставщик.
 */

export type KycMode = "live" | "stub" | null;

export type UpgradeDisclosure = {
  /** Первый пункт списка «что вы сделаете». */
  identityStep: string;
  /** Отдельное предупреждение над кнопкой; null — предупреждать не о чем. */
  notice: string | null;
  /** Правда ли, что документы уходят стороннему вендору. */
  vendorNote: string;
};

export function upgradeDisclosure(mode: KycMode): UpgradeDisclosure {
  if (mode === "stub") {
    return {
      identityStep:
        "Identity step — runs end to end, but in demo mode: no document is actually verified yet.",
      notice:
        "Demo mode: the identity provider is not connected yet, so nothing on your document is checked. Please ask us before paying for this tier.",
      vendorNote:
        "Privacy: in demo mode no document leaves your device and no ID image is stored anywhere.",
    };
  }
  if (mode === "live") {
    return {
      identityStep:
        "Identity check via our KYC partner — passport / national ID upload, ~2 minutes.",
      notice: null,
      vendorNote:
        "Privacy: we store the KYC decision (verified name, country, document type) — not your ID image. Raw documents stay with the KYC vendor under their retention policy.",
    };
  }
  // «Спросить не удалось». Механизм описан, глубина проверки не обещана.
  return {
    identityStep:
      "Identity check performed by our KYC provider; the depth of the check is set by that provider.",
    notice: null,
    vendorNote:
      "Privacy: we store the KYC decision (verified name, country, document type) — not your ID image. Any raw document is handled by the provider under its own retention policy.",
  };
}
