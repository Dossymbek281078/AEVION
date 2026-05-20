"use client";
import Link from "next/link";
import { useState } from "react";

export default function StockExchangeFintechPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 240) <= 25;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Биржи и финтех-центры</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">📈 Биржи и финтех-центры</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #272. Биржи и финтех-центры РК: KASE Казахстанская Фондовая
            Биржа Алматы (с 1993, 12 000 м²), AIX Astana International Exchange
            (МФЦА, открыта 2018, англ. право), AIFC Astana International Financial
            Centre (хаб финтеха региона). Trading floor с системами Bloomberg
            Terminal + Refinitiv Eikon, серверная с low-latency 10G/100G connectivity
            (для HFT High-Frequency Trading), Dark fiber до международных бирж
            NYSE/LSE/SGX. СОЗВПТ Закон РК (О Противодействии Отмыванию Денежных
            Средств), ISO 27001, FATF Recommendations, MiFID II.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав биржевого центра</h2>
          <p className="text-slate-300 leading-relaxed">
            ISO 27001 + MiFID II + FATF Recommendations + AIFC Regulations:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Trading Floor:</strong> 800-1500 м² с рабочими местами трейдеров (Bloomberg Terminal × 100-300, Refinitiv Eikon, custom OMS Order Management Systems).</li>
            <li><strong>Серверная (Data Centre):</strong> Tier III/IV (uptime 99.982%/99.995%) — colocation для HFT-стратегий, low-latency 10G/100G connectivity Cisco Catalyst 9500.</li>
            <li><strong>Dark Fiber:</strong> прямое оптоволокно до NYSE (New York), LSE (London), SGX (Singapore), HKEX (Hong Kong) для арбитража, latency &lt;50 мс к ближайшим хабам.</li>
            <li><strong>Listing Department:</strong> для оценки и приёма IPO новых эмитентов (Initial Public Offering).</li>
            <li><strong>Clearing &amp; Settlement:</strong> отдел расчёта и клиринга по сделкам (T+2 settlement default), интеграция с депозитарием.</li>
            <li><strong>Surveillance Room:</strong> мониторинг рыночных манипуляций, инсайдерской торговли, AI-аналитика паттернов (Nasdaq SMARTS Trade Surveillance).</li>
            <li><strong>Disaster Recovery Site (DR):</strong> идентичная серверная в географически удалённой location (минимум 50 км от основной) — для непрерывности bay при катастрофах.</li>
            <li><strong>Конференц-зал:</strong> для пресс-конференций, listing ceremony (открытие торгов новой компанией с подсветкой и колокольчиком).</li>
            <li><strong>VIP-кабинеты для брокеров институциональных клиентов:</strong> hedge funds, asset managers, sovereign wealth funds.</li>
            <li><strong>Education Centre:</strong> для обучения инвесторов розничного рынка.</li>
            <li><strong>Multi-factor security:</strong> биометрия + RFID + PIN + видеонаблюдение на каждом входе.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Серверная low-latency HFT</h2>
          <p className="text-slate-300">
            Биржа должна обеспечить колокацию для HFT-стратегий, где latency измеряется
            в наносекундах. Какие требования по NSE/Nasdaq Co-Location Standards?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Стандартная серверная Tier II с обычным Ethernet" },
              { v: "b", t: "Tier III с Gigabit Ethernet — этого достаточно" },
              { v: "c", t: "Только Tier IV без low-latency switching" },
              { v: "d", t: "Premium Co-Location Tier IV + Ultra-low-Latency Design: 1) Data Centre сертифицирован Uptime Institute Tier IV (uptime 99.995%, 2N+1 redundancy), полностью fault tolerant с возможностью concurrent maintenance; 2) Co-Location Cages для HFT-фирм — отдельные клетки 0.5-2 ракеты с биометрическим доступом, разный VLAN, изолированные источники питания; 3) Cross-connect cabling — оптоволокно от каждого co-location cage к centralized order matching engine с одинаковой длиной (равноудалённость для fairness — Equidistant Cabling, разница в latency между конкурирующими HFT-фирмами &lt;100 ns); 4) Core switching — Cisco Nexus 9000-9500 (latency 600-900 нс per port) или Arista 7150S (350 нс) или Mellanox/NVIDIA SN5000 (250 нс для ultra-HFT); 5) PCIe Gen5 NICs Solarflare X2522 (sub-microsecond latency для трейдинг-сервера); 6) Hardware Timestamping IEEE 1588v2 PTP (Precision Time Protocol) точность ±10 ns для аудита сделок; 7) Optical taps (Gigamon) с zero-latency для мониторинга и compliance; 8) FPGA-based pre-trade risk check (Algo-Logic / Mellanox Innova) для regulatory compliance без задержки; 9) Internet connectivity: 2 разных provider (Beeline + Транстелеком), BGP multihoming с автоматич. failover &lt;100 мс; 10) Dark fiber до international hubs — Marseille (MED), Frankfurt (DE-CIX), Amsterdam (AMS-IX), Singapore (SGX); 11) Удалённый Disaster Recovery site (Astana ↔ Almaty 1200 км) с DWDM transport network и асинхронной репликацией; 12) Регулярный audit ISO 27001 + SOC 2 Type II + AIFC Compliance; NSE Co-Lo Standards + Nasdaq Tech Stack + ISO/IEC 27001 + Uptime Institute Tier IV" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во Bloomberg Terminal</h2>
          <p className="text-slate-300">
            Trading floor биржи KASE 1200 м² с 220 рабочих мест (буферная зона на
            рост = +20%). Каждое рабочее место — двойной монитор + Bloomberg
            Terminal (специальный 6-экранный display + клавиатура). Стоимость подписки
            Bloomberg ~$24 000/мес/терминал. Сколько Bloomberg terminals закупить?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            N = N_трейдеров (220) + spare на ремонт<br />
            +резерв 10% для гостевых брокеров<br />
            +Disaster Recovery site (DR) 20% дублирование
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во Bloomberg Terminals"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 220 + 10% = 242 для основной площадки. С DR-сайтом ещё 20% дублирование = +44 шт. Но в задаче только основная площадка = ~240 терминалов. Стоимость подписки: 240 × $24 000 × 12 мес = $69 млн/год = 32 млрд тг/год (огромная операционная статья).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет биржи + DR</h2>
          <p className="text-slate-300">
            Биржа AIX-style 12 000 м² + Disaster Recovery site 3000 м² в другом регионе.
            ССЦ + импорт: главное здание 12 000 м² 4-эт. — 3.6 млрд тг,
            Trading Floor 1200 м² premium-отделка + AV + monitors — 1.8 млрд тг,
            240 Bloomberg Terminal стартовая закупка + первый год подписки — 14 млрд тг,
            Refinitiv Eikon × 80 + кастомные OMS трейдерские системы — 1.4 млрд тг,
            Data Centre Tier IV 600 м² (cabinets + HVAC + UPS + Gen) — 5.4 млрд тг,
            Network Cisco Catalyst Nexus 9500 + Arista 7150S core switching — 1.8 млрд тг,
            Co-Location cages для HFT-фирм × 20 шт — 0.6 млрд тг,
            Dark Fiber до Marseille/Frankfurt/Singapore/HK (5 каналов) — 4.2 млрд тг,
            DR-site 3000 м² с дублированием серверов и сетей — 2.8 млрд тг,
            DWDM transport между основным и DR-site — 0.6 млрд тг,
            Surveillance система Nasdaq SMARTS + AI Trade Monitoring — 0.45 млрд тг,
            Clearing &amp; Settlement Platform (с интеграцией депозитария) — 0.6 млрд тг,
            СОУЭ + СОТ + СКУД биометрия + многофакторная — 0.45 млрд тг,
            Trading Pit / ceremonial bell с подсветкой — 0.02 млрд тг,
            VIP-кабинеты институциональных брокеров — 0.45 млрд тг,
            Education Centre — 0.2 млрд тг,
            проектирование + лицензии AIFC + ISO 27001 + SOC 2 — 0.43 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~38 млрд тг (допуск ±10%). 3.6+1.8+14+1.4+5.4+1.8+0.6+4.2+2.8+0.6+0.45+0.6+0.45+0.02+0.45+0.2+0.43 = 38 млрд тг. AIX (открыта 2018, $1 млрд проект МФЦА) — суммарная инвестиция $80-100 млн = 37-46 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от инсайдерской</h2>
          <p className="text-slate-300">
            Биржа должна защищать от market manipulation (pump-and-dump, spoofing,
            front-running) и инсайдерской торговли. Что обязательно по MAR (Market
            Abuse Regulation EU) + СОЗВПТ РК?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только мониторинг крупных сделок &gt;1 млн долл." },
              { v: "b", t: "Только запись телефонных переговоров трейдеров" },
              { v: "c", t: "Multi-Layer Market Surveillance по MAR + MiFID II + FATF + СОЗВПТ: 1) Nasdaq SMARTS Trade Surveillance — AI-обнаружение паттернов wash trading, spoofing, layering, momentum ignition с machine learning моделями на >100 индикаторов (volume spike, order-to-trade ratios, dispersed timing); 2) Все ордера и сделки логируются на FPGA-based audit trail с PTP timestamp точностью ±10 ns (для регулятивной отчётности); 3) Insider Trading Detection — соотнесение крупных позиций с публичной информацией (corporate filings, news, exec resignations) — алгоритм Nasdaq SMARTS Compliance; 4) Запись всех средств коммуникации трейдеров — телефоны (Bloomberg Vault), чаты (Symphony / Bloomberg Chat), email (Office 365 ATP), Slack для команды; 5) Архивирование всех записей 7+ лет (regulatory retention) на immutable storage WORM (Write-Once-Read-Many); 6) Анти-money laundering AML — KYC (Know Your Customer) на каждого клиента, CDD (Customer Due Diligence) Enhanced для PEPs (Politically Exposed Persons), continuous monitoring транзакций; 7) Watch lists — sanctions (OFAC, EU, UN), PEPs, ME-региональные списки (РК ҚМ); 8) Suspicious Activity Reports (SAR) — автоматич. триггеры + ручной анализ compliance officer, отчёт в Финмониторинг РК; 9) Information barriers (Chinese Walls) между подразделениями (sales/trading/research) для предотвращ. front-running; 10) Whistleblower hotline для сотрудников + защита от retaliations; 11) Regular external audit Big4 (PwC/EY/Deloitte/KPMG) на compliance + AIFC аудит; 12) Sandbox для финтех-стартапов AIFC FinTech Lab с регулят. supervisor; EU MAR (2014) + MiFID II + FATF 40 Recommendations + СОЗВПТ Закон РК + AIFC Regulations" },
              { v: "d", t: "Только видеонаблюдение в trading floor" },
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
                {score === 4 ? "Отлично — готовы к проектированию биржи" : score >= 2 ? "Перечитайте ISO 27001 + MiFID II + FATF + Uptime Tier IV" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> ISO/IEC 27001, MiFID II (Markets in Financial Instruments), MAR (Market Abuse Regulation), FATF Recommendations, СОЗВПТ Закон РК, AIFC Regulations, Uptime Institute Tier IV, SOC 2 Type II.</p>
          <p><strong>Реальные объекты РК и мир:</strong> KASE Алматы (с 1993, 12 000 м²), AIX МФЦА Астана (2018, английское право), Astana International Financial Centre AIFC, Borsa Istanbul, LSE London, NYSE Wall Street, Nasdaq Times Square.</p>
        </section>
      </main>
    </div>
  );
}
