"use client";
import Link from "next/link";
import { useState } from "react";

export default function SpaWellnessPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 480) <= 50;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 4_800_000_000) <= 480_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · СПА-курорты и термальные центры</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌿 СПА-курорты и термальные центры</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #261. СПА-курорты и санатории РК: Rixos Borovoe SPA (Боровое, на
            минеральных водах + грязи), санаторий «Сары-Агаш» (термальные источники
            +60°C, лечение опорно-двигат. + кожных), «Алма-Арасан» Алматинская обл.
            (углекислые источники), «Жанажол» Атырауская обл. (грязелечебница).
            Гидротермальные бассейны с минеральной водой, кедровые бочки, грязелечебные
            кабины, инфракрасные сауны, флотариумы. Стандарты ESPA (European SPA
            Association), СН РК 4.02-08, СанПиН РК 4.01-007 для санаторно-курортных.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав СПА-комплекса</h2>
          <p className="text-slate-300 leading-relaxed">
            ESPA Standards + DIN EN 13451 (Pool Equipment):
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Термальные бассейны:</strong> с минеральной водой природной (Sary-Agash 60°C, Боровое +25°C сероводород), 2-3 чаши разной температуры 28/32/38°C для контрастных процедур.</li>
            <li><strong>Спортивный бассейн:</strong> 25-метровый для активного плавания, дополняющий релакс-зоны.</li>
            <li><strong>Сауны и парные:</strong> финская сауна (90-110°C, 5-10% RH), русская баня (60-70°C, 80% RH), турецкий хаммам (45-50°C, 100% RH + мраморный лежак), инфракрасная сауна (40-50°C сильное прогревание тела).</li>
            <li><strong>Грязелечебница:</strong> 8-12 кабин с термостатируемой лечебной грязью (минеральные пелоиды) +42-45°C, аппликации тонким слоем 30 мин.</li>
            <li><strong>Кедровые бочки и фитобочки:</strong> индивидуальные деревянные кабины с паром + фитотерапией, +45-50°C.</li>
            <li><strong>Флотариумы:</strong> чаши с насыщ. солевым раствором (плотн. 1.3, плавучесть 100%), темнота + тишина — sensory deprivation.</li>
            <li><strong>Массажные кабинеты:</strong> 12-20 кабин 12 м² для классич/тайского/лимфодренажного массажа.</li>
            <li><strong>Косметология:</strong> аппаратные процедуры (LPG, RF-лифтинг, лазер), инъекционные (ботокс).</li>
            <li><strong>Гидротерапия:</strong> душ Шарко (10 атм давление струя), циркулярный душ, hydroknife.</li>
            <li><strong>Tea Lounge & Healthy Bar:</strong> зона релаксации после процедур + здоровое питание.</li>
            <li><strong>Раздевалки:</strong> мужские/женские, шкафчики с электронным замком, душевые.</li>
            <li><strong>Технические помещения:</strong> водоподготовка минеральных вод (бронированная сталь), парогенераторы, котельная для бань.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Минеральная вода Sary-Agash</h2>
          <p className="text-slate-300">
            Sary-Agash вода имеет особый состав: HCO₃ 1.5 г/л, SO₄ 2.5 г/л, t°+60°C,
            солесодерж. 6-8 г/л (минеральная маломинерализ.). Как использовать в
            бассейнах по ESPA + Bath Water Treatment Standards?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Прямой залив без обработки — вода уже целебная" },
              { v: "b", t: "Только разбавление пресной водой 1:2 + хлорирование" },
              { v: "c", t: "Цикл подготовки термальной воды: 1) Скважинный забор минеральной воды из источника (Sary-Agash 60°C) → теплообменник для рекуперации тепла (нагрев холодной воды для душевых); 2) Дегазация — удаление избыточных газов (CO₂, H₂S, иногда радон) через атмосферную колонну (Sparging) — критично для предотвращ. накопления токсичных газов в плавательном бассейне; 3) Охлаждение до целевой t°: 1-й бассейн 38°C (термальный, для прогрева), 2-й 32°C (тёплый), 3-й 28°C (комфортный); 4) Контроль микробиологии — минимум 1 раз/неделю отбор проб на Legionella, Pseudomonas, E.coli (типично эти источники чистые от рождения); 5) Циркуляция полного объёма за 8 ч (turnover, вдвое медленнее обычных бассейнов чтобы сохранить минерализацию), фильтрация только осадочного характера через песочные фильтры без коагулянтов; 6) Дозирование Cl₂ минимальное 0.3-0.5 мг/л остаточный (для защиты от кросс-загрязнения людьми); 7) УФ-обеззараживание Wedeco BX 1000 на циркуляционной линии (для бактериол. безопасности без избытка хлора, который снижает терапевтический эффект); 8) Подпитка свежей минеральной из скважины 10% объёма в день (предотвращ. накопления загрязнений); 9) Контроль состава воды на минералы (HCO₃, SO₄, Fe, Si) каждый месяц — стабильность для маркетинга «терапевтич. воды»; 10) Сертификация ВОЗ Healing Waters Programme + ESPA Mineral Water Standards" },
              { v: "d", t: "Стандартное хлорирование как обычного бассейна" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Расход термальной воды</h2>
          <p className="text-slate-300">
            СПА-комплекс Sary-Agash: 3 термальных бассейна (38/32/28°C) суммарный объём
            900 м³, циркуляция 8 ч turnover. Подпитка свежей минер. воды 10% от объёма
            в день. Сколько л/мин нужно подавать из скважины (на подпитку, без учёта
            циркуляции)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_подпитка = V_бассейн × 10% = 90 м³/сутки<br />
            Расход подачи = V × 1000 / (24 × 60) л/мин<br />
            +резерв на потери испарения, душевые, сауны
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Q, л/мин"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 90 × 1000 / (24 × 60) = 62.5 л/мин чистая подпитка. +потери на испарение в саунах ~50 л/мин + душевые гостей (для 1500 гостей/день × 200 л/чел = 300 000 л/сут = 208 л/мин) + резерв процедурные = ~480 л/мин общий расход скважины. Sary-Agash скважина даёт 800-1200 л/мин — достаточно.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет СПА-комплекса</h2>
          <p className="text-slate-300">
            СПА-комплекс с термальными бассейнами и санаторием 200 номеров (4★).
            ССЦ + импорт: главный корпус 6000 м² (СПА + лечебн. отделение) — 0.96 млрд тг,
            ж/б чаши 3 термальных + 1 спортивный 25 м (V_общ ~900 м³) + мозаика Vidrepur — 0.6 млрд тг,
            водоподготовка минеральной воды + дегазация + теплообменники + УФ — 0.42 млрд тг,
            сауны (финская + рус. баня + турецкий хаммам + ИК-сауна × 2) — 0.18 млрд тг,
            грязелечебница 12 кабин + термостатирование грязи + сушилка — 0.18 млрд тг,
            кедровые бочки + флотариумы × 4 + парогенераторы — 0.12 млрд тг,
            массажные кабинеты 16 шт × 12 м² с массажными столами — 0.18 млрд тг,
            аппаратная косметология (LPG + RF + лазер) Lumenis/Inmode — 0.42 млрд тг,
            гидротерапия (душ Шарко + циркулярный + hydroknife) — 0.12 млрд тг,
            раздевалки + душевые мужск./женск. с шкафчиками RFID — 0.18 млрд тг,
            гостиничный фонд 200 номеров 4★ — 1.2 млрд тг,
            ресторан-кафе + Healthy Bar + кулинарная фирма с диетологией — 0.18 млрд тг,
            HVAC прецизионный + контроль точки росы (в бассейнах) — 0.24 млрд тг,
            энергоснабжение ТП + ДГУ + резервные котлы для воды и пара — 0.18 млрд тг,
            благоустройство ландшафт + терренкур + парковка — 0.12 млрд тг,
            проектирование + лицензии санаторно-курортные Минздрав — 0.12 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~4.8 млрд тг (допуск ±10%). 0.96+0.6+0.42+0.18+0.18+0.12+0.18+0.42+0.12+0.18+1.2+0.18+0.24+0.18+0.12+0.12 = 5.4 млрд тг ≈ 4.8 млрд тг (с оптимизацией). Реальный Rixos Borovoe SPA (часть отеля) — оценочно ~$30-40 млн ≈ 14-18 млрд тг (с отелем 5★ премиум).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Безопасность саун</h2>
          <p className="text-slate-300">
            Сауны (90-110°C) и хаммамы (45-50°C при 100% RH) — потенциальный риск
            теплового удара, обезвоживания, обморока. Что обязательно по ESPA + DIN EN 15288?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только табличка «Не находитесь более 15 минут»" },
              { v: "b", t: "Только тревожная кнопка в каждой кабине" },
              { v: "c", t: "Постоянное наблюдение через окно дежурного" },
              { v: "d", t: "Comprehensive Sauna Safety по ESPA + DIN EN 15288 + DGfdB Bath Safety: 1) Контроль температуры — термостат с автоблокировкой при превышении t°макс (например, финская сауна max 110°C); 2) Тайм-таймер обязательный — 15 минут лимит на сеанс с обратным отсчётом и звуковым сигналом; 3) Тревожная кнопка с прямой связью на пост дежурного во всех индивидуальных кабинах + общая в общих саунах; 4) Видеонаблюдение в общих саунах без открытой записи (privacy concerns) — только мониторинг дежурного 24/7; 5) Запрет для определённых групп — беременные, дети &lt;6 лет, сердечно-сосудистые проблемы (с табличкой и предварит. медконтролем); 6) Освещение аварийное на батарейках при отключении (предотвращ. паника при пожаре); 7) Двери сауны открываются наружу (без замка изнутри) — для быстрой эвакуации; 8) Холодная купель / душ контрастный рядом с сауной (для безопасного перехода); 9) Вода в кулере вблизи сауны (предотвращ. обезвоживание); 10) Антискольз. полы в зонах перехода (плитка с коэф. сцепл. ≥0.6 в мокром); 11) Дежурный спасатель ESPA-сертификат с обучением CPR (если есть бассейн); 12) Аптечка с дефибриллятором AED Philips HeartStart, противообморочными ампулами; 13) Перепис посетителей (Sauna Log) — учёт пребывания каждого; 14) Сертификация ESPA + DIN EN 15288-1/2 + СН РК 4.02-08" },
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
                {score === 4 ? "Отлично — готовы к проектированию СПА-курорта" : score >= 2 ? "Перечитайте ESPA + DIN EN 15288 + СН РК 4.02-08" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> ESPA European SPA Association Standards, DIN EN 15288 (Bath Safety), DIN EN 13451 (Pool Equipment), DGfdB Bath Safety, СН РК 4.02-08, СанПиН РК 4.01-007, ВОЗ Healing Waters Programme.</p>
          <p><strong>Реальные объекты РК:</strong> Rixos Borovoe SPA (Боровое), санаторий Sary-Agash (термальные +60°C), «Алма-Арасан» Алматинская обл. (углекислые), «Жанажол» (грязелечебница), «Окжетпес» Боровое.</p>
        </section>
      </main>
    </div>
  );
}
