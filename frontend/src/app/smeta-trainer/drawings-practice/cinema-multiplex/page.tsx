"use client";
import Link from "next/link";
import { useState } from "react";

export default function CinemaMultiplexPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 12) <= 1;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 6_800_000_000) <= 680_000_000;

  const correct = {
    ex1: ex1 === "d",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "c",
  };
  const score = Object.values(correct).filter(Boolean).length;

  const optClass = (state: string, value: string, ok: boolean) => {
    if (!showResults || state !== value) return state === value ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500";
    return ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Мультиплексы и кинотеатры</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🎬 Мультиплексы и кинотеатры (THX/Dolby Atmos)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #259. Мультиплексы РК: Chaplin Cinemas Алматы (14 залов, 2500 мест,
            Mega Almaty), Kino-Park Астана (12 залов, IMAX 3D 525 мест), Cinemax
            Шымкент (8 залов), Lotte Cinemas Алматы (10 залов). Стандарты: проекторы
            Christie 4K RGB Laser CP4440-RGB или Barco SP4K-RGB, акустика Dolby Atmos
            64-канальная объёмная, IMAX 3D с 9-метровыми проекторами IMAX Laser. THX
            (Tomlinson Holman eXperiment) сертификация залов. СН РК 3.02-08 «Зрелищные
            здания», SMPTE 196M (Cinema Sound), DCI Digital Cinema Specification.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав мультиплекса</h2>
          <p className="text-slate-300 leading-relaxed">
            DCI Digital Cinema Specification + SMPTE 196M:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Залы зрительские:</strong> 8-14 залов на мультиплекс, площади 80-300 м², ВРС 7-12 м, амфитеатр с уклоном 30-35° для оптимальной видимости.</li>
            <li><strong>Типы залов:</strong> стандартный (200-400 мест, цифровой 4K Christie), IMAX 3D (300-525 мест, 9-метровый экран Laser), VIP (Premium ECHO 30-50 мест с lounge-креслами).</li>
            <li><strong>Экраны:</strong> Harkness Spectral 240 или Strong White CW (для 3D с поляризацией), размер по DCI 1.85:1 (Flat) или 2.39:1 (Scope), ширина 8-20 м.</li>
            <li><strong>Проекторы:</strong> Christie CP4440-RGB Laser или Barco SP4K-15 (15 000 lm, 4K DCI 4096×2160, HDR + HFR 120 fps).</li>
            <li><strong>Аудио Dolby Atmos:</strong> 64 канала с потолочными динамиками + сабвуферы LFE (Low Frequency Effects) — 5.1.4 или 9.1.6 конфигурация.</li>
            <li><strong>Акустика залов:</strong> RT60=0.4-0.5 сек (короткий чтобы не маскировать реплики), поглощение стен Acoustix Sopra или mineral wool + Tectum панели.</li>
            <li><strong>Аппаратные:</strong> за каждым залом (8-12 м² helper room) с проектором + RAID-хранилищем (DCP файлы 200-300 ГБ на фильм).</li>
            <li><strong>Центральный TMS (Theatre Management System):</strong> Doremi/GDC Server, дистрибуция фильмов KDM-ключи, расписание шоу.</li>
            <li><strong>Фойе + лобби + кассы + терминалы:</strong> 30-40% от общей площади.</li>
            <li><strong>Бар и снэк (концессии):</strong> попкорн-машины, кулинарная фастфуд линия, бар безалкогольный.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Проектор и экран IMAX</h2>
          <p className="text-slate-300">
            IMAX-зал 525 мест с экраном 25×17 м (площадь 425 м²) высотой 17 м.
            Что обязательно по IMAX Inc. Specifications + DCI?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Стандартный проектор Christie 4K — для IMAX любой подойдёт" },
              { v: "b", t: "2 проектора Christie 4K стандартных в параллели" },
              { v: "c", t: "Барко с увеличенной светосилой и стандартный экран" },
              { v: "d", t: "IMAX Laser Projection System (одобренная только IMAX Inc.): 1) Двойной (dual) проектор IMAX Laser 4K (Christie + IMAX joint venture) на каждом сеансе работают одновременно 2 проектора с компенсацией для повышения яркости — 14 fL (фут-Ламберт) на экране 25 м (vs 4-5 fL у обычного цифрового кино); 2) Эксклюзивные источники света — RGB лазеры NEC NC2402ML 60 000 лм каждый (×2 = 120 000 лм суммарно), охлаждение жидкостное; 3) Объективы IMAX Anamorphic для соотношения 1.43:1 (true IMAX) или 1.90:1 (digital IMAX); 4) Экран Harkness Curved 25×17 м с серебряным покрытием для 3D-поляризации (специальная фирма IMAX Screen Surfaces), кривизна 30° от центра для устранения краевого искажения; 5) IMAX 3D с поляризационной системой (linear или circular polarization), очки выдаются перед сеансом + стерилизация UV; 6) Sound IMAX 12-канальный (5.1 + 4 потолочных + 2 фронтальных + sub-bass) с динамиками JBL ScreenArray Crown amplifiers; 7) Аппаратная behind-the-screen с двумя проекторами + резервным сервером; 8) Аудит и сертификация IMAX Inc. ежегодно — измерения яркости, фокус, цветности, звука; 9) Геометрия зала с точным расчётом seating area — все места в «sweet spot» зоны с углом до экрана 30-60°; 10) Эксклюзивный контракт с IMAX Inc. на специфическое программное обеспечение, фильмы должны быть IMAX-formatted (масштабированы для большего экрана); IMAX Inc. Specs + DCI Digital Cinema + SMPTE 196M" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во залов</h2>
          <p className="text-slate-300">
            Мультиплекс в Алматы (~2 млн жителей) с проходимостью 4 000 чел/день
            (выходные пик), средняя загрузка зала 50%, средняя ёмкость 280 мест,
            сеансы 5/день. Сколько залов нужно?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Зрит_в_зал_сеанс = 280 × 0.5 = 140 чел<br />
            Зрит_зал_день = 140 × 5 = 700 чел<br />
            N_залов = 4000 / 700 ≈ ?
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во залов"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 4000 / 700 = 5.7 ≈ 6 залов. Но это «оптимально» загруженный мультиплекс. На практике делают 10-14 залов разной ёмкости (от 30 для VIP до 525 для IMAX) — обеспечивая разнообразие репертуара и одновременный показ 12+ разных фильмов. Реально Chaplin Cinemas Mega Almaty имеет 14 залов.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет мультиплекса 12 залов</h2>
          <p className="text-slate-300">
            ССЦ + импорт: каркас здания + перекрытия 12 000 м² 2-этажный — 1.8 млрд тг,
            амфитеатры трибун 12 залов + кресла Daplast (Pivot/Premium ECHO для VIP) — 0.7 млрд тг,
            акустическая отделка залов (mineral wool 200 мм + Tectum + Acoustix Sopra) — 0.4 млрд тг,
            экраны Harkness Spectral 240 + Strong White CW (для 3D) × 12 шт — 0.18 млрд тг,
            проекторы Christie CP4440-RGB Laser × 11 + IMAX Laser × 2 (dual для одного IMAX-зала) — 1.4 млрд тг,
            аудио Dolby Atmos 7.1.4 × 11 залов + IMAX 12-канальная × 1 — 0.6 млрд тг,
            TMS GDC Cinema Network + KDM management + сервера хранения DCP — 0.3 млрд тг,
            HVAC прецизионный + кратность 8-10 1/час в залах + бесшумная вытяжка — 0.4 млрд тг,
            СОУЭ + СОТ + СКУД + противопожарная (АУПС + спринклер) — 0.18 млрд тг,
            фойе + лобби + кассы Касспро + терминалы билетов — 0.3 млрд тг,
            бар-снэк-концессии (попкорн машины + кулинарная линия + бар) — 0.18 млрд тг,
            ВИП-залы 30 мест × 2 шт (lounge-кресла + premium-сервис) — 0.18 млрд тг,
            благоустройство + парковка 800 м/мест в составе ТРЦ — 0.12 млрд тг,
            проектирование + лицензия DCI + сертификация THX выборочных залов — 0.08 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~6.8 млрд тг (допуск ±10%). 1.8+0.7+0.4+0.18+1.4+0.6+0.3+0.4+0.18+0.3+0.18+0.18+0.12+0.08 = 6.82 млрд тг. Удельная стоимость ~570 тыс. тг/м² (для встроенного варианта в ТРЦ). Реально Chaplin Cinemas Mega Almaty (14 залов, открыт 2017) — оценочно $20 млн ≈ 9 млрд тг (с учётом аренды места в ТРЦ).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Эвакуация при пожаре</h2>
          <p className="text-slate-300">
            Мультиплекс с одновременным посещением 3000+ зрителей. Что обязательно
            по СН РК 2.02-15 + NFPA 101 категория зрелищные?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только сирены и пожарные двери" },
              { v: "b", t: "Только спринклеры на потолке" },
              { v: "c", t: "Многоуровневая эвакуация и пожбез по СН РК 2.02-15 + NFPA 101 + IBC 2024: 1) ≥2 эвакуац. выхода из каждого зала, ширина прохода 1.2 м на 100 зрителей, расположение в противоположных концах зала; 2) Время эвакуации ≤6 минут расчётно для всех залов одновременно (worst-case); 3) Лестничные клетки незадымляемые Н1 или Н2 (с подпором воздуха при пожаре), ширина 1.65 м (для 3000 чел = 18.2 модуля по 0.6 м = 11 м суммарно на нескольких лестницах); 4) Aisles между рядами кресел ≥1.05 м ширина, через каждые 12-14 рядов поперечный проход; 5) АУПС автоматич. пожарная сигнализация + СОУЭ 5-го типа с речевым оповещением на 3 языках (русск./каз./англ.) + аварийное освещение Eaton CrouseHinds 1 ч автономии; 6) Спринклер ESFR в фойе + обычный в залах (не подходит ESFR из-за акустики) + в технических помещениях газовое пожаротушение IG-541 для проекторов; 7) Противопожарные двери EI60 между залами и фойе, automatic-closing on alarm; 8) Эвакуация во время фильма — приостановка проектора + включение полного света + речевое оповещение «Выход через ближайшую дверь со знаком EXIT»; 9) План эвакуации в каждом зале + обучение персонала ежеквартально + тренировки реальной эвакуации 2 раза/год; 10) Снижение паники — спокойные ассистенты в форменной одежде направляют зрителей; 11) АУПТ автоматический пуск, пожарные краны ПК-65 каждые 50 м; 12) СН РК 2.02-15 + NFPA 101 Life Safety + IBC 2024 Type A Assembly" },
              { v: "d", t: "Только индивидуальные противогазы под каждым креслом" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-xl p-6">
          <button
            onClick={() => setShowResults(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition"
          >
            Проверить ответы
          </button>
          {showResults && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${score === 4 ? "text-emerald-400" : score >= 2 ? "text-amber-400" : "text-rose-400"}`}>
                {score} / 4
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {score === 4 ? "Отлично — готовы к проектированию мультиплекса" : score >= 2 ? "Перечитайте DCI + IMAX Specs + СН РК 2.02-15 + NFPA 101" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> DCI Digital Cinema Specification, SMPTE 196M (Cinema Sound), IMAX Inc. Specifications, THX Certification, СН РК 3.02-08 + 2.02-15, NFPA 101 (Life Safety), IBC 2024.</p>
          <p><strong>Реальные объекты РК:</strong> Chaplin Cinemas Mega Almaty (14 залов, 2500 мест), Kino-Park Астана (12 залов, IMAX 3D 525 мест), Cinemax Шымкент (8 залов), Lotte Cinemas Алматы (10 залов), Cinema Park.</p>
        </section>
      </main>
    </div>
  );
}
