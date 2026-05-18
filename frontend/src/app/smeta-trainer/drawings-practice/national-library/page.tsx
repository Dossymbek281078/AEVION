"use client";
import Link from "next/link";
import { useState } from "react";

export default function NationalLibraryPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 30000) <= 3000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Национальные библиотеки</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">📚 Национальные библиотеки и фондохранилища</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #263. Национальные библиотеки РК: Национальная Академическая
            Библиотека (НАБ РК) Астана (50 000 м², 1.5 млн томов, открыта 2004,
            архитектор Norman Foster), Национальная Библиотека РК Алматы (1.2 млн
            томов, основана 1931), Республиканская научно-техническая библиотека.
            Фондохранилища с РГС O₂=2-3%/N₂=97% (защита от пожаров и насекомых),
            климат +18°C ±1°C / RH 50% ±5%, цифровизация Marc21 + Z39.50, RFID UHF
            860-960 МГц для учёта. ISO 11799 «Архивохранилища», IFLA Library
            Building Guidelines, СН РК 3.02-115.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав национальной библиотеки</h2>
          <p className="text-slate-300 leading-relaxed">
            IFLA Library Building Guidelines + ISO 11799:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Главное хранилище (Closed Stack):</strong> 60% общей площади, многоярусные полки шириной 25-30 см, шаг 1.2-1.6 м, движение мобильных стеллажей Bruynzeel/Forster электр. компактные.</li>
            <li><strong>Читальные залы (Reading Rooms):</strong> общий 200-500 мест + специализированные (рукописи, периодика, картография, искусствоведение) + индивидуальные кабины Carrels.</li>
            <li><strong>Хранилище редких книг и рукописей:</strong> специальная защищ. зона с двойной СКУД + климат +18°C/RH 50%/O₂=3% (РГС защита от пожара), бронированная дверь.</li>
            <li><strong>Каталогизация и обработка:</strong> отделы Marc21 + RDA cataloguing, оцифровка (планетарные сканеры Atiz BookEye 5 для книг + i2S DigiBook 10000 для прессы).</li>
            <li><strong>Цифровой архив:</strong> серверная для электр. версий, RAID-12 50+ ПБ суммарной ёмкости с Backup в географ. распределённую копию.</li>
            <li><strong>Реставрационная мастерская:</strong> для повреждённых томов, отдельная зона с фумигационной камерой (борьба с насекомыми).</li>
            <li><strong>Зал заседаний и конференц-залы:</strong> 200-500 мест для научных конференций.</li>
            <li><strong>Экспозиционные залы:</strong> для постоянных и временных выставок ценных артефактов (как в музее).</li>
            <li><strong>Помещения для пользователей:</strong> вестибюль, гардероб, кафе, магазин репродукций, информац. бюро.</li>
            <li><strong>Технические:</strong> компактное хранилище (Compact Shelving) на цокольном этаже, котельная мини, узел связи, серверы.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Хранилище 1.5 млн томов</h2>
          <p className="text-slate-300">
            Книгохранилище 1.5 млн томов с долгосрочной перспективой. Какая защита
            и климат по ISO 11799 + IFLA?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Обычные полки в обычном помещении +20°C/RH 65%" },
              { v: "b", t: "Только увеличить кратность воздухообмена" },
              { v: "c", t: "Климат +18°C/RH 50% без РГС" },
              { v: "d", t: "Архивохранилище ISO 11799 Level III: 1) Климат-контроль постоянный +18°C ±1°C, RH 50% ±5%, скорость изменений ≤1°C/24 ч и ≤3%/24 ч (стабильность критична — резкие перепады разрушают бумагу/переплёт); 2) Освещение в хранилище ≤50 лк (только когда нужно для забора), УФ-фильтрация светильников (UV≤75 мкВт/лм), желательно полная темнота с автоматич. датчиками присутствия; 3) Многослойная защита: HEPA F9 фильтрация воздуха (PM2.5≤25 мкг/м³) + активир. уголь для SO₂/NOx/O₃ (≤1 мкг/м³ каждого, защита от газовых поллютантов); 4) Регулируемая газовая среда РГС O₂=2-3% / N₂=97% (низкокислородная среда защищает от пожаров и насекомых одновременно) — генератор N₂ Atlas Copco PSA; 5) Запрет выпуска людей в зону РГС без SCBA Self-Contained Breathing Apparatus; 6) Газовое пожаротушение Inergen IG-541 (резервная защита если кислород повышается); 7) Контроль вредителей Integrated Pest Management — мониторинг ловушками 1 раз/мес + фумигация при необходимости; 8) Мобильные стеллажи Bruynzeel или Forster Compactus (compact storage увеличивает плотность хранения в 2 раза); 9) Полки нерж. сталь или anti-acid металл (без выделения вредных газов); 10) Для редких рукописей — отдельные конверты в Архивных Картонах кислотонейтральных pH 7-8.5 (acid-free); 11) Регулярный микробиологический контроль (грибки, бактерии); 12) Перепроверка состояния фонда каждые 5-10 лет с реставрацией повреждённых единиц; ISO 11799 + IFLA Library Building Guidelines + ICOM-CC Paper Working Group" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь хранилища</h2>
          <p className="text-slate-300">
            1.5 млн томов. Норматив IFLA: 200 томов/м² при compact storage (Bruynzeel
            мобильные стеллажи) или 80 томов/м² при стационарных полках.
            При смешанной системе 70% compact + 30% стационар. Какая площадь
            хранилища (м²)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S_compact = 1.5M × 70% / 200 = 5250 м²<br />
            S_open = 1.5M × 30% / 80 = 5625 м²<br />
            S_общ = + 50% для проходов + 20% технических
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="S_хранилище, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 5250 + 5625 = 10 875 м² полезного, + 50% проходы и сервис = 16 312 м² + 20% технические зоны (вентиляция, серверы) = 19 575 м² хранилищ. С учётом необходимых читальных залов (5000 м²), реставрационн. (500 м²), оцифровки (300 м²), офисов (1500 м²), общих зон + лобби (3000 м²) — общая площадь нац. библиотеки на 1.5 млн томов ~30 000 м².</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет нац. библиотеки</h2>
          <p className="text-slate-300">
            Национальная библиотека 30 000 м², хранилище 1.5 млн томов. ССЦ + импорт:
            монолит каркас + перекрытия 30 000 м² 5-этажн. с подвалом — 8.4 млрд тг,
            фасад премиум (натур. камень + витражи + крыша атриум) — 4.2 млрд тг,
            отделка читальных залов + интерьер по проекту арх. — 6.8 млрд тг,
            мобильные стеллажи Bruynzeel Compactus 7000 м² хранилищ — 3.2 млрд тг,
            стационарные стеллажи anti-acid 4000 м² — 0.4 млрд тг,
            планетарные сканеры Atiz BookEye 5 × 4 + i2S DigiBook 10000 × 2 — 0.6 млрд тг,
            серверная с RAID и Backup 50+ ПБ для цифрового архива — 1.4 млрд тг,
            HVAC прецизионный (контроль ±1°C/±5%) с HEPA F9 + актив. уголь — 3.6 млрд тг,
            РГС-генератор N₂ Atlas Copco PSA + газо-пожаротушение Inergen — 1.8 млрд тг,
            СОУЭ + СОТ + СКУД биометрический + противокражная RFID UHF — 1.4 млрд тг,
            АВ-инфра + интерактивная экспозиция артефактов — 0.8 млрд тг,
            реставрационная мастерская + фумигац. камера + лаборат. — 0.6 млрд тг,
            конференц-зал 500 мест + 4 кабинета для семинаров — 1.6 млрд тг,
            благоустройство + парковка 300 м/мест + ландшафт — 1.4 млрд тг,
            проектирование + изыскания + лицензии Минкультуры РК — 1.8 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~38 млрд тг (допуск ±10%). 8.4+4.2+6.8+3.2+0.4+0.6+1.4+3.6+1.8+1.4+0.8+0.6+1.6+1.4+1.8 = 38 млрд тг. Удельная стоимость ~1.27 млн тг/м² — премиум-культурный объект. НАБ РК Астана (50 000 м², 2004, Foster) — оценочно ~$100 млн = 46 млрд тг (с учётом инфляции 2026).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — RFID-учёт и противокражная</h2>
          <p className="text-slate-300">
            Большие библиотеки теряют до 1-2% фонда в год от краж и неучтённых возвратов.
            Что обязательно по IFLA + ANSI/NISO Z39.83?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только сотрудники на выходе" },
              { v: "b", t: "Видеонаблюдение и обыск сумок на выходе" },
              { v: "c", t: "RFID UHF Library Management System по IFLA RFID Working Group + ANSI/NISO Z39.83: 1) RFID-метки UHF 860-960 МГц (Tagsys ARIO 600 series) на каждый том, размещены в обложке/корешке, чтение на расстоянии до 1 м; 2) ISO 28560 LIB-RFID стандарт данных на тэге: barcode, ISIL, owner code, status (in-library/checked out/lost); 3) Self-checkout машины Bibliotheca Quickconnect / mk Solution Library Manager — пользователь сам сканирует свой читат. билет (RFID) + книги, выдача без участия библиотекаря; 4) Self-return машины с сортировкой по полкам (24/7 даже после закрытия); 5) Theft Detection Gate на выходе — пара антенн EM EAS-1 (Bibliotheca) обнаруживает любую неактивированную метку (книга не выдана); 6) Inventory machine Bibliotheca SmartShelf для быстрого подсчёта книг на полке (минуты vs часы вручную); 7) AutoSorter для возвращённых книг — сортировка по разделам и полкам; 8) Интеграция с LMS Aleph/Sierra Library Services Platform для онлайн-каталога; 9) Z39.50 / SRU/SRW для cross-library поиска (международная база OCLC WorldCat); 10) Marc21 + RDA cataloguing для метаданных; 11) Бесплатная аутентификация читателя через биометрию или приложение библиотеки; 12) Антикражные кодеры активирующие/деактивирующие метку при выдаче/возврате; ANSI/NISO Z39.83 + IFLA RFID Working Group + ISO 28560 LIB-RFID" },
              { v: "d", t: "Только магнитная полоса на обложке + датчик на выходе" },
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
                {score === 4 ? "Отлично — готовы к проектированию нац. библиотеки" : score >= 2 ? "Перечитайте ISO 11799 + IFLA + ANSI/NISO Z39.83" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> ISO 11799 (Архивохранилища), IFLA Library Building Guidelines, ICOM-CC Paper Working Group, ANSI/NISO Z39.83 (Library Standards), ISO 28560 LIB-RFID, СН РК 3.02-115, СанПиН РК 4.01-007.</p>
          <p><strong>Реальные объекты РК:</strong> НАБ РК Астана (50 000 м², Foster, 2004, 1.5 млн томов), Национальная Библиотека РК Алматы (с 1931, 1.2 млн томов), Республиканская научно-техническая Алматы, Президентская Библиотека Астана.</p>
        </section>
      </main>
    </div>
  );
}
