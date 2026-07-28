"use client";

/**
 * Честное сравнение AEVION с аналогами.
 *
 * Страница намеренно устроена так, что «где мы слабее» стоит ПЕРВЫМ и написано
 * подробнее: сравнение, в котором мы всегда побеждаем, ничего не стоит и не
 * помогает принимать решения. Источник — docs/COMPETITIVE-HONEST.md; правки
 * вносить туда и сюда одновременно, иначе документ и витрина разойдутся.
 *
 * Мобильный первым: широкие таблицы на телефоне нечитаемы, поэтому каждая
 * строка сравнения — карточка, а не колонки.
 */

import Link from "next/link";
import { useState } from "react";

type Row = {
  module: string;
  what: string;
  rivals: string;
  weaker: string;
  stronger: string;
  verdict?: string;
};

const GROUPS: Array<{ title: string; note?: string; rows: Row[] }> = [
  {
    title: "AI и агенты",
    rows: [
      {
        module: "Multichat Engine",
        what: "консилиум агентов с картой разногласий",
        rivals: "Perplexity Model Council (февраль 2026), Council Mode, десятки сборок multi-agent debate на GitHub",
        weaker:
          "У Perplexity ответы сводит chair-модель — это смысловой синтез, у нас лексические эвристики. Качество на живых моделях не измерено: консилиум через них ни разу не прогоняли. Провайдеры на проде настроены — anthropic, openai, gemini, openrouter (проверено 28.07), — но сам модуль за платной стеной, а локально ключей нет. То есть мешает доступ, а не отсутствие моделей. Ключи подписи на проде не настроены, поэтому в чеке пока только хеш.",
        stronger:
          "Карта разногласий считается без единого вызова модели — она бесплатна и воспроизводима: те же ответы дают ту же карту. Результат можно предъявить третьей стороне: хеши промта и ответов, стоимость, публичная проверка чека без аккаунта. У Perplexity этого нет. Попробовать можно без регистрации, у них — подписка Max.",
        verdict:
          "Спор агентов перестал быть нишей в феврале 2026. Наша ниша — предъявляемость спора, а не сам спор.",
      },
      {
        module: "QCoreAI · QFusionAI · QAI",
        what: "движки и смарт-роутинг моделей",
        rivals: "OpenRouter, LiteLLM, Portkey, Together",
        weaker: "У OpenRouter сотни моделей, биллинг, SLA и большое сообщество. У нас уже случалось, что бесплатный тариф упирался в неучтённую квоту.",
        stronger: "Экономия от роутинга видна публичным счётчиком, а не заявлена в маркетинге.",
      },
      {
        module: "QReal Studio · QMedia",
        what: "AI-видео и креатив",
        rivals: "Higgsfield, Runway, Pika, Sora, ElevenLabs",
        weaker: "Качество генерации у лидеров несопоставимо выше, и мы работаем поверх чужих моделей.",
        stronger: "Сгенерированное сразу фиксируется за автором в реестре прав.",
        verdict: "Утверждать превосходство над Higgsfield без слепого бенчмарка запрещено — решение основателя от 21.07.",
      },
    ],
  },
  {
    title: "Право, подпись, доверие",
    rows: [
      {
        module: "QRight · QSign · IP Bureau",
        what: "авторство, подпись, бюро доказательств",
        rivals: "OriginStamp, EverCert, PixelSeal, DocuSign, национальные реестры",
        weaker:
          "DocuSign — юридически признанная подпись с историей судебной практики; у нас её нет. OriginStamp и EverCert делают одну задачу, но давно и с репутацией. Хуже другое: до 27.07 в семи местах сайта постквантовая подпись подавалась как работающая в проде, тогда как проверка состояния отвечала «preview». Это разрыв не в технике, а в доверии.",
        stronger: "Три слоя в одном контуре: фиксация объекта, подпись, бюро доказательств. Якорь в биткоин через OpenTimestamps. Там, где нужно, хеш не покидает устройство.",
        verdict: "Честная формулировка — «доказательство существования на дату», а не «защита прав».",
      },
      {
        module: "QContract",
        what: "самоуничтожающиеся документы",
        rivals: "Digify, Docsend, Firmex",
        weaker: "У Docsend аналитика просмотров, интеграции с CRM и корпоративные договоры. Мы — демонстрация возможности.",
        stronger: "Дешевле и с публичной проверкой.",
      },
    ],
  },
  {
    title: "Деньги",
    note: "Единственная группа, где сравнение не может быть в нашу пользу — и не будет, пока нет лицензий.",
    rows: [
      {
        module: "QPayNet · QMaskCard · QTradeOffline · Bank",
        what: "платежи, защищённая карта, офлайн-расчёты",
        rivals: "Stripe, Revolut, Privacy.com, Wise",
        weaker: "У нас нет лицензии, эквайринга и compliance. Всё перечисленное — витрины и песочницы, а Stripe — платёжная инфраструктура планеты.",
        stronger: "Связность с остальными модулями; офлайн-сценарий QTradeOffline встречается редко.",
      },
      {
        module: "Revenue Hub · Ventures · Startup Exchange",
        what: "метрики выручки и биржа идей",
        rivals: "ProfitWell, Baremetrics, AngelList, Republic, F6S",
        weaker: "Там реальные деньги, инвесторы и юристы. У нас пока каталог.",
        stronger: "Идея на бирже защищена фиксацией авторства до показа — у AngelList такого нет.",
      },
    ],
  },
  {
    title: "Отраслевые",
    rows: [
      {
        module: "QBuild",
        what: "найм рабочих в строительстве",
        rivals: "hh.kz, кадровые агентства КЗ, глобальные EOR (Rippling, Deel, Multiplier)",
        weaker: "hh.kz — это трафик и привычка рынка, агентства дают документы и гарантии. На нашей витрине 5 проектов и 9 вакансий, и все засеяны нами: живых работодателей пока нет.",
        stronger: "Прямой найм без агентской комиссии, публикация бесплатна, оплата за найм. Локальный контекст: города, специальности, валюты Казахстана.",
        verdict: "Ниша реальна: выделенного приложения под найм строителей в Центральной Азии поиск не нашёл.",
      },
      {
        module: "Smeta Trainer",
        what: "тренажёр сметного дела РК",
        rivals: "АВС-4, «Смета РК», «Сана»",
        weaker: "Это не сметная программа и её не заменяет. Корпус учебный, в реестр допущенных средств мы не входим.",
        stronger: "Обучение методике и разбор типовых ошибок студента — того, чего сметные программы не делают.",
      },
      {
        module: "QSkyway",
        what: "воздушные коридоры для дронов",
        rivals: "Altitude Angel, Wing/OpenSky (AirMap закрылся)",
        weaker: "У Altitude Angel контракты с авиавластями. У нас 21 пара маршрутов из 42 упирается в потолок — покрытие неполное.",
        stronger: "Правила трёх юрисдикций (FAA, MLIT, AIP KZ) сведены в один слой, хотя публикуются они в трёх разных формах.",
      },
      {
        module: "CyberChess",
        what: "шахматы с ИИ-коучем",
        rivals: "Lichess, Chess.com",
        weaker: "Lichess бесплатен, открыт и имеет миллионы игроков. Соревноваться как игровая платформа бессмысленно.",
        stronger: "Коуч разбирает партию и подстраивается под уровень; боты ошибаются по-человечески; 500 тысяч задач из открытого дампа.",
      },
    ],
  },
  {
    title: "Здоровье и жизнь",
    note: "Здесь важнее всего не преувеличить: мы не медицинский продукт и не имеем права им называться.",
    rows: [
      {
        module: "HealthAI · QGood · PsyApp · DeepSan · QLife · QPersona",
        what: "помощники по здоровью, психологии и режиму",
        rivals: "Ada Health, K Health, Woebot, Wysa, Headspace, Notion",
        weaker: "У Ada и Woebot клинические исследования и регуляторный статус. У нас их нет — значит и позиционирования «доктор» быть не должно, несмотря на название модуля.",
        stronger: "Русскоязычность и связность с остальными модулями.",
      },
      {
        module: "QLearn · Kids AI · QNews · QStore · QEvents",
        what: "обучение, контент, магазин, события",
        rivals: "Duolingo, Khan Academy, Feedly, Gumroad, Meetup",
        weaker: "Это зрелые продукты с контентом и сообществами, которые строились годами. Наши — заготовки.",
        stronger: "Единый контур и цена входа.",
      },
      {
        module: "VeilNetX · ShadowNet · QChainGov · LifeBox",
        what: "приватная сеть, DAO-управление, цифровая капсула",
        rivals: "Tor, Mullvad, Snapshot, Aragon",
        weaker: "У Tor и Aragon годы независимого аудита. Заявлять приватность без внешнего аудита нельзя, и мы не заявляем.",
        stronger: "Работают внутри общего контура прав и подписи.",
      },
      {
        module: "Globus · Constitution · Z-Tide · Voice of Earth · MapReality",
        what: "авторские концепты платформы",
        rivals: "прямых аналогов нет",
        weaker: "Отсутствие аналога — это не преимущество, а чаще признак того, что рынок ещё не подтверждён.",
        stronger: "Измерять превосходство не над чем; ценность в связывании остальных модулей в одну картину.",
      },
    ],
  },
];

const PALETTE = {
  paper: "#fbfaf7",
  ink: "#1a1a1a",
  inkSoft: "#4a4a4a",
  inkMute: "#6b6b6b",
  line: "#e2ddd3",
  weak: "#8a3a2a",
  strong: "#2a5c3a",
  accent: "#0d6b5f",
};

export default function ComparePage() {
  const [openAll, setOpenAll] = useState(false);

  return (
    <main style={{ background: PALETTE.paper, color: PALETTE.ink, minHeight: "100vh" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 20px 80px" }}>
        <Link href="/demo" style={{ fontSize: 14, color: PALETTE.accent, textDecoration: "none", fontWeight: 600 }}>
          ← К демо
        </Link>

        <h1 style={{ fontSize: 36, lineHeight: 1.15, margin: "18px 0 10px", fontWeight: 800, letterSpacing: "-0.02em" }}>
          AEVION против аналогов
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: PALETTE.inkSoft, margin: "0 0 8px", maxWidth: 680 }}>
          Это не продающая страница. В каждой строке первым идёт то, где мы слабее — сравнение,
          в котором мы всегда побеждаем, ничего не стоит и не помогает решать.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: PALETTE.inkMute, margin: "0 0 26px", maxWidth: 680 }}>
          Реестр модулей взят из живого API, утверждения о нас — из фактических прогонов на проде,
          об аналогах — из публичных источников, проверенных 27–28 июля 2026.
        </p>

        <section
          style={{
            border: `1px solid ${PALETTE.line}`,
            borderRadius: 14,
            padding: "18px 20px",
            marginBottom: 30,
            background: "#fff",
          }}
        >
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: PALETTE.ink }}>
            <strong>Главная оговорка ко всему списку.</strong> Почти везде мы моложе и меньше: нет продаж,
            поддержка — это один человек и адрес почты, а не служба с гарантией ответа; нет интеграций, нет истории инцидентов. Для бизнеса это весит больше любой
            технической детали. Поштучно против лидера категории выбирать нас сегодня чаще всего
            незачем — смысл появляется, когда нужны несколько модулей сразу и общий контур доверия
            между ними.
          </p>
        </section>

        {/* Разбор ниже честный, но длинный. Инвестору и партнёру нужен один
            экран, который можно показать за полминуты и не соврать. Держим оба
            формата на одной странице: короткий сверху, подробный ниже. */}
        <section
          style={{
            border: `2px solid ${PALETTE.ink}`,
            borderRadius: 16,
            padding: "22px 22px 18px",
            marginBottom: 30,
            background: "#fff",
          }}
        >
          <p
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              fontWeight: 800,
              color: PALETTE.inkMute,
              margin: "0 0 14px",
            }}
          >
            Если у вас тридцать секунд
          </p>

          <div style={{ display: "grid", gap: 14 }}>
            {[
              {
                q: "Где мы объективно первые",
                a: "Два места. Предъявляемость ответа ИИ: чек с хешами, стоимостью и публичной проверкой без аккаунта — у Perplexity Model Council этого нет. И сведение правил трёх авиаюрисдикций (FAA, MLIT, AIP KZ) в один слой.",
              },
              {
                q: "Где мы объективно слабее",
                a: "Везде, где решает зрелость: нет продаж, поддержки, интеграций и внешнего аудита. В финтехе нет лицензий — сравнение со Stripe не в нашу пользу и не станет им без них. В здоровье у Ada и Woebot клинические исследования, у нас нет.",
              },
              {
                q: "Тогда зачем мы",
                a: "Поштучно против лидера категории — незачем. Смысл появляется, когда нужны несколько модулей сразу: один вход, один реестр прав, одна подпись между ними. Это то, чего у лидеров нет по построению — они делают один продукт.",
              },
            ].map((r) => (
              <div key={r.q}>
                <p style={{ margin: "0 0 3px", fontSize: 15.5, fontWeight: 800 }}>{r.q}</p>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: PALETTE.inkSoft }}>{r.a}</p>
              </div>
            ))}
          </div>

          <p
            style={{
              margin: "16px 0 0",
              paddingTop: 14,
              borderTop: `1px solid ${PALETTE.line}`,
              fontSize: 14.5,
              lineHeight: 1.55,
              color: PALETTE.inkMute,
            }}
          >
            Ниже — то же самое по каждому из 41 модуля, с названными аналогами и без
            смягчений.
          </p>
        </section>

        <button
          onClick={() => setOpenAll((v) => !v)}
          style={{
            border: `1px solid ${PALETTE.line}`,
            background: "#fff",
            color: PALETTE.ink,
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: 24,
          }}
        >
          {openAll ? "Свернуть подробности" : "Развернуть все подробности"}
        </button>

        {GROUPS.map((g) => (
          <section key={g.title} style={{ marginBottom: 38 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>{g.title}</h2>
            {g.note && (
              <p style={{ fontSize: 14.5, color: PALETTE.inkMute, margin: "0 0 14px", lineHeight: 1.55 }}>{g.note}</p>
            )}
            <div style={{ display: "grid", gap: 14 }}>
              {g.rows.map((r) => (
                <article
                  key={r.module}
                  style={{
                    border: `1px solid ${PALETTE.line}`,
                    borderRadius: 14,
                    padding: "16px 18px",
                    background: "#fff",
                  }}
                >
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 2px" }}>{r.module}</h3>
                  <p style={{ fontSize: 14, color: PALETTE.inkMute, margin: "0 0 10px" }}>{r.what}</p>

                  <p style={{ fontSize: 14, margin: "0 0 12px", lineHeight: 1.55 }}>
                    <span style={{ color: PALETTE.inkMute }}>Аналоги: </span>
                    <span style={{ color: PALETTE.inkSoft }}>{r.rivals}</span>
                  </p>

                  <details open={openAll}>
                    <summary style={{ cursor: "pointer", fontSize: 14.5, fontWeight: 700, color: PALETTE.weak }}>
                      Где мы слабее
                    </summary>
                    <p style={{ fontSize: 15, lineHeight: 1.6, margin: "8px 0 14px", color: PALETTE.ink }}>{r.weaker}</p>
                  </details>

                  <details open={openAll}>
                    <summary style={{ cursor: "pointer", fontSize: 14.5, fontWeight: 700, color: PALETTE.strong }}>
                      Где мы сильнее
                    </summary>
                    <p style={{ fontSize: 15, lineHeight: 1.6, margin: "8px 0 0", color: PALETTE.ink }}>{r.stronger}</p>
                  </details>

                  {r.verdict && (
                    <p
                      style={{
                        fontSize: 14.5,
                        lineHeight: 1.55,
                        margin: "14px 0 0",
                        paddingTop: 12,
                        borderTop: `1px solid ${PALETTE.line}`,
                        color: PALETTE.inkSoft,
                      }}
                    >
                      {r.verdict}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}

        <section style={{ borderTop: `2px solid ${PALETTE.ink}`, paddingTop: 22, marginTop: 10 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px" }}>Что из этого следует</h2>
          <ol style={{ margin: 0, paddingLeft: 22, fontSize: 15.5, lineHeight: 1.7, color: PALETTE.ink }}>
            <li>
              <strong>Поштучно мы почти нигде не лидер.</strong> Объективно первые мы в двух местах:
              предъявляемость AI-ответа и сведение правил трёх юрисдикций в QSkyway. Остальное —
              «дешевле, связнее, локальнее», а не «лучше».
            </li>
            <li>
              <strong>Самый большой разрыв — в доверии, а не в технике.</strong> Отсутствие продаж,
              поддержки и внешнего аудита весит больше любой функции.
            </li>
            <li>
              <strong>Главная опасность — обещать больше факта.</strong> На витрине пишем то, что
              отвечает проверка состояния, а не то, что запланировано.
            </li>
            <li>
              <strong>Ближе всего к деньгам</strong> QBuild и Smeta: локальный рынок и слабые аналоги.
              AI-модули — витрина возможностей.
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
