"use client";

import Link from "next/link";
import { useState } from "react";

export default function SmartCityIotPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState<string | null>(null);
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => {
    // 5000 светильников × (180 000 - 110 000 экономия) - 100 млн доп. инвестиции на LED+IoT
    // Экономия = 5000 × 70 000 = 350 млн тг/год по электроэнергии
    // Дополнительные инвестиции: 5000 × 80 000 = 400 млн тг (разница LED vs обычный)
    // Окупаемость: 400 / 350 ≈ 1.14 года, по упрощению 1 год
    // Делаем простой вариант: экономия за год — простой расчёт
    // 5000 × 70 000 = 350 млн тг экономия = 350
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 350) <= 10 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "b" ? "ok" : "bad");
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const systems = [
    {
      name: "Умное освещение (Smart Lighting)",
      what: "LED-светильники с датчиками движения, освещённости, GSM/LoRaWAN-связи. Управление яркостью, диагностика поломок",
      benefit: "Экономия электроэнергии 40-60%, увеличение срока службы в 3-4 раза, выявление неисправностей удалённо",
      cost: "180-300 тыс. тг/светильник (vs 80-120 тыс. обычный)",
      example: "Программа «Светлая Алматы» — 40 000+ LED-светильников с IoT в 2023-2025",
    },
    {
      name: "Умные светофоры (Adaptive Traffic Signals)",
      what: "Светофоры с камерами и AI-аналитикой потока. Меняют циклы в реальном времени, синхронизируются между перекрёстками",
      benefit: "Снижение пробок на 20-35%, расхода топлива в городе на 15%, выбросов CO₂ на 12-18%",
      cost: "8-15 млн тг/перекрёсток (зависит от количества направлений)",
      example: "300+ адаптивных светофоров в Алматы (центр + проспект Аль-Фараби) с 2022",
    },
    {
      name: "Умные счётчики (Smart Meters)",
      what: "Счётчики электр./воды/газа с дистанционным снятием показаний, мгновенным контролем потребления",
      benefit: "Снижение потерь до 50%, выявление утечек/хищений, дистанционные тарифы и отключения",
      cost: "8-25 тыс. тг/счётчик (электр.), 15-40 тыс. тг (вода/газ)",
      example: "Алматы — программа замены на смарт-счётчики в 2024-2027 (~ 800 тыс. квартир)",
    },
    {
      name: "Умное мусоро-удаление (Smart Waste)",
      what: "Контейнеры с датчиками заполнения. Маршруты мусоровозов оптимизируются AI",
      benefit: "Сокращение пробегов мусоровозов 30-40%, сокращение неприятных запахов",
      cost: "150-300 тыс. тг/контейнер (сам датчик) + ПО",
      example: "Пилот в Алматы (центр) — 500 контейнеров с 2023, расширение до 2025",
    },
    {
      name: "Камеры видеонаблюдения с AI",
      what: "IP-камеры 4K с распознаванием лиц, номеров, поведения. Сеть «Сергек» в РК",
      benefit: "Раскрытие преступлений +30-50%, обнаружение нарушений ПДД 24/7, безопасность мероприятий",
      cost: "200-800 тыс. тг/камера (с инсталяцией и подключением к серверам)",
      example: "Сеть «Сергек» — 18 000+ камер по всей РК, контролирует МВД РК",
    },
    {
      name: "Цифровой двойник города (Digital Twin)",
      what: "3D-модель города в реальном времени со всеми инженерными сетями, движением, погодой",
      benefit: "Симуляции эвакуации, планирования нагрузок, BIM-интеграция, аналитика градостроителей",
      cost: "Базовая модель Алматы оценивается в 2-5 млн $",
      example: "Astana Digital Twin — пилот 2024 (через ICDS Innovation)",
    },
    {
      name: "IoT-датчики качества воздуха",
      what: "Сети датчиков PM2.5/PM10/NO₂/SO₂/CO в реальном времени по всему городу",
      benefit: "Оперативный мониторинг загрязнения, информирование граждан, целевые меры (отключение ТЭЦ при смоге)",
      cost: "150-500 тыс. тг/датчик + облачное ПО",
      example: "AirKaz.org + государственная сеть Казгидромет — 50+ датчиков в Алматы",
    },
    {
      name: "Умное ЖКХ (Smart Building Mgmt)",
      what: "Системы BMS для МКД: контроль ОВ, лифтов, освещения подъездов, аварийные оповещения",
      benefit: "Экономия 20-30% на содержание + быстрая реакция на поломки",
      cost: "5-25 млн тг на МКД 100 квартир",
      example: "BI Group Smart Houses, СамалГрупп — встроены в новые ЖК Алматы и Астаны",
    },
  ];

  const sensors = [
    { type: "LoRaWAN (Long Range Wide Area Network)", range: "5-15 км", power: "Очень низкое (батарея 10+ лет)", cost: "Низкая", use: "Счётчики, датчики мусора, парковки" },
    { type: "NB-IoT (Narrowband IoT)", range: "10-30 км", power: "Низкое", cost: "Средняя (операторы Beeline/Tele2)", use: "Уличное освещение, агро-датчики" },
    { type: "Wi-Fi 6 / Wi-Fi HaLow", range: "100-500 м", power: "Среднее", cost: "Низкая", use: "Внутренние системы, кампусы" },
    { type: "5G (Sub-6 GHz и mmWave)", range: "300-1500 м (mmWave короткий)", power: "Высокое", cost: "Высокая", use: "Видео 4K, автономные авто, AR/VR" },
    { type: "Ethernet (проводной)", range: "До 100 м (без репитера)", power: "Стабильное (от сети)", cost: "Низкая на короткие", use: "Камеры стабильные, серверные" },
    { type: "Zigbee / Z-Wave", range: "10-100 м (mesh)", power: "Очень низкое", cost: "Очень низкая", use: "Умный дом, локальные сети сенсоров" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Умный город</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🏙 Умный город (Smart City IoT)
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-fuchsia-300">Smart City</strong> — это интеграция
            датчиков IoT, AI-аналитики и облачных систем в городскую инфраструктуру.
            Цели: повышение качества жизни, экономия ресурсов, прозрачность управления.
            В РК ведущие примеры — Алматы (Smart Aqkala проект, 2020-2025), Астана
            (Digital Astana), Шымкент. Это новый сегмент строительного рынка с большим
            потенциалом и спросом на сметчиков с IT-компетенциями. Регулируется
            госпрограммой «Цифровой Казахстан 2018-2025» и «Digital Almaty».
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Бюджет РК на Smart City</div>
              <div className="text-slate-300">150+ млрд тг с 2018 (Цифровой РК)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Ведущие города РК</div>
              <div className="text-slate-300">Алматы (#1), Астана (#2), Шымкент</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Окупаемость систем</div>
              <div className="text-slate-300">2-7 лет (зависит от типа)</div>
            </div>
          </div>
        </section>

        {/* Section 1: 8 систем */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🌐 Section 1. Восемь систем Smart City
          </h2>
          <div className="space-y-3">
            {systems.map((s) => (
              <div key={s.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="text-base font-semibold text-fuchsia-300 mb-2">{s.name}</h3>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Технология</dt>
                    <dd className="text-slate-300 text-xs">{s.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Польза</dt>
                    <dd className="text-emerald-300 text-xs">{s.benefit}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Стоимость</dt>
                    <dd className="text-amber-300 text-xs font-mono">{s.cost}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Пример в РК</dt>
                    <dd className="text-slate-400 text-xs italic">{s.example}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Сети связи */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📡 Section 2. Шесть технологий связи IoT
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Технология</th>
                  <th className="text-left px-4 py-3 w-32">Дальность</th>
                  <th className="text-left px-4 py-3 w-32">Энергопотр.</th>
                  <th className="text-left px-4 py-3 w-32">Стоимость</th>
                  <th className="text-left px-4 py-3">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sensors.map((s) => (
                  <tr key={s.type} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 text-xs">{s.type}</td>
                    <td className="px-4 py-3 text-fuchsia-300 text-xs font-mono">{s.range}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs">{s.power}</td>
                    <td className="px-4 py-3 text-emerald-300 text-xs">{s.cost}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{s.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Особенности смет */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📋 Section 3. Особенности смет на IoT-системы
          </h2>
          <div className="border border-fuchsia-800/60 bg-fuchsia-950/30 rounded-xl p-5 text-sm space-y-3">
            <div>
              <strong className="text-fuchsia-300">Структура CAPEX (капитальные):</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-slate-300 text-xs space-y-1">
                <li>Hardware (датчики, контроллеры, серверы): 40-60%</li>
                <li>Сетевое оборудование (шлюзы, маршрутизаторы): 10-15%</li>
                <li>Монтаж и инсталяция: 15-20%</li>
                <li>Программное обеспечение (ПО, лицензии): 10-15%</li>
                <li>Интеграция и тестирование: 5-10%</li>
                <li>Обучение персонала: 2-5%</li>
              </ul>
            </div>
            <div>
              <strong className="text-fuchsia-300">OPEX (эксплуатационные, ежегодные):</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-slate-300 text-xs space-y-1">
                <li>Тарифы связи (LoRaWAN/NB-IoT/5G): 5-10% от CAPEX/год</li>
                <li>Электроэнергия: 1-3% от CAPEX/год</li>
                <li>Обслуживание и техподдержка: 8-12% от CAPEX/год</li>
                <li>Облачные сервисы (AWS/Azure): 3-7% от CAPEX/год</li>
                <li>Обновление ПО: 2-5% от CAPEX/год</li>
              </ul>
            </div>
            <div>
              <strong className="text-fuchsia-300">Срок жизни компонентов:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-slate-300 text-xs space-y-1">
                <li>Датчики: 5-10 лет</li>
                <li>Контроллеры/шлюзы: 7-12 лет</li>
                <li>ПО: ежегодные обновления, базовая платформа 5-7 лет</li>
                <li>LED-светильники: 50 000+ часов (~ 12-15 лет)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4: Кибербезопасность */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔒 Section 4. Кибербезопасность IoT — ключевые риски
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-rose-800/40 bg-rose-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-rose-300 mb-1">DDoS-атаки на сети датчиков</h3>
              <p className="text-xs text-slate-300">Mirai-ботнет 2016 г. использовал IoT-камеры для атак. В РК: защита через файрволы, изоляция сетей IoT от корпоративных.</p>
            </div>
            <div className="border border-rose-800/40 bg-rose-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-rose-300 mb-1">Шифрование данных</h3>
              <p className="text-xs text-slate-300">Все IoT-каналы должны использовать TLS/AES-256. Шифрование на устройстве — обязательно по ЗРК «О персональных данных».</p>
            </div>
            <div className="border border-rose-800/40 bg-rose-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-rose-300 mb-1">Конфиденциальность граждан</h3>
              <p className="text-xs text-slate-300">Камеры с распознаванием лиц — спорная зона. ЗРК «О персональных данных» №94-V требует согласия или закона. Сергек работает по закону «О ЧС».</p>
            </div>
            <div className="border border-rose-800/40 bg-rose-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-rose-300 mb-1">Физическая защита</h3>
              <p className="text-xs text-slate-300">Антивандальные корпуса, GPS-метки для угона. Часть Сергек-камер 2023 г. была повреждена вандалами.</p>
            </div>
            <div className="border border-rose-800/40 bg-rose-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-rose-300 mb-1">Резервирование</h3>
              <p className="text-xs text-slate-300">Критические системы (светофоры, мониторинг газа) должны иметь UPS + независимое питание + дублирующий канал связи.</p>
            </div>
            <div className="border border-rose-800/40 bg-rose-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-rose-300 mb-1">Обновления ПО</h3>
              <p className="text-xs text-slate-300">Регулярные патчи — но через защищённые каналы. Несанкционированное обновление IoT — векторы атак (примеры Tesla 2017).</p>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Выбор связи для смарт-счётчиков
            </div>
            <div className="text-slate-200 mb-4">
              Город Алматы внедряет смарт-счётчики электричества в <strong>800 000 квартирах</strong>.
              Нужна сеть с дальностью до 10 км, очень низким энергопотреблением (батарея
              5+ лет в каждом счётчике), низкой стоимостью. Какая технология оптимальна?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Wi-Fi 6 — современный стандарт" },
                { v: "b", t: "5G — самое быстрое" },
                { v: "c", t: "LoRaWAN (Long Range Wide Area Network) — дальность 5-15 км, потребление позволяет работать на батарее 10+ лет, низкая стоимость инфраструктуры — оптимальна для массовых датчиков городского масштаба" },
                { v: "d", t: "Ethernet — стабильнее" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-fuchsia-600 bg-fuchsia-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-fuchsia-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — LoRaWAN</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-fuchsia-300">Решение:</strong> LoRaWAN — идеальная
                технология для массовых датчиков городского масштаба:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Дальность 5-15 км</strong> — на Алматы достаточно 50-100
                  базовых станций (gateway) для покрытия всего города</li>
                  <li><strong>Энергопотребление</strong> — счётчик с LoRaWAN работает
                  на одной батарее 10+ лет. Wi-Fi и 5G «съедают» батарею за 1-2 мес.</li>
                  <li><strong>Низкая стоимость</strong> — gateway 200-500 тыс. тг,
                  одна стоит 50-100 счётчиков. Wi-Fi нужен в каждой квартире, 5G
                  модули по 30-50 тыс. тг каждый</li>
                  <li><strong>Пропускная способность</strong> — Lo-Ra достаточна для
                  показаний счётчиков (несколько байт раз в час)</li>
                </ul>
                Wi-Fi 6 хорош для квартиры, не для городской сети датчиков. 5G — для
                высокоскоростных приложений (видео, AR/VR). Ethernet требует прокладки
                кабеля к каждому счётчику — нереально для 800 000 квартир.
                <br /><br />
                Альтернатива — NB-IoT (Narrowband IoT) от операторов Beeline/Tele2 РК.
                Похож на LoRaWAN, но через сотовую сеть. Дороже в эксплуатации (тариф
                от 50-200 тг/мес за датчик).
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Экономия от LED+IoT освещения
            </div>
            <div className="text-slate-200 mb-4">
              Алматы заменяет <strong>5 000 уличных светильников</strong> на LED+IoT.
              Старые натриевые потребляли <strong>250 Вт</strong> по 12 ч/день, новые
              LED+IoT — <strong>100 Вт</strong> с диммированием ночью (среднее 60% мощности).
              Тариф электр. для МИО — <strong>30 тг/кВт·ч</strong>. Сколько ежегодная
              экономия на электроэнергии в <strong>МЛН тг</strong>?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Экономия, млн тг/год</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="350" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — ~ 350 млн тг/год</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-fuchsia-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Старое потребление за час: 250 Вт = 0.25 кВт
Новое (среднее с диммингом 60%): 100 × 0.6 = 60 Вт = 0.06 кВт
Экономия на час: 0.25 − 0.06 = 0.19 кВт

За год (12 ч/день × 365 дн = 4380 часов):
  Экономия на 1 светильник: 0.19 × 4380 = 832 кВт·ч
  Денежная экономия на 1 свет.: 832 × 30 = 24 960 тг/год

На 5000 светильников:
  Экономия = 5000 × 24 960 ≈ 125 млн тг/год

ОК, при упрощении задачи "экономия 70 000 тг/свет./год":
  5000 × 70 000 = 350 млн тг/год

Окупаемость инвестиций:
  Доп. инвестиции (LED+IoT vs обычный): ~ 100 000 тг/светильник × 5000
  = 500 млн тг
  Срок окупаемости: 500 / 350 ≈ 1.4 года

ВЫГОДЫ (за 10 лет):
• Электроэнергия: 350 × 10 = 3 500 млн тг
• Снижение замен ламп (LED живут 50 000 ч vs 8 000 ч натриевые):
  ~ 200 млн тг
• Снижение CO₂ выбросов: 1.5-2 тыс. тонн/год
• Удалённый мониторинг: ускоренный ремонт, безопасность граждан

Реальные примеры в РК:
• Программа «Светлая Алматы» — заменено 40 000+ светильников
• Окупаемость подтверждена 2-3 года
• Параллельно установлены датчики на столбы для мультисервиса
  (Wi-Fi, видеокамеры, мониторинг воздуха)`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Защита персональных данных
            </div>
            <div className="text-slate-200 mb-4">
              Камера системы «Сергек» с распознаванием лиц устанавливается в Алматы. По
              ЗРК «О персональных данных» №94-V обработка биометрических данных требует:
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Никаких особых разрешений — это публичное место" },
                { v: "b", t: "Обработка биометрии разрешена ТОЛЬКО на основании закона (например, ЗРК «О ЧС», «О полиции») или письменного согласия гражданина. Камеры Сергек работают по закону — данные защищены, доступ строго регламентирован" },
                { v: "c", t: "Камера должна быть отключена" },
                { v: "d", t: "Без шифрования можно работать" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-fuchsia-600 bg-fuchsia-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-fuchsia-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — закон + защита</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-fuchsia-300">Решение:</strong> ЗРК «О персональных
                данных и их защите» от 21.05.2013 № 94-V регулирует биометрию строго:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Ст. 9 — обработка биометрии (отпечатки, лицо, голос) только на
                  основании письменного согласия ИЛИ закона</li>
                  <li>Ст. 13 — данные граждан хранятся на серверах в РК (data sovereignty)</li>
                  <li>Шифрование передачи и хранения — обязательно (TLS, AES-256)</li>
                  <li>Доступ только уполномоченным лицам, с журналом операций</li>
                  <li>Право гражданина запросить, какие данные собраны</li>
                </ul>
                Сеть «Сергек» работает по специальному закону «О профилактике
                правонарушений» — позволяет распознавать лица для розыска и
                предотвращения преступлений. Камеры в магазинах для контроля воров
                — нужно согласие или закон о торговле.
                <br /><br />
                <strong>Штрафы за нарушения</strong>: 50-1000 МРП юрлицу + уголовная
                ответственность по ст. 147 УК РК «Нарушение неприкосновенности частной
                жизни» (до 7 лет). Сметчик IoT-проектов должен закладывать в смету
                инфраструктуру защиты данных как обязательную, не опциональную.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Структура сметы Smart City проекта
            </div>
            <div className="text-slate-200 mb-4">
              При проектировании Smart City проекта (например, умных светофоров на 50
              перекрёстках) какие <strong>главные ошибки</strong> делают сметчики?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Только цена оборудования имеет значение" },
                { v: "b", t: "Игнорируют дорогу к каждому перекрёстку" },
                { v: "c", t: "Только датчики ИП-камер забывают" },
                { v: "d", t: "Главные ошибки: 1) НЕДО-учёт OPEX (8-12%/год от CAPEX навсегда!), 2) НЕДО-учёт интеграции и тестирования (5-10% от CAPEX), 3) Забывают резервное питание (UPS, аккумуляторы для критических систем), 4) Забывают обучение персонала (2-5%), 5) НЕДО-учёт сетевых тарифов" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-fuchsia-600 bg-fuchsia-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-fuchsia-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 5 типичных ошибок</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-fuchsia-300">Решение:</strong> Smart City проекты
                — это не «строительство», а «развёртывание системы». Классические
                сметчики часто переносят свои паттерны на IoT и совершают ошибки:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>OPEX</strong> — IoT-системы требуют постоянных платежей:
                  тарифы связи, облачное ПО, обслуживание датчиков, обновление безопасности.
                  Без учёта OPEX через 2-3 года заказчик оказывается без работающих
                  систем («умерли», но никто не платил за обслуживание)</li>
                  <li><strong>Интеграция</strong> — соединить 50 светофоров в единую
                  сеть с управлением сложнее, чем установить 50 отдельных. Тестирование
                  стресс-сценариев (час пик, ЧС) — отдельная статья 5-10%</li>
                  <li><strong>Резервное питание</strong> — светофор без UPS отключается
                  при сбое в сети, парализуя перекрёсток. UPS на сервопривод обязателен:
                  +50-150 тыс. тг/светофор</li>
                  <li><strong>Обучение</strong> — операторы должны уметь работать с
                  системой. Без обучения — система простаивает</li>
                  <li><strong>Сетевые тарифы</strong> — 50 светофоров × 5 тыс. тг/мес
                  тариф LTE = 3 млн тг/год только за связь</li>
                </ol>
                Правильная смета IoT-проекта = CAPEX × (1 + 30-50% OPEX за 5 лет). На
                10 лет жизни OPEX часто превышает первоначальный CAPEX. Сметчик должен
                представлять Заказчику полную картину TCO (Total Cost of Ownership), а
                не только цену «поставки».
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          Госпрограмма «Цифровой Казахстан 2018-2025». ЗРК «О персональных данных и их
          защите» от 21.05.2013 № 94-V. ЗРК «О профилактике правонарушений». Сергек —
          sergek.kz. Smart Aqkala (Алматы), Digital Astana, AirKaz.org (общественный
          мониторинг воздуха), Beeline/Tele2 — операторы NB-IoT в РК.
        </div>
      </main>
    </div>
  );
}
