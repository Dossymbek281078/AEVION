"use client";
import Link from "next/link";
import { useState } from "react";

export default function ReligiousMosquePage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 6500) <= 600;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 38_000_000_000) <= 3_800_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Мечети и религиозные комплексы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🕌 Мечети и религиозные комплексы</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #275. Мечети РК: Хазрет Султан Астана (открыта 2012, 5000+
            верующих, одна из крупнейших в ЦА), Центральная мечеть Алматы (3000
            верующих, открыта 1999), мечеть Нур-Астана, мечеть «Кок-Тас» Шымкент,
            Атырауская соборная. Молельный зал с ориентацией Qibla (направление
            на Каабу Мекки, 218° на азимуте от Астаны), купол с надписями каллиграфий,
            минареты 4 шт. H=63-77 м, михраб (полукруглая ниша Qibla), минбар
            (кафедра имама). Акустика молельни RT60 1.4-1.8 с (для речи имама).
            СНиП 31-06, СН РК 3.02-115, ICCROM Guidelines for Mosques.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав мечети</h2>
          <p className="text-slate-300 leading-relaxed">
            ICCROM Guidelines + традиционный исламский канон + СНиП 31-06:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Молельный зал (Mihrab Hall):</strong> ориентирован на Qibla (Мекка), для 3000-10 000 верующих, площадь 0.8-1.0 м²/чел.</li>
            <li><strong>Михраб:</strong> полукруглая ниша в стене Qibla (на которую обращён имам и молящиеся), украшена арабской каллиграфией.</li>
            <li><strong>Минбар:</strong> кафедра имама высотой 3-5 ступеней справа от михраба (для пятничной проповеди).</li>
            <li><strong>Купол центральный (Cuppola):</strong> 30-50 м внутренний диаметр, высота 30-50 м, символизирует небосвод (как Хазрет Султан Ø23.6 м H=46 м).</li>
            <li><strong>Минареты:</strong> 4 башни H=63-77 м (Хазрет Султан 77 м) для призыва на молитву Адхан 5 раз/день (Fajr/Dhuhr/Asr/Maghrib/Isha).</li>
            <li><strong>Раздельные молельные зоны для женщин:</strong> отдельный балкон или зал с отдельным входом + санзал.</li>
            <li><strong>Wudu (омовение):</strong> зал ритуального омовения с проточной водой (кран на каждые 5-7 верующих), отдельный для мужчин и женщин.</li>
            <li><strong>Библиотека-медресе:</strong> для изучения Корана, хадисов, исламской науки.</li>
            <li><strong>Имамский комплекс:</strong> кабинет имама + комната для подготовки к проповеди + жильё для дежурного имама.</li>
            <li><strong>Зона выноса обуви:</strong> при входе (вход в молельный зал босиком), индивидуальные шкафчики.</li>
            <li><strong>Двор (Sahn):</strong> внешний двор с фонтаном для летней молитвы, освещение фасадов ночью.</li>
            <li><strong>Главный купол + 4 минарета:</strong> архитектурная композиция османско-турецкого стиля (как Сулеймание Стамбул).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Купол молельного зала</h2>
          <p className="text-slate-300">
            Центральный купол мечети 5000 верующих: внутренний диаметр Ø24 м,
            H_вершины=40 м над полом. Какая конструкция по СН РК 5.04-13 + османский канон?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Деревянная стропильная конструкция с шифером" },
              { v: "b", t: "Только ж/б монолит без архитектурной отделки" },
              { v: "c", t: "Стальной каркас с тентовой обтяжкой" },
              { v: "d", t: "Многослойный каменно-ж/б купол по османскому канону (как Хазрет Султан Ø23.6 м): 1) Основание — ж/б плита B30 1.5 м толщ. с armature A-III двойной сеткой (выдерживает вес купола + полу-сферическая нагрузка); 2) Барабан под куполом (drum/tambour) — восьмигранник из ж/б стен с витражами Schueco для проникновения света; 3) Несущая структура купола — стальная радиальная ферма из труб Q345 (рёбра жёсткости 16 шт. с шагом 22.5°), вылет 12 м от барабана к замку купола; 4) Кровля купола снаружи — медный лист (Cu 0.6 мм Roof-Skin), традиционно для церквей и мечетей (защита от коррозии, патина с годами становится зеленоватой как символ времени); 5) Внутренняя отделка купола (intrados) — резная штукатурка с орнаментами + арабская каллиграфия (suras из Корана), позолоченные элементы, цвет преимущественно бирюзово-голубой (символ небосвода); 6) Освещение центрального купола — массивная люстра-канделябр медная 5-7 м диаметра 16-20 м длины подвеса (символ зашифр. света Аллаха); 7) Витражи в барабане — традиц. цветное стекло Faraj (тюркский стиль), 36-48 окон с тонкими каменными переплётами; 8) Семантика — купол подражает «своду Кабы» / «куполу неба», каллиграфия в окружности (al-Fatiha + Ayat al-Kursi); 9) Окно-фонарь на верхушке купола (oculus) с цветным стеклом — символ единого Аллаха; 10) Расчёт ветровой нагрузки по EN 1991-1-4 + сейсмический по СН РК 2.03-30 (для Алматы 9-10 баллов — повышенное армирование барабана); СН РК 5.04-13 + ICCROM Heritage Conservation + традиционный канон" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Расчёт молельного зала</h2>
          <p className="text-slate-300">
            Мечеть для 5000 верующих в пятницу. Норма пр. зоны молящегося:
            0.9 м² (мужчины) или 1.2 м² (женщины, с балкона). 70% мужчины / 30%
            женщины (балкон). Какая суммарная площадь молельного зала
            (включая балкон женщин)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S_муж = 5000 × 70% × 0.9 = ?<br />
            S_жен = 5000 × 30% × 1.2 = ?<br />
            +30% для михраба, минбара, проходов, мест для имама
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: S_муж = 3150 м², S_жен = 1800 м² (балкон), +30% = +1485 = ИТОГО 6435 м² ≈ 6500 м² зала на 5000 верующих. Для сравнения: Хазрет Султан Астана 17 800 м² общей застр., из них молельный 1700 м² на 5-6 тыс. чел. Большие мечети имеют 1.0-1.5 м²/верующий с учётом просторности.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет мечети 5000 чел</h2>
          <p className="text-slate-300">
            Соборная мечеть на 5000 верующих с куполом Ø24 м H=40 м + 4 минарета
            H=70 м. ССЦ + специф. материалы:
            монолит ж/б каркас + плита фундамента 18 000 м² 3-этажн. — 8.5 млрд тг,
            купол центральный (барабан + ж/б сечения + стальная ферма + Cu-кровля) — 4.2 млрд тг,
            4 минарета H=70 м (ж/б стволы + Cu-конусные шпили + динамики Адхан) — 3.6 млрд тг,
            фасад натуральный камень травертин + мрамор + декор. резьба — 4.8 млрд тг,
            витражи Schueco с цветным стеклом Faraj в барабане + окнах — 1.4 млрд тг,
            внутренняя отделка молельного зала (мрамор + каллиграфия + позолота) — 5.2 млрд тг,
            ковры персидские (Iran/Турция) ручной работы 1700 м² — 0.6 млрд тг,
            люстра-канделябр медная 5 м Ø центральная + 4 угловых — 0.42 млрд тг,
            wudu omovenie зал (8 кранов мужск/4 женск + холодная+горячая вода) — 0.45 млрд тг,
            HVAC прецизионная (тёплый пол для босого хождения) + акустика — 0.95 млрд тг,
            акустика молельни (rt60 1.6 с) + sound-reinforcement Adhan — 0.6 млрд тг,
            освещение фасада + минаретов RGB LED для подсветки ночью — 0.45 млрд тг,
            СОУЭ + СОТ + СКУД (входы) + противопожарная защита — 0.8 млрд тг,
            библиотека-медресе + кабинет имама + жильё для имамов — 1.4 млрд тг,
            благоустройство Sahn двора + фонтан Wudu внешн. + парковка 500 м/мест — 1.4 млрд тг,
            проектирование + Минкультуры РК + DUMK consultancy — 1.2 млрд тг,
            ландшафтная подсветка + минаретов + Cu-шпилей золочение — 1.0 млрд тг,
            строительные нормы СН РК + ICCROM + сейсмика 9 баллов — 1.55 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~38 млрд тг (допуск ±10%). 8.5+4.2+3.6+4.8+1.4+5.2+0.6+0.42+0.45+0.95+0.6+0.45+0.8+1.4+1.4+1.2+1.0+1.55 = 38 млрд тг. Реальная Хазрет Султан Астана (2012, 17 800 м²) — оценочно $200 млн = 92 млрд тг (более крупная и премиум-уровень). Стандартная соборная на 5000 чел = 38 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Акустика и звукоусиление</h2>
          <p className="text-slate-300">
            Имам в пятницу читает проповедь Hutbah для 5000+ верующих. Услышать
            должны все, без эффекта эха. Что обязательно?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только мощные колонки JBL на потолке без обработки акустики" },
              { v: "b", t: "Только акустическая отделка стен (без звукоусиления)" },
              { v: "c", t: "Многоуровневая звуковая система: 1) Акустическое проектирование зала по Beranek + Sabine для RT60=1.4-1.8 с (компромисс между удобством речи имама и торжественностью пения Корана); 2) Стены и купол — комбинация поглощающих (мраморные ниши с резной поверхностью, ковры на полу) и диффундирующих (полированные мраморные колонны, каллиграфия лепная) поверхностей — равномерное распределение звука без direct echoes; 3) Звукоусиление distributed system Bose Panaray MA12EX или JBL Control Contractor — line array колонки малой мощности (60-150 Вт) с узкой direct radiation pattern, равномерно размещены по периметру зала каждые 8-12 м (плотностью 1 колонка на 50-80 верующих); 4) DSP-процессор Yamaha DME-32 для time-alignment всех колонок (синхронизация по местоположению — каждая колонка задерживает звук с расчётной задержкой для совпадения с прямым звуком от имама в каждой точке зала); 5) Микрофон имама — boundary microphone Shure CVB-B/C на минбаре + handheld для движущегося имама, ducking + noise gate для устранения фоновых шумов; 6) Внешние динамики на минаретах для Адхана (5 раз/день, с уровнем 80-85 дБА на расстоянии 30 м от минарета — слышимость до 2 км); 7) Контроль громкости — администрация мечети может регулировать через app, autodimming для шумных дней; 8) Audio-обработка для подавления реверберации (Lexicon PCM92 — компенсация эха при усилении звука); 9) Резервная батарейная система UPS на 2 ч для пятничной молитвы при отключении; AES Pro Audio + Sabine Acoustic Formula + Beranek + СНиП 31-06" },
              { v: "d", t: "Только индивидуальные наушники для каждого верующего" },
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
                {score === 4 ? "Отлично — готовы к проектированию мечети" : score >= 2 ? "Перечитайте СН РК 5.04-13 + СНиП 31-06 + ICCROM" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СНиП 31-06 (Общественные здания), СН РК 3.02-115, СН РК 5.04-13 (Купольные конструкции), СН РК 2.03-30 (Сейсмика), AES Pro Audio + Beranek + Sabine Acoustic, ICCROM Heritage Conservation.</p>
          <p><strong>Реальные объекты РК и мир:</strong> Хазрет Султан Астана (2012, 17 800 м², купол Ø23.6 м H=46 м, 4 минарета H=77 м), Центральная мечеть Алматы (1999), Нур-Астана, «Кок-Тас» Шымкент, Атырауская соборная, Сулеймание Стамбул, Шейх Зайед Абу-Даби.</p>
        </section>
      </main>
    </div>
  );
}
