/**
 * Что показывать вместо «⭐ Upgrade to Verified», пока проверка личности — заглушка.
 *
 * 20.10.2026, окно «Приложения» (по слову оркестратора). Замер на проде 10:19:
 * /api/bureau/health → kyc: "stub", payment: "stub"; страница /bureau/upgrade/<cert>
 * честно пишет «Этот уровень ещё не может быть завершён… средства не будут списаны»,
 * карточки тарифов на /bureau тоже знают режим — а в реестре на /bureau и на
 * /bureau/cert/[certId] КАЖДЫЙ сертификат нёс кнопку «Upgrade to Verified» без
 * проверки режима (условие было только verificationLevel !== "verified"). Гость
 * нажимал и упирался в барьер: тупик, повторённый столько раз, сколько записей.
 *
 * Одно место решения для обоих экранов. Направление умолчания — как у страницы
 * апгрейда: НЕЗНАНИЕ режима (null — ручка здоровья не ответила) кнопку не прячет,
 * прячет только известная заглушка. Иначе сбой сетевого вызова выключал бы платный
 * путь на живой площадке.
 */

export type KycModeKnown = "live" | "stub" | "misconfigured" | null | undefined;

export type VerifiedCta =
  | { kind: "upgrade"; href: string }
  | { kind: "contact"; href: string };

/** Куда писать, пока Verified закрыт: тема «bureau» на общей форме обращения. */
export const VERIFIED_CONTACT_HREF = "/pricing/contact?topic=bureau";

export function verifiedCta(mode: KycModeKnown, certId: string): VerifiedCta {
  if (mode === "stub" || mode === "misconfigured") return { kind: "contact", href: VERIFIED_CONTACT_HREF };
  return { kind: "upgrade", href: `/bureau/upgrade/${encodeURIComponent(certId)}` };
}

/** Подпись ссылки-обращения на языке страницы (en — запасной). */
export function verifiedContactLabel(lang: string | undefined): string {
  if (lang === "ru") return "Verified — напишите нам";
  if (lang === "kk") return "Verified — бізге жазыңыз";
  return "Verified — ask us";
}

export type PaymentModeKnown = "live" | "stub" | "misconfigured" | null | undefined;

/**
 * Продаёт ли ВИТРИНА /bureau платные уровни (карточки «Verified» и «Notarized»).
 *
 * 30.10.2026, решение Оркестратора: не продавать то, чего нет. Пока
 * /api/bureau/health отвечает kyc или payment = stub (замер прода 30.10: оба stub),
 * на витрине нет ни цены нотариальной соподписи, ни призыва «выбрать сертификат для повышения» /
 * «отправьте запрос» — вместо них честная строка и форма раннего доступа.
 *
 * Направление умолчания здесь ПРОТИВОПОЛОЖНО verifiedCta(): кнопка у конкретного
 * сертификата при незнании режима не прячется (сетевой сбой не должен выключать
 * живой платный путь), а витрина при незнании НЕ обещает — своя неосведомлённость
 * не повод называть цену. Готово только когда ОБА барьера живые.
 */
export function tiersSellable(kyc: KycModeKnown, payment: PaymentModeKnown): boolean {
  return kyc === "live" && payment === "live";
}
