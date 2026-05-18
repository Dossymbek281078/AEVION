"use client";
import Link from "next/link";
import { useState } from "react";

export default function SeismologyStationPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 8) <= 1;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 4_500_000_000) <= 450_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Сейсмостанции и геофиз. центры</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌍 Сейсмостанции и геофизические центры</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #277. КНДЦ Курчатов (Казахстан. национальный центр данных
            CTBTO IDC — мониторинг ядерных испытаний по Договору о всеобщем
            запрещении ядерных испытаний), сейсмостанция Talgar Geophysical
            Station (Алматинская обл., с 1965 г), Aksu, Akkala, Borovoye,
            Karatau, Makanchi (PS23 IMS auxiliary). Широкополосные сейсмографы
            Streckeisen STS-2 (период 120-360 с) и Nanometrics Trillium 240,
            digitizer Quanterra Q330 24-bit 100 sps, GPS-UTC синхрон. ±10 нс,
            подземный гранитный бункер H=8 м под слоем грунта. СН РК 2.03-30
            + IMS Operational Manual + IRIS GSN Standards + UNESCO IGCP.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав сейсмостанции IMS-уровня</h2>
          <p className="text-slate-300 leading-relaxed">
            CTBTO IMS Operational Manual + IRIS GSN + IRIS Wilber-3:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Сейсм. бункер (vault):</strong> подземный ж/б шахта глубиной 8-15 м с фундаментом-плитой ж/б на гранитном коренном основании (bedrock outcrop), стены ж/б 0.5 м толщ. + гидроизоляция Bentofix; температурная стабильность ±0.5 °C/сут.</li>
            <li><strong>Сейсмометр Streckeisen STS-2 или Nanometrics Trillium 240:</strong> широкополосный сейсмограф 360 с / 50 Гц, 3 компонента (BHZ/BHN/BHE), масса 13 кг, vacuum-sealed, level ±1° (компенсируется автоматически).</li>
            <li><strong>Установка сейсмометра:</strong> на пьедестале из гранита (granite pier) 1×1×1 м, изолирован виброподвесом от пола бункера, кожух из stainless steel под вакуумом, fiberglass thermal isolation 50 мм.</li>
            <li><strong>Digitizer:</strong> Quanterra Q330 / Nanometrics Centaur — 24-bit ADC, 6 каналов (3 BHZ/BHN/BHE + 3 HHZ/HHN/HHE для short-period), 100 sps по умолч., передача NTP/TCP, локальный буфер 24 ч.</li>
            <li><strong>GPS-приёмник UTC-синхронизация:</strong> Trimble Acutime 360 на крыше с антенной с молниезащитой, точность ±10 нс по UTC (требование CTBTO для триангуляции эпицентра).</li>
            <li><strong>Hyper-array:</strong> на станциях CTBTO IMS Type I (как Borovoye) — массив из 7-25 сейсмометров на расстоянии 1-25 км между точками, для f-k анализа и подавления шума.</li>
            <li><strong>Магнитометр (M-station):</strong> опц. — флюксгейт магнитометр для геомагнитного мониторинга + induction coils для дальнего мониторинга.</li>
            <li><strong>Инфразвуковой массив (I-station):</strong> опц. — 4-8 микробарометров MB2005 (Martec) для регистрации звука {"<"}20 Гц (ядерные взрывы, метеоры, вулканы); порт wind-noise reduction.</li>
            <li><strong>Радионуклидная станция (RN):</strong> опц. — Particulate sampler ARIX + noble gas SAUNA для отбора атмосферы (CTBTO IMS Type RN).</li>
            <li><strong>Power supply:</strong> 2-канальное UPS Schneider Galaxy 5500 + солнечные панели 5 кВт + батарея LiFePO₄ 50 кВт·ч (автономия 5 сут).</li>
            <li><strong>Data transmission:</strong> VSAT (Inmarsat) основной канал + 4G/LTE резерв, объём 5-10 ГБ/сут, доставка в КНДЦ Курчатов + CTBTO IDC Vienna.</li>
            <li><strong>Climate control:</strong> чиллер 2 кВт на бункер + влажность ≤70%, дренаж грунтовых вод 5 м³/сут.</li>
            <li><strong>Молниезащита:</strong> 4-молниеотвода H=12 м по периметру + контур заземления Rg ≤4 Ω + газоразр. защита OpenGear на каждом сигнальном порту.</li>
            <li><strong>Защита от ущерба:</strong> двойной забор 3 м + СКУД биометрия + CCTV-IP 4K с лицев. распозн., видеоархив 90 дн.</li>
            <li><strong>Лаборатория КНДЦ:</strong> офис 200 м² для сейсмолога 24/7, мониторы Bahn 32" с RTQuake real-time waveform display, дублирующие БД Postgres + IRIS DMC.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Виброизоляция сейсмометра</h2>
          <p className="text-slate-300">
            Сейсмостанция CTBTO IMS уровня в Алматинской обл. Что критично
            для регистрации сейсмических волн дальних землетрясений (P-волна
            амплитуда 1 нм)?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Сейсмометр в обычном здании на 1-м этаже у дороги — норм" },
              { v: "b", t: "Сейсмометр в подвале офисного здания с холодильниками рядом" },
              { v: "c", t: "Сейсмометр на бетонной плите фундамента — без бункера" },
              { v: "d", t: "Подземный гранитный бункер с виброподвесом по IRIS GSN + CTBTO IMS Type I: 1) Глубина бункера 8-15 м от поверхности — ниже зоны микро-вибраций (трафик, ветер, температурные колебания); 2) Фундамент сейсмометра — гранитный пьедестал 1×1×1 м, монолитный с коренным выступом гранита (bedrock outcrop) — не с почвой и не с бетоном; 3) Виброизоляция между пьедесталом и полом бункера — gap 5-10 см заполнен песком или вакуум; 4) Температурная стабильность ±0.5 °C/сут — bunker isolation + чиллер 2 кВт + thermal mass граунт; 5) Влажность ≤70% — иначе конденсат на оптомех. датчиках сейсмометра; 6) Кожух сейсмометра — stainless steel vacuum-sealed (10⁻³ мбар вакуум) для подавления термоконвекции внутри прибора; 7) Расстояние от транспортной инфраструктуры — ≥5 км от шоссе, ≥10 км от ж/д, ≥20 км от аэропорта (трафик-noise); 8) Геология — стабильный гранитный массив (как Талгар Geophysical Station), не зона разломов или вечной мерзлоты; 9) Электромагнитная защита — Faraday cage из медной сетки 2×2 мм для сейсмометра, чтобы выключить EM-наводки на широкополосный фильтр; 10) Установка — level ±1° (компенсируется автоматически Streckeisen leveling motor), азимут точно по геомагнитной оси с поправкой declination; СН РК 2.03-30 + CTBTO IMS Operational Manual + IRIS GSN Site Standards + USGS Open-File Report 88-672" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Глубина бункера</h2>
          <p className="text-slate-300">
            Сейсмостанция в районе предгорий Заилийского Алатау. Поверхность —
            аллювиальные грунты, гранитный фундамент на глубине 7 м. Минимальная
            глубина для виброизоляции сейсмометра по CTBTO + IRIS Standards
            (метров от поверхности до пьедестала сейсмометра):
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="м"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> ~<strong>8 м</strong> (7 м до гранита + 1 м
                заглубление в гранит для прочного сцепления пьедестала с
                коренной породой). Принципиально — бункер должен сидеть НА
                ГРАНИТЕ (bedrock), а не на грунте, иначе аллювий передаёт
                микроколебания от трафика/ветра/температуры. Альтернатива —
                buried borehole vault (как для CTBTO Borovoye 50 м burial).
                IRIS GSN Site Standards + CTBTO IMS Type I.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс станции CTBTO IMS</h2>
          <p className="text-slate-300">
            Сейсмостанция IMS уровня Type I в РК (как Borovoye или Karatau):
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Геоинженерные изыскания + бурение скважин до bedrock (3 шт × 30 м) = 0.15 млрд тг</li>
            <li>Земляные работы + выемка под бункер 8 м (объём 400 м³ × 6 000 тг) = 0.024 млрд тг</li>
            <li>Бункер ж/б подземный 5×5×8 м (200 м² стен + 25 м² плита) + гидроизоляция Bentofix = 0.15 млрд тг</li>
            <li>Гранитный пьедестал монолит. с bedrock 1×1×1 м (вырезается из bedrock + полировка) = 0.018 млрд тг</li>
            <li>Сейсмометр Streckeisen STS-2 широкополосный 360 с (3 компонента) + спарный комплект = 0.06 млрд тг</li>
            <li>Сейсмометр короткопериодный Lennartz 5s + accelerometer Episensor = 0.025 млрд тг</li>
            <li>Digitizer Quanterra Q330 24-bit 100 sps + резервный Centaur Nanometrics = 0.022 млрд тг</li>
            <li>GPS Trimble Acutime 360 + антенна с молниезащитой = 0.012 млрд тг</li>
            <li>Hyper-array — 7 сейсмометров точек в радиусе 1-3 км (для f-k анализа) + кабельная сеть = 0.42 млрд тг</li>
            <li>Инфразвуковой массив (опц.) — 4 микробарометра Martec MB2005 + порт wind-noise + кабели = 0.18 млрд тг</li>
            <li>Магнитометр флюксгейт (опц.) + induction coils в отд. mu-metal capsule = 0.045 млрд тг</li>
            <li>UPS Schneider Galaxy 5500 + солнечные панели 5 кВт + LiFePO₄ 50 кВт·ч = 0.18 млрд тг</li>
            <li>VSAT терминал + 4G/LTE резерв + спутниковые тарифы (3 года) = 0.08 млрд тг</li>
            <li>Молниезащита 4 пика H=12 м + контур заземления Rg≤4 Ω + газоразр. защита = 0.07 млрд тг</li>
            <li>Двойной забор 3 м с АКЛ + СКУД биометрия + CCTV-IP 4K × 12 камер 90-дн архив = 0.18 млрд тг</li>
            <li>Лаборатория наземная 200 м² (офис сейсмолога 24/7, мониторы RTQuake, БД Postgres) = 0.42 млрд тг</li>
            <li>Подъездная дорога асфальт 2 км до станции + ЛЭП 10 кВ или PV-генерация = 0.45 млрд тг</li>
            <li>Чиллер 2 кВт на бункер + дренаж грунтовых вод + влажность = 0.045 млрд тг</li>
            <li>Сертификация CTBTO IMS (тестирование noise level, calibration, документация) + проектирование (5%) + ПИР + НР + СП = 2 млрд тг</li>
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
                <strong>Ответ:</strong> ~4.5 млрд тг (~$9M USD) — стандарт CTBTO
                IMS Type I primary seismic station с hyper-array + инфразвук.
                Главные статьи — hyper-array (7 точек × 60 млн = 420 млн)
                + лаборатория 24/7 + земляные/бункер. Финансирование — КНДЦ
                Курчатов МЭ РК + CTBTO Preparatory Commission Vienna (часть
                грантового бюджета). СН РК 2.03-30 + CTBTO Operational Manual.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Передача данных в IDC</h2>
          <p className="text-slate-300">
            Сейсмостанция CTBTO IMS работает в РК. Что обязательно для статуса
            «Primary IMS Station» по Договору ВЗЯИ + IMS Operational Manual?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только локальная запись данных + ежемесячная отправка USB" },
              { v: "b", t: "Передача только по email раз в сутки (FTP отчёт)" },
              { v: "c", t: "Real-time stream NRT (Near Real-Time) ≤7 минут задержка в IDC Vienna + 99.9% uptime + GPS-UTC ±10 нс: 1) Канал передачи — основной VSAT Inmarsat (Iridium для арктических станций), резервный 4G/LTE, объём 5-10 ГБ/сут (3 каналов BHZ/BHN/BHE по 100 sps × 24-bit); 2) Протокол — SeedLink / mini-SEED стандарт IRIS (стандарт IRIS DMC) или CD-1.1 формат CTBTO; 3) Задержка end-to-end ≤7 минут от регистрации до IDC Vienna (стандарт IMS Type I), реально достижимо 30-60 секунд при VSAT в Ku-band; 4) Uptime ≥99.9% (max 8.7 ч простоя/год, включая обслуживание) — обеспечивается резервированием digitizer/power/coms; 5) GPS-UTC синхронизация — каждый sample timestamp с точностью ±10 нс по UTC (Trimble Acutime 360 на крыше + holdover в clock chip Quanterra при потере GPS до 24 ч); 6) Calibration — еженедельная автокалибровка сейсмометра (step signal от STS-2 cal-coil) + ежегодная PISCES test (CTBTO sends синтет. сигналы для проверки); 7) Quality control — daily noise spectrogram review, monthly state-of-health report, annual on-site inspection CTBTO; 8) Security — все данные подписываются цифровой подписью X.509 на стороне станции, верифицируются IDC; нельзя «подделать» отчёт без compromise приватного ключа сертификата; 9) Архивация — локальная (24-72 ч буфер Quanterra) + IDC long-term (вечное хранение в Vienna Seismic Bulletin); IRIS DMC mirror для научного доступа; 10) Тендерный процесс ICBC — CTBTO IMS станция сертифицируется только после 1-летнего тестового периода с noise survey и interference test; CTBTO IMS Operational Manual + Treaty CTBT 1996 + IRIS GSN Standards" },
              { v: "d", t: "Только при подозрении на ядерный взрыв" },
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
              {score === 4 && "Отлично! Ты знаешь стандарты CTBTO IMS + IRIS GSN."}
              {score === 3 && "Хорошо. Перечитай CTBTO IMS Operational Manual для углубления."}
              {score === 2 && "Уровень C — пересмотри СН РК 2.03-30 + IRIS Site Standards."}
              {score <= 1 && "Нужно повторить. См. USGS Open-File Report 88-672 + IRIS DMC."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>СН РК 2.03-30</strong> — Сейсмостойкое проектирование (региональная микрозонировка)</li>
            <li><strong>CTBT 1996</strong> — Comprehensive Nuclear-Test-Ban Treaty (Договор о всеобщем запрещении ядерных испытаний)</li>
            <li><strong>CTBTO IMS Operational Manual</strong> — для primary seismic stations Type I и auxiliary Type II</li>
            <li><strong>CTBTO PrepCom EIF</strong> — Engineering and Installation Framework (стандарты установки IMS)</li>
            <li><strong>IRIS GSN Site Standards</strong> — Global Seismographic Network site criteria</li>
            <li><strong>IRIS DMC Data Center</strong> — стандарты потока данных (SeedLink, mini-SEED)</li>
            <li><strong>USGS Open-File Report 88-672</strong> — Network Site Survey for Seismic Observatories</li>
            <li><strong>ISC Bulletin (International Seismological Centre)</strong> — мировой каталог землетрясений</li>
            <li><strong>UNESCO IGCP</strong> — International Geoscience Programme</li>
            <li><strong>ITU-R BO.1696</strong> — стандарты VSAT для научных передач</li>
            <li><strong>ISO 9001 + ISO 17025</strong> — менеджмент качества для калибровочной лаборатории</li>
            <li><strong>Закон РК «Об использовании атомной энергии»</strong> — № 442-IV от 12.01.2016</li>
            <li><strong>Постановление РК № 1232 от 24.12.2018</strong> — мониторинг сейсмобезопасности</li>
            <li><strong>FDSN (Federation of Digital Seismograph Networks)</strong> — глоб. стандарты обмена</li>
            <li><strong>ANSS (Advanced National Seismic System) ComCat</strong> — USGS earthquake catalog API</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
