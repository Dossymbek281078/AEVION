"use client";

import Link from "next/link";
import { useState } from "react";

export default function ShefmontazhPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);
  const [ex3, setEx3] = useState("");
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);
  const [ex4, setEx4] = useState<string | null>(null);
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "c" ? "ok" : "bad");
  const checkEx3 = () => {
    // 200 млн тг оборудование × 4% шефмонтаж = 8 млн тг
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 8_000_000) <= 500_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const diffs = [
    { aspect: "Кто выполняет", pnr: "Пуско-наладочная организация (специализированная)", shef: "Специалист завода-изготовителя (эксперт по данному оборудованию)" },
    { aspect: "Цель", pnr: "Ввести систему в работу, настроить режимы", shef: "Обеспечить правильность монтажа по требованиям завода, консультация" },
    { aspect: "Ответственность", pnr: "За работоспособность системы", shef: "За соответствие монтажа требованиям ТУ завода, сохранение гарантии" },
    { aspect: "Без их участия", pnr: "Система не вводится в эксплуатацию", shef: "Гарантия завода аннулируется" },
    { aspect: "Стоимость", pnr: "5-25% от стоимости оборудования", shef: "2-5% от стоимости оборудования + командировочные" },
    { aspect: "Когда?", pnr: "После монтажа, перед вводом", shef: "Во время монтажа и первых запусков" },
    { aspect: "Документ", pnr: "Акт ПНР + протоколы испытаний", shef: "Заключение (протокол) шеф-инженера" },
    { aspect: "Нормативная база", pnr: "ЭСН Сб. 4, СНиП 3.05", shef: "Договор с заводом-изготовителем + ТУ" },
  ];

  const examples = [
    { equip: "Лифтовое оборудование OTIS/Schindler", shef: "Инженер завода контролирует монтаж направляющих, противовеса, электросхемы", cost: "3-5% от стоимости лифта" },
    { equip: "Котлы BUDERUS/VIESSMANN", shef: "Технический инженер присутствует при первом розжиге, настройке горелки", cost: "2-4% от стоимости котла" },
    { equip: "Холодильные машины CARRIER/TRANE", shef: "Заводской инженер контролирует заправку фреоном, балансировку", cost: "3-5% от стоимости чиллера" },
    { equip: "Трансформаторы SIEMENS/ABB", shef: "Электромонтёр завода проверяет схему защит, коэффициент трансформации", cost: "1-3% от стоимости" },
    { equip: "Газовые турбины GE/Siemens Energy", shef: "Целая бригада завода (5-15 специалистов) живёт на объекте месяцами", cost: "5-10% от стоимости турбины" },
    { equip: "Медицинское оборудование MRI/CT (Philips/GE)", shef: "Обязателен — без инженера завода гарантия аннулируется сразу", cost: "5-8% от стоимости" },
    { equip: "Насосные агрегаты KSB/Grundfos крупные", shef: "Центровка по методике завода, первый пуск под наблюдением", cost: "2-4% от стоимости" },
    { equip: "АСУ ТП / ПЛК Siemens/Schneider", shef: "Программист завода проверяет корректность конфигурации, обучение", cost: "8-15% от стоимости АСУТП" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Шефмонтаж</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🔩 Шефмонтаж и шефналадка</h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-lime-300">Шефмонтаж</strong> — это надзор специалиста завода-изготовителя за монтажом и первыми пусками его оборудования. Без шефмонтажа на сложном оборудовании завод аннулирует гарантию. Шефмонтаж ≠ ПНР: ПНР — наладчики вводят систему в работу, шефмонтаж — завод контролирует правильность монтажа. В смете шефмонтаж выделяется отдельной строкой: <strong>2-10% от стоимости оборудования</strong>.
          </p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Стоимость</div>
              <div className="text-slate-300">2-10% от стоимости оборудования</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Кто выполняет</div>
              <div className="text-slate-300">Специалист завода-изготовителя</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Без него</div>
              <div className="text-slate-300">Гарантия завода аннулируется</div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">🆚 Section 1. Шефмонтаж vs ПНР — 8 отличий</h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-40">Параметр</th>
                  <th className="text-left px-4 py-3">ПНР</th>
                  <th className="text-left px-4 py-3">Шефмонтаж</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {diffs.map((d) => (
                  <tr key={d.aspect} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 text-xs font-medium">{d.aspect}</td>
                    <td className="px-4 py-3 text-yellow-300 text-xs">{d.pnr}</td>
                    <td className="px-4 py-3 text-lime-300 text-xs">{d.shef}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">🔧 Section 2. Примеры шефмонтажа по видам оборудования</h2>
          <div className="space-y-3">
            {examples.map((e) => (
              <div key={e.equip} className="border border-lime-800/40 bg-lime-950/20 rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-4 mb-1">
                  <h3 className="text-base font-semibold text-lime-300">{e.equip}</h3>
                  <span className="text-xs text-emerald-300 italic shrink-0">{e.cost}</span>
                </div>
                <p className="text-sm text-slate-300">{e.shef}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 3. Упражнения</h2>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Упражнение 1 / 4 — Почему шефмонтаж важен</div>
            <div className="text-slate-200 mb-4">Заказчик решил не включать шефмонтаж в бюджет для экономии. Что произойдёт при монтаже котла VIESSMANN без шеф-инженера?</div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Ничего — монтажники и так знают как монтировать" },
                { v: "b", t: "Гарантия завода аннулируется. Любая поломка котла — ремонт за счёт заказчика (не завода). Монтажники могут допустить ошибку согласно специфическим ТУ этого котла" },
                { v: "c", t: "Только небольшие сложности" },
                { v: "d", t: "Завод заплатит штраф" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex1 === opt.v ? "border-lime-600 bg-lime-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-lime-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-lime-600 hover:bg-lime-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol(v => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex1Sol ? "Скрыть" : "Показать решение"}</button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-lime-300">Решение:</strong> В договорах поставки крупного оборудования заводы фиксируют: «Гарантия действует при условии монтажа под надзором шеф-инженера завода». Шеф-монтаж стоит 2-4% от котла (200-400 тыс. тг). Котёл стоит 5-15 млн тг. Первая поломка без гарантии — 500 тыс. - 2 млн тг. Шефмонтаж окупается при первом же гарантийном случае.
              </div>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Упражнение 2 / 4 — Иностранные специалисты</div>
            <div className="text-slate-200 mb-4">Шеф-инженер из Германии приедет на 2 недели для шефмонтажа газовой турбины. Что нужно включить в смету?</div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Только оклад шеф-инженера" },
                { v: "b", t: "Только авиабилеты" },
                { v: "c", t: "Полный пакет: оклад по ставке завода (200-500 $/день) + командировочные + авиабилеты + виза РК + проживание + питание + перевод + страховка. На 2 недели ~3-8 млн тг" },
                { v: "d", t: "Заказчик платит отдельно, не в смете" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex2 === opt.v ? "border-lime-600 bg-lime-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-lime-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-lime-600 hover:bg-lime-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol(v => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex2Sol ? "Скрыть" : "Показать решение"}</button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — полный пакет</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-lime-300">Решение:</strong> Для иностранных шеф-специалистов в смете учитывается: ставка (200-500 $/день) × 14 дней = 2800-7000 $ + авиабилеты (500-2000 $) + визовые сборы + проживание 4-5-звёзд + питание + переводчик (6-10 тыс. тг/день). Итого 2 недели иностранного шефмонтажа: 3-8 млн тг. Это регулярно не закладывают в смету на начальных стадиях, что потом приводит к удорожанию.
              </div>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Упражнение 3 / 4 — Расчёт стоимости</div>
            <div className="text-slate-200 mb-4">
              Стоимость оборудования — <strong>200 000 000 тг</strong>. Шефмонтаж — <strong>4%</strong> от стоимости. Сколько?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Стоимость шефмонтажа, тг</span>
              <input value={ex3} onChange={e => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="8000000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-lime-600 hover:bg-lime-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol(v => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex3Sol ? "Скрыть" : "Показать решение"}</button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 8 млн тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-lime-300">Решение:</strong> 200 000 000 × 4% = 8 000 000 тг. В ССР шефмонтаж размещается в Главе 2 «Основные объекты строительства» или Главе 5 «Прочие» — зависит от соглашения с заказчиком. НР и СП на шефмонтаж не начисляются (это услуги завода, не СМР).
              </div>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Упражнение 4 / 4 — Когда шефмонтаж не нужен</div>
            <div className="text-slate-200 mb-4">В каком случае шефмонтаж не требуется по условиям контракта на поставку?</div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Для всего иностранного оборудования он обязателен" },
                { v: "b", t: "Только для дорогого оборудования (&gt; 10 млн $)" },
                { v: "c", t: "Никогда — всегда нужен" },
                { v: "d", t: "Для типового серийного оборудования с простым монтажом (насосы &lt; 50 кВт, вентиляторы, бытовые котлы), где завод в договоре не ставит условие шефмонтажа для гарантии. Нужно внимательно читать договор поставки" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex4 === opt.v ? "border-lime-600 bg-lime-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-lime-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-lime-600 hover:bg-lime-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol(v => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex4Sol ? "Скрыть" : "Показать решение"}</button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — читать договор поставки</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-lime-300">Решение:</strong> Нет универсального правила — всё определяет договор поставки. Простые насосы серии Grundfos CM, бытовые котлы &lt; 100 кВт — обычно без шефмонтажа, монтаж по инструкции. Сложные: газовые турбины, промышленные чиллеры, МРТ, АСУТП — шефмонтаж обязателен по контракту. Сметчик должен изучить договоры поставки ВСЕГО оборудования и выявить, где требуется шефмонтаж. Это входит в обязанности при разработке сметы по Гл. 2/5 ССР.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">Договоры поставки оборудования (контрактные условия гарантии). СН РК 8.02-05 (ССР). ГК РК ст. 723 (Гарантия работ и оборудования). Нормы командировочных расходов — НК РК + внутренние положения компании.</div>
      </main>
    </div>
  );
}
