"use client";
import Link from "next/link";
import { useState } from "react";

// ── Хелпер числового ответа с допуском ────────────────────────────────────────
function checkNum(input: string, expected: number, tol = 0.05): boolean {
  const v = parseFloat(input.replace(",", ".").replace(/\s/g, ""));
  if (isNaN(v)) return false;
  return Math.abs((v - expected) / expected) <= tol;
}

// ── Раздел 2: Декоративные покрытия ──────────────────────────────────────────
type CoatingRow = {
  name: string;
  desc: string;
  surface: string;
  price: string;
  note: string;
};

const COATINGS: CoatingRow[] = [
  {
    name: "Микроцемент",
    desc: "Тонкослойное покрытие на цементной основе с полимерными добавками. Толщина 2–5 мм.",
    surface: "Полы, стены, ванны, раковины — без швов. Waterproof после пропитки.",
    price: "6 000–12 000 тг/м² (работа)",
    note: "Нанесение 3–5 слоёв + финишная пропитка воском или полиуретаном",
  },
  {
    name: "Бетонный лофт (бетон-эффект)",
    desc: "Декоративная штукатурка с эффектом необработанного бетона. Имитирует промышленный интерьер.",
    surface: "Стены, потолки. Не подходит для пола без специального упрочнителя.",
    price: "4 000–8 000 тг/м² (работа)",
    note: "Популярен в офисах, ресторанах, стиль Loft/Industrial",
  },
  {
    name: "Жидкие обои",
    desc: "Целлюлозное волокно + добавки. Наносится валиком или шпателем, скрывает мелкие трещины.",
    surface: "Только стены и потолки в сухих помещениях. Не влагостойкие.",
    price: "800–2 000 тг/м² (работа)",
    note: "Легко восстановить: смочить и растушевать заплатку. Не рекомендуется в детских комнатах без сертификата",
  },
  {
    name: "Декоративная краска (перламутр, металлик)",
    desc: "Акриловые/алкидные краски с эффектом металла, перламутра, песка. 2–3 слоя.",
    surface: "Стены, потолки, элементы декора. Некоторые составы для фасадов.",
    price: "1 500–4 000 тг/м² (работа)",
    note: "Оптически расширяет или сужает пространство в зависимости от цвета",
  },
  {
    name: "Патина",
    desc: "Эффект состаренного металла или дерева. Наносится воском, лаком с пигментом на базовый слой.",
    surface: "Декоративные элементы, мебель, рамы, лепнина, колонны.",
    price: "3 000–8 000 тг/м² (работа)",
    note: "Обычно применяется в комплексе с позолотой или лепниной",
  },
];

// ── Страница ──────────────────────────────────────────────────────────────────
export default function SpecialFinishesPage() {
  // Упр. 1 — multiple choice: венецианская штукатурка
  const [a1, setA1] = useState<string | null>(null);
  const [r1, setR1] = useState<boolean | null>(null);
  const [s1, setS1] = useState(false);

  // Упр. 2 — multiple choice: микроцемент
  const [a2, setA2] = useState<string | null>(null);
  const [r2, setR2] = useState<boolean | null>(null);
  const [s2, setS2] = useState(false);

  // Упр. 3 — числовое: роспись 30 × 80 000 = 2 400 000
  const [a3, setA3] = useState("");
  const [r3, setR3] = useState<boolean | null>(null);
  const [s3, setS3] = useState(false);

  // Упр. 4 — multiple choice: сусальное золото
  const [a4, setA4] = useState<string | null>(null);
  const [r4, setR4] = useState<boolean | null>(null);
  const [s4, setS4] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-amber-400 hover:text-amber-300"
          >
            &larr; К разделам
          </Link>
          <span className="text-xs text-slate-500">AEVION Smeta Trainer · Специальные виды отделки</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-10">
        {/* Title */}
        <section>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
            ✨ Специальные виды отделки
          </h1>
          <p className="mt-3 text-slate-400 max-w-3xl">
            Венецианская штукатурка, декоративные покрытия, позолота, художественная роспись, резьба.
            Премиальные отделочные технологии с расценками для сметных расчётов РК.
          </p>
          <div className="mt-4 grid md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-500">Нормативы ЭСН</div>
              <div className="text-sm text-slate-200 mt-1">Сб.15 — малярные и отделочные работы</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-500">Применение</div>
              <div className="text-sm text-slate-200 mt-1">Ресторанны, отели, культурные объекты, VIP-интерьеры</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-xs text-slate-500">Диапазон цен</div>
              <div className="text-sm text-slate-200 mt-1">1 500 — 200 000+ тг/м² (зависит от техники)</div>
            </div>
          </div>
        </section>

        {/* Раздел 1: Венецианская штукатурка */}
        <section>
          <h2 className="text-2xl font-bold text-amber-300 mb-4">
            Раздел 1. Венецианская штукатурка
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-900/50 bg-gradient-to-br from-amber-950/30 to-yellow-950/20 p-5">
              <h3 className="text-base font-bold text-amber-200 mb-3">Что это такое</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Декоративная штукатурка на основе мраморной пыли, извести и натуральных пигментов.
                Имитирует полированный мрамор или тёсаный камень. Техника пришла из Венеции XVI века.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">&bull;</span>
                  <span>Наносится <b className="text-slate-200">8–12 слоёв</b> с просушкой каждого</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">&bull;</span>
                  <span>Финишная полировка стальной лопаткой — создаёт эффект мрамора</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">&bull;</span>
                  <span>Требует идеально ровное основание (не более 2 мм на 2 м)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">&bull;</span>
                  <span>Срок работ: 1 м² — 3–5 часов мастера высшей квалификации</span>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-amber-900/50 bg-slate-900/40 p-5">
              <h3 className="text-base font-bold text-amber-200 mb-3">Стоимость и расценки</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-sm text-slate-400">Материал (готовая смесь)</span>
                  <span className="text-sm font-mono text-amber-300">1 500–4 000 тг/м²</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-sm text-slate-400">Работа (мастер-штукатур)</span>
                  <span className="text-sm font-mono text-amber-300">3 500–11 000 тг/м²</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-sm text-slate-400">Итого под ключ</span>
                  <span className="text-base font-mono font-bold text-amber-200">5 000–15 000 тг/м²</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Сравнение: реальный мрамор</span>
                  <span className="text-sm font-mono text-slate-500">от 18 000 тг/м²</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500 italic">
                Венецианская штукатурка при правильном нанесении неотличима от мрамора, но в 2–4 раза
                дешевле натурального камня.
              </p>
            </div>
          </div>
        </section>

        {/* Раздел 2: Декоративные покрытия */}
        <section>
          <h2 className="text-2xl font-bold text-amber-300 mb-4">
            Раздел 2. Декоративные покрытия — 5 видов
          </h2>
          <div className="space-y-3">
            {COATINGS.map((c) => (
              <div
                key={c.name}
                className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 grid md:grid-cols-4 gap-3 items-start"
              >
                <div className="md:col-span-1">
                  <h3 className="text-base font-bold text-amber-200">{c.name}</h3>
                  <div className="text-sm font-mono font-bold text-amber-400 mt-1">{c.price}</div>
                </div>
                <div className="md:col-span-1">
                  <p className="text-sm text-slate-400 leading-relaxed">{c.desc}</p>
                </div>
                <div className="md:col-span-1">
                  <div className="text-xs text-slate-500 font-semibold uppercase mb-1">Поверхности</div>
                  <p className="text-sm text-slate-300">{c.surface}</p>
                </div>
                <div className="md:col-span-1">
                  <div className="text-xs text-slate-500 font-semibold uppercase mb-1">Особенности</div>
                  <p className="text-sm text-slate-400 italic">{c.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Раздел 3: Позолота */}
        <section>
          <h2 className="text-2xl font-bold text-amber-300 mb-4">
            Раздел 3. Позолота, сусальное золото, серебрение
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-yellow-900/50 bg-gradient-to-br from-yellow-950/30 to-amber-950/20 p-4">
              <h3 className="text-base font-bold text-yellow-200 mb-2">Сусальное золото</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">
                Листы чистого золота 24К или сплавов, толщиной 0,1 мкм. Наносятся на клей мордан.
                Полировальник из агата для закрепления.
              </p>
              <ul className="space-y-1 text-sm text-slate-400">
                <li><span className="text-yellow-400">▸</span> Иконостасы, купола, лепнина</li>
                <li><span className="text-yellow-400">▸</span> Интерьеры религиозных объектов</li>
                <li><span className="text-yellow-400">▸</span> VIP-отели, дворцовые комплексы</li>
                <li><span className="text-yellow-400">▸</span> Фасадные элементы (наружная позолота)</li>
              </ul>
              <div className="mt-3 text-sm font-mono font-bold text-yellow-300">20–80 тыс. тг/м²</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
              <h3 className="text-base font-bold text-slate-300 mb-2">Серебрение</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">
                Листовое серебро (999 проба) или имитация — алюминиевые листы с эффектом серебра.
                Под лак — сохраняет блеск десятилетиями.
              </p>
              <ul className="space-y-1 text-sm text-slate-400">
                <li><span className="text-slate-400">▸</span> Зеркальные поверхности, рамы</li>
                <li><span className="text-slate-400">▸</span> Иконы, оклады, утварь</li>
                <li><span className="text-slate-400">▸</span> Декоративные элементы мебели</li>
              </ul>
              <div className="mt-3 text-sm font-mono font-bold text-slate-300">15–50 тыс. тг/м²</div>
            </div>
            <div className="rounded-xl border border-orange-900/50 bg-gradient-to-br from-orange-950/20 to-amber-950/20 p-4">
              <h3 className="text-base font-bold text-orange-200 mb-2">Имитация золота (поталь)</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">
                Медно-цинковый сплав, имитирующий золото. Дешевле в 10–15 раз. Требует лакирования —
                иначе темнеет через 3–5 лет.
              </p>
              <ul className="space-y-1 text-sm text-slate-400">
                <li><span className="text-orange-400">▸</span> Декоративные рамы, мебель</li>
                <li><span className="text-orange-400">▸</span> Интерьерные акценты, театры</li>
                <li><span className="text-orange-400">▸</span> Рекламные конструкции</li>
              </ul>
              <div className="mt-3 text-sm font-mono font-bold text-orange-300">2 000–8 000 тг/м²</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            При указании в смете: разграничивать «позолота сусальным золотом 24К» и «имитация позолоты
            (поталь)» — разница в цене 10–15 раз. На реставрационных объектах (памятники архитектуры)
            допускается только натуральное золото согласно проекту реставрации.
          </p>
        </section>

        {/* Раздел 4: Художественная роспись */}
        <section>
          <h2 className="text-2xl font-bold text-amber-300 mb-4">
            Раздел 4. Художественная роспись
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-900/50 bg-slate-900/40 p-5">
              <h3 className="text-base font-bold text-amber-200 mb-3">Настенная роспись (фреска/акрил)</h3>
              <div className="space-y-2 text-sm text-slate-400">
                <p>Выполняется художниками-монументалистами. Предварительно — набросок и утверждение
                   эскизов заказчиком. Этапы: грунтовка → перевод эскиза → роспись слоями → лак.</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-slate-950/50 rounded p-2">
                    <div className="text-xs text-slate-500">Простые мотивы</div>
                    <div className="font-mono font-bold text-amber-300">30–60 тыс. тг/м²</div>
                  </div>
                  <div className="bg-slate-950/50 rounded p-2">
                    <div className="text-xs text-slate-500">Сложные сюжетные</div>
                    <div className="font-mono font-bold text-amber-300">60–200 тыс. тг/м²</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-amber-900/50 bg-slate-900/40 p-5">
              <h3 className="text-base font-bold text-amber-200 mb-3">Потолочная роспись (плафон)</h3>
              <div className="space-y-2 text-sm text-slate-400">
                <p>Сложнее настенной — работа над головой, леса/люльки, перспективные деформации.
                   Купольная роспись требует 3D-проектирования ракурса. Срок: 1 м² — 4–8 часов художника.</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-slate-950/50 rounded p-2">
                    <div className="text-xs text-slate-500">Орнаменты</div>
                    <div className="font-mono font-bold text-amber-300">40–80 тыс. тг/м²</div>
                  </div>
                  <div className="bg-slate-950/50 rounded p-2">
                    <div className="text-xs text-slate-500">Сюжет / иллюзионизм</div>
                    <div className="font-mono font-bold text-amber-300">80–300 тыс. тг/м²</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/30 p-3 text-sm text-slate-400">
            <b className="text-slate-200">Художники-мастера в РК:</b> стоимость формируется из гонорара
            художника, материалов и оформления авторского договора. Для государственных объектов — через
            творческий союз художников Казахстана. Расценка в ЭСН не регулируется — индивидуальная калькуляция.
          </div>
        </section>

        {/* Раздел 5: Резьба */}
        <section>
          <h2 className="text-2xl font-bold text-amber-300 mb-4">
            Раздел 5. Резьба по камню и дереву
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <h3 className="text-base font-bold text-amber-200 mb-2">Резьба по камню (скульптурные элементы)</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">▸</span>
                  <span><b className="text-slate-200">Капители, карнизы, базы колонн</b> — реставрация фасадов ОКН</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">▸</span>
                  <span><b className="text-slate-200">Порталы, наличники</b> — представительские здания</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">▸</span>
                  <span><b className="text-slate-200">Скульптурные группы</b> — парки, площади</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">▸</span>
                  <span>Цена: <span className="font-mono text-amber-300">100 000–500 000+ тг/пог. м</span> в зависимости от сложности</span>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <h3 className="text-base font-bold text-amber-200 mb-2">Резьба по дереву (декоративные элементы)</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">▸</span>
                  <span><b className="text-slate-200">Лепные розетки, кессоны</b> — деревянные потолки</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">▸</span>
                  <span><b className="text-slate-200">Резные двери</b> — входные группы, кабинеты</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">▸</span>
                  <span><b className="text-slate-200">Реставрация иконостасов</b> — работа в режиме консервации</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">▸</span>
                  <span>Цена: <span className="font-mono text-amber-300">30 000–200 000+ тг/пог. м</span> плюс порода дерева</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section>
          <h2 className="text-2xl font-bold text-amber-300 mb-4">Упражнения</h2>

          {/* Упр. 1 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-yellow-300">Упражнение 1. Техника венецианской штукатурки</h3>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Венецианская штукатурка — многослойное покрытие. Сколько слоёв наносится по технологии
              и как создаётся эффект полированного мрамора?
            </p>
            <div className="space-y-2">
              {[
                { id: "a", label: "1 слоем — густой, под шпателем выравнивается" },
                { id: "b", label: "2 слоями — базовый и финишный" },
                { id: "c", label: "8–12 слоями с просушкой каждого — финишная полировка стальной лопаткой имитирует полированный мрамор" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${
                    a1 === opt.id
                      ? "border-amber-500 bg-amber-950/30"
                      : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1-sf"
                    value={opt.id}
                    checked={a1 === opt.id}
                    onChange={() => setA1(opt.id)}
                    className="mt-1 accent-amber-500"
                  />
                  <span className="text-sm text-slate-200">
                    <b className="text-amber-400 font-mono">{opt.id})</b> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-3">
              <button
                onClick={() => setR1(a1 === "c")}
                className="px-3 py-2 rounded bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium"
              >
                Проверить
              </button>
              <button
                onClick={() => setS1(!s1)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
              >
                {s1 ? "Скрыть" : "Показать"} решение
              </button>
              {r1 !== null && (
                <span className={`text-sm font-semibold ${r1 ? "text-emerald-400" : "text-rose-400"}`}>
                  {r1 ? "Верно!" : "Неверно, попробуйте ещё"}
                </span>
              )}
            </div>
            {s1 && (
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-amber-900/40 text-sm text-slate-300">
                <div>
                  Правильный ответ: <b className="text-amber-300">в) 8–12 слоёв.</b>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Каждый слой — 0,5–1 мм. Просушка между слоями 2–4 часа. Финальная полировка горячей
                  стальной лопаткой «запечатывает» поверхность, создавая характерный блеск мрамора.
                  Именно трудоёмкость обуславливает цену 5 000–15 000 тг/м² — это 3–5 часов мастера на 1 м².
                </div>
              </div>
            )}
          </div>

          {/* Упр. 2 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-yellow-300">Упражнение 2. Где применяется микроцемент?</h3>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Микроцемент — универсальное покрытие толщиной 2–5 мм на цементно-полимерной основе.
              Где его применение наиболее технически обосновано?
            </p>
            <div className="space-y-2">
              {[
                { id: "a", label: "Только потолки (слишком тяжёлый для пола)" },
                { id: "b", label: "Только наружные стены (водонепроницаемый)" },
                { id: "c", label: "Универсально — полы, стены, ванны, раковины без швов. Waterproof после пропитки. Цена работы 6–12 тыс. тг/м²" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${
                    a2 === opt.id
                      ? "border-amber-500 bg-amber-950/30"
                      : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2-sf"
                    value={opt.id}
                    checked={a2 === opt.id}
                    onChange={() => setA2(opt.id)}
                    className="mt-1 accent-amber-500"
                  />
                  <span className="text-sm text-slate-200">
                    <b className="text-amber-400 font-mono">{opt.id})</b> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-3">
              <button
                onClick={() => setR2(a2 === "c")}
                className="px-3 py-2 rounded bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium"
              >
                Проверить
              </button>
              <button
                onClick={() => setS2(!s2)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
              >
                {s2 ? "Скрыть" : "Показать"} решение
              </button>
              {r2 !== null && (
                <span className={`text-sm font-semibold ${r2 ? "text-emerald-400" : "text-rose-400"}`}>
                  {r2 ? "Верно!" : "Неверно, попробуйте ещё"}
                </span>
              )}
            </div>
            {s2 && (
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-amber-900/40 text-sm text-slate-300">
                <div>
                  Правильный ответ: <b className="text-amber-300">в) Универсально — полы, стены, ванны без швов.</b>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Ключевое преимущество микроцемента — отсутствие швов. Это критично в ванных комнатах
                  (нет грибка в швах) и кухнях. Требует профессиональной пропитки полиуретаном или воском —
                  без неё не водонепроницаем. Стоимость 6 000–12 000 тг/м² работы, срок 3–5 дней на 30 м².
                </div>
              </div>
            )}
          </div>

          {/* Упр. 3 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-yellow-300">Упражнение 3. Стоимость художественной росписи</h3>
              <span className="text-xs text-slate-500">numeric ±100 000 тг</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Заказана настенная роспись в ресторане: площадь <b>30 м²</b>, сложный сюжетный орнамент,
              тариф художника <b>80 000 тг/м²</b>. Рассчитайте стоимость росписи в тенге.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={a3}
                onChange={(e) => setA3(e.target.value)}
                placeholder="Например: 2400000"
                className="px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm w-48 focus:border-amber-500 outline-none"
              />
              <span className="text-slate-400 text-sm">тг</span>
              <button
                onClick={() => setR3(checkNum(a3, 2400000, 0.042))}
                className="px-3 py-2 rounded bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium"
              >
                Проверить
              </button>
              <button
                onClick={() => setS3(!s3)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
              >
                {s3 ? "Скрыть" : "Показать"} решение
              </button>
              {r3 !== null && (
                <span className={`text-sm font-semibold ${r3 ? "text-emerald-400" : "text-rose-400"}`}>
                  {r3 ? "Верно!" : "Неверно, попробуйте ещё"}
                </span>
              )}
            </div>
            {s3 && (
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-amber-900/40 text-sm text-slate-300">
                <div>30 м² &times; 80 000 тг/м² = <b className="text-amber-300">2 400 000 тг</b></div>
                <div className="text-xs text-slate-500 mt-1">
                  Дополнительно к тарифу художника: материалы (краски, лаки) — +5–10% от суммы,
                  строительные леса — +15 000–30 000 тг/сутки, авторский договор — 15% НДС если ИП на ОСН.
                  Итоговый бюджет: 2 400 000 + ~300 000 = ~2 700 000 тг.
                </div>
              </div>
            )}
          </div>

          {/* Упр. 4 */}
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-yellow-300">Упражнение 4. Сусальное золото</h3>
              <span className="text-xs text-slate-500">multiple-choice</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">
              Сусальное золото — листы толщиной 0,1 мкм. Стоимость 20–80 тыс. тг/м².
              В каких объектах применение сусального золота является стандартной практикой и технически обоснованным?
            </p>
            <div className="space-y-2">
              {[
                { id: "a", label: "Промышленные полы (высокая износостойкость)" },
                { id: "b", label: "Кровельное покрытие жилых домов (снижение теплопотерь)" },
                { id: "c", label: "Обязательно для всех зданий по нормам РК" },
                { id: "d", label: "Декорирование фасадов, интерьеров, иконостасов — тонкие листы 0,1 мкм, управление электрическим полем не нужно, цена 20–80 тыс. тг/м²" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${
                    a4 === opt.id
                      ? "border-amber-500 bg-amber-950/30"
                      : "border-slate-800 bg-slate-900/30 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4-sf"
                    value={opt.id}
                    checked={a4 === opt.id}
                    onChange={() => setA4(opt.id)}
                    className="mt-1 accent-amber-500"
                  />
                  <span className="text-sm text-slate-200">
                    <b className="text-amber-400 font-mono">{opt.id})</b> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-3">
              <button
                onClick={() => setR4(a4 === "d")}
                className="px-3 py-2 rounded bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium"
              >
                Проверить
              </button>
              <button
                onClick={() => setS4(!s4)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
              >
                {s4 ? "Скрыть" : "Показать"} решение
              </button>
              {r4 !== null && (
                <span className={`text-sm font-semibold ${r4 ? "text-emerald-400" : "text-rose-400"}`}>
                  {r4 ? "Верно!" : "Неверно, попробуйте ещё"}
                </span>
              )}
            </div>
            {s4 && (
              <div className="mt-3 p-3 rounded bg-slate-950/60 border border-amber-900/40 text-sm text-slate-300">
                <div>
                  Правильный ответ: <b className="text-amber-300">г) Декорирование фасадов, интерьеров, иконостасов.</b>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Сусальное золото наносится на подготовленную поверхность с клеем мордан. Применение:
                  купола православных церквей, мечети (минареты), дворцовые интерьеры, представительские
                  кабинеты, иконостасы. Толщина листа 0,1 мкм — на 1 м² уходит 5–8 г золота. Цена
                  20–80 тыс. тг/м² включает золото + работу позолотчика + предварительную подготовку.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Factoid */}
        <section className="rounded-xl border border-amber-800/40 bg-gradient-to-br from-amber-950/40 to-yellow-950/20 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-lg font-semibold text-amber-200 mb-2">
                Как вносить специальные отделки в смету
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Специальные виды отделки — <b>индивидуальные расценки (ИР)</b> по ЭСН. Для них составляется
                отдельная калькуляция: время художника / позолотчика (часы), расход золота/краски, вспомогательные
                материалы, арендованное оборудование (леса, нагревательные инструменты). Нельзя применять
                единичные расценки малярных работ (ЭСН Сб.15-1) — они не отражают реальной трудоёмкости.
              </p>
              <p className="text-sm text-slate-300 leading-relaxed mt-2">
                Для государственных объектов (театры, музеи, культурные центры) — экспертиза сметы
                принимает ИР при наличии коммерческого предложения от профессиональных исполнителей
                и протокола согласования с заказчиком.
              </p>
            </div>
          </div>
        </section>

        {/* Footer nav */}
        <div className="pt-6 border-t border-slate-800 flex justify-between text-xs text-slate-600">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-amber-400 hover:underline"
          >
            ← К разделам
          </Link>
          <span>
            AEVION Smeta Trainer · Модуль «Специальные виды отделки» · ЭСН Сб.15 · Индивидуальные расценки
          </span>
        </div>
      </main>
    </div>
  );
}
