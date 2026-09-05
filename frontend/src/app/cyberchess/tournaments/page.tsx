"use client";

import { человеческаяДата } from "./tournamentDate";

// AEVION CyberChess — Tournament Hub (list view)
// Zone: aevion-core/main owns frontend/src/app/cyberchess/**
// Reads from /api/cyberchess-tournaments/list; falls back to mock if offline.
//
// New in this iteration:
//   • Format chips (All / Elim / Swiss / RR)
//   • Format badge on each card ("Swiss 5 rounds" / "Round-robin" / "Single Elim")
//   • Standings preview on card hover (mini-table top-5)
//
// Enhancements (2026-05-19):
//   • Filter chip "Только real-player" — keep only realPlayers === true
//   • Sort dropdown: fill (players/maxPlayers) | startsAt date | prize
//   • Live indicator with pulse dot for status === "live" tournaments

import { useCallback, useEffect, useMemo, useState } from "react";
import { tournamentUserId, tournamentDisplayName } from "./playerIdentity";
import Link from "next/link";

const T = {
  bg: "#0a0e1a",
  surface: "#141826",
  surfaceAlt: "#1b2033",
  border: "#2a3148",
  text: "#e2e8f0",
  dim: "#94a3b8",
  faint: "#64748b",
  accent: "#10b981",
  accentDim: "#065f46",
  blue: "#3b82f6",
  purple: "#a78bfa",
  red: "#ef4444",
  yellow: "#fbbf24",
  orange: "#fb923c",
};

type TimeControl = "blitz" | "rapid" | "classic";
type Status = "upcoming" | "live" | "finished";
type Format = "single_elimination" | "swiss" | "round_robin";

interface Tournament {
  id: string;
  title: string;
  format: Format;
  timeControl: TimeControl;
  eloMin: number;
  eloMax: number;
  players: number;
  maxPlayers: number;
  prizeChessy: number;
  status: Status;
  startsAt: string;
  swissRounds?: number;
  currentRound?: number;
  realPlayers?: boolean;
  /** "user" — турнир завёл кто угодно через открытую ручку; "seed" — фикстура. */
  origin?: "seed" | "user";
}

interface StandingRow {
  rank: number;
  id: string;
  name: string;
  rating: number;
  score: number;
  buchholz: number;
  gamesPlayed: number;
}

// Запасной список помечен origin: "seed" — тем же признаком, по которому
// карточка рисует подпись «образец». Прежде признака не было: при недоступном
// сервере человек видел «Spring Blitz Open, 87/128 игроков» как настоящий
// турнир. Сообщение об отказе внизу страницы есть, но карточки читают раньше
// него и по отдельности.
//
// Механизм переиспользован, а не заведён второй: подпись уже умеет включаться
// по origin.
const MOCK_FALLBACK: Tournament[] = [
  {
    id: "spring-blitz-01",
    title: "Spring Blitz Open",
    format: "single_elimination",
    timeControl: "blitz",
    eloMin: 1800,
    eloMax: 2400,
    players: 87,
    maxPlayers: 128,
    prizeChessy: 50_000,
    status: "upcoming",
    origin: "seed",
    startsAt: "2026-05-18 19:00",
  },
  {
    id: "swiss-arena-may",
    title: "Swiss Arena — Май",
    format: "swiss",
    timeControl: "rapid",
    eloMin: 1900,
    eloMax: 2500,
    players: 8,
    maxPlayers: 16,
    prizeChessy: 40_000,
    status: "upcoming",
    origin: "seed",
    startsAt: "2026-05-16 18:00",
    swissRounds: 5,
    currentRound: 1,
    realPlayers: true,
  },
  {
    id: "classic-rr-may",
    title: "Classical Round-robin — May",
    format: "round_robin",
    timeControl: "classic",
    eloMin: 2000,
    eloMax: 2800,
    players: 8,
    maxPlayers: 8,
    prizeChessy: 120_000,
    status: "upcoming",
    origin: "seed",
    startsAt: "2026-05-14 12:00",
  },
];

type TcFilter = "all" | TimeControl;
type StatusFilter = "all" | Status;
type FormatFilter = "all" | Format;
type SortKey = "fill" | "startsAt" | "prize";

export default function TournamentsHubPage() {
  const [tcFilter, setTcFilter] = useState<TcFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [realPlayersOnly, setRealPlayersOnly] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<SortKey>("startsAt");
  const [eloMin, setEloMin] = useState<number>(0);
  const [eloMax, setEloMax] = useState<number>(3000);

  const [tournaments, setTournaments] = useState<Tournament[]>(MOCK_FALLBACK);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState<boolean>(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const r = await fetch("/api-backend/api/cyberchess-tournaments/list", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      /* Ветка «пришло, но не то» раньше молчала: при 200 с телом без списка
         состояние оставалось на MOCK_FALLBACK, ошибка не ставилась, и человек
         видел выдуманные турниры вообще без признака. Отправляем в тот же
         catch, что и недоступный сервер — сообщение внизу уже есть. */
      if (!data?.ok || !Array.isArray(data.tournaments)) {
        throw new Error("ответ без списка турниров");
      }
      setTournaments(data.tournaments);
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const arr = tournaments.filter((t) => {
      if (formatFilter !== "all" && t.format !== formatFilter) return false;
      if (tcFilter !== "all" && t.timeControl !== tcFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (realPlayersOnly && !t.realPlayers) return false;
      if (t.eloMax < eloMin) return false;
      if (t.eloMin > eloMax) return false;
      return true;
    });

    // Sort
    arr.sort((a, b) => {
      if (sortKey === "fill") {
        const fa = a.maxPlayers > 0 ? a.players / a.maxPlayers : 0;
        const fb = b.maxPlayers > 0 ? b.players / b.maxPlayers : 0;
        return fb - fa; // most-full first
      }
      if (sortKey === "prize") {
        return b.prizeChessy - a.prizeChessy; // biggest prize first
      }
      // startsAt: earliest first (string compare works for ISO-ish "2026-05-18 19:00")
      return a.startsAt.localeCompare(b.startsAt);
    });

    return arr;
  }, [tournaments, formatFilter, tcFilter, statusFilter, realPlayersOnly, sortKey, eloMin, eloMax]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, padding: "24px 32px" }}>
      {/* Global keyframes */}
      <style>{`
        @keyframes cc-hub-pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.5); opacity: 0.5; }
        }
        @keyframes cc-hub-live-glow {
          0%, 100% { box-shadow: 0 0 0 1px ${T.red}33, 0 0 18px ${T.red}22; }
          50%      { box-shadow: 0 0 0 2px ${T.red}77, 0 0 28px ${T.red}55; }
        }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/cyberchess"
          style={{ color: T.dim, textDecoration: "none", fontSize: 14 }}
        >
          ← к шахматам
        </Link>
      </div>

      {/* Header */}
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <h1
            style={{
              fontSize: 36,
              margin: 0,
              letterSpacing: -0.5,
              color: T.text,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span>🏆</span>
            <span>Турниры AEVION</span>
          </h1>
          <button
            onClick={() => setCreateOpen(true)}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: `linear-gradient(135deg, ${T.accent}, ${T.blue})`,
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: `0 4px 16px ${T.accent}44`,
              whiteSpace: "nowrap",
            }}
          >
            ＋ Создать турнир
          </button>
        </div>
        <p style={{ color: T.dim, marginTop: 8, fontSize: 14 }}>
          На вылет, швейцарская система или круговой — создай свой турнир или регистрируйся в чужой.
        </p>
        {loading && (
          <div style={{ color: T.faint, marginTop: 8, fontSize: 12 }}>Загружаем список...</div>
        )}
        {errorMsg && (
          <div style={{ color: T.orange, marginTop: 8, fontSize: 12 }}>
            Турниры сейчас не загрузились — ниже показан ПРИМЕР того, как
            выглядит список. Обновите страницу через минуту.
          </div>
        )}
      </header>

      {createOpen && (
        <CreateTournamentModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void reload();
          }}
        />
      )}

      {/* Filters */}
      <section
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "center",
        }}
      >
        <FilterGroup label="Формат">
          {(["all", "single_elimination", "swiss", "round_robin"] as const).map((v) => (
            <PillButton
              key={v}
              active={formatFilter === v}
              onClick={() => setFormatFilter(v)}
              label={
                v === "all"
                  ? "Все"
                  : v === "single_elimination"
                  ? "На вылет"
                  : v === "swiss"
                  ? "Швейцарская"
                  : "Круговой"
              }
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Контроль времени">
          {(["all", "blitz", "rapid", "classic"] as const).map((v) => (
            <PillButton
              key={v}
              active={tcFilter === v}
              onClick={() => setTcFilter(v)}
              label={
                v === "all"
                  ? "Все"
                  : v === "blitz"
                  ? "Блиц"
                  : v === "rapid"
                  ? "Рапид"
                  : "Классика"
              }
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Статус">
          {(["all", "upcoming", "live", "finished"] as const).map((v) => (
            <PillButton
              key={v}
              active={statusFilter === v}
              onClick={() => setStatusFilter(v)}
              label={
                v === "all"
                  ? "Все"
                  : v === "upcoming"
                  ? "Скоро"
                  : v === "live"
                  ? "Live"
                  : "Завершён"
              }
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Игроки">
          <PillButton
            active={realPlayersOnly}
            onClick={() => setRealPlayersOnly((v) => !v)}
            label={realPlayersOnly ? "⚡ только реальные" : "Все игроки"}
          />
        </FilterGroup>

        <FilterGroup label="Сортировать">
          {(
            [
              ["startsAt", "По дате"],
              ["fill", "По заполненности"],
              ["prize", "По призу"],
            ] as const
          ).map(([key, label]) => (
            <PillButton
              key={key}
              active={sortKey === key}
              onClick={() => setSortKey(key)}
              label={label}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="ELO диапазон">
          <input aria-label="ELO минимум"
            type="number"
            value={eloMin}
            onChange={(e) => setEloMin(Number(e.target.value) || 0)}
            style={inputStyle}
            placeholder="от"
          />
          <span style={{ color: T.dim }}>—</span>
          <input aria-label="ELO максимум"
            type="number"
            value={eloMax}
            onChange={(e) => setEloMax(Number(e.target.value) || 0)}
            style={inputStyle}
            placeholder="до"
          />
        </FilterGroup>
      </section>

      {/* Tournament cards grid */}
      <section
        style={{
          display: "grid",
          // min(340px, 100%) вместо жёстких 340: на экране уже 340 колонка
          // перестаёт требовать невозможного и сжимается до ширины экрана.
          // Замер 28.08.2026 на ширине 320: карточки были 340 при окне 305,
          // и страница уезжала вбок на 52 пикселя. На 375 этого не видно.
          gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))",
          gap: 16,
        }}
      >
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: 32,
              textAlign: "center",
              color: T.dim,
              background: T.surface,
              border: `1px dashed ${T.border}`,
              borderRadius: 12,
            }}
          >
            Турниры под текущие фильтры не найдены.
          </div>
        )}
        {filtered.map((t) => (
          <TournamentCard key={t.id} t={t} />
        ))}
      </section>
    </div>
  );
}

// ── small inline components ────────────────────────────────────────

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: T.faint, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {children}
      </div>
    </div>
  );
}

function PillButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? T.accent : T.surfaceAlt,
        color: active ? "#022c22" : T.text,
        border: `1px solid ${active ? T.accent : T.border}`,
        borderRadius: 999,
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 120ms",
      }}
    >
      {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  background: T.surfaceAlt,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  padding: "6px 10px",
  color: T.text,
  fontSize: 13,
  width: 70,
};

function formatLabel(f: Format, t: Tournament): string {
  if (f === "single_elimination") return "На вылет";
  if (f === "swiss") {
    const rounds = t.swissRounds ?? 5;
    return `Швейцарская · ${rounds} туров`;
  }
  return "Круговой";
}

function formatColor(f: Format): string {
  if (f === "single_elimination") return T.purple;
  if (f === "swiss") return T.blue;
  return T.yellow;
}

function TournamentCard({ t }: { t: Tournament }) {
  const [hovered, setHovered] = useState(false);
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const tcLabel =
    t.timeControl === "blitz" ? "Блиц" : t.timeControl === "rapid" ? "Рапид" : "Классика";
  const tcColor =
    t.timeControl === "blitz" ? T.orange : t.timeControl === "rapid" ? T.blue : T.purple;
  const statusColor =
    t.status === "live" ? T.red : t.status === "upcoming" ? T.accent : T.faint;
  const statusLabel =
    t.status === "live" ? "LIVE" : t.status === "upcoming" ? "Скоро" : "Завершён";
  const isLive = t.status === "live";

  const full = t.players >= t.maxPlayers;

  useEffect(() => {
    if (!hovered || standings) return;
    let cancelled = false;
    setStandingsLoading(true);
    fetch(`/api-backend/api/cyberchess-tournaments/${t.id}/standings`, { cache: "no-store", signal: AbortSignal.timeout(10_000) })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.ok && Array.isArray(data.standings)) {
          setStandings(data.standings.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStandingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hovered, t.id, standings]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: T.surface,
        border: `1px solid ${isLive ? `${T.red}77` : hovered ? T.accentDim : T.border}`,
        borderRadius: 12,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
        transition: "border-color 160ms",
        animation: isLive ? "cc-hub-live-glow 2.2s ease-in-out infinite" : undefined,
      }}
    >
      {/* minWidth:0 у левого блока и flexShrink:0 у метки — не косметика.
          Без первого блок с названием не может стать уже своего текста, и на
          узком телефоне карточка вылезает за экран, утаскивая за собой всю
          страницу. Замер 28.08.2026 на ширине 320: страница уезжала вбок на
          52 пикселя, виновником сторож назвал метку «Завершён».
          На 375 этого не видно — поломка живёт только на узких экранах. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 17, color: T.text, overflowWrap: "anywhere" }}>{t.title}</h3>
          <div style={{ marginTop: 4, fontSize: 12, color: T.dim }}>{человеческаяДата(t.startsAt)}</div>
        </div>
        <span
          style={{
            color: statusColor,
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {isLive && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: T.red,
                display: "inline-block",
                animation: "cc-hub-pulse-dot 1.2s ease-in-out infinite",
              }}
            />
          )}
          {statusLabel}
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Tag color={formatColor(t.format)}>{formatLabel(t.format, t)}</Tag>
        <Tag color={tcColor}>{tcLabel}</Tag>
        <Tag color={T.dim}>
          ELO {t.eloMin}–{t.eloMax}
        </Tag>
        <Tag color={full ? T.red : T.accent}>
          {t.players}/{t.maxPlayers} игроков
        </Tag>
        {/* Признак — ПРОИСХОЖДЕНИЕ, а не внутренний флаг realPlayers.
            Пометка обязана быть НА образце, а не только на настоящем: рядом с
            честно подписанным соседом непомеченный образец берёт его доверие.
            На проде 12.08 таких было 11 из 13, включая «Winter Arena #12» со
            статусом «завершён» — с результатами, которых не было.

            19.08 на проде нашёлся тринадцатый случай, ломавший прежнюю логику:
            посевной турнир real-swiss-demo помечен realPlayers: true. По
            прежнему условию он получал ярлык «⚡ real players» — то есть
            фикстура рекламировалась как турнир с живыми игроками. Флаг внутри
            фикстуры описывает её содержимое, а не происхождение; спрашивать
            надо у сервера, откуда запись. */}
        {t.origin === 'seed' ? (
          <Tag color={T.dim}>образец</Tag>
        ) : t.realPlayers ? (
          <Tag color={T.yellow}>⚡ real players</Tag>
        ) : null}
      </div>

      {/* Standings preview (hover) */}
      {hovered && (t.format === "swiss" || t.format === "round_robin") && (
        <div
          style={{
            background: T.surfaceAlt,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: 10,
            fontSize: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: T.faint,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            Топ-5 · {t.format === "swiss" ? "коэффициент Бухгольца" : "круговой"}
          </div>
          {standingsLoading && <div style={{ color: T.dim }}>Загрузка...</div>}
          {!standingsLoading && (!standings || standings.length === 0) && (
            <div style={{ color: T.faint }}>Данных пока нет</div>
          )}
          {!standingsLoading && standings && standings.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.id}>
                    <td style={{ color: T.faint, width: 24, padding: "2px 4px" }}>
                      {row.rank}.
                    </td>
                    <td style={{ color: T.text, padding: "2px 4px" }}>{row.name}</td>
                    <td
                      style={{
                        color: T.yellow,
                        fontWeight: 700,
                        textAlign: "right",
                        padding: "2px 4px",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      }}
                    >
                      {row.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 4,
        }}
      >
        <span style={{ fontSize: 14, color: T.yellow, fontWeight: 700 }}>
          💎 {t.prizeChessy.toLocaleString("ru-RU")} Chessy
          {t.origin === "user" && t.prizeChessy > 0 && (
            // Турнир может завести кто угодно, без входа, и приз он объявляет
            // сам — до десяти миллионов. Платит призы только подписанный
            // вебхук, то есть за этим числом никто не стоит. Без оговорки оно
            // выглядит как обязательство площадки, да ещё и рядом с самой
            // сильной подписью «настоящие игроки».
            <span style={{ fontSize: 11.5, fontWeight: 400, color: T.dim, marginLeft: 6 }}>
              объявлен создателем
            </span>
          )}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href={`/cyberchess/tournaments/${t.id}`}
            style={{
              background: T.surfaceAlt,
              color: T.text,
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 12,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Подробнее
          </Link>
          {t.status === "live" ? (
            <Link
              href="/cyberchess/spectator"
              style={{ ...btnPrimary(T.blue), textDecoration: "none", display: "inline-block" }}
            >
              Смотреть
            </Link>
          ) : t.status === "upcoming" ? (
            <button
              disabled={full}
              onClick={async () => {
                try {
                  const r = await fetch(
                    `/api-backend/api/cyberchess-tournaments/${t.id}/register`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      /* Пустое тело заставляло сервер выдать `anon_…`: место
                         занято, а связать его с человеком нечем. Шлём ту же
                         личность, что и детальная страница турнира. */
                      body: JSON.stringify({
                        userId: tournamentUserId(),
                        ...(tournamentDisplayName()
                          ? { displayName: tournamentDisplayName() }
                          : {}),
                      }),
                    },
                  );
                  const data = await r.json();
                  if (data?.ok) {
                    alert(`Вы записаны на «${t.title}». Номер участника: ${data.ticketId}`);
                  } else {
                    // Человеку — человеческое; код ошибки уходит в консоль.
                    // Раньше здесь было «Error: <код>»: слово чужого языка и
                    // строка, которая ничего не говорит тому, кто её прочтёт.
                    console.warn("[tournaments] регистрация отклонена:", data?.error);
                    alert(
                      `Не удалось записаться на «${t.title}». ` +
                        `Попробуйте ещё раз — если не выйдет, напишите нам.`,
                    );
                  }
                } catch {
                  /* Здесь стояло «Registered (offline mock)» — то есть при
                     упавшем запросе человеку СООБЩАЛИ, что он зарегистрирован.
                     Он его не был: на сервер ничего не дошло, места в турнире
                     за ним нет, и узнал бы он об этом, только не найдя себя в
                     списке участников. Молчание было бы лучше этого, а правда
                     лучше молчания. */
                  alert(
                    `Не удалось зарегистрироваться на «${t.title}»: нет связи с сервером. ` +
                      `Вы НЕ записаны — попробуйте ещё раз.`,
                  );
                }
              }}
              style={btnPrimary(full ? T.faint : T.accent)}
            >
              {full ? "Заполнен" : "Register"}
            </button>
          ) : (
            <button disabled style={btnPrimary(T.faint)}>
              Завершён
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function btnPrimary(color: string): React.CSSProperties {
  return {
    background: color,
    color: "#022c22",
    border: "none",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}

// ── Create-tournament modal ────────────────────────────────────────
// POSTs to /api-backend/api/cyberchess-tournaments/ and, on success, closes
// and refreshes the list. Any player can spin up a joinable event.
function CreateTournamentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<Format>("single_elimination");
  const [timeControl, setTimeControl] = useState<TimeControl>("blitz");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [eloMin, setEloMin] = useState(0);
  const [eloMax, setEloMax] = useState(3000);
  const [prizeChessy, setPrizeChessy] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "9px 11px",
    color: T.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: T.faint,
    marginBottom: 5,
  };

  const submit = async () => {
    if (title.trim().length < 3) {
      setErr("Название минимум 3 символа");
      return;
    }
    setBusy(true);
    setErr(null);
    /* Тот же источник личности, что и у кнопки «Register» на этой странице.
       Раньше здесь ключ читался напрямую и НЕ совпадал с тем, под которым идёт
       регистрация. Бэкенд по userId создателя
       записывает его ПЕРВЫМ УЧАСТНИКОМ, поэтому один человек занимал в своём же
       турнире два места под двумя id, и свести их было нечем. А если ключ
       задачи дня пуст (в турнирном потоке его никто не пишет), создатель не
       попадал в участники вовсе. Прав creatorId не даёт — проверено, он нужен
       ровно для этой автозаписи. */
    const userId = tournamentUserId();
    const displayName = tournamentDisplayName();
    try {
      // No trailing slash — hit the route directly and avoid a 308 POST redirect.
      const r = await fetch("/api-backend/api/cyberchess-tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          format,
          timeControl,
          maxPlayers,
          eloMin,
          eloMax,
          prizeChessy,
          startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
          description: description.trim() || undefined,
          userId: userId || undefined,
          displayName: displayName || undefined,
        }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        throw new Error(data?.hint || data?.error || `HTTP ${r.status}`);
      }
      onCreated();
    } catch (e) {
      setErr((e as Error).message || "Не удалось создать турнир");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(3,6,15,0.78)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 22, color: T.text }}>＋ Новый турнир</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: T.faint, fontSize: 20, cursor: "pointer" }}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <p style={{ color: T.dim, fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          Твой турнир появится в списке и будет открыт для регистрации других игроков.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="t-name" style={labelStyle}>Название</label>
          <input id="t-name"
            style={inputStyle}
            value={title}
            maxLength={80}
            placeholder="Напр. Пятничный блиц"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label htmlFor="t-format" style={labelStyle}>Формат</label>
            <select id="t-format" style={inputStyle} value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              <option value="single_elimination">На вылет</option>
              <option value="swiss">Швейцарка</option>
              <option value="round_robin">Круговой</option>
            </select>
          </div>
          <div>
            <label htmlFor="t-tc" style={labelStyle}>Контроль времени</label>
            <select id="t-tc"
              style={inputStyle}
              value={timeControl}
              onChange={(e) => setTimeControl(e.target.value as TimeControl)}
            >
              <option value="blitz">Блиц</option>
              <option value="rapid">Рапид</option>
              <option value="classic">Классика</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label htmlFor="t-players" style={labelStyle}>Игроков</label>
            <input id="t-players"
              type="number"
              style={inputStyle}
              value={maxPlayers}
              min={2}
              max={128}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="t-elo-min" style={labelStyle}>ELO мин</label>
            <input id="t-elo-min"
              type="number"
              style={inputStyle}
              value={eloMin}
              min={0}
              max={3000}
              onChange={(e) => setEloMin(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="t-elo-max" style={labelStyle}>ELO макс</label>
            <input id="t-elo-max"
              type="number"
              style={inputStyle}
              value={eloMax}
              min={0}
              max={3000}
              onChange={(e) => setEloMax(Number(e.target.value))}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label htmlFor="t-prize" style={labelStyle}>Приз (Chessy)</label>
            <input id="t-prize"
              type="number"
              style={inputStyle}
              value={prizeChessy}
              min={0}
              onChange={(e) => setPrizeChessy(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="t-start" style={labelStyle}>Старт (необязательно)</label>
            <input id="t-start"
              type="datetime-local"
              style={inputStyle}
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label htmlFor="t-desc" style={labelStyle}>Описание (необязательно)</label>
          <textarea id="t-desc"
            style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
            value={description}
            maxLength={300}
            placeholder="Пара слов о турнире"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {err && (
          <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>⚠ {err}</div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: "transparent",
              color: T.dim,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={busy}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              border: "none",
              background: busy ? T.faint : `linear-gradient(135deg, ${T.accent}, ${T.blue})`,
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Создаём…" : "Создать турнир"}
          </button>
        </div>
      </div>
    </div>
  );
}
