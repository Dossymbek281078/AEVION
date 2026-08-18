import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";
import { channelFrom } from "@/lib/products";
import { WaitlistCapture } from "@/components/WaitlistCapture";

// Посадочная страница запуска CyberChess — 30 августа 2026.
//
// ЗАЧЕМ ОТДЕЛЬНАЯ СТРАНИЦА. Ролики ведут человека в шахматы, а /cyberchess —
// это само приложение: доска на весь экран, и место для «оставьте адрес» там
// отнимало бы игровое поле. Форма на главной и на /go собирает адреса всей
// платформы; здесь собираются те, кто пришёл именно за шахматами, и поле
// source="cyberchess" потом отвечает, какой канал их привёл.
//
// ЧЕСТНОСТЬ ЧИСЕЛ. Размер банка задач берётся из живого API, а не зашивается:
// на 18.08 в базе 502 584 задачи, и любое зашитое число начнёт врать в день,
// когда пул вырастет или усохнет. Не ответило — обходимся без цифры.
//
// ЧЕГО ЗДЕСЬ НАМЕРЕННО НЕТ. Ни слова про «задачу дня» и про рейтинг: на
// 18.08 задача дня крутит 365 позиций-пустышек, а публичный рейтинг состоит
// из выдуманных игроков (см. ЗАПУСК-2026-08-30.md, Б-1 и Б-2). Обещать их до
// выкатки починки — ровно то, из-за чего страницы платформы уже теряли доверие.

export const metadata: Metadata = {
  title: "CyberChess — запуск 30 августа",
  description:
    "Шахматы с ИИ-коучем, полмиллиона задач и турнирами. Оставьте адрес — напишем в день запуска и пришлём условия раннего доступа.",
  openGraph: {
    title: "CyberChess — запуск 30 августа",
    description:
      "ИИ-коуч, полмиллиона задач, турниры, античит. Ранний доступ по адресу почты.",
    type: "website",
  },
};

const PAPER = "#f7f6f2";
const INK = "#16161a";
const MUTED = "#5d5f66";
const GOLD = "#a9781a";

/** Размер банка задач — из живого API. null, если ответа нет: цифру без подтверждения не показываем. */
async function fetchPuzzleBank(): Promise<number | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/cyberchess-puzzles/meta`, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const j = (await r.json()) as { bankTotal?: number; poolSize?: number };
    const n = j.bankTotal ?? j.poolSize ?? 0;
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Сколько турниров объявлено. Тем же правилом: нет ответа — нет числа. */
async function fetchTournamentCount(): Promise<number | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/cyberchess-tournaments/list`, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const j = (await r.json()) as { count?: number; tournaments?: unknown[] };
    const n = j.count ?? (Array.isArray(j.tournaments) ? j.tournaments.length : 0);
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

function daysUntilLaunch(): number {
  const launch = Date.UTC(2026, 7, 30); // 30 августа 2026
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((launch - today) / 86_400_000);
}

export default async function CyberChessLaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const [bank, tournaments] = await Promise.all([fetchPuzzleBank(), fetchTournamentCount()]);
  const left = daysUntilLaunch();

  // Метка канала из адреса: /cyberchess/launch?c=tt в подписи ролика TikTok,
  // ?c=ig в шапке Instagram. Без неё все адреса лягут с одинаковым
  // source="cyberchess", и после запуска на вопрос «какой ролик привёл людей»
  // ответа не будет вовсе — а именно он решает, куда вкладывать следующий.
  //
  // Через channelFrom, а не напрямую: неизвестное значение превращается в null
  // и метки не будет. Иначе первый же чужой параметр в ссылке заведёт в
  // выгрузке подписчиков мусорный канал, который потом не отличить от нашего.
  const channel = channelFrom((await searchParams).c);
  const source = channel ? `cyberchess-${channel}` : "cyberchess";
  const bankLabel = bank ? new Intl.NumberFormat("ru-RU").format(bank) : null;

  return (
    <main style={{ minHeight: "100vh", background: PAPER, color: INK, padding: "32px 18px 56px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
        <header>
          <div style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: "0.12em", color: GOLD, textTransform: "uppercase" }}>
            AEVION · CyberChess
          </div>
          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 34,
              lineHeight: 1.15,
              margin: "10px 0 0",
              letterSpacing: "-0.01em",
            }}
          >
            Открываем 30 августа
          </h1>
          <p style={{ color: MUTED, fontSize: 15.5, lineHeight: 1.6, margin: "12px 0 0" }}>
            {left > 0
              ? `Через ${left} ${left === 1 ? "день" : left < 5 ? "дня" : "дней"}. Оставьте адрес — напишем в день запуска и пришлём условия раннего доступа, пока цена стартовая.`
              : "Уже открыто. Оставьте адрес, если хотите получать разборы и новости о турнирах."}
          </p>
        </header>

        <WaitlistCapture
          source={source}
          tone="light"
          title="Написать вам в день запуска"
          description="Одно письмо на запуск и условия раннего доступа. Ничего больше."
        />

        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 21, margin: 0 }}>Что уже работает</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {bankLabel ? (
              <Fact title={`${bankLabel} задач в банке`} note="С темами и рейтингом, а не набор картинок. Число берётся из базы при сборке страницы." />
            ) : null}
            <Fact
              title="ИИ-коуч, который учит по-разному"
              note="Разбор партии со стороны движка: где ошибка, почему она ошибка и что делать вместо."
            />
            {tournaments ? (
              <Fact title={`${tournaments} турниров с сеткой и рейтингом`} note="Регистрация, круги, таблица результатов." />
            ) : null}
            <Fact
              title="Игра с людьми и с движком"
              note="Подбор соперника по времени и рейтингу; ходы проверяет сервер, а не браузер."
            />
            <Fact
              title="Античит на стороне сервера"
              note="Подозрительные партии помечаются автоматически, без ручного разбора каждой."
            />
          </div>

          <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
            Пока идёт подготовка, приложение уже открыто:{" "}
            <a href="/cyberchess" style={{ color: GOLD, fontWeight: 600 }}>
              зайти и попробовать
            </a>
            .
          </p>
        </section>

        <footer style={{ borderTop: `1px solid rgba(22,22,26,0.12)`, paddingTop: 16 }}>
          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Мы пишем только по делу и только про шахматы. Отписка — одной ссылкой в каждом письме.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Fact({ title, note }: { title: string; note: string }) {
  return (
    <div
      style={{
        background: "#fffdf8",
        border: "1px solid rgba(22,22,26,0.10)",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontFamily: "Georgia, serif", fontSize: 16.5, fontWeight: 700 }}>{title}</div>
      <div style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.55, marginTop: 4 }}>{note}</div>
    </div>
  );
}
