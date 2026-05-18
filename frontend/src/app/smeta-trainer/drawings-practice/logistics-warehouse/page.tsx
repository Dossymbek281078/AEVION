"use client";
import Link from "next/link";
import { useState } from "react";

export default function LogisticsWarehousePage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 56000) <= 5000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 48_000_000_000) <= 4_500_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Логистические склады класса А</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">📦 Логистические склады класса А</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #240. Логистические комплексы РК: DAMU Logistics Hub Хоргос (МЦПС
            «Хоргос-Восточные Ворота», 130 000 м² на 2026 г.), Алматинский Логистический
            Парк, СЭЗ «Қазақстан-Транзит» Шымкент, Astana Logistics Park. Класс А
            (FEDIA международная классификация): высота 9-12 м чистая ВРС, нагрузка
            на пол 5-8 т/м², стеллажи Jungheinrich + AS/RS Dematic Multishuttle,
            ВРС 9 м, температурные зоны +5°C/+18°C/-20°C для cold chain. СНиП 31-04,
            FEM 9.831 (Storage Racks), IBC 2024 High-Rise.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Классификация складов FEDIA</h2>
          <p className="text-slate-300 leading-relaxed">
            FEDIA International Federation of Logistics Real Estate:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Класс A+ (Premium):</strong> ≥30 000 м² моноблок, ВРС 12-14 м, нагрузка ≥6 т/м², ESFR спринклер, температ. зоны, ж/д подъезд, BREEAM/LEED Gold.</li>
            <li><strong>Класс A:</strong> 10 000-30 000 м², ВРС 9-12 м, нагрузка 5-6 т/м², ESFR спринклер, докшелтеры с уровневыдвижными мостками, IT-инфра.</li>
            <li><strong>Класс B:</strong> ВРС 6-9 м, нагрузка 3-5 т/м², без ESFR (обычный спринклер), без cold chain.</li>
            <li><strong>Класс C/D:</strong> &lt;6 м, ангары, СтройДОН-стандарт.</li>
            <li>Конструктив: ж/б каркас с шагом колонн 24×12 м (или 30×24 м для премиум), бесколонные пролёты 60 м для AS/RS.</li>
            <li>Полы — индустриальные топпинговые Cemfast Mecanical Sika 200 мм с упрочнённым верхним слоем (стеклянная фибра, корунд, металл) F600 истираемость.</li>
            <li>Кровля сэндвич-панели Kingspan Topspan с теплоизол. PIR 100-150 мм (U=0.18 Вт/м²·К).</li>
            <li>Докшелтеры (Dock Levelers) Hörmann HLS6 с пневмо-уплотн. + откидные мостки 6-9 т грузопод.</li>
            <li>Спринклер ESFR (Early Suppression Fast Response) с расходом 1500-2400 л/мин, давление 5-8 бар.</li>
            <li>Стеллажи Jungheinrich PRO или Dematic Selective Pallet Rack (4-5 ярусов до 11 м).</li>
            <li>AS/RS Dematic Multishuttle или Mecalux Schaefer Logistics — автоматизированные.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Конструктив склада А+ 100 000 м²</h2>
          <p className="text-slate-300">
            Логистический хаб Хоргос-DAMU 100 000 м² моноблок для контейнерного
            транзита TITR. Какое конструктивное решение?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Кирпичные стены + дерев. перекрытия — традиционно дёшево" },
              { v: "b", t: "Каркас металлический ферменный с шагом 6×6 м" },
              { v: "c", t: "Ж/б каркас сборный 12×6 м колонны + балки KBE — стандарт 80-х" },
              { v: "d", t: "Премиум А+ конструктив: 1) Ж/б каркас монолит с шагом колонн 24×12 м (или 30×24 м для AS/RS зон), колонны Ø500 мм бетон C40 высота 12 м (ВРС чистая 11 м с учётом стропил), увеличение пролётов уменьшает кол-во колонн = +15% полезной площади под стеллажи; 2) Балки перекрытия преднапряж. предв. напр. ж/б ПК-30 высотой 1.5 м (для пролёта 24 м с нагрузкой кровли + спринклер водяные коллекторы 200 кг/м); 3) Покрытие стропильные стальные фермы Astron Building Systems или сэндвич-конструкция, кровля Kingspan Topspan PIR 150 мм (U=0.15 Вт/м²·К, защита от перегрева летом); 4) Полы — топпинг Cemfast/Sika Mecanical 200 мм армир. сеткой A-III + упрочняющий слой Sika MasterTop 1330 (корунд+металл, истираемость F600 по ASTM C779), ровность ±2 мм/3 м (для AS/RS требование), плоскостность IF-100 по ACI 117; 5) Дилатации поля 6×6 м для предотвращения трещин при +35/-25°C; 6) Стены — сэндвич Kingspan 100 мм PIR + металл. лист SP25 (защита от ветра и теплоизоляция); 7) Стеллажи Jungheinrich PRO 11 м с 4 ярусами по 2.5 м + усиленные узлы (нагрузка на ячейку 1.5-2.5 т); 8) Сертификация LEED/BREEAM Gold (тепло-/энергоэффективность); FEM 9.831 + СНиП 31-04 + ACI 360R (Floors)" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во палетомест</h2>
          <p className="text-slate-300">
            Склад 100 000 м² моноблок. Из них 70% хранение (70 000 м²), 20% transit
            (приём/отгрузка), 10% упаковка/обработка. Стеллаж Selective Pallet Rack
            4 яруса × 0.8 м × 1.2 м (ячейка 800×1200×1100 мм палета EUR Quattro).
            Ширина проезда 3.2 м для штабелёра Linde V-Compact.
            Сколько палетомест?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Эффективность площади ~50% (50% занимают стеллажи, 50% проезды/проходы)<br />
            Шаг между стеллажами 1.2 м (палета поперёк); +3.2 м проезд<br />
            Плотность: 1 палетоместо на 1.8 м² × 4 яруса = 4 палетоместа на 1.8 м² = 2.2 п.м./м²
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во палетомест"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 70 000 м² × 0.4 (полезная под стеллажи с учётом проездов) × 2 (палет в ширину) × 4 (яруса) ≈ 224 000 п.м. Но это идеализир. С учётом узлов сопряжения, рамп, погрузочных зон — фактич. ~56 000 палетомест (как в Хоргос-DAMU). Удельная плотность ~0.56 п.м./м².</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет 100 000 м²</h2>
          <p className="text-slate-300">
            ССЦ + импорт: каркас + перекрытия 100 000 м² ж/б B40 ВРС 12 м с фермами Astron — 14 млрд тг,
            стены сэндвич Kingspan 100 мм PIR на металлокаркасе — 4.2 млрд тг,
            кровля Kingspan Topspan 150 мм + светопроницаемые ленты 8% площади — 6.4 млрд тг,
            полы топпинг Sika Mecanical 200 мм с упрочнением (поверхностная отделка) — 4.8 млрд тг,
            стеллажи Jungheinrich PRO ~56 000 палетомест — 2.8 млрд тг,
            48 докшелтеров Hörmann HLS6 + откидные мостки 6 т — 1.4 млрд тг,
            48 рулонных ворот Hörmann SPU40 + 6 разгрузочных ворот для крупногабаритной техники — 0.6 млрд тг,
            спринклер ESFR + насосная станция + резервуар 600 м³ — 3.2 млрд тг,
            HVAC (отопление инфракрасное Schwank + вентиляция бесшумовая) — 2.4 млрд тг,
            СКУД + СОТ + WMS Manhattan/SAP EWM + RFID-метки — 1.8 млрд тг,
            энергоснабжение ТП 2×1600 кВА + резерв ДГУ 1000 кВт + UPS — 1.6 млрд тг,
            ж/д подъездная с пандусами 6 ж/д ворот + 4 ж/д тупика — 2.2 млрд тг,
            офисный 3-эт. блок 3000 м² + лаборатория качества + столовая — 1.4 млрд тг,
            благоустройство + парковка 800 м/мест + ограждение — 1.2 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~48 млрд тг (допуск ±10%). 14+4.2+6.4+4.8+2.8+1.4+0.6+3.2+2.4+1.8+1.6+2.2+1.4+1.2 = 48 млрд тг. Удельная стоимость ~480 тыс. тг/м² ≈ $1050/м² — соответствует мировым проектам класса А+ (Prologis, GLP, Goodman).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — ESFR-спринклер</h2>
          <p className="text-slate-300">
            Склад класса А с горючими товарами (пластик, бумага, текстиль на палетах
            высотой 11 м). Обычный спринклер не справится — пожар скрытно растёт
            на верхних ярусах. Какое решение по NFPA 13 / NFPA 230?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Газовое пожаротушение N₂ — экологически чисто, но дорого" },
              { v: "b", t: "Пенное пожаротушение AFFF — эффективно для нефти, но не для пластика" },
              { v: "c", t: "Early Suppression Fast Response ESFR-спринклер: 1) Спринклерные головки ESFR K=22.4-25.2 (расход 600-800 л/мин при 5 бар, в 2× больше обычного К=11.2), активация при +68/74°C (1 спринклер ELO Quick Response); 2) Расход системы — расчёт по NFPA 13 на «12 спринклеров одновременно» (worst case = 9600 л/мин при 6 бар) при минимально-расчётной площади 90 м²; 3) Насосная — главный насос 12 000 л/мин Grundfos + резерв 2-ой + жокей-насос для поддержания давления; 4) Резервуар воды 600-1000 м³ с automatic refill из городского водопровода + аварийный приём из пожарных гидрантов; 5) Распределение труб: магистраль Ø200-300 мм + распределит. Ø100-150 мм + спринклер на каждые 9 м² потолка; 6) ESFR-спринклер устанавливается на потолке (нет «in-rack» — оптимально для grocery/3PL); 7) Air-Aspirating Smoke Detection VESDA Aspiration на ранней стадии (10× быстрее обычных датчиков); 8) Совместимость с СОУЭ 5-го типа речевым оповещением; 9) Заводская установка с пуском Engineered Design FM Global или UL Approved; 10) Сертификация FM Global Loss Prevention Data Sheet 8-9 + NFPA 13 + NFPA 230 + СН РК 2.02-15" },
              { v: "d", t: "Двойное обычное спринклерное покрытие — потолочное + в-стеллажное" },
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
                {score === 4 ? "Отлично — готовы к проектированию склада класса А+" : score >= 2 ? "Перечитайте FEM 9.831 + NFPA 13/230 + СНиП 31-04" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СНиП 31-04 (Складские здания), FEM 9.831 (Storage Racks), NFPA 13 (Sprinklers) + NFPA 230 (Storage), IBC 2024, FM Global LPDS 8-9, ACI 360R (Floors), BREEAM/LEED.</p>
          <p><strong>Реальные объекты РК:</strong> DAMU Logistics Hub Хоргос (130 000 м² на 2026), Алматинский Логистический Парк, СЭЗ «Қазақстан-Транзит» Шымкент, Astana Logistics Park, Wildberries/Ozon склады РК.</p>
        </section>
      </main>
    </div>
  );
}
