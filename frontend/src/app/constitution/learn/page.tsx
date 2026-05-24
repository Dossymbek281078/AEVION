"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  classify,
  DEFAULT_SLIDERS,
  SLIDER_META,
  type Sliders,
  type SliderMeta,
} from "@/lib/constitution";
import { useI18n } from "@/lib/i18n";

type LessonId =
  | "floor"
  | "ruleOfLaw"
  | "rotation"
  | "transparency"
  | "multiStatus"
  | "skinInGame"
  | "polycentricity"
  | "positiveSum";

type Task = {
  /** Sliders pre-filled (one to be tuned by the student) */
  fixed: Partial<Sliders>;
  /** Slider key the student must move */
  target: LessonId;
  /** Regime ID the student must reach */
  expectedRegimeId: string;
  /** Tolerance: target slider must be ≥ this value (or ≤) */
  expectedAboveOrBelow: "above" | "below";
  expectedThreshold: number;
  hint: string;
};

type Lesson = {
  id: LessonId;
  number: number;
  title: string;
  pillar: "Pillar 1: Floor below" | "Pillar 2: Law above" | "Pillar 3: Rotation & status" | "Pillar 4: Growing pie";
  theory: string;
  example: string;
  task: Task;
};

const LESSONS: Lesson[] = [
  {
    id: "floor",
    number: 1,
    title: "Пол снизу",
    pillar: "Pillar 1: Floor below",
    theory:
      "Главное открытие XX века: элита перестаёт бояться низа не когда низ обезоружен, а когда низ имеет, что терять. Пол снизу — это гарантированный минимум: образование, базовое здравоохранение, пенсии, иногда UBI. Когда люди не прижаты к стене, у них нет экзистенциальной мотивации отнимать. Это самое дорогое и самое стабилизирующее изменение, которое можно сделать с обществом — но оно требует, чтобы пирог уже рос.",
    example:
      "1945–1980, Западная Европа. Бесплатные университеты в Германии и Франции, всеобщее здравоохранение в Британии (NHS 1948), социальное жилье в Швеции. Floor вырос с 20 до 70 за поколение — и капитализм впервые получил массовую легитимность.",
    task: {
      fixed: { ruleOfLaw: 85, rotation: 60, transparency: 80, multiStatus: 55, skinInGame: 55, polycentricity: 30, positiveSum: 65 },
      target: "floor",
      expectedRegimeId: "nordic",
      expectedAboveOrBelow: "above",
      expectedThreshold: 70,
      hint: "Подними пол снизу ≥70 — получишь Скандинавскую модель.",
    },
  },
  {
    id: "ruleOfLaw",
    number: 2,
    title: "Закон обязателен и для верха",
    pillar: "Pillar 2: Law above",
    theory:
      "Магна Карта 1215 — первый зафиксированный случай, когда король обязался жить по писаным правилам. Сегодня это очевидно, но 800 лет назад — революционно. Чем выше ruleOfLaw, тем меньше элиты грызутся между собой: проигравший знает, что проиграл по правилам, а не из-за того, что его кинули. Это снижает интенсивность интриг и переводит конкуренцию в продуктивное русло.",
    example:
      "Сингапур и UK XIX века — два разных пути к высокому ruleOfLaw. UK: эволюционно через парламент. Сингапур: жёсткий top-down под Ли Куан Ю. Оба варианта снижают коррупцию, но второй не оставляет ротации, что даёт хрупкость в кризис преемственности.",
    task: {
      fixed: { floor: 50, rotation: 10, transparency: 40, multiStatus: 30, skinInGame: 30, polycentricity: 20, positiveSum: 60 },
      target: "ruleOfLaw",
      expectedRegimeId: "feudalism",
      expectedAboveOrBelow: "below",
      expectedThreshold: 35,
      hint: "Опусти закон ≤35 — получишь Поздний феодализм (закон уважает форму, но не суть).",
    },
  },
  {
    id: "rotation",
    number: 3,
    title: "Ротация и жребий",
    pillar: "Pillar 3: Rotation & status",
    theory:
      "Афины V в. до н.э.: половина государственных должностей замещалась жребием. Это не было «случайно» — это было защитой от формирования постоянных коалиций. Когда верх ротируется, у нижних есть шанс наверх, и у верха меньше страха быть постоянной мишенью. Современная sortition (швейцарские референдумы, ирландский Citizens' Assembly) возвращает афинский принцип в XXI век.",
    example:
      "Ирландия 2016: 99 случайных граждан полтора года совещались об абортах. Их рекомендация легла в основу референдума 2018 — abortion-rights прошли с 66%. Жребий смог решить вопрос, который парламент 30 лет не мог сдвинуть.",
    task: {
      fixed: { floor: 35, ruleOfLaw: 55, transparency: 50, multiStatus: 55, skinInGame: 40, polycentricity: 70, positiveSum: 65 },
      target: "rotation",
      expectedRegimeId: "ancient-polis",
      expectedAboveOrBelow: "above",
      expectedThreshold: 65,
      hint: "Подними ротацию ≥65 — получишь Античный полис (но осторожно: высокая rotation + низкий multi-status = exclusion).",
    },
  },
  {
    id: "transparency",
    number: 4,
    title: "Прозрачность элит",
    pillar: "Pillar 2: Law above",
    theory:
      "Самое дешёвое улучшение конституции — публичные декларации доходов чиновников, открытые бюджеты, доступ к данным о решениях. Прозрачность не убивает власть, она убивает паранойю снизу. Скандинавская «принцип публичности» (Швеция, 1766 — самый старый Freedom of Information Act в мире) сделала возможным высокий floor: налогоплательщик видит, куда уходят деньги.",
    example:
      "Эстония — каждый гражданин может посмотреть, кто и когда обращался к его персональным данным в государственных системах. Эта обратная прозрачность («следишь за мной → я слежу за тобой») построила доверие к e-government быстрее, чем где-либо в Европе.",
    task: {
      fixed: { floor: 25, ruleOfLaw: 25, rotation: 10, multiStatus: 25, skinInGame: 25, polycentricity: 15, positiveSum: 50 },
      target: "transparency",
      expectedRegimeId: "authoritarian",
      expectedAboveOrBelow: "below",
      expectedThreshold: 25,
      hint: "Опусти прозрачность ≤25 — получишь Авторитарную вертикаль (тёмные комнаты + тревожный верх).",
    },
  },
  {
    id: "multiStatus",
    number: 5,
    title: "Множественные оси статуса",
    pillar: "Pillar 3: Rotation & status",
    theory:
      "Когда уважения можно достичь только через одну ось (например, деньги), всё общество выстраивается в линию и грызётся за неё. Когда легитимных осей много — наука, ремесло, забота, искусство, спорт — амбиции рассредотачиваются, конкуренция становится менее токсичной. Это самое хрупкое изменение, потому что его нельзя ввести законом — оно растёт из культуры.",
    example:
      "Япония: уважение к ремесленнику (shokunin) сохранилось рядом с уважением к корпоративному менеджеру. Школьный учитель в Финляндии престижнее, чем юрист. В обоих случаях это не natural — это столетия культурной работы.",
    task: {
      fixed: { floor: 75, ruleOfLaw: 85, rotation: 70, transparency: 80, skinInGame: 70, polycentricity: 65, positiveSum: 80 },
      target: "multiStatus",
      expectedRegimeId: "open-access",
      expectedAboveOrBelow: "above",
      expectedThreshold: 70,
      hint: "Подними multi-status ≥70 — соберёшь все 4 опоры → Open Access Order.",
    },
  },
  {
    id: "skinInGame",
    number: 6,
    title: "Skin in the game",
    pillar: "Pillar 4: Growing pie",
    theory:
      "Талеб: «Кто принимает решение, должен нести его последствия лично». Когда банкир рискует только зарплатой, а вкладчики — деньгами, банкир будет принимать асимметричные риски. Кочевая степь — пример общества с экстремальным skin-in-game: вождь, который проиграет битву, ведя её сам, лишится головы или племени. Низкий skin-in-game → перекладывание рисков → системный кризис.",
    example:
      "Финансовый кризис 2008 — Lehman Brothers traders получили бонусы за 2005-2007, потом фирма рухнула, а их зарплаты остались. С 2010 в ЕС введены clawback-правила: бонусы можно отозвать через 5–7 лет если оказывается, что сделки были деструктивны.",
    task: {
      fixed: { floor: 40, ruleOfLaw: 45, rotation: 60, transparency: 70, multiStatus: 65, polycentricity: 85, positiveSum: 35 },
      target: "skinInGame",
      expectedRegimeId: "mixed",
      expectedAboveOrBelow: "above",
      expectedThreshold: 85,
      hint: "Подними skin ≥85 — получишь «Кочевую степь» (но это попадёт в mixed-классификатор без правильных весов остальных ползунков).",
    },
  },
  {
    id: "polycentricity",
    number: 7,
    title: "Полицентричность",
    pillar: "Pillar 3: Rotation & status",
    theory:
      "Элинор Остром (Нобель по экономике 2009) показала: общие ресурсы лучше всего управляются не централизованным государством и не приватизацией, а полицентричными сообществами с реальной автономией. Швейцарские кантоны, индийские деревенские водоохраны, североамериканские прибрежные рыболовные кооперативы — все работают через локальные правила + право на exit.",
    example:
      "Швейцария: 26 кантонов, каждый со своим налоговым режимом и системой образования. Цуг (низкий налог, корпорации) vs Базель (высокий налог, фарма-кластер) — конкурируют за резидентов. Кто не согласен — переезжает за 2 часа на поезде. Это и есть полицентричность в действии.",
    task: {
      fixed: { floor: 35, ruleOfLaw: 75, rotation: 35, transparency: 65, multiStatus: 75, skinInGame: 65, positiveSum: 80 },
      target: "polycentricity",
      expectedRegimeId: "network-post-nation",
      expectedAboveOrBelow: "above",
      expectedThreshold: 75,
      hint: "Подними полицентричность ≥75 — получишь Сетевую постнацию (конкурирующие юрисдикции).",
    },
  },
  {
    id: "positiveSum",
    number: 8,
    title: "Положительная сумма",
    pillar: "Pillar 4: Growing pie",
    theory:
      "Без растущего пирога все остальные ползунки скатываются обратно. Феодализм держался 800 лет именно потому, что positiveSum был близок к нулю — экономика не росла, а если кто-то получал больше, кто-то получал меньше. Промышленная революция (1750–1850) дала первый длинный рост positiveSum, и это сделало возможным всё последующее: избирательное право, социальное государство, открытый порядок. Любая конституционная реформа либо опирается на рост, либо обречена.",
    example:
      "Венесуэла 2000-х: высокие нефтяные цены → щедрые социальные программы (вырос floor с 30 до 60). После обвала цен (2014–) positiveSum рухнул, floor не удержался, страна провалилась в hyperinflation. Без растущей экономики высокий пол снизу — иллюзия.",
    task: {
      fixed: { floor: 30, ruleOfLaw: 30, rotation: 10, transparency: 20, multiStatus: 25, skinInGame: 30, polycentricity: 15 },
      target: "positiveSum",
      expectedRegimeId: "extractive-boom",
      expectedAboveOrBelow: "above",
      expectedThreshold: 65,
      hint: "Подними positive sum ≥65 при низких остальных — получишь Экстрактивный бум (рост достаётся узкой группе).",
    },
  },
];

const PROGRESS_KEY = "constitution.academy.progress";

function loadProgress(): Set<LessonId> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as LessonId[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveProgress(set: Set<LessonId>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

export default function ConstitutionLearnPage() {
  const { t } = useI18n();
  const [progress, setProgress] = useState<Set<LessonId>>(new Set());
  const [openLesson, setOpenLesson] = useState<LessonId | null>(null);
  const [certBusy, setCertBusy] = useState<boolean>(false);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const complete = useCallback((id: LessonId) => {
    setProgress((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveProgress(next);
      return next;
    });
  }, []);

  const reset = () => {
    saveProgress(new Set());
    setProgress(new Set());
  };

  const allDone = progress.size === LESSONS.length;

  const downloadCert = async () => {
    setCertBusy(true);
    try {
      const r = await fetch("/api-backend/api/constitution/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "🎓 AEVION Constitution Academy — Completed",
          sliders: {
            floor: 75, ruleOfLaw: 85, rotation: 70, transparency: 80,
            multiStatus: 75, skinInGame: 70, polycentricity: 65, positiveSum: 80,
          },
          regime: { id: "open-access", name: "Open Access Order", era: "Academy graduation" },
        }),
      });
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aevion-constitution-academy-cert-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setCertBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <Link href="/constitution" className="text-[#d4af37] hover:underline text-sm">
            ← Constitution
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 text-[#d4af37]">
            {t("constitution.learn.title")}
          </h1>
          <p className="text-[#9aa3c0] mt-2 max-w-3xl">
            {t("constitution.learn.subtitle")}
          </p>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 max-w-md">
              <div className="text-xs text-[#9aa3c0] mb-1">
                {t("constitution.learn.progress")}: {progress.size} / {LESSONS.length}
              </div>
              <div className="h-2 bg-[#050a1a] rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#d4af37] to-emerald-400 transition-all"
                  style={{ width: `${(progress.size / LESSONS.length) * 100}%` }}
                />
              </div>
            </div>
            {allDone && (
              <button
                type="button"
                onClick={downloadCert}
                disabled={certBusy}
                className="px-4 py-2 rounded bg-gradient-to-r from-[#d4af37] to-emerald-400 text-[#0b1736] font-bold hover:opacity-90 disabled:opacity-40"
              >
                🎓 {certBusy ? "..." : t("constitution.learn.cert")}
              </button>
            )}
            {progress.size > 0 && (
              <button
                type="button"
                onClick={reset}
                className="text-xs text-[#9aa3c0] hover:text-rose-300"
              >
                {t("constitution.learn.reset")}
              </button>
            )}
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LESSONS.map((lesson) => {
            const done = progress.has(lesson.id);
            return (
              <button
                key={lesson.id}
                type="button"
                onClick={() => setOpenLesson(lesson.id)}
                className={`text-left bg-[#0b1736]/60 border rounded-xl p-4 transition hover:bg-[#0b1736]/80 ${
                  done
                    ? "border-emerald-400/40"
                    : "border-[#d4af37]/20 hover:border-[#d4af37]/40"
                }`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-xs text-[#9aa3c0]">
                    {t("constitution.learn.lesson")} {lesson.number} · {lesson.pillar}
                  </div>
                  {done && <span className="text-emerald-400 text-sm">✓ Done</span>}
                </div>
                <div className="text-xl font-bold text-[#d4af37]">
                  {t(`constitution.lesson.${lesson.id}.title`)}
                </div>
                <div className="text-sm text-[#9aa3c0] mt-1 line-clamp-2">
                  {t(`constitution.lesson.${lesson.id}.theory`).slice(0, 120)}…
                </div>
              </button>
            );
          })}
        </section>

        {openLesson && (
          <LessonModal
            lesson={LESSONS.find((l) => l.id === openLesson)!}
            done={progress.has(openLesson)}
            onClose={() => setOpenLesson(null)}
            onComplete={() => complete(openLesson)}
          />
        )}
      </div>
    </div>
  );
}

function LessonModal({
  lesson,
  done,
  onClose,
  onComplete,
}: {
  lesson: Lesson;
  done: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { t } = useI18n();
  // Pre-fill task sliders
  const [sliders, setSliders] = useState<Sliders>(() => ({
    ...DEFAULT_SLIDERS,
    ...lesson.task.fixed,
    [lesson.task.target]: 50, // student adjusts this one
  }));
  const [checkResult, setCheckResult] = useState<{ ok: boolean; message: string } | null>(null);

  const meta = SLIDER_META.find((m) => m.key === lesson.task.target) as SliderMeta;
  const regime = useMemo(() => classify(sliders), [sliders]);

  const check = () => {
    const value = sliders[lesson.task.target];
    const meetsThreshold = lesson.task.expectedAboveOrBelow === "above"
      ? value >= lesson.task.expectedThreshold
      : value <= lesson.task.expectedThreshold;
    const regimeMatches = regime.id === lesson.task.expectedRegimeId;
    if (meetsThreshold && regimeMatches) {
      setCheckResult({
        ok: true,
        message: `✓ Идеально. Режим: ${regime.name}. ${lesson.task.target} = ${value}.`,
      });
      onComplete();
    } else if (regimeMatches) {
      setCheckResult({
        ok: false,
        message: `Режим совпал (${regime.name}), но ${lesson.task.target}=${value} — на грани. Подвинь ${lesson.task.expectedAboveOrBelow === "above" ? "повыше" : "пониже"} ${lesson.task.expectedThreshold}.`,
      });
    } else {
      setCheckResult({
        ok: false,
        message: `Пока ${regime.name}, ожидаем другой режим. ${lesson.task.hint}`,
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="bg-[#0b1736] border border-[#d4af37]/40 rounded-xl p-5 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-baseline mb-3">
          <div>
            <div className="text-xs text-[#9aa3c0]">
              {t("constitution.learn.lesson")} {lesson.number} · {lesson.pillar}
            </div>
            <h3 className="text-2xl font-bold text-[#d4af37]">
              {t(`constitution.lesson.${lesson.id}.title`)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9aa3c0] hover:text-white text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <section className="mb-5">
          <h4 className="text-sm font-semibold text-[#f5d27a] mb-1">
            {t("constitution.learn.theory_heading")}
          </h4>
          <p className="text-sm text-[#e7ecf8] leading-relaxed">
            {t(`constitution.lesson.${lesson.id}.theory`)}
          </p>
        </section>

        <section className="mb-5 border-l-2 border-[#d4af37]/30 pl-3">
          <h4 className="text-xs uppercase tracking-wider text-[#9aa3c0] mb-1">
            {t("constitution.learn.example_heading")}
          </h4>
          <p className="text-sm text-[#e7ecf8] italic">
            {t(`constitution.lesson.${lesson.id}.example`)}
          </p>
        </section>

        <section className="mb-5 bg-[#050a1a]/40 border border-[#d4af37]/20 rounded p-4">
          <h4 className="text-sm font-semibold text-[#f5d27a] mb-2">
            {t("constitution.learn.task_heading")}
          </h4>
          <p className="text-sm text-[#9aa3c0] mb-3">
            {t(`constitution.lesson.${lesson.id}.hint`)}
          </p>
          <div className="mb-3">
            <div className="flex justify-between items-baseline mb-1">
              <label className="font-medium">{meta.label}</label>
              <span className="text-[#d4af37] font-mono">{sliders[lesson.task.target]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={sliders[lesson.task.target]}
              onChange={(e) =>
                setSliders((s) => ({ ...s, [lesson.task.target]: Number(e.target.value) }))
              }
              className="w-full accent-[#d4af37]"
            />
            <div className="flex justify-between text-xs text-[#9aa3c0] mt-1">
              <span>{meta.low}</span>
              <span>{meta.high}</span>
            </div>
          </div>
          <div className="text-xs text-[#9aa3c0] mb-3">
            Текущий режим: <span className="text-[#f5d27a] font-semibold">{regime.name}</span>
            {" "}(id: <code>{regime.id}</code>)
          </div>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={check}
              className="px-4 py-2 rounded bg-[#d4af37] text-[#0b1736] font-semibold text-sm hover:opacity-90"
            >
              {t("constitution.learn.check")}
            </button>
            {done && (
              <span className="text-xs text-emerald-400">{t("constitution.learn.passed")}</span>
            )}
          </div>
          {checkResult && (
            <div
              className={`mt-3 text-sm border rounded px-3 py-2 ${
                checkResult.ok
                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/5 text-amber-300"
              }`}
            >
              {checkResult.message}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
