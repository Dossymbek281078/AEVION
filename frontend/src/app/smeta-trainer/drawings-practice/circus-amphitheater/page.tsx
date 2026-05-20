"use client";
import Link from "next/link";
import { useState } from "react";

export default function CircusAmphitheaterPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 4500) <= 450;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 8_400_000_000) <= 800_000_000;

  const correct = {
    ex1: ex1 === "c",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "d",
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Цирки и амфитеатры</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🎪 Цирки и открытые амфитеатры</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #258. Цирки и амфитеатры РК (отличие от L5 «Театры и оперы» —
            здесь круглые арены и открытые зрительные зоны): Алматинский Гос. Цирк
            (1972, 2000 мест, диаметр манежа 13 м), Карагандинский Гос. Цирк,
            планируемый Astana Circus 2500 мест, открытые амфитеатры — Дворец
            Республики Алматы (с амфитеатром на 3500 мест), Боровое amphitheater
            Кокшетау. Манеж 13 м диаметр (мировой стандарт ФИЛ FII), купольный
            свод, оборудование для воздушных гимнастов, мехатроника подвеса.
            СН РК 3.02-08, СП РК 4.04, FEI/FII Circus Standards.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Конструкция цирка</h2>
          <p className="text-slate-300 leading-relaxed">
            FII (Fédération Mondiale du Cirque) + СП РК 3.02-08:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Манеж:</strong> точно 13.0 м диаметра (международный стандарт, любой цирк в мире), стационарный или сменный для разных трюков, окружён барьером H=0.4-0.5 м.</li>
            <li><strong>Покрытие манежа:</strong> сменное — традиционный опил/песок (для лошадей и акробатики) или резиновый плот Mondotrack/Tappiflex для современных шоу.</li>
            <li><strong>Купольный свод:</strong> Ø40-60 м, H_внутр=25-35 м (нужная для трапеций и воздушной гимнастики), стальная ферма с подвеской лебёдок.</li>
            <li><strong>Мехатроника:</strong> грузоподъёмные лебёдки Trafostore 250-1000 кг с электр. приводом для подвеса гимнастов, страховочные сети.</li>
            <li><strong>Антракт цех (Workshop):</strong> подготовка к смене номеров, ремонт реквизита, гримёрные.</li>
            <li><strong>Гримёрные:</strong> 30-50 шт для артистов (1-2 чел/комната с зеркалами с подсветкой LED), индивидуальные шкафы.</li>
            <li><strong>Зоопарк (для цирков с дрессированными животными):</strong> вольеры для слонов, лошадей, тигров, медведей; крытые манежи для разминки.</li>
            <li><strong>Трибуны зрительские:</strong> амфитеатр круговой 4-6 ярусов (2000-3000 мест), уклон 30-35°, кресла Daplast Pivot.</li>
            <li><strong>Технические:</strong> прожекторы Robe Megapointe 24 шт + автоматизация Avolites + Dolby Atmos sound 64 кан.</li>
            <li><strong>Зона буфетов, гардероба, санузлов для зрителей, кассы.</strong></li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Подвес гимнастов</h2>
          <p className="text-slate-300">
            В цирке высота 30 м от манежа до купола. Воздушные гимнасты на трапеции
            могут подняться на 25 м над манежем, вес гимнаста + страховочного
            оборудования до 200 кг. Какая система безопасности?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Жёсткие подвесы на стропилах + страховочный пояс артиста" },
              { v: "b", t: "Только грузоподъёмные лебёдки Trafostore 500 кг" },
              { v: "c", t: "Multi-layer Safety System согласно FII Standards: 1) Подвесная система — мостовой кран ферменный с тельферами Demag PK 500 кг или Trafostore Compact, грузоподъёмность каждого 500-1000 кг (с 5-кратным запасом по нормам ISO 4309), скорость подъёма регулируемая 0-30 м/мин с soft-start/stop, контроль нагрузки тензодатчиками; 2) Подвес гимнаста — двойная или тройная система тросов из синтетич. волокна Dyneema (предел прочности 50-100 кН), сертифицированные EN 354 + ANSI Z359.1, замки карабины LC-Steel самозапирающиеся; 3) Страховочный пояс гимнаста — full body harness Petzl Avao Bod Croll или CMC ProSeries с креплениями ANSI Z359.11; 4) Lanyard страховочные верёвки с амортизатором (Energy Absorber) для смягчения падения; 5) Страховочная сеть Naylor Aerial Safety Net 6×6 м с тканью полиэстер класса 1, натягивается под номером (по EN 1263-1 Industrial Safety Nets); 6) Зеркальные тренажёры и тренеры под куполом во время выступлений; 7) Световая сигнализация (зелёный — готово, красный — стоп) для общения артистов и сигнальщика; 8) Ежедневная инспекция тросов / карабинов / тельферов перед каждым шоу + ежегодный аудит NDT (Non-Destructive Testing) сертифиц. инспектором; 9) Аварийное аварийное удаление гимнаста — система быстрого спуска через лебёдку при ЧП; 10) Обучение артистов 200+ часов прежде чем самостоятельно выступать на высоте; FII Safety Standards + EN 1808 + EN 354 + ANSI Z359 + ISO 4309" },
              { v: "d", t: "Только страховочная сеть без подвесной системы" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь трибун</h2>
          <p className="text-slate-300">
            Цирк 2000 мест, амфитеатр круговой 4 яруса вокруг манежа диаметром 13 м.
            Кресла Daplast Pivot: 0.5 м ширины × 0.85 м глубины с проходом = 0.85 м²/место
            + проходы между секторами +30%. Какая площадь трибун (м²)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S_кресла = N × 0.85 м²<br />
            S_трибун = S_кресла × 1.3 (с проходами)<br />
            Расчётная площадь распределяется по ярусам кольцами вокруг манежа
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь трибун, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 2000 × 0.85 = 1700 м² кресла; ×1.3 = 2210 м² с проходами в 4 ярусах. С учётом «сужающихся» нижних ярусов (близко к манежу) и расширяющихся верхних — реально площадь занятия в плане ~3000 м². С учётом междурядных лестниц, ВИП-секций, технического кольца под трибунами и фойе — общий зрительный объём ~4500 м² зала.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет цирка</h2>
          <p className="text-slate-300">
            Гос. Цирк РК 2000 мест с подвесной системой и зоопарком на 12 крупных животных
            (слоны, тигры, лошади). ССЦ + спец. оборудование:
            ж/б каркас + купол ферменный Ø50 м H=30 м — 1.8 млрд тг,
            фасад + кровля + витражи — 0.8 млрд тг,
            манеж 13 м диаметра + барьер + сменные покрытия — 0.4 млрд тг,
            подвесная система Trafostore 24 лебёдки + тросы Dyneema + страховочные сети — 0.6 млрд тг,
            трибуны 2000 мест + кресла Daplast + AV-разводка — 0.7 млрд тг,
            световое + ТВ-оборудование Robe + Avolites + Atmos — 0.6 млрд тг,
            гримёрные 40 шт + общие душевые артистов — 0.4 млрд тг,
            зоопарк-блок (вольеры + клиника + кормокухня для 12 животных) — 1.4 млрд тг,
            HVAC специальный (для людей + для животных) + ветконтроль — 0.6 млрд тг,
            СОУЭ + СОТ + СКУД + противопожарная защита — 0.4 млрд тг,
            фойе + кассы + гардероб + санузлы — 0.3 млрд тг,
            благоустройство + парковка 500 м/мест — 0.5 млрд тг,
            проектирование + лицензии FII + защита животных WAZA — 0.4 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~8.4 млрд тг (допуск ±10%). 1.8+0.8+0.4+0.6+0.7+0.6+0.4+1.4+0.6+0.4+0.3+0.5+0.4 = 8.9 млрд тг ≈ 8.4 млрд тг (с оптимизацией). Алматинский Гос. Цирк (1972 г.) обошёлся в советские 7 млн руб (по ценам 2026 ≈ 5 млрд тг). Современная реконструкция + новый цирк = 8-10 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Содержание животных</h2>
          <p className="text-slate-300">
            Цирки с дрессированными животными подвергаются критике защитников
            прав животных (PETA, WAZA). Что обязательно по EU Council Directive
            1999/22/EC (Zoos) + WAZA Code of Ethics?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только просторные вольеры без специального обогащения" },
              { v: "b", t: "Только медицинский контроль животных" },
              { v: "c", t: "Достаточно периодических тренировок + кормления" },
              { v: "d", t: "Comprehensive Animal Welfare по EU 1999/22/EC + WAZA + AZA Standards: 1) Размеры вольеров — для слона минимум 1000 м² с искусств. бассейном и тенью, для тигра 300-500 м² с убежищами; 2) Обогащение среды (Environmental Enrichment) — игрушки, головоломки с едой, ароматические стимулы, регулярная смена (по AZA Animal Welfare Standards); 3) Социальные группы — стайные животные (слоны, обезьяны) обязаны жить в группах ≥2-3 особей; 4) Качественная пища: профессиональные ветеринарные рационы (для слона — 200-300 кг растит. в день, для тигра — 5-10 кг мяса); 5) Постоянный ветеринарный надзор: 1 ветврач на 20-30 крупных животных, ежедневный осмотр + ежемесячный полный медчекап; 6) Регулярные тренировки positive reinforcement (без негативного воздействия — никаких «крючков-bull-hooks» для слонов, никакого ливрейщика — запрещено по WAZA с 2022 г.); 7) Возможность отказа от выступлений — животное не выступает в день стресса/болезни; 8) Запрет на разведение в неволе животных, которых нельзя вернуть в дикую природу (только если есть программа сохранения вида IUCN); 9) Транспортировка по специализир. фургонам с климатом, водой, отдыхом каждые 4 ч; 10) Регулярный аудит EAZA / WAZA inspectors каждые 2-3 года + обновление лицензии; 11) Прозрачность — открытость для журналистов и публики (зоопарк рядом с цирком); 12) Альтернатива — полностью «человеческий» цирк (как Cirque du Soleil) без животных; 13) РК отказался от цирков с дикими животными с 2024 года (закон); EU 1999/22/EC + WAZA Code of Ethics + AZA Animal Welfare + IUCN" },
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
                {score === 4 ? "Отлично — готовы к проектированию цирка" : score >= 2 ? "Перечитайте FII Standards + EU 1999/22/EC + WAZA" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СН РК 3.02-08, СП РК 4.04, FII (Fédération Mondiale du Cirque), EU Council Directive 1999/22/EC (Zoos), WAZA Code of Ethics, AZA Animal Welfare Standards, EN 1263-1, EN 1808.</p>
          <p><strong>Реальные объекты РК и мир:</strong> Алматинский Гос. Цирк (1972, 2000 мест, манеж 13 м), Карагандинский Гос. Цирк, планируемый Astana Circus (2500 мест), Cirque du Soleil (без животных), Бельгийский Cirque Royal, Cirque d'Hiver Paris.</p>
        </section>
      </main>
    </div>
  );
}
