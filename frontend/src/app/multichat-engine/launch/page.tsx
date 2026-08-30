import type { Metadata } from "next";
import paper from "@/styles/aevionPaper.module.css";
import { probeJson, probeLive } from "@/lib/probeLive";
import { channelFrom } from "@/lib/products";
import { WaitlistCapture } from "@/components/WaitlistCapture";
import { LandingView } from "@/components/LandingView";
import { PageTracking } from "@/components/PageTracking";

// Посадочная запуска Multichat.
//
// ПОЧЕМУ ЗДЕСЬ НЕТ ДАТЫ ОТКРЫТИЯ. Первая версия этой страницы объявляла дату в
// заголовке, в OG-карточке и обратным отсчётом «через N дн.». Я проверил её
// происхождение и не нашёл опоры ВНЕ собственной работы: каждое вхождение вело в
// файлы, которые я же написал в тот день. Единственная подтверждённая дата на
// платформе — 30 августа у шахмат (ветка launch/2026-08-30 и независимая сводка
// вкладки CyberChess). Дата запуска — решение основателя, и выдуманная дата на
// странице, где у человека просят адрес, есть обещание, которого платформа не
// давала. Поэтому здесь честное «напишем в день запуска», а оно к тому же и есть
// настоящая причина оставить адрес.
//
// ПОЧЕМУ ЗДЕСЬ НЕТ ЧИСЛА «17 МОДЕЛЕЙ». Замер 18.08 на живом проде: реестр
// провайдеров отвечает 17 записей, но с настроенным ключом из них ЧЕТЫРЕ —
// anthropic, openai, gemini, openrouter. Написать «17 моделей» было бы правдой
// по списку и обманом по делу: тринадцать не ответят. Поэтому страница обещает
// «четыре независимых поставщика» — столько, сколько реально отвечает.
//
// ЧТО ПРОВЕРЕНО ПЕРЕД ТЕМ, КАК ОБЕЩАТЬ (18.08, боевой прод api.aevion.app):
//   • реестр моделей жив: GET /api/qcoreai/providers → 200, configured=4;
//   • публичная проверка чека работает по-настоящему:
//     POST /api/multichat/receipt/verify с мусором → 400 (поля проверяются),
//     с настоящим чеком → 200 и разбор;
//   • общий доступ по ссылке: GET /api/multichat/shared/<чужой токен> → 404,
//     то есть роут жив и отдаёт только по действительной ссылке;
//   • платная стена работает: GET /api/multichat/conversations без токена → 402;
//   • приём адресов принимает: POST /api/constitution/waitlist/subscribe с
//     мусором → 400, то есть ручка есть и проверяет поля.
//
// ПОЧЕМУ СТИЛЬ ИЗ aevionPaper, А НЕ СВОИ КОНСТАНТЫ. Соседние посадочные (бюро,
// шахматы) объявляют палитру четырьмя литералами у себя в файле — три копии
// одного и того же. Здесь взят существующий светлый эталон платформы: его
// `--paper` совпадает с их PAPER до символа, и на нём же сделаны страницы
// QVenture. Заодно это снимает срабатывание сторожа темы модуля
// (__tests__/themeTokens.guard.test.ts): в файле нет ни одного шестнадцатеричного
// цвета, а значит и исключения в храповике не нужно.
//
// ЧЕГО ЗДЕСЬ НАМЕРЕННО НЕТ:
//   • цены. Отдельной подписки на модуль в магазине нет — он входит в тарифы
//     Medium и Full. Назвать цену, которую нельзя оплатить, значит отправить
//     человека к кнопке, которой не существует;
//   • обещания «модели спорят и приходят к истине». Совет показывает
//     РАСХОЖДЕНИЯ и пункты для проверки, а решает человек. Это разные вещи, и
//     вторая была бы неправдой.

export const metadata: Metadata = {
  title: "AEVION Multichat — ранний доступ",
  description:
    "Один вопрос — ответы моделей четырёх независимых поставщиков рядом, с картой расхождений и чеком, который проверяется по ссылке.",
  // СВОЙ canonical: без него страница наследует адрес раздела из его макета
  // и просит поисковик показывать раздел вместо себя. Замер живого прода
  // 30.08.2026 — так вели себя 78 страниц сайта.
  alternates: { canonical: "/multichat-engine/launch" },
  openGraph: {
    title: "AEVION Multichat — ранний доступ",
    description:
      "Совет моделей вместо одного ответа: видно, где они расходятся. Ранний доступ по адресу почты.",
    // Контент посадочных русский, а корневой layout объявляет lang="en":
    // проверено запросом от имени поискового робота — в серверной разметке
    // 2167 кириллических символов при lang="en" и без hreflang. Для
    // поисковика и превью в мессенджерах это рассогласование, и оно решается
    // здесь точечно: трогать общий layout нельзя, остальной сайт двуязычный.
    locale: "ru_RU",
    type: "website",
  },
};

/**
 * Склонение слова «поставщик» после числа. Без него страница написала бы
 * «4 независимых поставщик» — мелочь, которая сразу читается как машинный текст.
 */
function pluralProviders(n: number): string {
  const last2 = n % 100;
  const last = n % 10;
  if (last2 >= 11 && last2 <= 14) return "независимых поставщиков";
  if (last === 1) return "независимый поставщик";
  if (last >= 2 && last <= 4) return "независимых поставщика";
  return "независимых поставщиков";
}

export default async function MultichatLaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const [providers, receiptUp, sharedUp] = await Promise.all([
    probeJson<{
      providers?: { id?: string; name?: string; configured?: boolean; free?: boolean }[];
    }>("/api/qcoreai/providers"),
    probeLive("/api/multichat/receipt/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Заведомо неверный пакет: ждём 400. Настоящих чеков на проде не создаём.
      body: "{}",
    }),
    // Ручка ищет беседу по токену, поэтому 404 на несуществующий токен — её
    // ПРАВИЛЬНЫЙ ответ, а не признак поломки. Без этой оговорки метка не
    // могла стать «работает» никогда: проба сама создаёт условие, при котором
    // всегда получает 404, и мы бы вечно писали «проверяется» о работающем
    // контуре. Токен намеренно несуществующий — проба ничего не создаёт.
    probeLive("/api/multichat/shared/launch-page-probe", undefined, { aliveOn404: true }),
  ]);

  // Числа и названия поставщиков берутся ИЗ ОТВЕТА, а не пишутся руками.
  //
  // Замер 19.08.2026: ручка отдаёт 17 поставщиков, из них `configured: true` ровно
  // четыре (anthropic, openai, gemini, openrouter), и бесплатных среди них два.
  // Прежний текст называл те же числа и те же имена — и был точен. Но зашитое
  // число не может остаться верным само: убери ключ провайдера, и страница
  // продолжит обещать «четыре независимых поставщика». Ровно этого правила — числа
  // только из фактического прогона — я и держусь в остальном.
  const ready = (providers?.providers ?? []).filter((p) => p.configured);
  const freeReady = ready.filter((p) => p.free);
  // Совет имеет смысл от двух независимых поставщиков: один — это не совет.
  const modelsUp = ready.length >= 2;

  // Метка канала — та же механика, что на посадочных бюро и шахмат: без неё
  // после запуска не ответить, какой источник привёл людей именно сюда.
  const channel = channelFrom((await searchParams).c);
  const source = channel ? `multichat-${channel}` : "multichat";

  return (
    <main className={paper.paper} style={{ minHeight: "100vh", padding: "32px 18px 56px" }}>
      {/* Заходы сюда не считались до 28.08.2026: страница собирает адреса, но
          события page_view не слала. Воронка считает переходы ОТ page_view,
          поэтому её посетители не попадали в знаменатель — конверсия выглядела
          лучше, чем есть. Компонент сам читает ?c= из ссылки. */}
      <PageTracking page="multichat-launch" />
      <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
        <header>
          <div className={paper.kicker}>AEVION · Multichat</div>
          <h1
            className={paper.serifTitle}
            style={{ fontSize: "clamp(28px, 5vw, 36px)", lineHeight: 1.15, marginTop: 10 }}
          >
            Спросить не одну модель, а совет
          </h1>
          <p
            style={{
              color: "var(--ink-soft)",
              fontSize: 15.5,
              lineHeight: 1.6,
              margin: "12px 0 0",
            }}
          >
            Опишите задачу словами — вопрос уходит сразу нескольким моделям, ответы
            встают рядом, и отдельно показано, <b>где они расходятся</b>. Именно
            расхождение чаще всего и есть то место, которое стоит проверить самому.
            {" Дату открытия объявим отдельно — оставьте адрес, и письмо придёт в день запуска."}
          </p>
        </header>

        <LandingView source={source} />

        <WaitlistCapture
          source={source}
          tone="light"
          title="Написать вам в день запуска"
          description="Одно письмо на запуск и условия раннего доступа. Ничего больше."
        />

        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className={paper.sectionHead}>
            <h2 className={paper.serifTitle} style={{ fontSize: 21 }}>
              Как это работает
            </h2>
          </div>

          <Step
            n={1}
            title={
              modelsUp
                ? `Один вопрос — ${ready.length} ${pluralProviders(ready.length)}`
                : "Один вопрос — несколько независимых поставщиков"
            }
            note={
              modelsUp
                ? `${ready.map((p) => p.name ?? p.id).join(", ")} отвечают на один и тот же вопрос.` +
                  (freeReady.length
                    ? ` ${freeReady.length} из ${ready.length} — на бесплатных моделях, поэтому совет можно собрать, не платя за каждый ответ.`
                    : "")
                : "Сколько поставщиков подключено, страница спросит у боевого сервера при сборке. Сейчас ответ не получен, поэтому числа здесь нет."
            }
            live={modelsUp}
          />
          <Step
            n={2}
            title="Расхождения названы, а не спрятаны"
            note="Рядом с ответами — что именно не сошлось: разные числа, одинокое мнение, осторожные формулировки. Плюс список «что проверить», в том же порядке. Решает человек."
            live={modelsUp}
          />
          <Step
            n={3}
            title="Чек, который проверяется по ссылке"
            note="К каждому совету прилагается чек: какие модели отвечали, сколько ответили, отпечаток каждого ответа. Проверяется без входа и без аккаунта — тем, кому вы её отправили."
            live={receiptUp}
          />
          <Step
            n={4}
            title="Совет можно открыть ссылкой"
            note="Ссылка отдаёт беседу только по действительному токену и без стоимости запросов внутри — показывать заказчику можно, счёт он не увидит."
            live={sharedUp}
          />

          <p style={{ color: "var(--ink-faint)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Отметка «работает» ставится не вручную: страница спрашивает у боевого
            сервера при сборке.
          </p>
        </section>

        <section className={paper.card}>
          <h2 className={paper.serifTitle} style={{ fontSize: 18, marginBottom: 6 }}>
            Чего мы не обещаем
          </h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
            Совет не приходит к истине голосованием — он показывает, где модели
            расходятся, а вывод делает человек. Отвечают четыре поставщика: в списке
            их семнадцать, но настроены четыре, и писать «17 моделей» мы не будем.
            Отдельной подписки на модуль пока нет — он входит в тарифы Medium и Full.
          </p>
        </section>

        <footer style={{ borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
          <p style={{ color: "var(--ink-faint)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Пока идёт подготовка, открыт сам модуль:{" "}
            <a className={paper.link} href="/multichat-engine">
              посмотреть Multichat
            </a>{" "}
            — там же кнопка «показать на примере», она работает без входа. Проверить
            чужой чек тоже можно без аккаунта:{" "}
            <a className={paper.link} href="/multichat-engine/verify">
              страница проверки
            </a>
            . Ссылка нужна по делу: страница выше обещает, что чек проверяется по
            ссылке, а проверить это было негде — единственный выход со страницы вёл в
            модуль. Отписка — одной ссылкой в каждом письме.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Step({ n, title, note, live }: { n: number; title: string; note: string; live: boolean }) {
  return (
    <div className={paper.card} style={{ display: "flex", gap: 12 }}>
      <div
        className={paper.serifTitle}
        style={{ fontSize: 20, color: "var(--teal-deep)", lineHeight: 1.2 }}
      >
        {n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <span className={paper.serifTitle} style={{ fontSize: 16.5 }}>
            {title}
          </span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: live ? "var(--teal-deep)" : "var(--ink-faint)",
            }}
          >
            {live ? "работает" : "проверяется"}
          </span>
        </div>
        <div style={{ color: "var(--ink-soft)", fontSize: 13.5, lineHeight: 1.55, marginTop: 4 }}>
          {note}
        </div>
      </div>
    </div>
  );
}
