"use client";
import Link from "next/link";
import { useState } from "react";

export default function AgricultureResearchInstitutePage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 6_000) <= 600;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 16_000_000_000) <= 1_600_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Агро-НИИ + генбанки</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌱 Агро-НИИ + генбанки растений</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #278. КазНИИ земледелия и растениеводства Алмалыбак
            (Алматинская обл., с 1934 г, ~7000 видов в генбанке), НИИ зернового
            хозяйства им. Бараева (Шортанды, с 1957 г, селекция пшеницы
            «Шортандинская»), ВНИИР Сейфуллина Астана. Современные комплексы
            включают теплицы Venlo class A 1 га × 8 секций с climate control
            Priva Connext, фитотроны с Philips Greenpower LED TopLight 1100
            PPFD, генбанк семян −18 °C и −180 °C (LN₂) объёмом 6000 м³ (по
            модели Svalbard SGSV), молекулярно-биологические лаборатории
            BSL-2 + tissue culture. СН РК 3.02-115 + FAO ITPGRFA + Treaty 2001
            + ISTA International Rules for Seed Testing.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав агро-НИИ + генбанка</h2>
          <p className="text-slate-300 leading-relaxed">
            FAO Genebank Standards + ISTA + EU GMP class C + СН РК 3.02-115:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Теплица Venlo class A (high-tech glass):</strong> площадь 8×1 250 м² = 10 000 м² (8 секций), ВРС 6 м, остекление двухслойное Saint-Gobain Pilkington Optifloat 4-16-4 мм с low-E coating (солнечный фактор g = 0.7), мансардная крыша ребристая.</li>
            <li><strong>Климат-контроль Priva Connext:</strong> 6 ступеней — нагрев hot-water 60 °C от газового котла Viessmann + охлаждение Padcooling (испарительное) или Chillers Trane 250 кВт, увлажнение тумано-генераторами Coolnet, СО₂ enrichment до 1000 ppm от газового котла.</li>
            <li><strong>Светодиодное досвечивание Philips Greenpower LED:</strong> TopLight Compact 320 W (PPFD 1100 µmol/м²/с на высоте 2 м) — 8 ламп на 1 ряд × 30 рядов на секцию = 240 ламп × 8 секций = 1920 ламп. Спектр RB 80/20 (red + blue).</li>
            <li><strong>Фитотроны (climate chamber):</strong> 4-6 шт по 12-25 м², ±0.5 °C точность, ±2% RH, фотопериод 0-24 ч, T = 5-45 °C, влажность 30-95% — для имитации экстремального климата (для селекции засухо- и солеустойчивых сортов).</li>
            <li><strong>Гидропоника:</strong> NFT (Nutrient Film Technique) или Deep Water Culture для томатов/огурцов, ЭлектроРр (Electrical Conductivity) контроль 1.5-3.5 mS/см, pH 5.8-6.2 с автокоррекцией.</li>
            <li><strong>Генбанк семян (Cold Storage):</strong> 6000 м³ объёма, разделён на:
              <ul className="list-disc list-inside ml-6 space-y-1 mt-1">
                <li>Active collection — T = +4 °C / RH ≤ 50% (для distribution к селекционерам), seed viability 5-10 лет, объём ~1000 м³</li>
                <li>Base collection — T = −18 °C / RH ≤ 20% (long-term storage), seed viability 20-50 лет, объём ~4000 м³</li>
                <li>Cryo collection LN₂ — T = −180 °C (vapor phase) или −196 °C (liquid phase) для recalcitrant seeds (как Mango, Coconut), объём ~1000 м³</li>
              </ul>
            </li>
            <li><strong>Молекулярно-биологическая лаборатория BSL-2:</strong> ПЦР Roche LightCycler + Sanger sequencing 3500 Applied Biosystems + NGS Illumina MiSeq для DNA-fingerprinting сортов, безопасность ISO 15189 + WHO BSL-2.</li>
            <li><strong>Tissue culture (in-vitro):</strong> ламинар-кабинеты Klimaplus класс A (HEPA H14) для micropropagation редких сортов, рост агаризованной среды Murashige-Skoog (MS) в 1000 mл магент-сосудах.</li>
            <li><strong>Поля экспериментальные:</strong> 200-400 га делянок с автоматизированным микроклиматом (датчики Davis Vantage Pro2 + IoT LoRa), pivot-ирригация Valley 8000 series, дроны DJI Agras T40 для аэрозольной обработки.</li>
            <li><strong>Семеохранилище приёма:</strong> сушка семян до влажности 5-7% (для длительного хранения) в осушительной камере Rotronic с silicagel или molecular sieve 3Å.</li>
            <li><strong>Документация и БД:</strong> GRIN-Global (USDA + CGIAR open-source) — каталог 7000 сортов с passport data + characterization + evaluation; интеграция с FAO WIEWS (World Information on PGR).</li>
            <li><strong>Резервное копирование (back-up duplicate):</strong> отправка дублирующих образцов в Svalbard Global Seed Vault (Норвегия, 78° с.ш., −18 °C permafrost backup для 1 млн сортов мира) — РК уже отправляет с 2008 года.</li>
            <li><strong>Энергопитание:</strong> ТП 2×1000 кВА + дизельная резерв 500 кВА на 48 ч (критично для морозильных камер!) + UPS Eaton 9395 100 кВА × 15 мин.</li>
            <li><strong>Системы пожаротушения:</strong> газовое пожаротушение Inergen (N₂+Ar+CO₂) в генбанке (вместо воды, чтобы не порчить семена), ESFR-спринклер в теплицах.</li>
            <li><strong>Адм. корпус для научных сотрудников:</strong> 100-150 рабочих мест, библиотека сельхоз. литературы, конференц-зал 80 мест для FAO/CGIAR встреч.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Хранение семян генбанка</h2>
          <p className="text-slate-300">
            Генбанк РК 7000 сортов яровой пшеницы. Как обеспечить viability
            семян на 30-50 лет по FAO Genebank Standards 2014?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Обычные мешки в складе при T = +20 °C / RH = 60%" },
              { v: "b", t: "Только заморозка в обычном кухонном морозильнике −18 °C" },
              { v: "c", t: "Кратковременное хранение +4 °C без сушки семян" },
              { v: "d", t: "3-уровневое хранение по FAO Genebank Standards 2014 + IPGRI Guidelines: 1) Подготовка семян — досушивание до влажности 5-7% (orthodox seeds) или 25-35% (recalcitrant) в сушильной камере Rotronic с silicagel или molecular sieve 3Å, проверка влажности гигрометр Karl Fischer titrator KFT70 ± 0.1%; 2) Active collection (рабочая коллекция для distribution) — упаковка в алюм. фольгу пакетики 200-500 г + вакуум-сварка, хранение T = +4 °C / RH ≤ 50%, viability 5-10 лет, объём ~1000 м³, регулярная regen. через 5 лет; 3) Base collection (long-term backup) — упаковка двойная алюм. фольга + heat-seal vacuum, хранение T = −18 °C ± 1 °C / RH ≤ 20%, viability 30-50 лет; объём ~4000 м³ с 3-х контурным холодильным циклом и резервом DG; 4) Cryo collection — для recalcitrant seeds (Mango, Avocado) — vapor phase LN₂ T = −180 °C или liquid LN₂ T = −196 °C в Dewar 5 м³ Air Liquide LD-5K, viability >100 лет; 5) Аудит viability — germination test 1 раз / 5 лет (ISTA-rules): 400 семян в 4 повторностях на фильтр-бумаге +20 °C, считают % всхожести; если падает <85% (initial value) — re-generation через посадку в поле; 6) Регенерация семян — каждые 20-30 лет высев сорта в чистоту (isolation distance 200 м для пшеницы) с rogueing посторонних типов; 7) Документация passport — каждый accession имеет уникальный ID (например, KZN-1234) + acquisition data + taxonomy + characterization + evaluation (через FAO multi-crop passport descriptors); 8) Back-up duplicate — отправка 500 г образца в Svalbard Global Seed Vault как «safety duplicate» каждые 10 лет; 9) Безопасность — биометрия + СКУД + газовое пожаротушение Inergen (вода погубит семена), резерв питания DG 500 кВА на 48 ч; 10) Сертификация — ISTA Member Laboratory + CGIAR (Consultative Group on International Agricultural Research) compliance audit; FAO Genebank Standards 2014 + ITPGRFA 2001 + ISTA International Rules + IPGRI Handbook + EU 1829/2003 ОГМО" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём генбанка</h2>
          <p className="text-slate-300">
            Генбанк хранит 7000 accession сортов × 3 повторности × средн.
            упаковка 200 г = 4.2 т семян. Базовое хранение −18 °C занимает 80%
            ёмкости, активное +4 °C — 20%. Плотность стеллажного хранения в
            алюм. упаковке 70 кг/м³. + 30% коэф. проходов между стеллажами +
            10% для cryo LN₂ камеры. Объём генбанка (м³, округл. до тыс.):
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="м³"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> 4 200 кг ÷ 70 кг/м³ ≈ 60 м³ базовый объём
                стеллажей. + 30% коэф. проходов = 78 м³. + 10% cryo LN₂ камера
                = 86 м³. Но это только семена пшеницы — реальный полнофункц.
                генбанк РК на 7000 сортов всех культур (пшеница, ячмень, рис,
                кукуруза, бобовые, технические) с резервом расширения на 20 лет
                ⇒ ≈ <strong>6000 м³</strong> (как Svalbard SGSV: 10 000 м³ на
                4.5 млн accession в полном объёме). FAO Genebank Standards 2014.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс агро-НИИ</h2>
          <p className="text-slate-300">
            Агро-НИИ + генбанк РК «под ключ» (8 секций Venlo 1 га + генбанк 6000 м³ + лаборатории):
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земляные + фундаменты теплиц 10 000 м² × 10 000 тг = 0.1 млрд тг</li>
            <li>Теплица Venlo class A: каркас стальной + 2-слойное остекление Saint-Gobain + крыша open-roof (10 000 м² × 220 000 тг) = 2.2 млрд тг</li>
            <li>Climate control Priva Connext (нагрев + охлаждение Padcooling + СО₂ + увлажнение) на 8 секций = 0.6 млрд тг</li>
            <li>LED-досвечивание Philips Greenpower 1920 ламп × 250 000 тг = 0.48 млрд тг</li>
            <li>Фитотроны 6 шт × 20 м² × 6 млн тг/м² = 0.72 млрд тг</li>
            <li>Гидропоника NFT 5000 м² × 30 000 тг = 0.15 млрд тг</li>
            <li>Генбанк-здание ж/б склад с холодильным контуром 6000 м³ + стеллажи + изоляция Kingspan PIR 200 мм = 1.6 млрд тг</li>
            <li>Холодильные установки −18 °C × 2 (резерв) + +4 °C × 2 (Carrier Aquasnap 300 кВт каждая) = 0.85 млрд тг</li>
            <li>Cryo LN₂ Dewar 5 м³ Air Liquide × 2 + LN₂-генератор 50 л/час + автоматика = 0.4 млрд тг</li>
            <li>Молекулярно-биол. лаборатория BSL-2 200 м² + ПЦР Roche + Sanger ABI 3500 + NGS Illumina MiSeq = 1.2 млрд тг</li>
            <li>Tissue culture лаборатория ISO 14644 класс A + HEPA H14 + ламинар-кабинеты × 6 = 0.5 млрд тг</li>
            <li>Семеохранилище приёма + сушка Rotronic + Karl Fischer KFT70 = 0.2 млрд тг</li>
            <li>Поля 200 га + pivot-ирригация Valley 8000 + дрон DJI Agras T40 × 3 + датчики IoT = 0.95 млрд тг</li>
            <li>ТП 2×1000 кВА + DG 500 кВА × 48 ч + UPS Eaton 9395 100 кВА = 0.35 млрд тг</li>
            <li>Газовое пожаротушение Inergen в генбанке + ESFR в теплицах + СКУД биометрия + CCTV = 0.45 млрд тг</li>
            <li>БД GRIN-Global + интеграция WIEWS + сервер Dell PowerEdge R750 = 0.18 млрд тг</li>
            <li>Адм. корпус 1500 м² + библиотека + конф.-зал 80 мест = 1.2 млрд тг</li>
            <li>Подъездная дорога + ЛЭП + газопровод + проектирование 4% + ПИР + НР + СП + сертификация ISTA = 4 млрд тг</li>
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
                <strong>Ответ:</strong> ~16 млрд тг (~$33M USD) — полнофункц. агро-НИИ
                + генбанк + 1 га high-tech теплицы. Главные статьи:
                Venlo-теплица 14% + генбанк (здание + холод + cryo) 18% + молбиол лаборат. 8%.
                Финансирование — МСХ РК + грант FAO/CGIAR + WIEWS/ITPGRFA фонд.
                Окупаемость не прямая (научно-социальная) — но семена дают
                +15-20% урожайность через 10 лет селекции (КП «Шортандинская»
                +30% относительно местных).
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Регенерация семян</h2>
          <p className="text-slate-300">
            Генбанк хранит 7000 сортов пшеницы в base collection (−18 °C, 30-50 лет
            viability). Через сколько лет нужно re-generation accession и почему?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никогда — семена хранятся вечно при −18 °C" },
              { v: "b", t: "Каждый год — обязательная регенерация для свежести" },
              { v: "c", t: "Каждые 20-30 лет ИЛИ когда germination drops <85% initial: 1) Принцип FAO Genebank Standards 2014 — viability monitoring каждые 5 лет ISTA germination test (400 семян × 4 повторности на фильтр-бумаге +20 °C / 7 дн); 2) Если viability падает с initial 98-99% до <85% — accession уходит в «red flag» список для регенерации; 3) Регенерация — высев в поле с изоляц. расстоянием 200 м (для пшеницы яровой) от других сортов чтобы не было cross-pollination, rogueing нетипичных растений, harvest вручную (для чистоты сорта); 4) Объём семян для регенерации — 1 кг для пшеницы (даёт 2-3 т урожая, из которых 200-500 г возвращается в base collection как новая accession); 5) Selection pressure — при регенерации может происходить «дрифт» популяции (некоторые алели теряются), поэтому количество растений ≥ 200 шт для self-pollinated (пшеница) и ≥ 1000 для cross-pollinated (рожь); 6) Документация — каждая регенерация добавляет новый «sub-accession» с уникальным ID (KZN-1234-r1, KZN-1234-r2), passport data обновляется в GRIN-Global; 7) Альтернатива регенерации — cryopreservation LN₂ (T = −196 °C) — viability >100-300 лет без re-generation, но дороже и не подходит для всех видов; 8) Особый случай — orthodox seeds (пшеница, ячмень, кукуруза) — desiccation-tolerant, хорошо хранятся; recalcitrant (Mango, Coconut, Avocado) — не выносят desiccation и кратко хранятся даже при −18 °C; 9) Back-up в Svalbard — РК отправляет дубликат каждой регенерации в Svalbard Global Seed Vault (Норвегия) как «backup of last resort»; 10) Бюджет — регенерация 200 accession в год × 2 млн тг/accession = 400 млн тг/год эксплуатационных расходов; FAO Genebank Standards 2014 + IPGRI Handbook + ISTA + Treaty ITPGRFA 2001" },
              { v: "d", t: "Каждые 5 лет обязательно для всех 7000 сортов" },
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
              {score === 4 && "Отлично! Ты владеешь FAO Genebank Standards + ITPGRFA."}
              {score === 3 && "Хорошо. Перечитай FAO Genebank Standards 2014 + IPGRI Handbook."}
              {score === 2 && "Уровень C — пересмотри СН РК 3.02-115 + ISTA Rules."}
              {score <= 1 && "Нужно повторить. См. Treaty ITPGRFA 2001 + GRIN-Global API."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>СН РК 3.02-115</strong> — Сельскохозяйственные здания и сооружения</li>
            <li><strong>Treaty ITPGRFA 2001</strong> — International Treaty on Plant Genetic Resources for Food and Agriculture (FAO)</li>
            <li><strong>FAO Genebank Standards 2014</strong> — для orthodox/intermediate/recalcitrant seeds и in-vitro/cryo</li>
            <li><strong>IPGRI Handbook 1985</strong> — Plant Genetic Resources Conservation Handbook (CGIAR)</li>
            <li><strong>ISTA International Rules for Seed Testing 2024</strong> — для germination/viability tests</li>
            <li><strong>FAO WIEWS</strong> — World Information and Early Warning System on PGRFA</li>
            <li><strong>Svalbard Global Seed Vault (SGSV) Norway</strong> — back-up duplicate storage standard</li>
            <li><strong>GRIN-Global</strong> — USDA + CGIAR open-source genbank database</li>
            <li><strong>Convention on Biological Diversity (CBD) 1992</strong> — Nagoya Protocol on ABS</li>
            <li><strong>EU 1829/2003</strong> — Regulation on genetically modified food and feed</li>
            <li><strong>WHO BSL-2 Biosafety Manual</strong> — для молекулярно-биол. лабораторий</li>
            <li><strong>ISO 15189</strong> — Medical/biological laboratories quality management</li>
            <li><strong>ISO 14644</strong> — Cleanrooms (для tissue culture)</li>
            <li><strong>FAO Multi-Crop Passport Descriptors v2.1</strong> — стандарт passport data accession</li>
            <li><strong>CGIAR Consortium for International Agricultural Research</strong> — глоб. сеть НИИ</li>
            <li><strong>Закон РК «О семеноводстве»</strong> — № 392 от 08.02.2003</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
