"use client";
import Link from "next/link";
import { useState } from "react";

export default function MaternityPerinatalPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 32) <= 3;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 24_000_000_000) <= 2_400_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Роддома и перинатальные центры</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🤱 Роддома и перинатальные центры</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #260. Перинатальные центры и роддома РК: Республиканский Научный
            Центр Материнства и Детства (РНЦМД) Астана 350 коек, Алматинский ГКБ №7
            родильное отделение, Шымкентский Перинатальный центр, Карагандинский
            Областной перинатальный. ПИТ новорожденных уровень III NICU (Neonatal
            Intensive Care Unit) для недоношенных от 24-й недели, операционные
            родблоки класс A ISO 5, инкубаторы Atom Medical / Drager Babyleo TN500,
            кислородный сепаратор + N₂O закись + Севофлуран для аналгезии. СанПиН
            9.02.020.10, ВОЗ Baby-Friendly Hospital Initiative, AAP NICU Standards.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав перинатального центра</h2>
          <p className="text-slate-300 leading-relaxed">
            ВОЗ + AAP NICU Standards + СанПиН 9.02.020.10:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Приёмное отделение акушерское:</strong> shock-room + кабинеты осмотра + предродовая палата для роженицы с прогрессирующими родами.</li>
            <li><strong>Родильные залы (Delivery Suite):</strong> 8-12 индивидуальных боксов (LDRP — Labor, Delivery, Recovery, Postpartum) 24-30 м² каждый с акушерским креслом-кроватью Hill-Rom Affinity 4, мониторами CTG кардиотокография.</li>
            <li><strong>Операционные кесарево-сечение (CS):</strong> 2-3 операционные ISO 5 класс A с ламинарным потоком 0.45 м/с, для экстренных и плановых КС.</li>
            <li><strong>NICU отделения:</strong> 3 уровня — I (нормальные новорождённые при матери), II (Special Care 32-34 нед, проблемы), III (Intensive Care от 24 нед, реанимация).</li>
            <li><strong>ПИТ NICU уровень III:</strong> инкубаторы закрытые Atom Infa Warmer / Drager Babyleo TN500 (контроль t°кожи ±0.2°C, влажность 50-80%), ИВЛ Drager Babylog VN500 + Maquet Servo-n для недоношенных.</li>
            <li><strong>Палаты совместного пребывания «мать-дитя»:</strong> 6-12 м² 1 кровать матери + детская кроватка, естественное освещение и тёплая отделка.</li>
            <li><strong>Палаты обсервации:</strong> для рожениц с инфекциями (гепатит, ВИЧ) — изолятор с отдельным санузлом и шлюзом.</li>
            <li><strong>Молочная кухня:</strong> подготовка и стерилизация смесей для новорождённых, отдельная от общей кухни.</li>
            <li><strong>Лаборатория экспресс:</strong> 24/7 определение группы крови, газов крови (для NICU), биохимия.</li>
            <li><strong>Блок переливания крови:</strong> экстренное переливание родильнице при кровотечении (постгеморрагическом).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Операционная кесарево-сечения</h2>
          <p className="text-slate-300">
            Операционная КС в перинатальном центре с возможностью одновременной реанимации
            новорождённого. Какие требования по ВОЗ + AAP + СанПиН 9.02.020.10?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Стандартная операционная как для абдоминальной хирургии" },
              { v: "b", t: "Класс B ISO 7 — для большинства операций достаточно" },
              { v: "c", t: "Класс A только для матери, без зоны реанимации новорождённого" },
              { v: "d", t: "Combined Delivery-Resuscitation Suite по AAP + ВОЗ: 1) Класс A ISO 5 ламинарный поток 0.45 м/с с HEPA H14 фильтрацией (3520 частиц 0.5 мкм/м³); 2) Главный операционный стол Maquet/Steris (для матери) + рядом неонатальный реанимационный столик Drager Resuscitaire B2 с обогревом + кислородной подачей + monitor; 3) Зонирование — «сторонняя» зона матери (анестезиолог, акушер) и «сторонняя» зона новорождённого (педиатр-неонатолог, мед.сестра NICU); 4) Системы газов: O₂ + N₂O (закись азота) + Air + Vacuum + N₂ + СО₂ для матери; отдельно для новорождённого — O₂ blender (Bird Mark 2 или Maxtec) с регулир. концентрацией 21-100%; 5) Анестезия эпидуральная (95% случаев) или общая через систему Drager Fabius Plus + Aestiva 5 с Севофлураном/Десфлураном; 6) Освещение хирургич. Maquet Hanaulux 2 светильника 160 000 лк + резерв; 7) UV-стерилизация воздуха перед каждым случаем; 8) Двухсекционный охранник СПС: автомат. дезинф. поверхности + ручная санобработка; 9) АСУ Patient Data Management Philips Vital Sense с автоматич. записью всех параметров мать + ребёнок; 10) Подготовка к экстренному обмену крови (Exchange Transfusion) у новорождённого через катетер umbilical vein; 11) Стерильное поле для обоих пациентов одновременно (мать на операц. столе, новорождённый на reanimation cart); 12) Время от разреза до родоразрешения ≤5 минут (стандарт декомпенсированного состояния плода); СанПиН 9.02.020.10 + ВОЗ + AAP NICU Standards + ASA Practice Guidelines for Obstetric Anesthesia" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во инкубаторов NICU</h2>
          <p className="text-slate-300">
            Перинатальный центр 350 коек обслуживает 8000 родов/год. Доля недоношенных
            (≤37 нед) в РК ~7% = ~560/год, из них в NICU уровень III попадают ~40% (220 шт)
            со средним пребыванием 35 дней. Каков расчётный единомоментный фонд
            инкубаторов NICU III?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Bed-days = N_дет × ср. пребыв. = 220 × 35 = 7700 дней<br />
            N_инк = Bed-days / 365 (доступн. ½ года) с округлением +20%
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во инкубаторов"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 7700 / 365 = 21 инкубаторов средний загруз; +20% запас на пики (групповые роды + переводы) и резерв на ремонт = ~25 шт; +дополнит. 7 шт для NICU уровень II Special Care = ~32 инкубатора всего по перинатальному центру 350 коек.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет перинатального центра</h2>
          <p className="text-slate-300">
            Перинатальный центр 350 коек (350 матерей + 60 мест NICU + 290 обычные).
            ССЦ + импорт: монолит каркас + перекрытия 28 000 м² 4-этажн. — 7.2 млрд тг,
            фасад НВФ + витражи + кровля — 2.4 млрд тг,
            отделка медицинская антибакт. (полы Forbo Marmoleum + сэндвич стены) — 3.6 млрд тг,
            12 родильных боксов LDRP с акушерскими креслами Hill-Rom Affinity 4 — 0.9 млрд тг,
            3 операционные КС класс A ISO 5 с ламинар. потоком + Drager анестезия — 1.4 млрд тг,
            32 инкубатора Drager Babyleo TN500 + Atom Infa Warmer + ИВЛ Babylog VN500 — 2.8 млрд тг,
            UH-аппараты (УЗИ Philips EPIQ Elite × 4 + GE Voluson E10) — 0.6 млрд тг,
            экспресс-лаборатория 24/7 (газы крови Radiometer ABL90 + биохим) — 0.4 млрд тг,
            HVAC прецизионный (ISO 5 в операц. + ISO 8 в NICU + ISO 9 палаты) — 1.6 млрд тг,
            медицинские газы O₂/N₂O/Air/Vacuum/N₂/CO₂ полная разводка — 0.45 млрд тг,
            кислородный сепаратор + резервуар жидкого О₂ — 0.32 млрд тг,
            СОУЭ + СОТ + СКУД + дополн. сигнализация Code Blue/Code Pink — 0.4 млрд тг,
            ИТ-инфра + СУ ИБ Philips ICCA + Patient Data Management — 0.6 млрд тг,
            благоустройство + парковка + вертолётная площадка для эвакуации — 0.85 млрд тг,
            проектирование + лицензии Минздрав + ВОЗ Baby-Friendly — 0.48 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~24 млрд тг (допуск ±10%). 7.2+2.4+3.6+0.9+1.4+2.8+0.6+0.4+1.6+0.45+0.32+0.4+0.6+0.85+0.48 = 24 млрд тг. Удельная стоимость ~68 млн тг/койка — соответствует мировым перинатальным центрам уровня III. РНЦМД Астана (350 коек, открыт 2008, модернизация 2020) — ~$100 млн = 47 млрд тг с инфляцией 2026.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Безопасность новорождённых</h2>
          <p className="text-slate-300">
            Похищения новорождённых (Infant Abduction) — известный риск роддомов
            (исторически случались в РК и мире). Что обязательно по AHA + Joint
            Commission Safety?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только видеонаблюдение в коридорах" },
              { v: "b", t: "Только обязательная регистрация всех посетителей" },
              { v: "c", t: "Multi-layered Infant Security Programme по Joint Commission + AHA: 1) RFID-браслеты на запястье/ножке новорождённого синхронизованные с RFID-браслетом матери (Hugs Infant Protection System или Smart Tag Pediatric Solutions); 2) RFID-датчики на дверях родильного отделения и NICU — при попытке выноса с не-парным RFID — авто-блокировка двери + сигнал тревоги Code Pink на пост; 3) Дверь NICU с biometrics СКУД (отпечаток + код + бейдж), посещения только мать+отец после идентификации; 4) Видеонаблюдение IP HD 4K по всем периметрам и коридорам отделения, запись 90 дней; 5) Стажирующих и непостоянных сотрудников запрет нахождения в NICU без сопровожд. ответственного; 6) Все сотрудники с фотобейджами + цветной кодинг (синий — врачи, белый — мед.сёстры NICU, зелёный — клининг, красный — посетители); 7) Code Pink — общесистемная тревога при подозрении на похищение, мгновенная блокировка всех выходов отделения и роддома; 8) Регулярные тренировки персонала 4 раза/год + симуляция Code Pink с реальным закрытием; 9) Образование молодых мам — родители учат отличать форму мед.персонала, не передавать ребёнка незнакомцам; 10) Связь с правоохранительными органами + ИВД РК предустановлена в системе тревоги; 11) Двойной идентификатор перед каждым кормлением и любой манипуляцией (RFID + визуально); 12) Регулярный аудит безопасности (1 раз/квартал) с тестированием каждой системы; AHA Hospital Security Standards + Joint Commission Sentinel Event Alert + НРБ-99" },
              { v: "d", t: "Только колесо-преграждение в коридорах NICU" },
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
                {score === 4 ? "Отлично — готовы к проектированию перинатального центра" : score >= 2 ? "Перечитайте СанПиН 9.02.020.10 + ВОЗ + AAP NICU" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СанПиН РК 9.02.020.10, ВОЗ Baby-Friendly Hospital Initiative, AAP NICU Standards (American Academy of Pediatrics), ASA Practice Guidelines, Joint Commission Hospital Standards, AHA Hospital Security.</p>
          <p><strong>Реальные объекты РК:</strong> РНЦМД Астана (350 коек, открыт 2008), Алматинский ГКБ №7 родильный блок, Шымкентский Перинатальный центр (240 коек), Карагандинский Областной перинатальный, Перинат. центр Усть-Каменогорска.</p>
        </section>
      </main>
    </div>
  );
}
