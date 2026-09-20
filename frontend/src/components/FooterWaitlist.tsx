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
import { WaitlistCapture } from "./WaitlistCapture";

/** Помечает источник: видно в выгрузке. Схема сервера режет на 60 знаках. */
export function footerWaitlistSource(pathname: string | null | undefined): string {
  const пусто = !pathname || pathname === "/";
  return `footer:${пусто ? "home" : pathname}`.slice(0, 60);
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
  lang?: "ru" | "en";
  title?: string;
  description?: string;
  buttonLabel?: string;
  doneText?: string;
  /** Своя пометка источника вместо `footer:<путь>`. Режется до 60 знаков схемой. */
  source?: string;
};

export function FooterWaitlist(props: WaitlistIfMissingProps = {}) {
  const pathname = usePathname();
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
        lang={props.lang ?? "ru"}
        title={props.title ?? "Не готовы сегодня — оставьте адрес"}
        description={
          props.description ??
          "Напишем, когда откроется то, что вы смотрели, и пришлём условия раннего доступа."
        }
        promise=""
        buttonLabel={props.buttonLabel ?? "Сообщить мне"}
        doneText={props.doneText ?? "Готово — адрес записан. Подтверждение уже ушло вам на почту."}
      />
    </div>
  );
}

/** То же самое под именем по смыслу, а не по месту рождения. */
export const WaitlistIfMissing = FooterWaitlist;
