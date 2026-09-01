"use client";

import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { repoUrl } from "@/lib/repoUrl";

const IDEAS = [
  {
    title: "QSign — государственная e-подпись",
    desc: "Post-quantum FIPS 204 — реализовано, включается ключом подписи. Потенциал: нацинфраструктура KZ / UAE / SA.",
    arr: "$20-100M/год",
    accent: "#10b981",
    ready: "В проде",
  },
  {
    title: "AEVION Bank — лицензированный цифровой банк",
    desc: "DIFC-лицензия + QSign-аттестация всех операций. Shariah-совместимая структура возможна.",
    arr: "$200M+/год к году 5",
    accent: "#3b82f6",
    ready: "Фундамент готов",
  },
  {
    title: "IP Bureau (QRight v2)",
    desc: "Первый IP-реестр с on-chain аттестацией для AI-контента. Партнёрство с национальным патентным ведомством.",
    arr: "$10-50M/год",
    accent: "#8b5cf6",
    ready: "MVP в проде",
  },
  {
    title: "DevHub — Zapier для MENA/CIS",
    desc: "15 SaaS-подписок → 1 кабинет. 9 интеграций live. Zapier и Make не работают нормально в этих рынках.",
    arr: "$50-150M/год",
    accent: "#f59e0b",
    ready: "9 интеграций live",
  },
  {
    title: "QCoreAI — AI API для госсектора MENA/CIS",
    desc: "Anthropic/OpenAI не имеют compliance-дружественного присутствия в KZ/UZ/AZ. QCoreAI = «последняя миля» AI.",
    arr: "$30-80M/год",
    accent: "#ec4899",
    ready: "364 vitest, 5+ провайдеров",
  },
];

const DEAL = [
  { label: "Форма", value: "Партнёрство, не выкуп. Основатель остаётся." },
  { label: "Финансирование", value: "$10M возвратным авансом от партнёра" },
  { label: "Смысл аванса", value: "Освободить основателя от текущих компаний → фул-тайм на идеи AEVION" },
  { label: "Деление дохода", value: "51% основатель / 49% партнёр (стартовая рамка)" },
  { label: "Чем платит партнёр", value: "В основном ресурсами (compute, инженеры, дистрибуция, бренд)" },
  { label: "Роль основателя", value: "Chief Idea Officer — автор следующих идей, мажоритарная доля" },
  { label: "Бренд", value: "AEVION сохраняется (не merge в партнёра)" },
  { label: "Токен AEV", value: "Вынесен из периметра (ring-fenced)" },
  { label: "Вето основателя", value: "Constitution v1 — изменения только с письменного согласия" },
  { label: "Due diligence", value: "Tech + legal + financial, 30 дней" },
  { label: "Эксклюзивность", value: "60 дней с подписания LOI" },
  { label: "Контакт", value: "yahiin1978@gmail.com" },
];

// Partnership upside is the partner's 49% of project revenue as ARR grows —
// not an equity valuation. Figures are forward projections, not guarantees.
const SCENARIO = [
  { year: "Год 1", arr: "$15-30M", val: "$7-15M", color: "#10b981" },
  { year: "Год 3", arr: "$130M", val: "$64M", color: "#3b82f6" },
  { year: "Год 5", arr: "$360-490M", val: "$176-240M", color: "#a855f7" },
];

export default function PartnerPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #050810 0%, #0a0e1a 40%, #0f172a 100%)",
      color: "#f8fafc",
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    }}>
      <Wave1Nav />

      {/* HERO */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 80px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.28em", color: "#10b981", textTransform: "uppercase", marginBottom: 20 }}>
          Innovation Partnership · Вы покупаете двигатель идей, не снимок
        </div>
        <h1 style={{ fontSize: "clamp(34px, 5.5vw, 68px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 24 }}>
          Инструментов в мире — избыток.<br />
          <span style={{ background: "linear-gradient(135deg, #10b981, #3b82f6, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Идей такого калибра — нет.
          </span>
        </h1>
        <p style={{ fontSize: 20, color: "#cbd5e1", maxWidth: 820, lineHeight: 1.6, marginBottom: 16 }}>
          AI пишет код. Инженеры нанимаются за неделю. Капитал — в избытке.
          <strong style={{ color: "#f8fafc" }}> Единственный дефицитный ресурс — идея: что строить,
          почему сейчас, и как связать то, что другие видят по отдельности.</strong>
        </p>
        <p style={{ fontSize: 17, color: "#94a3b8", maxWidth: 800, lineHeight: 1.6, marginBottom: 36 }}>
          Вы покупаете не 30 продуктов и не QSign — это копируется. Вы покупаете
          доказанную машину генерации идей (30+ модулей за 6 месяцев, один человек)
          и право владеть всем, что она произведёт дальше. Вы приводите команду и капитал.
          Двигатель остаётся в компании как Chief Idea Officer — навсегда.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 40 }}>
          <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20Innovation%20Partnership%20-%20LOI%20inquiry" style={btnPrimary}>
            Запросить LOI · yahiin1978@gmail.com
          </a>
          <Link href="/partner#deal" style={btnGhost}>Условия сделки</Link>
          <Link href="/status" style={btnGhost}>Live health-board</Link>
          <Link href="/partner/print" style={btnGhost}>PDF brief →</Link>
        </div>

        {/* ROI CALLOUT — самое важное число для инвестора */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1, background: "rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(16,185,129,0.25)" }}>
          {[
            { label: "Форма", val: "Партнёрство", sub: "не выкуп — основатель остаётся", color: "#94a3b8" },
            { label: "Аванс", val: "$10M", sub: "возвратный · + ресурсы партнёра", color: "#10b981" },
            { label: "Доход", val: "51 / 49", sub: "основатель / партнёр", color: "#3b82f6" },
            { label: "Роль основателя", val: "Chief Idea Officer", sub: "мажоритарная доля · автор идей", color: "#a855f7" },
          ].map((c, i) => (
            <div key={c.label} style={{ padding: "24px 28px", background: i === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>{c.label}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: c.color, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 6 }}>{c.val}</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* WHY PARTNERSHIP MODEL */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
            Почему эта модель лучше acquisition
          </div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 36 }}>
            Вы платите не за код. За человека, который думает иначе.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {[
              {
                t: "Что вы покупаете", d: "Не код — мышление. 30+ продуктов за 6 месяцев = доказательство скорости идей. Следующие 30 придут, пока конкуренты копируют первые 30.",
                accent: "#10b981",
              },
              {
                t: "Что уже защищено", d: "Авторское право (179 стран, Бернская конвенция), prior art через QRight, коммерческая тайна через QShield. Юридически — сегодня.",
                accent: "#3b82f6",
              },
              {
                t: "Почему основатель остаётся", d: "Сохраняет 51% дохода и остаётся Chief Idea Officer — автор следующих идей AEVION, бренд за ним. Уходить невыгодно ни ему, ни вам: ценность в человеке, а не в коде.",
                accent: "#a855f7",
              },
              {
                t: "Финансовая безопасность", d: "DIFC Dubai: 0% CGT, английское право, DIFC Courts. Опциональный secondary-транш основателю (часть чека) — через эскроу, независимый банк, при закрытии.",
                accent: "#f59e0b",
              },
            ].map(c => (
              <div key={c.t} style={{ padding: 24, background: "rgba(255,255,255,0.03)", border: `1px solid ${c.accent}30`, borderRadius: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: c.accent, marginBottom: 10 }}>{c.t}</div>
                <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6 }}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VERIFY NOW — technical team section */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px 0" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
          Проверьте прямо сейчас — без НДА, без нашего слова
        </div>
        <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 12 }}>
          Это не готовые продукты. Это доказательства скорости мышления.
        </h2>
        <p style={{ fontSize: 16, color: "#94a3b8", marginBottom: 28, lineHeight: 1.6, maxWidth: 780 }}>
          Каждый модуль — MVP: концепция подтверждена, фундамент заложен, polish — работа вашей команды.
          Правильный вопрос не «готово ли это прямо сейчас», а
          {" "}<strong style={{ color: "#f8fafc" }}>«что ваша команда сделает из этого за 6 месяцев?»</strong>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 24 }}>
          {[
            { label: "130+ PR · 500+ коммитов на GitHub", href: repoUrl(), note: "Объём работы одного человека — верифицируется по git log", color: "#10b981" },
            { label: "GET /api/aevion/catalog", href: "https://aevion.app/api-backend/api/aevion/catalog", note: "JSON реестр 30+ модулей с реальными backend-ами", color: "#3b82f6" },
            { label: "QSign v2 — postquantum подпись", href: "https://aevion.app/qsign", note: "ML-DSA-65 FIPS 204 — реализовано в QSign v2, включается ключом подписи", color: "#8b5cf6" },
            { label: "Constitution v1 — атестация", href: "https://aevion.app/constitution", note: "Реальный документ с QSign-envelope, AI-советник работает", color: "#f59e0b" },
            { label: "Live health-board", href: "https://aevion.app/status", note: "Daily smoke полностью зелёный — ничего не скрыто", color: "#ec4899" },
            { label: "OpenAPI 3.1 spec", href: "https://aevion.app/api-backend/api/openapi.json", note: "Все задокументированные endpoints backend-а", color: "#06b6d4" },
          ].map(item => (
            <a key={item.label} href={item.href} target="_blank" rel="noopener" style={{ padding: "18px 20px", background: "rgba(255,255,255,0.03)", border: `1px solid ${item.color}30`, borderRadius: 16, textDecoration: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: item.color }}>↗ {item.label}</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{item.note}</div>
            </a>
          ))}
        </div>
        <div style={{ padding: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
          Полный Tech DD пакет — честный статус каждого продукта, curl-команды, архитектура, что именно нужна команда для запуска каждого:
          {" "}<a href="mailto:yahiin1978@gmail.com?subject=AEVION%20Tech%20DD%20request" style={{ color: "#10b981", textDecoration: "none", fontWeight: 700 }}>запросить по email →</a>
        </div>
      </section>

      {/* IDEAS PIPELINE */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
          Innovation pipeline — что строим с командой
        </div>
        <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 12 }}>
          5 продуктов · иллюстративный потенциал ~$490M ARR к году 5 (компания pre-revenue — не прогноз).
        </h2>
        <p style={{ fontSize: 16, color: "#94a3b8", marginBottom: 36, lineHeight: 1.5 }}>
          Каждый из них сегодня — либо в проде, либо с готовой базой. Без команды — прототипы.
          С командой 80-100 человек — рыночные продукты.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {IDEAS.map(idea => (
            <div key={idea.title} style={{ padding: 28, background: "rgba(255,255,255,0.03)", border: `1px solid ${idea.accent}35`, borderRadius: 20, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 0% 0%, ${idea.accent}12, transparent 60%)`, pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: idea.accent, textTransform: "uppercase" }}>{idea.ready}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc", padding: "4px 10px", background: `${idea.accent}20`, borderRadius: 999 }}>{idea.arr}</div>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.3, marginBottom: 10 }}>{idea.title}</h3>
                <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.55, margin: 0 }}>{idea.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, padding: 20, background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 14, fontSize: 14, color: "#c4b5fd" }}>
          <strong style={{ color: "#e9d5ff" }}>+ 5 незапущенных концепций</strong> — раскрываются под NDA при подписании LOI. Это следующая волна идей, которую основатель уже проработал.
        </div>
      </section>

      {/* FOUNDER */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
            Кто за этим стоит
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 48, alignItems: "start" }}>
            {/* Left — identity */}
            <div>
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900, color: "#0a0e1a", marginBottom: 20 }}>
                Д
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#f8fafc", marginBottom: 6 }}>Досымбек Жақия</div>
              <div style={{ fontSize: 13, color: "#10b981", fontWeight: 700, marginBottom: 16 }}>Founder & Chief Idea Officer</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: "🏗", text: "Финдиректор + владелец строительных компаний (КЗ)" },
                  { icon: "♟", text: "Кандидат в мастера по шахматам" },
                  { icon: "🧠", text: "30+ продуктов за 6 мес — без команды разработчиков" },
                  { icon: "📍", text: "Астана, Казахстан" },
                ].map(item => (
                  <div key={item.text} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16, lineHeight: 1.5 }}>{item.icon}</span>
                    <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Right — story */}
            <div>
              <h2 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 900, lineHeight: 1.2, letterSpacing: "-0.02em", marginBottom: 20, color: "#f8fafc" }}>
                «Я не искал проблему.<br />Я в ней работал.»
              </h2>
              <p style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.7, marginBottom: 16 }}>
                Строительная отрасль — одна из самых непрозрачных в мире. Проектная документация стоит
                сотни тысяч долларов и защищена лишь бумажной печатью. Экспертные заключения подписываются
                людьми которых нет. Платежи теряются в цепочках субподрядчиков. Я работал <em>внутри</em> этой
                системы — как финансовый директор и владелец проектных компаний.
              </p>
              <p style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.7, marginBottom: 16 }}>
                Мне не нужно было проводить исследование рынка. Проблема была моей ежедневной реальностью.
                Когда появились AI-инструменты, я смог наконец строить то, что видел годами.{" "}
                <strong style={{ color: "#f8fafc" }}>За 6 месяцев — 30+ рабочих модулей. Не потому что я быстро пишу код.
                Потому что я 10 лет понимал задачу.</strong>
              </p>
              <div style={{ padding: 20, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, fontSize: 14, color: "#94a3b8", lineHeight: 1.6, fontStyle: "italic" }}>
                «Шахматы научили думать паттернами и играть на 10 ходов вперёд.
                Строительство показало где система врёт и почему.
                AI дал руки, чтобы наконец это исправить.»
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINANCIAL SCENARIO */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>
            Финансовый сценарий
          </div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 36 }}>
            При команде 80-100 человек и primary-капитале в рост.
          </h2>
          <div data-stack-mobile="" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginBottom: 28 }}>
            {SCENARIO.map(s => (
              <div key={s.year} style={{ padding: 28, background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}30`, borderRadius: 18, textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.2em", color: s.color, textTransform: "uppercase", marginBottom: 12 }}>{s.year}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em", marginBottom: 4 }}>{s.arr}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>ARR</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>партнёр · 49% дохода</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 22, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>
            Партнёрство, не выкуп: $10M возвратным авансом + ресурсы. При $360-490M ARR в год 5 доля партнёра <strong style={{ color: "#10b981" }}>49% дохода = $176-240M/год</strong> · <strong style={{ color: "#3b82f6" }}>основатель 51% остаётся ведущим</strong>.
            Партнёр платит в основном ресурсами — большой чек не нужен, большие деньги приходят по факту роста. Проекции ARR — иллюстративные, forward-looking, не прогноз и не гарантия: компания сейчас pre-revenue ($0 выручки).
          </div>
        </div>
      </section>

      {/* DEAL TERMS */}
      <section id="deal" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.24em", color: "#10b981", textTransform: "uppercase", marginBottom: 16 }}>
          Условия
        </div>
        <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 36 }}>
          8 строк. Без воды.
        </h2>
        <div style={{ padding: 36, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 24 }}>
          {DEAL.map((d, i) => (
            <div key={d.label} data-stack-mobile="" style={{ display: "grid", gridTemplateColumns: "minmax(0, 260px) minmax(0, 1fr)", gap: 24, padding: "15px 0", borderBottom: i === DEAL.length - 1 ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", color: "#94a3b8", textTransform: "uppercase", paddingTop: 2 }}>
                {d.label}
              </div>
              <div style={{ fontSize: 16, color: "#f1f5f9", lineHeight: 1.5, fontWeight: d.label === "Доля инвестора" || d.label === "Secondary (основателю)" ? 800 : 400 }}>
                {d.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, padding: 28, background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20, textAlign: "center" }}>
          <div style={{ fontSize: 15, color: "#cbd5e1", marginBottom: 18, lineHeight: 1.6 }}>
            LOI с 8 пунктами — подписываем в течение 5 рабочих дней. Funds через эскроу при закрытии. DIFC courts.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20Innovation%20Partnership%20-%20LOI%20request&body=Hello,%0A%0AWe%20are%20interested%20in%20the%20AEVION%20Innovation%20Partnership.%0A%0AOrganisation:%0AContact:%0AInvestment%20capacity:%0ATeam%20we%20can%20bring:%0APreferred%20jurisdiction:%0ATimeline:%0A%0A--" style={btnPrimary}>
              Запросить LOI · yahiin1978@gmail.com
            </a>
            <Link href="/partner/print" style={btnGhost}>PDF brief (Ctrl+P)</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>AEVION · Innovation Partnership · Confidential · 2026</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
            <Link href="/status" style={{ color: "#94a3b8", textDecoration: "none" }}>Live health-board</Link>
            <Link href="/partner/print" style={{ color: "#94a3b8", textDecoration: "none" }}>PDF brief</Link>
            <Link href="/acquire" style={{ color: "#94a3b8", textDecoration: "none" }}>Acquisition brief</Link>
            <Link href="/pilot" style={{ color: "#94a3b8", textDecoration: "none" }}>90-day pilot</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "14px 28px",
  fontSize: 15,
  fontWeight: 800,
  color: "#0a0e1a",
  background: "linear-gradient(135deg, #10b981, #3b82f6)",
  borderRadius: 12,
  textDecoration: "none",
  boxShadow: "0 8px 24px rgba(16,185,129,0.25)",
};

const btnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "14px 24px",
  fontSize: 14,
  fontWeight: 700,
  color: "#cbd5e1",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 12,
  textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.12)",
};
