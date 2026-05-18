"use client";
import Link from "next/link";
import { useState } from "react";

export default function CoworkingFlexOfficePage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 280) <= 28;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 1_800_000_000) <= 180_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Коворкинги и гибкие офисы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏢 Коворкинги и гибкие офисы</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #270. Коворкинги и flex-office РК (отличие от L5 «Технопарки» —
            здесь коммерческие коворкинги без венчурной поддержки): Multispace Алматы
            (4 этажа, 4500 м²), Workpoint Astana (3500 м²), Cowork Borovoe (1800 м²
            на курорте), GLAM Coworking Шымкент (2200 м²). Тарифы: hot-desk (плавающее
            место), dedicated desk (фиксированное), private office (от 1 чел до команды).
            Гибкая разводка LED + Cat6A + USB-C на потолке (modular system Logoele),
            переговорные boxes Framery с акустич. изоляцией, кофе + снэк-бар. WELL
            Building v2 + ASHRAE 62.1 + ANSI/ASA S12.60 (Acoustic Performance).
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав коворкинга</h2>
          <p className="text-slate-300 leading-relaxed">
            WELL Building v2 + ANSI/ASA S12.60 + COVID-Adapted Office Standards:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Hot-desk зоны (Open-space):</strong> 50% общей площади, регулир. столы Steelcase Stand-up, эргон. кресла Herman Miller Aeron, мониторы LG UltraWide 34".</li>
            <li><strong>Dedicated desk зоны:</strong> 25% площади, фиксированные места с шкафчиком и подставкой под кружку.</li>
            <li><strong>Private offices:</strong> 20% площади, 6-30 м² кабинеты для команд 1-12 человек, с собств. дверью и переговорным столом.</li>
            <li><strong>Переговорные boxes / Phone Booths:</strong> Framery O / Phone Booth акустически изолированные кабины для звонков, видеоконф, deep-work (NRC ≥0.85).</li>
            <li><strong>Большие переговорные:</strong> 6-20 чел с большим столом, проектором/ТВ Samsung Flip 75", whiteboard.</li>
            <li><strong>Кафе и кофе-станции:</strong> Premium-эспрессо-машины La Marzocco Linea Mini, кофе Specialty (Onyx, Stumptown), снэки healthy.</li>
            <li><strong>Lounge зоны:</strong> мягкая мебель для случайных встреч и отдыха, биофильный дизайн с растениями.</li>
            <li><strong>Технические:</strong> серверная для общего интернет-канала (100-1000 Mbps), резервный канал с автопереключением.</li>
            <li><strong>Принт-станция:</strong> МФУ HP LaserJet Enterprise + 3D-принтер (для творческих проектов).</li>
            <li><strong>Санузлы, душевые (для велосипедистов), nap-room, гардероб.</strong></li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Акустическое зонирование</h2>
          <p className="text-slate-300">
            Коворкинг 2000 м² с hot-desk + private offices + переговорными в одном
            пространстве. Главная задача — изоляция шумных зон от тихих. Какое
            решение по ANSI/ASA S12.60 + WELL Sound?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только звукопоглощающие потолочные плиты" },
              { v: "b", t: "Только звук-маскировка sound masking" },
              { v: "c", t: "Multi-zone Acoustic Design по ANSI/ASA S12.60 + WELL Sound: 1) Зонирование по типу активности: «focus zone» (deep work, ≤35 дБ background noise) — quiet pods и dedicated desks с акустическими экранами 1.4 м высотой Steelcase Brody (Sound Booth); «collaboration zone» (team work, ≤55 дБ) — hot-desks с lower screens; «social zone» (кафе, lounge, ≤60 дБ) — без ограничений на разговоры; 2) Physical separation — глухие стены EI60 между социальной зоной и фокусированными; 3) Акустические потолки Armstrong Optima 600×600 NRC 0.95 — поглощение реверберации, RT60 целевое ≤0.5 с в open-space; 4) Боковые стены — Acoustix Sopra Panel или Tectum + декоративный текстиль (живопись на acoustic substrate); 5) Полы — ковровое покрытие Forbo Tessera Stratos NRC 0.30 (снижение step noise); 6) Звукоизоляция между private offices: Rw ≥45 дБ (стены 2× ГКЛ + минвата 50 мм + второй слой ГКЛ); 7) Phone Booths Framery O — Rw=44 дБ изоляция, NRC ≥0.85 absorption внутри; 8) Sound masking system Cambridge Sound Q-1 в open-space — pink noise 47 дБ маскирующий приглушённые разговоры (privacy effective); 9) HVAC бесшумная NR≤35 (low-velocity ducts с шумоглушителями); 10) Регулярный аудит акустики Brüel & Kjær PULSE Sound Analyzer + обновление зонирования по обратной связи арендаторов; ANSI/ASA S12.60 + WELL v2 Sound + ISO 3382-3 (Acoustics in Office)" },
              { v: "d", t: "Только мягкая мебель в всех зонах" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во рабочих мест</h2>
          <p className="text-slate-300">
            Коворкинг 2000 м² полезной площади (без коридоров и санузлов).
            Структура: 50% hot-desk (8 м²/место с учётом проходов), 25% dedicated
            desk (6 м²/место), 20% private offices (12 м²/место), 5% переговорные
            и общие зоны (не считаются как рабочие места).
            Сколько рабочих мест всего?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S_hot = 2000 × 50% = 1000 м² / 8 = 125 мест<br />
            S_ded = 2000 × 25% = 500 м² / 6 = 83 мест<br />
            S_priv = 2000 × 20% = 400 м² / 12 = ?
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во рабочих мест"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 125 + 83 + (400/12=33) = 241 место + дополнит. в переговорных и lounge = ~280 рабочих мест в 2000 м² коворкинге. WeWork стандарт ~7-8 м²/место (более плотно), Premium коворкинги ~10 м²/место (комфортнее).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет коворкинга 2000 м²</h2>
          <p className="text-slate-300">
            Premium-коворкинг 2000 м² на 280 мест. ССЦ + импорт: ремонт «под ключ»
            (фальшпол + стены + потолки + отделка) — 240 млн тг,
            мебель Steelcase / Herman Miller (столы + кресла + шкафчики) — 220 млн тг,
            16 Framery O phone booths — 65 млн тг,
            12 больших переговорных + Samsung Flip 75" + AV — 95 млн тг,
            гибкая разводка Floor Box × 240 шт + Cat6A + USB-C — 120 млн тг,
            кофе-станции La Marzocco × 4 + Healthy Bar инвентарь — 28 млн тг,
            акустика Armstrong Optima + Acoustix Sopra + sound masking — 75 млн тг,
            HVAC прецизионный (UFAD под фальшполами) — 95 млн тг,
            СОУЭ + СОТ + СКУД биометрия + RFID-карты резидентов — 55 млн тг,
            IT-инфра + Wi-Fi 7 Cisco mesh + резервный канал (2× 1 Gbps) — 65 млн тг,
            душевые + nap-room + lounge зоны — 35 млн тг,
            принт-станция HP + 3D-принтер + сканер — 12 млн тг,
            ландшафтные дизайн biophilic + растения + кашпо — 28 млн тг,
            энергоснабжение + ДГУ резерв + UPS для серверной — 45 млн тг,
            проектирование + WELL/LEED Gold аудит — 85 млн тг,
            маркетинг + брендинг + первые 6 мес операц. — 100 млн тг,
            оборотные ср-ва + резерв на наполнение арендаторами — 95 млн тг,
            арендная плата за здание 2 года предоплата (если не собственное) — 320 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~1.8 млрд тг (допуск ±10%). 240+220+65+95+120+28+75+95+55+65+35+12+28+45+85+100+95+320 = 1.78 млрд тг ≈ 1.8 млрд тг. Удельная стоимость ~900 тыс. тг/м² (с арендой). Multispace Алматы (4500 м²) — оценочно $5-7 млн = 2.3-3.3 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Безопасность данных арендаторов</h2>
          <p className="text-slate-300">
            В коворкинге работают конкурирующие компании на одной общей сети.
            Что обязательно для защиты конфиденциальных данных каждого арендатора?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только сильный пароль на Wi-Fi" },
              { v: "b", t: "Только разделение Wi-Fi по тарифам (hot-desk/dedicated)" },
              { v: "c", t: "Только индивидуальные VPN для каждой компании" },
              { v: "d", t: "Multi-layer Data Security по ISO 27001 + GDPR + WeWork Security Best Practices: 1) Сетевое сегментирование — каждый арендатор получает изолированный VLAN с собственным DHCP scope (no cross-tenant traffic), отдельные SSID на Wi-Fi (Tenant_A_5G, Tenant_B_5G); 2) Firewall между VLAN — Cisco Catalyst CW9300W с ACL правилами запрета межтенант. трафика; 3) Каждый Floor Box имеет собственный port-VLAN binding — после аутентификации в RADIUS server пользователь автоматически получает доступ только к VLAN своей компании; 4) Гостевой Wi-Fi полностью изолирован (Guest Network) с captive portal, без доступа к рабочим VLAN; 5) Защита Wi-Fi WPA3 Enterprise (Personal-PSK уязвим к dictionary attacks) + 802.1X с сертификатами компании; 6) Запрет на shared принтеры/сканеры между арендаторами — индивид. печать через ключ-карту PrinterLogic; 7) Видеонаблюдение записывает только общие зоны (lounge, входы), не приватные офисы — privacy by design GDPR; 8) Phone booths — звукоизоляция Rw≥44 дБ + опционально дополнит. RF-shielding (Faraday Cage) для критичных переговоров; 9) Document Shredder в каждом офисе — крест-резка P-4 уровень для уничтожения распечатанных конфиденциальных документов; 10) Контракты с арендаторами включают NDA от коворкинга + ответственность за data breach; 11) Регулярный security audit (Pentest) — внешняя фирма-аудитор раз в 6 мес; 12) Compliance соответствие GDPR + ISO 27001 + СОЗВПТ Закон РК «О персональных данных»; ISO/IEC 27001 + GDPR Art. 32 + NIST SP 800-53 + СО3РК " },
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
                {score === 4 ? "Отлично — готовы к проектированию коворкинга" : score >= 2 ? "Перечитайте ANSI/ASA S12.60 + WELL Sound + ISO 27001" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> WELL Building Standard v2, ANSI/ASA S12.60 (Acoustic Performance Office), ISO 3382-3, ASHRAE 62.1, ISO/IEC 27001, GDPR Art. 32, NIST SP 800-53.</p>
          <p><strong>Реальные объекты РК:</strong> Multispace Алматы (4500 м², 4 этажа), Workpoint Astana (3500 м²), Cowork Borovoe (1800 м² на курорте), GLAM Coworking Шымкент (2200 м²), Smart Point Atyrau.</p>
        </section>
      </main>
    </div>
  );
}
