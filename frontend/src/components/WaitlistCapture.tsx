"use client";

/**
 * Приём почты на публичных страницах платформы.
 *
 * Зачем отдельный компонент: замер 14.08.2026 показал, что на главной, на /go
 * и на /pricing не было НИ ОДНОГО поля для адреса — весь пришедший трафик
 * уходил, не оставляя следа, и во всей системе накопилось 3 подписчика.
 *
 * Пишет в уже работающую на проде ручку `POST /api/constitution/waitlist/subscribe`
 * (таблица `constitution_waitlist`, дедупликация по адресу, подтверждающее
 * письмо через Brevo). Своего хранилища НЕ заводит: второй способ делать то же
 * самое стоит дороже, чем поле `source`, по которому потом видно, с какой
 * страницы пришёл человек.
 *
 * Отказ показывается отказом. Форма бюро до 11.08 писала адрес в localStorage,
 * ждала 600 мс и печатала зелёное «You're on the waitlist!» — человек уходил
 * уверенным, что подписался, а адреса не было нигде. Здесь успех показывается
 * только на ответ сервера, и у каждого класса отказа свой текст.
 */

import { useI18nOptional } from "@/lib/i18n";
import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { channelNow } from "@/lib/channelNow";
import { track } from "@/lib/track";

type Status = "idle" | "sending" | "done" | "error";

export type WaitlistCaptureProps = {
  /** Помечает страницу-источник: видно в выгрузке, максимум 60 символов (схема сервера). */
  source: string;
  title?: string;
  description?: string;
  /** Что человек получит. Пустая строка убирает строку целиком. */
  promise?: string;
  buttonLabel?: string;
  /** Тёмная плашка для светлых страниц, светлая — для тёмных секций. */
  tone?: "dark" | "light";
  /**
   * Сжатый вид: одна линия «поле + кнопка», без заголовка и описания в кадре.
   *
   * Нужен там, где карточка лежит НАД содержимым (прилипшая строка под доской
   * в шахматах). Замер 11.10.2026 на проде: полная карточка занимала 200 px, на
   * 390×844 — 277 px, и накрывала от 16 до 40 клеток доски из 64. Заголовок при
   * этом не пропадает — он остаётся в разметке скрытым для глаза, чтобы форма
   * не осталась без названия для скринридера.
   */
  compact?: boolean;
  /**
   * Зовётся ОДИН раз, когда подписка действительно легла в базу.
   *
   * Повод 11.10.2026 (приёмка user-37): человек оставил адрес строкой под
   * доской, а отметка «уже предлагали» не ставилась — и в конце партии он
   * получал то же предложение модальным окном. Форма знает об успехе, страница
   * нет; способа узнать у неё не было.
   *
   * Необязательный: прежние места вызова ничего не передают и работают как
   * прежде.
   */
  onSubscribed?: () => void;
  /** Язык подсказки и сообщений об отказе. По умолчанию русский. */
  lang?: "ru" | "en" | "kk" | "ar";
  /**
   * Текст подтверждения после успешной подписки.
   *
   * Зачем настраивается. Общий текст — «напишем, когда будет что показать»:
   * он верен для страниц без даты. Но на странице запуска, где прямо сказано
   * «Открываем 30 августа», такое подтверждение звучит расплывчатее самого
   * обещания, и человек уходит с меньшей уверенностью, чем пришёл. Замер
   * 28.08.2026: страница обещает «напишем в день запуска», письмо называет
   * дату, а подтверждение на экране — нет.
   */
  doneText?: string;
};

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;

/**
 * Тексты, которые НЕЛЬЗЯ передать пропом: подсказка в поле, сообщения об
 * отказах и надпись во время отправки. Заголовок и кнопка уже настраиваются
 * снаружи, а эти строки были зашиты по-русски — и на английских страницах
 * (/en/go, /en/longevity, заведены 28.08.2026) человек видел кириллицу ровно в
 * той точке, где оставляет контакт.
 *
 * По умолчанию русский: ни одна существующая страница не меняет поведения.
 */
const COPY = {
  ru: {
    title: "Забрать ранний доступ к модулям AEVION",
    description: "Платформа выпускает модули по одному. Оставьте адрес — напишем в день запуска того, что вам ближе, и пришлём условия раннего доступа.",
    promise: "Письмо приходит на запуск модуля. Отписка — одной ссылкой в каждом письме.",
    buttonLabel: "Получить ранний доступ",
    placeholder: "вы@почта.рф",
    sending: "Отправляем…",
    emailLabel: "Адрес электронной почты",
    typo: "Похоже, в адресе опечатка. Проверьте — и отправьте ещё раз.",
    done: "Готово — адрес записан. Напишем, когда будет что показать.",
    tooMany: "Слишком много попыток подряд. Подождите минуту и повторите.",
    rejected: "Сервер не принял адрес. Проверьте написание.",
    ourFault: "Не смогли сохранить адрес — это на нашей стороне. Попробуйте ещё раз через минуту.",
    notStored:
      "Приняли адрес, но сохранить его насовсем сейчас не вышло — это на нашей стороне. Отправьте ещё раз через минуту, чтобы точно не потерять вас к запуску.",
    offline: "Не дозвонились до сервера. Проверьте связь и повторите.",
  },
  en: {
    title: "Get early access to AEVION modules",
    description: "The platform ships one module at a time. Leave your address and we will write when the next one opens.",
    promise: "One email per module launch. Unsubscribe in one click.",
    buttonLabel: "Get early access",
    placeholder: "you@example.com",
    sending: "Sending…",
    emailLabel: "Email address",
    typo: "That address looks like a typo. Check it and send again.",
    done: "Done — the address is saved. We write when there is something to show.",
    tooMany: "Too many attempts in a row. Wait a minute and try again.",
    rejected: "The server did not accept the address. Check the spelling.",
    ourFault: "We could not save the address — that is on our side. Try again in a minute.",
    notStored:
      "We took your address but could not store it permanently just now — that is on us. Please send it again in a minute so we do not lose you before launch.",
    offline: "Could not reach the server. Check the connection and try again.",
  },
  // ⚠️ ar — черновой перевод (27.10.2026, саудовская волна), нужна вычитка носителя
  ar: {
    title: "احصل على وصول مبكر إلى وحدات AEVION",
    description: "تطلق المنصة الوحدات واحدة تلو الأخرى. اترك بريدك وسنكتب لك يوم إطلاق ما يهمك مع شروط الوصول المبكر.",
    promise: "رسالة واحدة عند إطلاق كل وحدة. إلغاء الاشتراك برابط واحد في كل رسالة.",
    buttonLabel: "الحصول على وصول مبكر",
    placeholder: "you@example.com",
    sending: "جارٍ الإرسال…",
    emailLabel: "عنوان البريد الإلكتروني",
    typo: "يبدو أن في العنوان خطأً مطبعياً. تحقق منه وأرسل مرة أخرى.",
    done: "تم — حُفظ العنوان. سنكتب لك عندما يكون هناك ما نعرضه.",
    tooMany: "محاولات كثيرة متتالية. انتظر دقيقة ثم حاول مجدداً.",
    rejected: "لم يقبل الخادم العنوان. تحقق من كتابته.",
    ourFault: "لم نتمكن من حفظ العنوان — الخطأ من جهتنا. حاول مرة أخرى بعد دقيقة.",
    notStored:
      "استلمنا عنوانك لكن تعذّر حفظه بشكل دائم الآن — الخطأ من جهتنا. أرسله مرة أخرى بعد دقيقة حتى لا نفقدك قبل الإطلاق.",
    offline: "تعذّر الوصول إلى الخادم. تحقق من الاتصال وحاول مجدداً.",
  },
  // ⚠️ kk — черновой перевод, нужна вычитка носителя
  kk: {
    title: "AEVION модульдеріне ерте қол жеткізу",
    description: "Платформа модульдерді бір-бірлеп шығарады. Мекенжайыңызды қалдырыңыз — сізге жақынының іске қосылған күні жазып, ерте қол жеткізу шарттарын жібереміз.",
    promise: "Хат модуль іске қосылғанда келеді. Әр хатта бір сілтемемен жазылымнан бас тартуға болады.",
    buttonLabel: "Ерте қол жеткізу",
    placeholder: "сіз@пошта.kz",
    sending: "Жіберілуде…",
    emailLabel: "Электрондық пошта мекенжайы",
    typo: "Мекенжайда қате бар сияқты. Тексеріп, қайта жіберіңіз.",
    done: "Дайын — мекенжай жазылды. Көрсететін нәрсе болғанда жазамыз.",
    tooMany: "Тым көп әрекет қатарынан. Бір минут күтіп, қайталаңыз.",
    rejected: "Сервер мекенжайды қабылдамады. Жазылуын тексеріңіз.",
    ourFault: "Мекенжайды сақтай алмадық — бұл біздің тараптағы қате. Бір минуттан кейін қайталап көріңіз.",
    notStored:
      "Мекенжайды қабылдадық, бірақ қазір біржола сақтай алмадық — бұл біздің тарапта. Іске қосылуға дейін жоғалтпау үшін бір минуттан кейін қайта жіберіңіз.",
    offline: "Серверге қосыла алмадық. Байланысты тексеріп, қайталаңыз.",
  },
} as const;

/**
 * 27.10.2026: язык формы из языка страницы. Раньше всё, что не en/kk, шло по-русски — и в
 * ar-режиме (саудовская волна, замер Продаж locale ar-SA) человек видел «Адрес электронной
 * почты» ровно в поле контакта. Свой текст есть у ru/en/kk/ar; остальные восемь языков
 * платформы получают английский (он же запасной для словарей, см. lib/i18n-lang/README.md).
 * Вне провайдера (в тестах) остаётся русский, как и прежде.
 */
export function языкФормы(l: string | null | undefined): keyof typeof COPY {
  if (!l || l === "ru") return "ru";
  if (l === "en" || l === "kk" || l === "ar") return l;
  return "en";
}

export function WaitlistCapture({
  source,
  title,
  description,
  promise,
  buttonLabel,
  tone = "dark",
  compact = false,
  onSubscribed,
  lang,
  doneText,
}: WaitlistCaptureProps) {
  /*
   * Язык берём из словаря, если проп не передан.
   *
   * Замер 02.09.2026 отрисовкой: на английской /go человек видел «вы@почта.рф»
   * ровно в том поле, где оставляет контакт — а это единственная кликабельная
   * ссылка из шапок соцсетей, то есть первое, что видит пришедший извне.
   *
   * Переводы ЗДЕСЬ БЫЛИ с самого начала: дефект не в текстах, а в умолчании.
   * Проп не передавали шесть страниц из девяти, и умолчание было русским —
   * тот же класс, что у чипа провенанса днём раньше.
   *
   * Вне провайдера (в тестах) остаётся русский: так ведёт себя и прежний код,
   * и менять поведение проверок заодно с починкой языка не надо.
   */
  const i18n = useI18nOptional();
  // 24.10.2026: kk — свой текст (раньше падал на русский: подвал /kk по-русски на каждой странице)
  const язык: keyof typeof COPY = lang ?? языкФормы(i18n?.lang);
  const copy = COPY[язык];
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const dark = tone === "dark";
  const fg = dark ? "#f8fafc" : "#0f172a";
  const muted = dark ? "rgba(226,232,240,0.75)" : "#475569";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setStatus("error");
      setMessage(copy.typo);
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const канал =
        typeof window === "undefined"
          ? null
          : channelNow()
      const r = await fetch(apiUrl("/api/constitution/waitlist/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value,
          source: source.slice(0, 60),
          // Канал привлечения — ОТДЕЛЬНО от source. source отвечает «с какой
          // страницы», channel — «кто привёл». До 31.08.2026 второго не было
          // вовсе: про покупки мы знали канал, а про подписчиков — нет, хотя
          // список для запуска и есть главный актив воронки.
          //
          // Через channelFrom, а не сырым значением: чужое ?c= из посторонней
          // ссылки в учёт не поедет, и словарь останется тот же, что у покупок.
          ...(канал ? { channel: канал } : {}),
        }),
      });
      if (r.ok) {
        // Ручка честно называет, КУДА легла подписка: "postgres" — сохранена,
        // всё остальное значит запасное хранилище в памяти процесса, которое
        // не переживёт перезапуск. Раньше мы читали только r.ok и говорили
        // «адрес записан» в обоих случаях — то есть теряли подписчика молча,
        // а человек уходил уверенным, что он в списке. Для канала запуска это
        // дороже всего: письмо в день старта такому адресу не уйдёт.
        //
        // Поэтому непостоянное сохранение показываем как ОТКАЗ: это правда, и
        // повтор через минуту может лечь уже в базу.
        let storage: unknown = "postgres";
        try {
          storage = (await r.json())?.storage ?? "postgres";
        } catch {
          // тело не разобралось — считаем, что сохранено: ручка вернула 2xx,
          // и пугать человека из-за нашей неспособности прочитать ответ нельзя
          storage = "postgres";
        }
        if (storage !== "postgres") {
          setStatus("error");
          setMessage(copy.notStored);
          return;
        }
        /* ── Ступень воронки «оставил адрес» ──
           07.10.2026. До этого дня форма работала, писала в базу и НЕ отправляла
           ни одного события: в воронке ступени не было вовсе. Стоило это дорого
           не самой потерей числа, а выводом — я доложил «формы сбора почты нет»,
           хотя форма есть и работает. Отсутствие события читается как отсутствие
           вещи, и проверять это надо по предмету, а не по учёту.

           ЗДЕСЬ, а не в начале submit: выше стоят два отказа (адрес с опечаткой
           и непостоянное хранилище — см. разбор про "postgres"), и оба означают,
           что человека в списке НЕТ. Событие на входе в форму считало бы их
           подписчиками. Как у daily_solved: засчитал сервер, а не мы.

           🔴 САМОГО АДРЕСА В СОБЫТИИ НЕТ. Ручка сводки воронки открыта без
           токена, и личное в неё попадать не может: кладём только source — имя
           страницы-источника, которое и так видно в выгрузке. */
        track({ type: "waitlist_submit", meta: { source: source.slice(0, 60) } });
        /* ЗДЕСЬ, а не выше: два отказа (опечатка в адресе и непостоянное
           хранилище) до этой точки уже вернулись, значит сюда доходит только
           настоящий успех. Отметку «уже предлагали» страница ставит по этому
           вызову — иначе подписавшийся получит то же предложение ещё раз. */
        try { onSubscribed?.(); } catch { /* страница не обязана быть исправной ради формы */ }
        setStatus("done");
        setMessage(doneText || copy.done);
        setEmail("");
        return;
      }
      // Отдельный текст на каждый класс отказа: «что-то пошло не так» не говорит
      // человеку, повторять ему попытку или исправлять адрес.
      if (r.status === 429) {
        setStatus("error");
        setMessage(copy.tooMany);
      } else if (r.status === 400) {
        setStatus("error");
        setMessage(copy.rejected);
      } else {
        setStatus("error");
        setMessage(copy.ourFault);
      }
    } catch {
      setStatus("error");
      setMessage(copy.offline);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        padding: compact ? "4px 8px" : "24px 20px",
        borderRadius: compact ? 12 : 16,
        background: dark ? "linear-gradient(135deg, #0f172a, #1e293b)" : "#fff",
        border: dark ? "1px solid rgba(212,175,55,0.35)" : "1px solid rgba(15,23,42,0.12)",
        color: fg,
      }}
    >
      <h2
        style={
          compact
            ? /* Скрыто от глаза, но читается скринридером: форма без названия —
                 это форма, про которую непонятно, что она делает. */
              { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", margin: -1, padding: 0, border: 0 }
            : { fontSize: 22, fontWeight: 900, margin: "0 0 8px", letterSpacing: "-0.02em", color: fg }
        }
      >
        {title ?? copy.title}
      </h2>
      {compact ? null : (
        <p style={{ fontSize: 14, lineHeight: 1.55, margin: "0 0 16px", color: muted, maxWidth: 620 }}>
          {description ?? copy.description}
        </p>
      )}

      <div style={{ display: "flex", gap: compact ? 6 : 10, flexWrap: compact ? "nowrap" : "wrap", alignItems: compact ? "center" : "flex-start", paddingLeft: compact ? 18 : 0 }}>
        <label htmlFor={`waitlist-email-${source}`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          {copy.emailLabel}
        </label>
        <input
          id={`waitlist-email-${source}`}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={copy.placeholder}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            // Ответ прошлой отправки убираем, как только человек начал вводить
            // следующий адрес. Иначе зелёное «Готово» висит над пустым полем и
            // подписывает собой ввод, к которому не относится.
            if (status !== "idle") {
              setStatus("idle");
              setMessage("");
            }
          }}
          disabled={status === "sending"}
          aria-invalid={status === "error"}
          aria-describedby={message ? `waitlist-msg-${source}` : undefined}
          style={{
            flex: compact ? "1 1 120px" : "1 1 260px",
            minWidth: 0,
            padding: compact ? "5px 9px" : "12px 14px",
            fontSize: 16, // 16px — иначе Safari на телефоне зумит форму при фокусе
            borderRadius: 10,
            border: dark ? "1px solid rgba(226,232,240,0.25)" : "1px solid rgba(15,23,42,0.18)",
            background: dark ? "rgba(15,23,42,0.6)" : "#fff",
            color: fg,
          }}
        />
        <button
          type="submit"
          disabled={status === "sending"}
          style={{
            padding: compact ? "5px 11px" : "12px 20px",
            fontSize: compact ? 14 : 15,
            fontWeight: 800,
            borderRadius: 10,
            border: "none",
            cursor: status === "sending" ? "wait" : "pointer",
            background: dark ? "#d4af37" : "#0f172a",
            color: dark ? "#0f172a" : "#fff",
            whiteSpace: "nowrap",
          }}
        >
          {status === "sending" ? copy.sending : (buttonLabel ?? copy.buttonLabel)}
        </button>
      </div>

      {message ? (
        <p
          id={`waitlist-msg-${source}`}
          role="status"
          aria-live="polite"
          style={{
            margin: compact ? "4px 0 0" : "12px 0 0",
            fontSize: compact ? 13 : 14,
            fontWeight: 600,
            color: status === "done" ? (dark ? "#4ade80" : "#15803d") : dark ? "#fca5a5" : "#b91c1c",
          }}
        >
          {message}
        </p>
      ) : null}

      {(promise ?? copy.promise) ? (
        // 13.5px, а не 12.5: замер в браузере при ширине 390 (iPhone) показал, что
        // это САМЫЙ мелкий содержательный текст на странице — и при этом он объясняет,
        // на что человек подписывается («письмо на запуск», «отписка одной ссылкой»).
        // Мельче только надзаголовки в 11px, но те — три слова заглавными, их читают
        // взглядом, а не построчно. Мелкое условие подписки — плохая мелочь.
        <p style={{
          /* 🔴 Сжатый вид НЕ прячет обещание: человек должен видеть, на что
             подписывается, и что отписка в одно нажатие (это требование, не
             оформление). Замер 11.10 на проде: в сжатой прилипшей строке этот
             абзац стоил 33 px из 97 — больше, чем ряд поля с кнопкой. Поэтому
             он остаётся, но мельче и без большого отступа. */
          margin: compact ? "2px 0 0" : "12px 0 0",
          fontSize: compact ? 11.5 : 13.5,
          lineHeight: compact ? 1.25 : 1.55,
          color: muted,
        }}>{promise ?? copy.promise}</p>
      ) : null}
    </form>
  );
}

export default WaitlistCapture;
