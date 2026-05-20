"use client";
import Link from "next/link";
import { useState } from "react";

export default function BondedWarehouseFtzPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 50_000) <= 5_000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 25_000_000_000) <= 2_500_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Бондированные склады СЭЗ</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🛃 Бондированные склады СЭЗ (Free Trade Zone)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #277. СЭЗ «Хоргос — Восточные ворота» (МЦПС Хоргос, ICBC),
            СЭЗ «Сарыарка» (Темиртау), СЭЗ «Морпорт Актау». Бондированный режим
            (Customs Bonded) — товар хранится в специальной зоне таможенного
            контроля без уплаты НДС, акцизов, ввозных пошлин ДО момента
            выпуска во внутреннее потребление РК. Таможенный кодекс ЕАЭС
            ст. 155-162 + Закон РК «О таможенном регулировании» от 2017.
            Период бондирования до 3 лет (Customs Bonded Warehouse).
            Электронное пломбирование (e-seal) + АИС КГД МФ РК «Астана-1»
            для онлайн-учёта остатков. WCO Kyoto Convention 1973 (revised).
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав бондированного склада СЭЗ</h2>
          <p className="text-slate-300 leading-relaxed">
            Таможенный кодекс ЕАЭС + WCO Kyoto Convention + АИС «Астана-1»:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Периметр СЭЗ:</strong> двойное ограждение 3 м с колючей АКЛ + видеонаблюдение CCTV-IP 24/7, расстояние между заграждениями 5 м (контрольно-следовая полоса).</li>
            <li><strong>Зона таможенного контроля (ЗТК):</strong> входной шлюз для грузовиков с весами автомобильными 80 т (Mettler-Toledo VTC), сканирование рентгеном HCV-Mobile (Smiths Detection).</li>
            <li><strong>Бондированный склад (Customs Bonded):</strong> площадь 30 000-100 000 м², ВРС 12-15 м, стеллажи селективные Jungheinrich 7 ярусов + AS/RS для high-velocity, температурный режим 5-25 °C для общего хранения.</li>
            <li><strong>Бондированный холодильник (Cold Bonded):</strong> 5 000-10 000 м² с T = -25 °C / +5 °C для фарм. препаратов, пищевых продуктов, парфюмерии (Coca-Cola, Procter & Gamble).</li>
            <li><strong>Зона консолидации/деконсолидации (Cross-docking):</strong> 2 000-5 000 м² для разбивки контейнеров 40 фут на палеты + переупаковка под РК-розницу.</li>
            <li><strong>Таможенный пост КГД МФ РК:</strong> офис 200-500 м² с сертифицированными АРМ «Астана-1», SOAS (Skype-камеры для удалённого досмотра), приёмная декларанта.</li>
            <li><strong>Зона досмотра товаров:</strong> площадка 500-1 000 м² с роклой, столом для вскрытия пломб, видеокамерами 360° для протокольного осмотра.</li>
            <li><strong>Бондированный магазин (Bonded Shop, Duty-Free):</strong> для туристов через границу — Хоргос ICBC, на площади 5-10 тыс. м².</li>
            <li><strong>Зона производства / сборки (Manufacturing Bonded):</strong> цех 5 000-20 000 м² для сборки готовой продукции из бондированных компонентов (СЭЗ «Сарыарка» — KIA Sportage из CKD-комплектов).</li>
            <li><strong>Административный корпус:</strong> офисы СЭЗ-резидентов, customs broker, переводчики, банковские филиалы (Halyk, Сбербанк KZ).</li>
            <li><strong>Зона контейнерного хранения (Container Yard):</strong> площадка для 40-футовых TEU контейнеров на 500-2 000 ед., погрузчик Kalmar Reach Stacker 45 т.</li>
            <li><strong>ЖД-терминал:</strong> примыкание к Атасу-Алашанькоу / Хоргос-Достык с подъездными путями колея 1520+1435 (Россия+Китай), кран мостовой 50 т для перегрузки контейнеров.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Электронная пломбировка</h2>
          <p className="text-slate-300">
            Бондированный склад СЭЗ «Хоргос» хранит 50 000 м² FMCG + электроники.
            Какое оборудование контроля по WCO + АИС «Астана-1» обязательно?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только видеонаблюдение CCTV без интеграции с КГД" },
              { v: "b", t: "Только бумажные пломбы и журналы учёта" },
              { v: "c", t: "Только RFID на товаре без e-seal на контейнере" },
              { v: "d", t: "Комплексная система Customs Tracking по WCO Kyoto + АИС «Астана-1»: 1) Электронная пломба e-seal (Cargotec Smartrac / Savi Tag) на каждом контейнере с GPS + 4G + alarming при вскрытии (накладывается в порту отправки, снимается только в зоне ЗТК при участии инспектора КГД); 2) RFID-метки EPC Gen2 (UHF 860-960 МГц) на каждой палете (passive Avery Dennison AD-661) + читатели Impinj Speedway R420 на въезд/выезд из зоны хранения (автоматический учёт перемещений); 3) АИС КГД МФ РК «Астана-1» — онлайн-интеграция через REST API: фискальный учёт всех операций (приём, размещение, перемещение, отгрузка), отчёт КГД ежедневно к 9:00; 4) Видеонаблюдение CCTV-IP 24/7 на периметре + внутри (Axis Q1798-LE 4K с 30-дн архивом, синхрон. с АИС по timestamp товарной операции); 5) СКУД (Access Control) — биометрия отпечатков пальцев + RFID-карта для входа персонала и customs broker, лог в АИС; 6) Весы автомобильные 80 т Mettler-Toledo VTC на въезд/выезд + калибровка ГосСтандарт РК ежеквартально (защита от подмены содержимого); 7) Рентген-сканер HCV-Mobile Smiths Detection для досмотра подозрительных контейнеров (по риск-профилю АИС), оператор в кабине защищённой свинцовым стеклом; 8) Зона досмотра с поворотной HD-камерой 360° + микрофоном для протокольной видеозаписи (доказательная база для арбитража); 9) Резервный канал связи 4G + спутниковый VSAT для аварийной отправки в АИС при обрыве оптики; 10) Сертификация СЭЗ-режима — лицензия КГД МФ РК на класс А (free trade zone) с ежегод. аудитом; СН РК 4.04-23 + Таможенный кодекс ЕАЭС ст. 155-162 + WCO Kyoto Convention 1973" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Расчёт площади бонда</h2>
          <p className="text-slate-300">
            Хоргос СЭЗ. Резидент-импортёр заявляет: 25 000 палет с FMCG +
            10 000 палет с электроникой + 1 500 контейнеров 40 фут. (мебель
            IKEA импорт CN→KZ). Норма: 0.8 м² пола под палету (стеллаж 7 ярусов
            = 5.6 палет/м²), 25 м² пола под TEU 40 фут (контейнерная площадка
            наземная без штабелирования). + 30% коэф. проходов RAL ESFR.
            Округли до тыс. м². Введи м²:
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="м²"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> 35 000 палет × 0.8 м² ÷ 5.6 яр. ≈ 5 000 м² (стеллажи)
                + 1 500 TEU × 25 м² = 37 500 м² (контейнерная)
                + (5 000 + 37 500) × 30% коэф. проходов = ~13 000 м²
                ⇒ ≈ <strong>50 000 м²</strong> бондированной площади.
                СН РК 4.04-23 + FEM 9.831 + WCO Kyoto Convention.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капитальный бюджет СЭЗ</h2>
          <p className="text-slate-300">
            Бондированный склад 50 000 м² (СЭЗ «Хоргос»): ССЦ РК + WCO + АИС:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земляные + фундаменты ж/б плита B30 (50 000 м² × 14 000 тг) = 700 млн тг</li>
            <li>Каркас стальной ЛМК (Q355B, span 24 м, ВРС 12 м) (50 000 м² × 28 000 тг) = 1.4 млрд тг</li>
            <li>Сэндвич-стены PIR-100 + кровля PIR-200 (1 800 п.м фасада × 35 000 тг + 50 000 м² кровли × 18 000 тг) = 0.96 млрд тг</li>
            <li>Эпокс. пол под Jungheinrich 25 т/м² (50 000 м² × 24 000 тг) = 1.2 млрд тг</li>
            <li>Стеллажи селективные 7 яр. + AS/RS-зона (35 000 палет × 65 000 тг + 5 000 палет AS/RS × 280 000 тг) = 3.68 млрд тг</li>
            <li>Холодильная зона T = -25/+5 °C (5 000 м² × 240 000 тг) = 1.2 млрд тг</li>
            <li>WMS Manhattan SCALE + интеграция АИС «Астана-1» = 0.7 млрд тг</li>
            <li>ESFR-спринклер + насосная (50 000 м² × 9 000 тг) = 0.45 млрд тг</li>
            <li>Периметр СЭЗ: 2-контурный забор АКЛ + CCTV-IP 4K + biometric СКУД (1.8 км × 280 тыс тг + 220 камер × 350 тыс тг + СКУД) = 0.65 млрд тг</li>
            <li>Электронные пломбы e-seal Cargotec + RFID Impinj + хост-сервер = 0.42 млрд тг</li>
            <li>Рентген-сканер HCV-Mobile Smiths Detection 1 шт + лицензия = 1.7 млрд тг</li>
            <li>Автомобильные весы Mettler-Toledo VTC 80 т 4 шт = 0.18 млрд тг</li>
            <li>Контейнерная площадка асфальт + RTG-кран 45 т Kalmar = 1.6 млрд тг</li>
            <li>ЖД-терминал колея 1520+1435 (700 м путей + кран мостовой 50 т) = 1.2 млрд тг</li>
            <li>Customs-офис КГД 500 м² + бондированный магазин Duty-Free 8 000 м² = 0.95 млрд тг</li>
            <li>Адм. корпус 2 000 м² + котельная газовая 4 МВт + ТП 2×1600 кВА + ВНС = 1.4 млрд тг</li>
            <li>Благоустройство СЭЗ + парковка фурам 200 мест + проектирование (3% бюджета) + ПИР + НР + СП = 7 млрд тг</li>
          </ul>
          <p className="text-slate-300">Итого capex (тг, округл. до млрд):</p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="тг"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> ~25 млрд тг (50 USD M ≈ ~$500/м² для класса А+ FTZ).
                Это +60% к обычному классу А (FEDIA) из-за СЭЗ-инфраструктуры:
                периметр + customs-офис + рентген + e-seal + ЖД-терминал.
                Окупаемость 10-12 лет при rate $7-8/м²/мес (СЭЗ-резиденты платят меньше
                из-за льгот по НДС и пошлинам). СН РК 4.04-23 + ССЦ РК 2026-Q2 + WCO.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Период бондирования</h2>
          <p className="text-slate-300">
            Резидент СЭЗ «Хоргос» — импортёр электроники CN→KZ.
            Что определяет максимальный срок хранения товара в бондированном
            режиме без уплаты НДС/акциза/пошлин по ТК ЕАЭС?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Не ограничен — товар можно хранить бессрочно без декларации" },
              { v: "b", t: "12 месяцев — фиксированный срок, после которого товар автоматически выпускается во внутр. потребление" },
              { v: "c", t: "До 3 лет по ТК ЕАЭС ст. 155 (Customs Bonded Warehouse), с пролонгацией: 1) Базовый срок — 3 года с даты помещения товара под таможенную процедуру таможенного склада (ТК ЕАЭС ст. 155, п. 1). До истечения резидент обязан подать декларацию ДТ-2 для одной из 4 процедур: выпуск во внутреннее потребление (с уплатой НДС 12% + акциз + пошлина 0-20%), реэкспорт (без пошлин), уничтожение (под надзором КГД), или отказ в пользу государства; 2) Пролонгация на 3 года возможна для отдельных категорий (биомед., запчасти, спортинвентарь, культурные ценности) — но только до общего срока 5 лет максимум (ст. 156, п. 2); 3) Скоропортящиеся товары (фарм., пищевые, парфюмерия) — ограничение до 6 мес. со ссылкой на срок годности; 4) Возможные операции в бонде: переупаковка, маркировка, дробление, сортировка, погрузка/разгрузка, лабораторный отбор образцов (ст. 159) — но НЕ изменение качественных характеристик товара (нельзя перемалывать кофе в кофе-молотый); 5) Учёт остатков — ежедневный отчёт в АИС «Астана-1» с TIR-номером и пломбой, инвентаризация полная 1 раз/год + выборочная по риск-профилю КГД; 6) Особый случай — товары для производственной сборки (Manufacturing Bonded) — срок исчисляется по производственному циклу, но не более 2 лет, после чего готовая продукция подаёт ДТ-2 как товар РК-производства; 7) Штрафные санкции — если срок истёк и декларация не подана: КГД накладывает арест на товар + штраф 5% от ТС в день, после 30 дней — конфискация в пользу государства; 8) Льготы по СЭЗ — освобождение от НДС, акциза, пошлин даже при выпуске на территорию РК (для СЭЗ-резидентов сроком до 10 лет); 9) Контроль — рандомные таможенные досмотры 1-2% годового товарооборота по риск-профилю АИС + плановые аудиты КГД МФ РК; 10) IT-инфраструктура — облачная WMS Manhattan SCALE + АИС «Астана-1» интеграция через GraphQL API для онлайн-учёта; ТК ЕАЭС ст. 155-162 + Закон РК «О таможенном регулировании» 2017 + WCO Kyoto Convention 1973" },
              { v: "d", t: "1 месяц — товар обязан быть растаможен в течение 30 дней" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <button
          onClick={() => setShowResults(true)}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold transition"
        >
          Проверить ответы
        </button>

        {showResults && (
          <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}>
            <h2 className="text-2xl font-bold text-slate-50">Результат: {score} / 4</h2>
            <p className="mt-2 text-slate-300">
              {score === 4 && "Отлично! Ты понимаешь бондированный режим и СЭЗ-инфраструктуру."}
              {score === 3 && "Хорошо. Перечитай ТК ЕАЭС ст. 155-162 + WCO Kyoto Convention для закрепления."}
              {score === 2 && "Уровень C — пересмотри СН РК 4.04-23 + АИС «Астана-1»."}
              {score <= 1 && "Нужно повторить. См. Закон РК «О таможенном регулировании» + WCO Kyoto Convention."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>ТК ЕАЭС</strong> — Таможенный кодекс Евразийского экономического союза 2017, ст. 155-162 (таможенный склад)</li>
            <li><strong>Закон РК «О таможенном регулировании»</strong> — № 123-VI от 26.12.2017</li>
            <li><strong>Закон РК «О специальных экономических зонах»</strong> — № 469-IV от 21.07.2011</li>
            <li><strong>WCO Kyoto Convention 1973</strong> (revised 1999) — International Convention on the Simplification and Harmonization of Customs Procedures</li>
            <li><strong>WCO TIR Convention 1975</strong> — Customs Convention on the International Transport of Goods under Cover of TIR Carnets</li>
            <li><strong>Istanbul Convention on Temporary Admission 1990</strong> — для временного ввоза экспонатов, оборудования</li>
            <li><strong>СН РК 4.04-23</strong> — Складские здания (ВРС, проёмы, противопожарные нормы)</li>
            <li><strong>СН РК 3.02-30</strong> — Сейсмостойкое проектирование (для Хоргос — зона 8-9 баллов)</li>
            <li><strong>FEM 9.831</strong> — Federation Européenne de la Manutention — стеллажи селективные</li>
            <li><strong>FM Global Data Sheet 8-9</strong> — ESFR-спринклеры для складов ВРС 12+ м</li>
            <li><strong>ISO 9001 / ISO 28000</strong> — менеджмент качества + безопасность цепочки поставок</li>
            <li><strong>АИС «Астана-1»</strong> — Автоматизированная информационная система КГД МФ РК (онлайн декларирование, e-seal, риск-профили)</li>
            <li><strong>HS Code (Harmonized System)</strong> — WCO Brussels — единая классификация товаров для деклараций</li>
            <li><strong>Incoterms 2020</strong> — ICC Paris — условия поставки FOB/CIF/DDP для бонда</li>
            <li><strong>ЕЭК Решение № 51 от 21.04.2015</strong> — порядок ведения реестра уполномоч. эконом. операторов (УЭО)</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
