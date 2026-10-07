"use client";

import { channelNow } from "@/lib/channelNow";
import { useEffect, useRef } from "react";
import { track } from "@/lib/track";
import { channelFrom } from "@/lib/products";

/**
 * Замер посещения и ухода к оплате — один компонент на все посадочные.
 *
 * Зачем. Замер 13.08.2026: из страниц, куда реально ведут ссылки, считала
 * только `/pricing`. Ролики на YouTube ведут на `/qrenew` и `/qmelanin` — там
 * не считалось НИЧЕГО. То есть даже те просмотры, что уже есть, приходили
 * вслепую: нельзя сказать ни сколько человек дошло, ни нажал ли кто-нибудь
 * «купить».
 *
 * Канал берём из адреса на клиенте (`?c=tt`), чтобы страницу не пришлось
 * делать серверной ради одной метки. Клики по оплате ловим делегированием на
 * документе: карточки остаются как есть, ничего не переписываем. `track` уходит
 * через sendBeacon, поэтому событие переживает переход на чекаут.
 *
 * Ставится одной строкой: <PageTracking page="qmelanin" />
 */
export function PageTracking({ page }: { page: string }) {
  const sent = useRef(false);

  useEffect(() => {
    // Метка приводится к тому же словарю, каким пользуются события оплаты.
    //
    // Найдено 30.08.2026: здесь метка клалась СЫРОЙ («tg»), а checkout_start —
    // сверенной по списку каналов («telegram»). В панели это две плитки, где
    // один и тот же канал назван двумя словами, и сопоставить заходы с
    // покупками нельзя. Сверка живёт в channelFrom, второй словарь заводить
    // здесь незачем.
    //
    // Три исхода различаются намеренно:
    //   метки нет      -> "direct"
    //   метка знакомая -> имя канала из списка
    //   метка чужая    -> "unknown", и это НЕ то же самое, что direct: именно
    //                     по росту этой доли 21.08 заметили, что для Дзена и
    //                     VK не заведены метки и продажи с них терялись.
    //                     Какая именно метка пришла, видно в поле path рядом.
    // Через общий источник: иначе просмотр после перехода без метки скажет
    // «прямой заход», а покупка в той же вкладке — «из TikTok». Два наших
    // ответа об одном человеке разошлись бы, и воронка перестала бы сходиться.
    const параметры = new URLSearchParams(window.location.search);
    // `ref` читаем наравне с `c` ИМЕННО ЗДЕСЬ, а не только в channelNow:
    // иначе переход с чужой площадки, метку которой мы не знаем, назвался бы
    // «прямым заходом». Прямой заход и «пришёл с неизвестной площадки» —
    // разные ответы, и путать их дороже, чем не знать имени площадки.
    const raw = параметры.get("c") ?? параметры.get("ref");
    const известный = channelNow();
    const channel = известный ?? (raw ? "unknown" : "direct");

    // В dev React вызывает эффект дважды. Без защёлки сводка показывала бы
    // вдвое больше посещений на пустом месте.
    if (!sent.current) {
      sent.current = true;
      track({ type: "page_view", source: page, meta: { channel } });
    }

    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!el) return;
      const href = el.getAttribute("href") ?? "";
      // Только уходы к оплате. Внутренние переходы меряются на своих страницах;
      // считать их намерением купить значило бы завысить цифру.
      if (!/gumroad\.com|lemonsqueezy\.com/.test(href)) return;
      const product = href.match(/\/l\/([a-zA-Z0-9]+)/)?.[1]
        ?? href.match(/checkout\/buy\/([a-f0-9-]+)/)?.[1]
        ?? "unknown";
      track({ type: "cta_click", source: page, meta: { channel, product } });
    }

    /*
     * 🔴 ПРИЗНАК ЧЕЛОВЕКА: «engaged» — одно событие за сессию.
     *
     * Повод 07.10.2026, слово оркестратора. Замер того же утра: за трое суток
     * 515 живых просмотров и ОДНО нажатие на всю платформу. Прежде чем чинить
     * первый экран, надо знать, люди ли эти просмотры: внешний обходчик ссылок
     * YouTube исполняет JS и в наших числах выглядел живым человеком (76
     * визитов за двое суток по шаблону «33 поста ровно по 2 визита»).
     *
     * Условие намеренно простое и дешёвое: ВИДИМАЯ вкладка 10 секунд ИЛИ
     * прокрутка на четверть страницы. Машина обычно не делает ни того, ни
     * другого: ей нужен ответ сервера, а не чтение.
     *
     * Чего признак НЕ обещает: он не доказывает человека. Обходчик, который
     * подождёт десять секунд, пройдёт — поэтому «engaged» читается как «похоже
     * на чтение», а не как «человек». Зато обратное надёжно: нулевая доля
     * engaged среди живых означает, что чинить первый экран рано — его никто
     * не смотрит.
     *
     * Единица — СЕССИЯ, отметка в sessionStorage. Доступ к хранилищу обёрнут:
     * в приватном окне он бросает исключение, и тогда защёлка живёт в памяти
     * страницы — событие уйдёт не более одного раза на загрузку, этого хватает.
     */
    const КЛЮЧ_ВНИМАНИЯ = "aevion_engaged_sent";
    let вниманиеОтправлено = false;
    try {
      вниманиеОтправлено = window.sessionStorage.getItem(КЛЮЧ_ВНИМАНИЯ) === "1";
    } catch {
      вниманиеОтправлено = false;
    }

    let видимыхМс = 0;
    let отметка = document.visibilityState === "visible" ? Date.now() : 0;
    let тик: ReturnType<typeof setInterval> | null = null;

    function отправитьВнимание(причина: "время" | "прокрутка") {
      if (вниманиеОтправлено) return;
      вниманиеОтправлено = true;
      try {
        window.sessionStorage.setItem(КЛЮЧ_ВНИМАНИЯ, "1");
      } catch {
        // Хранилище недоступно — защёлка остаётся в памяти страницы.
      }
      track({ type: "engaged", source: page, meta: { channel, причина } });
    }

    function накопить() {
      if (отметка > 0) {
        видимыхМс += Date.now() - отметка;
        отметка = document.visibilityState === "visible" ? Date.now() : 0;
      }
      if (видимыхМс >= 10_000) отправитьВнимание("время");
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        if (отметка === 0) отметка = Date.now();
      } else {
        накопить();
        отметка = 0;
      }
    }

    function onScroll() {
      const высота = document.documentElement.scrollHeight - window.innerHeight;
      // Страница короче экрана: прокручивать нечего, и требовать прокрутку
      // значило бы считать внимательными только тех, у кого длинная страница.
      if (высота <= 0) return;
      if (window.scrollY / высота >= 0.25) отправитьВнимание("прокрутка");
    }

    if (!вниманиеОтправлено) {
      тик = setInterval(накопить, 2_000);
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      if (тик) clearInterval(тик);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", onScroll);
    };
  }, [page]);

  return null;
}
