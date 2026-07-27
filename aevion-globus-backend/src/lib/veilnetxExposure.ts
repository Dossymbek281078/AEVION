/**
 * Оценка раскрытости запроса для VeilNetX.
 *
 * Вынесено из обработчика маршрута, чтобы шкалу можно было проверить тестом:
 * до этого она жила внутри `veilnetx.ts` и единственным способом её измерить
 * был живой HTTP-запрос. Из-за этого месяцами не замечали, что лучшая оценка
 * недостижима (issue #785).
 *
 * ЧТО ИМЕННО СЧИТАЕТСЯ. Раньше в сумму шли все находки подряд, включая те, на
 * которые пользователь повлиять не может:
 *
 *   - `user-agent` — его шлёт любой браузер, отсутствие невозможно;
 *   - `language` — то же самое, `Accept-Language` шлётся всегда;
 *   - `dnt` — штраф начислялся за ВЫКЛЮЧЕННЫЙ Do-Not-Track, то есть за
 *     состояние по умолчанию, которого человек не выбирал.
 *
 * В сумме это 32 балла у любого браузера при пороге «зелёного» в 30 и оценке A
 * при ≤ 12. Человек за Tor с прокси, сделавший всё возможное, всё равно видел
 * жёлтый и оценку B. Категория, которую никто не может получить, создаёт
 * впечатление, что инструмент различает состояния, хотя он их не различает.
 *
 * Теперь в счёт идёт только то, что пользователь может изменить: наличие
 * прокси, утечка гео, Client Hints, Referer, cookie. Неизбежное остаётся в
 * отчёте с `counted: false` — оно видно и объяснено, но не портит оценку.
 * Это не смягчение шкалы: обычный браузер без прокси по-прежнему получает F.
 */

export type ExposureCategory = "network" | "identity" | "fingerprint";
export type ExposureSeverity = "low" | "med" | "high";

export interface ExposureFinding {
  id: string;
  label: string;
  severity: ExposureSeverity;
  /** Раскрыто ли — то, что человек видит в отчёте. */
  exposed: boolean;
  /**
   * Идёт ли в оценку. false у неизбежного для браузера: показываем и объясняем,
   * но не наказываем за то, что нельзя изменить.
   */
  counted: boolean;
  category: ExposureCategory;
  advice: string;
}

export interface ExposureInput {
  proxyDetected: boolean;
  geoLeaked: boolean;
  geoLabel: string;
  uaRaw: string | null;
  uaBrowser: string;
  uaOs: string;
  clientHintsLeaked: boolean;
  clientHintsLabel: string;
  primaryLanguage: string | null;
  refererPresent: boolean;
  cookiePresent: boolean;
  dnt: boolean;
}

export interface ExposureResult {
  findings: ExposureFinding[];
  exposureScore: number;
  level: "green" | "yellow" | "red";
  grade: string;
  byCategory: Record<ExposureCategory, { exposed: number; total: number }>;
  /** Максимум, который вообще можно набрать — чтобы шкала была проверяема. */
  maxScore: number;
}

const WEIGHT: Record<ExposureSeverity, number> = { low: 8, med: 16, high: 26 };

export function gradeFor(score: number): string {
  // score = раскрытость, 0 = лучший случай (невидим), 100 = худший.
  if (score <= 12) return "A";
  if (score <= 28) return "B";
  if (score <= 45) return "C";
  if (score <= 65) return "D";
  return "F";
}

export function buildFindings(i: ExposureInput): ExposureFinding[] {
  return [
    {
      id: "real-ip",
      label: i.proxyDetected
        ? "Запрос идёт через прокси — реальный IP скрыт от конечного сервера"
        : "Реальный IP виден серверу напрямую (нет прокси/Tor)",
      severity: "high",
      exposed: !i.proxyDetected,
      counted: true,
      category: "network",
      advice:
        "Используй Tor Browser или доверенный VPN — реальный IP выдаёт провайдера и приблизительное местоположение.",
    },
    {
      id: "geo",
      label: i.geoLeaked ? `Гео определяется по IP: ${i.geoLabel || "да"}` : "Гео по IP не раскрыто на этом хопе",
      severity: "high",
      exposed: i.geoLeaked,
      counted: true,
      category: "network",
      advice: "Скрытие IP (Tor/VPN) автоматически скрывает и гео — оно вычисляется из IP.",
    },
    {
      // Неизбежно: заголовок шлёт любой браузер, «не раскрыть» его нельзя.
      // Опасна не сама строка, а её уникальность — а за уникальность отвечает
      // соседняя находка client-hints, которую отключить как раз можно.
      id: "user-agent",
      label: i.uaRaw ? `User-Agent раскрывает браузер/ОС: ${i.uaBrowser} / ${i.uaOs}` : "User-Agent не передан",
      severity: "med",
      exposed: Boolean(i.uaRaw),
      counted: false,
      category: "fingerprint",
      advice: "Tor Browser унифицирует User-Agent у всех пользователей — так ты сливаешься с толпой.",
    },
    {
      id: "client-hints",
      label: i.clientHintsLeaked
        ? `Client Hints раскрывают точную версию/платформу: ${i.clientHintsLabel || "да"}`
        : "Client Hints (Sec-CH-UA) не переданы",
      severity: "med",
      exposed: i.clientHintsLeaked,
      counted: true,
      category: "fingerprint",
      advice:
        "Sec-CH-UA-* пинят мажорную версию браузера, платформу и (high-entropy hints) архитектуру CPU. Tor Browser их не шлёт.",
    },
    {
      // Тоже неизбежно: Accept-Language шлётся всегда. Сузить круг можно только
      // сменив локаль на массовую, а не убрав заголовок.
      id: "language",
      label: i.primaryLanguage
        ? `Accept-Language раскрывает локаль: ${i.primaryLanguage}`
        : "Accept-Language не передан",
      severity: "low",
      exposed: Boolean(i.primaryLanguage),
      counted: false,
      category: "identity",
      advice: "Локаль сужает круг: en-US ≠ kk-KZ. Tor Browser шлёт всем одинаковый en-US.",
    },
    {
      id: "referer",
      label: i.refererPresent
        ? "Referer раскрывает, с какой страницы ты пришёл (кросс-сайтовая связка)"
        : "Referer не передан",
      severity: "med",
      exposed: i.refererPresent,
      counted: true,
      category: "identity",
      advice: "Настрой Referrer-Policy: strict-origin-when-cross-origin или no-referrer в браузере/расширении.",
    },
    {
      id: "cookie",
      label: i.cookiePresent
        ? "В запросе есть cookie — потенциальная кросс-сессионная привязка"
        : "Cookie в запросе нет",
      severity: "low",
      exposed: i.cookiePresent,
      counted: true,
      category: "identity",
      advice: "Чисти cookie между сессиями или используй контейнеры/приватный режим для изоляции.",
    },
    {
      // Do-Not-Track выключен по умолчанию во всех браузерах, а из части
      // интерфейсов его вообще убрали. Штраф за это наказывал за настройку,
      // которой человек не касался. Находка остаётся информационной.
      id: "dnt",
      label: i.dnt
        ? "Do-Not-Track включён"
        : "Do-Not-Track не установлен (большинство сайтов его игнорируют, но это маркер)",
      severity: "low",
      exposed: !i.dnt,
      counted: false,
      category: "identity",
      advice: "Включи Do-Not-Track как маркер намерения (защита слабая — не полагайся только на него).",
    },
  ];
}

export function scoreExposure(input: ExposureInput): ExposureResult {
  const findings = buildFindings(input);

  const exposureScore = Math.min(
    100,
    findings.reduce((sum, f) => (f.exposed && f.counted ? sum + WEIGHT[f.severity] : sum), 0),
  );
  const maxScore = Math.min(
    100,
    findings.reduce((sum, f) => (f.counted ? sum + WEIGHT[f.severity] : sum), 0),
  );

  const level: ExposureResult["level"] =
    exposureScore >= 60 ? "red" : exposureScore >= 30 ? "yellow" : "green";

  const byCategory: Record<ExposureCategory, { exposed: number; total: number }> = {
    network: { exposed: 0, total: 0 },
    identity: { exposed: 0, total: 0 },
    fingerprint: { exposed: 0, total: 0 },
  };
  for (const f of findings) {
    byCategory[f.category].total += 1;
    if (f.exposed) byCategory[f.category].exposed += 1;
  }

  return { findings, exposureScore, level, grade: gradeFor(exposureScore), byCategory, maxScore };
}
