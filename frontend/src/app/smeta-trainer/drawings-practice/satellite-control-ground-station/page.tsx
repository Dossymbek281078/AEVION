"use client";
import Link from "next/link";
import { useState } from "react";

export default function SatelliteControlGroundStationPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 13) <= 1.5;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 12_000_000_000) <= 1_200_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Спутниковые станции управления</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">📡 Спутниковые станции управления GS</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #289. Акколь Aizak Satellite Ground Station (АО «Қазақстан
            Ғарыш Сапары» / Казахстанско-французское предприятие, управление
            KazSat-2/3, KazEOSat-1/2, спутники-разведчики), станция Жезказган
            (полигон), Алматы Bayterek Telemetry. Спутниковая GS управляет
            орбитой sat через uplink commands + receives downlink telemetry +
            payload data. Антенны Cassegrain dual-reflector parabolic
            Ø9-13 м (GEO Ka-band 26-40 ГГц для high-throughput) или Ø3-5 м
            (LEO X-band 8-12 ГГц для optical recon), motorised tracking
            azimuth+elevation 0.01° точность. ECSS-E-ST-50C + CCSDS 401.0-B-30
            + ITU-R S.1428-1 + СН РК 4.04-09 + Закон РК «О связи».
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав GS станции управления</h2>
          <p className="text-slate-300 leading-relaxed">
            ECSS-E-ST-50C + CCSDS + ITU-R + IEC 60945 + СН РК 4.04-09:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Antenna Cassegrain Ø13 м:</strong> dual-reflector parabolic main + hyperbolic sub-reflector, surface accuracy λ/40 RMS (~0.5 мм для Ka-band 30 ГГц), материал — алюминиевые сегментные панели Vertex Antennentechnik с CFRP-back, weight 25-40 т, gain 65-68 dBi G/T 35-40 dB/K.</li>
            <li><strong>Antenna mount:</strong> azimuth-elevation 2-axis sun-tracker (azimuth 0-360° непрерывный slip-ring, elevation 0-90°), редукторы Bonfiglioli precision 1:50 000 ratio, motor servomotor Siemens S120 с encoder Heidenhain 28-bit для точности 0.01° (=36 угл. сек, лучше требований ITU-R S.1428 0.1°).</li>
            <li><strong>Radome (опц.):</strong> рацио-прозрачный купол FRP fiberglass 6 мм + foam core 25 мм + outer GRP, диаметр 18-20 м для антенны 13 м, защита от ветра 200 км/ч + obледенения; loss 0.3-0.5 dB при сухом, 1-2 dB при дожде.</li>
            <li><strong>RF Feed:</strong> dual-polarization horn antenna в фокусе sub-reflector, OMT (Ortho-Mode Transducer) разделяет H и V поляризации, waveguide WR-28 (Ka-band 26-40 ГГц), LNA (Low-Noise Amplifier) cryo-cooled Cassegrain output T_sys 50-80 K.</li>
            <li><strong>LNA + Down-converter:</strong> LNA Norsat 8000 series с шумовой температурой 30-50 K, GaAs HEMT, gain 60 dB; D/C Comtech RT-RX150 converts Ka 30 GHz → IF 1-1.5 GHz для analog cabling в shelter.</li>
            <li><strong>Modem + baseband:</strong> Comtech CDM-Series satellite modem, DVB-S2X / CCSDS PCM/PSK/PM для telemetry, BPSK/QPSK/8PSK/16APSK modulation, FEC LDPC + DVB-S2 8/9 rate.</li>
            <li><strong>HPA (High Power Amplifier):</strong> для uplink — TWTA Travelling Wave Tube Amplifier 500-3000 Вт (для uplink mission control commands) Thales / CPI, output Ka 30 GHz, water-cooled.</li>
            <li><strong>Tracking receiver:</strong> dual-channel monopulse tracking receiver — detects sat in beam pattern и обновляет azimuth+elevation сигналы для motor controller, обеспечивает auto-track tolerance 0.005° от boresight.</li>
            <li><strong>Mission Operations Center MOC:</strong> control room 200-500 м² для операторов (24/7 4-сменка), мониторы 4K wall-mounted 12 шт, real-time orbital displays + telemetry plots + command authorisation; ECSS-E-ST-50-13 уровни безопасности (operator/supervisor/manager).</li>
            <li><strong>Cybersecurity:</strong> air-gapped network для commanding (no internet connection), FIPS 140-2 Level 3 encryption AES-256 на uplink commands, RBAC role-based access control + biometric+RFID + PKI certificates.</li>
            <li><strong>Time reference:</strong> Rubidium clock Symmetricom (precision ±10⁻¹¹) + GPS-disciplined oscillator + NTP server stratum-1 для time-sync командного потока.</li>
            <li><strong>RFI shielding (Radio Frequency Interference):</strong> mu-metal shielding в местах sensitive electronics + Faraday cage 60 dB attenuation для MOC + bandpass filters на front-end; критично для LEO X-band где shared с radar/military.</li>
            <li><strong>Anti-RFI environment:</strong> «quiet zone» radius 1-3 км от antenna без излучателей (мобильная связь + WiFi запрещены, спецpermit для exemption).</li>
            <li><strong>UPS + DG backup:</strong> UPS Eaton 9395 100 кВА × 30 мин + DG Caterpillar 1500 кВА на 72 ч + automatic transfer switch (ATS) ≤10 мс (mission-critical, нельзя терять связь с sat).</li>
            <li><strong>Met station + sun tracker:</strong> wind speed/direction (Vaisala WMT700) + temperature + humidity + barometer; используется для compensation atmospheric refraction (5-10 угл. сек bias при low elevation).</li>
            <li><strong>Адм. блок + workshop:</strong> 1000-2000 м² для engineering, simulators, лаборатория RF (network analyzer Keysight + spectrum), maintenance shop, библиотека documentation.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Antenna size для Ka-band</h2>
          <p className="text-slate-300">
            Aizak GS принимает downlink с KazSat-3 на Ka-band 20 ГГц.
            Distance to sat 36 786 км GEO. Какая антенна по ITU-R S.1428 +
            CCSDS link budget?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Антенна Ø1 м — это достаточно для всего" },
              { v: "b", t: "Антенна Ø50 м — больше точно лучше" },
              { v: "c", t: "Не нужна антенна вообще — спутник передаёт цифровыми сигналами" },
              { v: "d", t: "Cassegrain Ø13 м для Ka-band downlink с KazSat-3 GEO по CCSDS Link Budget + ITU-R S.1428: 1) Gain formula G = η·(πD/λ)² где λ=15 мм (20 ГГц), η=65% (Cassegrain типичный), D=13 м ⇒ G = 0.65 × (π×13/0.015)² ≈ 4.8·10⁶ = 67 dBi; 2) Link budget — sat EIRP 65 dBW (TWTA 100 Вт × antenna 35 dBi), path loss FSL = 32.45 + 20·log10(d_km) + 20·log10(f_MHz) = 32.45 + 91.3 + 86.0 = 210 dB; 3) G/T (figure of merit) — критическая характеристика, G/T = G_antenna − 10·log(T_sys), для Ø13 m × T_sys 80 K (cryo-cooled LNA) ⇒ G/T = 67 − 19 = 48 dB/K; ITU-R S.1428 требует G/T ≥35 dB/K для commercial Ka; 4) Pointing accuracy — beam-width θ_3dB = 70·λ/D = 70·0.015/13 = 0.08° (== 5 угл. мин), требуется tracking ±0.02° = 1/4 от beamwidth, обеспечивается monopulse auto-track + encoder Heidenhain 28-bit 0.01°; 5) Rain fading Ka-band — на дожде 10-25 мм/ч на 20 ГГц теряется 5-15 dB; компенсация — uplink power control + adaptive modulation (DVB-S2X auto-switch QPSK → BPSK при degraded link); 6) Atmospheric refraction — на elevation <15° есть bias 5-10 угл. сек, корректируется automatic raytrace модель + GPS-corrected ephemeris; 7) Surface accuracy — для 20 GHz λ/40 = 0.4 мм RMS, требует CFRP-backed aluminium panels Vertex Antennentechnik с factory pre-stressed; 8) Foundation — antenna 35 т + wind load 200 km/h ⇒ изгиб 8-15 мм на edge => активная компенсация (laser metrology system) или жёсткая foundation 30×30×3 м ж/б 1000 т; 9) Radome необязательно (не используется на Aizak), но защита 1 дБ wet loss vs 1 дБ от radome = wash, plus ice shedding issues; 10) Альтернатива — массив малых антенн Ø3 м × 4 шт в phased-array (как Capella SAR) — гибче но capex 3-4× больше; ITU-R S.1428-1 + CCSDS 401.0-B-30 + ECSS-E-ST-50C + IEC 60945 + ITU-R V.431" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Диаметр antenna для G/T=48</h2>
          <p className="text-slate-300">
            ITU-R S.1428 требует G/T ≥35 dB/K для commercial Ka-band GS.
            Имеем cryo-cooled LNA T_sys=80 K (системная T_sys), antenna η=65%,
            λ=15 мм (20 ГГц). G/T = 10·log(η·(πD/λ)²) − 10·log(T_sys) =
            10·log(η)+20·log(πD/λ) − 10·log(80). Какой минимальный диаметр D
            антенны (м, округл. до целых) для G/T = 48 dB/K?
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
                <strong>Ответ:</strong> 48 = 10·log(0.65) + 20·log(πD/0.015) − 10·log(80)
                = −1.87 + 20·log(πD/0.015) − 19.03 ⇒ 20·log(πD/0.015) = 68.9
                ⇒ πD/0.015 = 10^3.445 = 2786 ⇒ D = 2786·0.015/π ≈ <strong>13.3 м</strong>.
                Это реальный диаметр Aizak GS Ø13 м antenna. ITU-R S.1428 + CCSDS.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс GS станции</h2>
          <p className="text-slate-300">
            Aizak GS Ø13 m Ka-band + MOC + cybersecurity «под ключ»:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земляные + foundation ж/б 30×30×3 м под antenna 1000 т + дренаж = 0.55 млрд тг</li>
            <li>Antenna Cassegrain Ø13 м Vertex Antennentechnik aluminium panels + CFRP back λ/40 RMS = 3.2 млрд тг</li>
            <li>Antenna mount AZ-EL Bonfiglioli + Siemens S120 servos + Heidenhain 28-bit encoder = 1.4 млрд тг</li>
            <li>Radome опц. FRP fiberglass Ø19 м (на Aizak не используется) = 0 (исключено)</li>
            <li>RF feed dual-pol horn + OMT + waveguide WR-28 Ka-band = 0.18 млрд тг</li>
            <li>LNA Norsat 8000 cryo-cooled T_sys 50-80 K + cooling Sumitomo cryocooler = 0.45 млрд тг</li>
            <li>D/C Comtech RT-RX150 + frequency conversion + filters = 0.12 млрд тг</li>
            <li>Modem Comtech CDM-Series DVB-S2X 1 Gbps + FEC LDPC = 0.18 млрд тг</li>
            <li>HPA TWTA Thales 2000 Вт Ka-band water-cooled + redundant = 0.85 млрд тг</li>
            <li>Tracking monopulse receiver + auto-track loop 0.005° = 0.32 млрд тг</li>
            <li>MOC 400 м² control room + monitors Bahn 4K wall × 12 + operator desks = 0.85 млрд тг</li>
            <li>Cybersecurity air-gapped network + FIPS 140-2 Level 3 + AES-256 + PKI = 0.65 млрд тг</li>
            <li>Time ref Rubidium Symmetricom + GPS-disciplined + NTP stratum-1 = 0.18 млрд тг</li>
            <li>RFI shielding mu-metal MOC + Faraday cage 60 dB + bandpass filters = 0.42 млрд тг</li>
            <li>UPS Eaton 9395 100 кВА × 30 мин + DG Caterpillar 1500 кВА 72 ч + ATS = 0.95 млрд тг</li>
            <li>Met station Vaisala WMT700 + sun tracker + atmospheric model = 0.05 млрд тг</li>
            <li>Adm 1500 м² + workshop + RF lab Keysight network analyzer + spectrum = 0.85 млрд тг</li>
            <li>Подъездная дорога + ЛЭП 35 кВ + connect to КЕГОК + benhowse + landscape = 0.65 млрд тг</li>
            <li>ESIA + ITU/Roscosmos certification + СН РК commissioning + проектирование 4% + PNR + insurance = 0.95 млрд тг</li>
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
                <strong>Ответ:</strong> ~12 млрд тг (~$25M USD) — стандарт single-antenna
                Ka-band GS. Большая статья — antenna+mount (38%) + cybersecurity (5%)
                + MOC + monitors (7%). ITU-R + CCSDS Standards.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Cybersecurity sat command</h2>
          <p className="text-slate-300">
            Uplink commands to KazSat-3 — критическая команда (могут изменить
            orbit / включить payload / disable). Что обязательно по NIST
            SP 800-82 + CCSDS Security?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никакой защиты — космос недоступен злоумышленникам" },
              { v: "b", t: "Простой WPA2 password для wifi-связи" },
              { v: "c", t: "Полный комплекс по NIST SP 800-82 + CCSDS Security Architecture + ECSS-E-ST-50-13: 1) Air-gapped network — MOC полностью изолирован от internet, все updates через одностороннюю diode network bridge (data flow только outbound logs); 2) AES-256 + HMAC-SHA-256 шифрование uplink commands (FIPS 140-2 Level 3 hardware crypto modules Thales Luna HSM); 3) PKI X.509 certificate chain — каждая команда подписывается оператором + supervisor + manager (3-key rule по NIST), no single point of compromise; 4) RBAC + biometric — operator может только monitor, supervisor — change parameter, manager — orbit maneuver; биометрия отпечаток+iris+RFID + 2FA token YubiKey; 5) Command spoofing prevention — каждая команда имеет sequence-number + timestamp + nonce + encrypted with sat-specific session key (rotation ежесуточно); 6) Spread spectrum FH+DS — uplink command channel использует frequency-hopping (FH) + direct-sequence spread (DS) spectrum для protection от RF jamming; 7) Telemetry encryption downlink — sat data также encrypted AES-256, иначе adversary может intercept and gain awareness; 8) Operational security OPSEC — no scheduled commanding times, randomised pass schedule + decoy traffic для traffic-analysis prevention; 9) Incident response — 24/7 SOC monitoring all command logs + anomaly detection ML (UEBA — User Entity Behaviour Analytics), automatic kill-switch при >2 invalid auth attempts; 10) Audit + compliance — quarterly external penetration test + SOC 2 Type II audit + ISO 27001 certification + reports to КАЭН РК + Mil Force; NIST SP 800-82 + CCSDS 350.0-G-3 Security Architecture + ECSS-E-ST-50-13 + FIPS 140-2 + ISO/IEC 27001 + ITU-R RS.2065" },
              { v: "d", t: "Только пароли в текстовых файлах + email connect" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold transition">
          Проверить ответы
        </button>

        {showResults && (
          <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}>
            <h2 className="text-2xl font-bold text-slate-50">Результат: {score} / 4</h2>
            <p className="mt-2 text-slate-300">
              {score === 4 && "Отлично! Ты знаешь satellite ground stations."}
              {score === 3 && "Хорошо. Перечитай ITU-R S.1428 + CCSDS 401.0-B-30."}
              {score === 2 && "Уровень C — пересмотри ECSS-E-ST-50C + NIST SP 800-82."}
              {score <= 1 && "Нужно повторить. См. ECSS standards + FIPS 140-2."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>ECSS-E-ST-50C</strong> — Communications (European Cooperation for Space Standardization)</li>
            <li><strong>ECSS-E-ST-50-13</strong> — Operations interface</li>
            <li><strong>CCSDS 401.0-B-30</strong> — Radio Frequency and Modulation Systems (Consultative Committee for Space Data Systems)</li>
            <li><strong>CCSDS 350.0-G-3</strong> — Security Architecture for Space Data Systems</li>
            <li><strong>ITU-R S.1428-1</strong> — Reference FSS earth-station antenna patterns</li>
            <li><strong>ITU-R RS.2065</strong> — Protection of Earth Stations on Mobile Platforms</li>
            <li><strong>ITU-R V.431</strong> — Nomenclature of the frequency and wavelength bands</li>
            <li><strong>IEC 60945</strong> — Maritime navigation and radiocommunication equipment</li>
            <li><strong>NIST SP 800-82</strong> — Guide to Industrial Control Systems Security</li>
            <li><strong>FIPS 140-2 Level 3</strong> — Security Requirements for Cryptographic Modules</li>
            <li><strong>ISO/IEC 27001</strong> — Information Security Management Systems</li>
            <li><strong>NASA-STD-2100</strong> — Software Engineering Requirements</li>
            <li><strong>СН РК 4.04-09</strong> — Электрические станции (применимо к GS)</li>
            <li><strong>Закон РК «О связи»</strong> — № 567-II от 05.07.2004</li>
            <li><strong>Roscosmos GOST RV 56-12</strong> — Космическая техника наземная</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
