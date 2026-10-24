"use client";

/**
 * Приём адреса в общем подвале — последняя возможность не потерять посетителя.
 *
 * ЗАЧЕМ. Замер 20.09.2026 (соседнее окно, браузером): из пятнадцати страниц,
 * куда ведут посты очереди, у ДВЕНАДЦАТИ нет ни одного способа оставить адрес —
 * ни поля почты, ни «уведомить». Поле есть только у /go, /qright и /veilnetx.
 * Очередь расписана на 34 дня ежедневных постов, а подписчиков на последний
 * замер было три: каждый не готовый купить сегодня уходит бесследно.
 *
 * Подвал выбран потому, что он ОДИН на все страницы: правка в одном файле
 * закрывает и те двенадцать, и все будущие, вместо блока, вписанного в каждую
 * страницу руками (и забытого в следующей).
 *
 * ПОЧЕМУ ЭТО ЧЕСТНО. Подписка пишется в `constitution_waitlist` и СРАЗУ шлёт
 * подтверждающее письмо (`sendWaitlistConfirm`, с защитой от повтора), а
 * отправка на проде настроена — `/api/auth/email/healthz` отвечает
 * `waitlistCanSend: true` (проверено 20.09). Обещание выполняется в ту же
 * минуту, а не «когда-нибудь».
 *
 * ДВОЙНОГО ПОЛЯ НЕ БУДЕТ. Страница, у которой свой приём адреса уже есть,
 * не должна получать второй: две формы об одном — это выбор без разницы, и
 * человек не понимает, куда писать. Поэтому блок при монтировании смотрит,
 * есть ли на странице другое поле почты, и если есть — не рисуется вовсе.
 * Проверка идёт по факту на экране, а не по списку адресов: список пришлось
 * бы дополнять при каждой новой странице, и он бы устаревал молча.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18nOptional, языкИзАдреса } from "@/lib/i18n";
import { WaitlistCapture } from "./WaitlistCapture";

/** Помечает источник: видно в выгрузке. Схема сервера режет на 60 знаках. */
export function footerWaitlistSource(pathname: string | null | undefined): string {
  const пусто = !pathname || pathname === "/";
  // Разделитель — ДЕФИС, а не двоеточие: реестр писем на бэкенде сопоставляет
  // метку как `s === prefix` или `s.startsWith(prefix + "-")`
  // (lib/constitutionBrevo.ts). С двоеточием метка не находила бы свой модуль,
  // и подписчик получал бы общее письмо вместо модульного — тихо.
  const путь = (пусто ? "home" : String(pathname).replace(/^\//, "")).replace(/[^a-zA-Z0-9-]+/g, "-");
  return `footer-${путь}`.slice(0, 60);
}

/** Есть ли на странице ЧУЖОЕ поле почты (не наше). */
export function hasOtherEmailField(root: ParentNode, mine: Element | null): boolean {
  const поля = Array.from(root.querySelectorAll('input[type="email"]'));
  return поля.some((поле) => !mine || !mine.contains(поле));
}

/**
 * Приём адреса, который не появляется там, где он уже есть.
 *
 * Пропы нужны полноэкранным оболочкам (/build, /qsign и другие APP_PREFIXES):
 * подвала они не рисуют вовсе, а страница бывает англоязычной. Значения по
 * умолчанию — те, что нужны подвалу; второй реализации не заводим.
 */
export type WaitlistIfMissingProps = {
  lang?: "ru" | "en" | "kk";
  title?: string;
  description?: string;
  buttonLabel?: string;
  doneText?: string;
  /** Своя пометка источника вместо `footer:<путь>`. Режется до 60 знаков схемой. */
  source?: string;
};

export function FooterWaitlist(props: WaitlistIfMissingProps = {}) {
  const pathname = usePathname();
  /*
   * Язык блока — из адреса: на /en/… подвал говорит по-английски САМ, а не
   * через живой слой перевода. Повод 13.10.2026 (bd): на /en/devhub заголовок и
   * кнопка переводились слоем, а placeholder «вы@почта.рф» — нет (слой идёт по
   * текстовым узлам, атрибуты не трогает), и англоязычный посетитель из пяти
   * каталогов видел кириллицу ровно в поле контакта. Явный проп lang старше.
   *
   * 115б (bd, замер локалью en-US): у /devhub префикса нет, а страница английская —
   * язык берём из ТОГО ЖЕ источника, что и остальная страница (i18n: префикс →
   * сохранённый выбор → navigator.language); префикс адреса — запасной путь вне
   * провайдера (тесты, обособленные оболочки).
   */
  const i18n = useI18nOptional();
  const лангИз = (l: string | null | undefined): "ru" | "en" | "kk" => (l === "en" ? "en" : l === "kk" ? "kk" : "ru");
  // 24.10.2026: kk — свой текст; раньше всё, что не en, шло по-русски
  const язык: "ru" | "en" | "kk" = props.lang ?? (i18n ? лангИз(i18n.lang) : лангИз(языкИзАдреса(pathname)));
  const Т = {
    ru: { title: "Не готовы сегодня — оставьте адрес", description: "Напишем, когда откроется то, что вы смотрели, и пришлём условия раннего доступа.", button: "Сообщить мне", done: "Готово — адрес записан. Подтверждение уже ушло вам на почту." },
    en: { title: "Not ready today — leave your address", description: "We will write when what you were looking at opens and send you the early-access terms.", button: "Notify me", done: "Done — your address is saved. A confirmation is already in your inbox." },
    kk: { title: "Бүгін дайын емессіз бе — мекенжай қалдырыңыз", description: "Сіз қараған нәрсе ашылғанда жазып, ерте қол жеткізу шарттарын жібереміз.", button: "Хабарлау", done: "Дайын — мекенжай жазылды. Растау хаты поштаңызға жіберілді." },
  }[язык];
  const [показывать, установить] = useState(false);
  const [узел, запомнить] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    // Ждём отрисовку страницы: наш подвал монтируется раньше, чем клиентские
    // блоки страницы, и без задержки мы бы считали «чужого поля нет» всегда.
    const t = setTimeout(() => {
      try {
        установить(!hasOtherEmailField(document, узел));
      } catch {
        // Не смогли спросить — не рисуем: лишняя форма хуже отсутствующей.
        установить(false);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [pathname, узел]);

  if (!показывать) return <div ref={запомнить} data-testid="footer-waitlist-idle" />;

  return (
    <div ref={запомнить} data-testid="footer-waitlist" style={{ maxWidth: 560, margin: "0 0 24px" }}>
      <WaitlistCapture
        source={(props.source ?? footerWaitlistSource(pathname)).slice(0, 60)}
        tone="light"
        lang={язык}
        title={props.title ?? Т.title}
        description={
          props.description ??
          Т.description
        }
        promise=""
        buttonLabel={props.buttonLabel ?? Т.button}
        doneText={props.doneText ?? Т.done}
      />
    </div>
  );
}

/** То же самое под именем по смыслу, а не по месту рождения. */
export const WaitlistIfMissing = FooterWaitlist;
