/**
 * Print-friendly acquisition brief. Open in browser → Ctrl/Cmd+P → "Save as PDF".
 * Layout is intentionally B/W with high contrast: works for both screen review
 * and a clean PDF that can be attached to outbound email.
 *
 * Page structure (A4 portrait):
 *   1. Cover (one page)
 *   2. Three macro-waves + 5 pillars (one page)
 *   3. Modules summary (one page)
 *   4. Deal terms (one page)
 *   5. Comparables + close (one page)
 */

const css = `
  @page { size: A4; margin: 16mm 14mm; }
  html, body { background: #fff !important; color: #111 !important; font-family: Inter, Helvetica, Arial, sans-serif; }
  .print-root { color: #111; max-width: 720px; margin: 0 auto; font-size: 11.5pt; line-height: 1.45; }
  .print-root h1, .print-root h2, .print-root h3 { color: #0f172a; letter-spacing: -0.01em; }
  .print-root h1 { font-size: 30pt; font-weight: 900; line-height: 1.05; margin: 0 0 12pt; }
  .print-root h2 { font-size: 16pt; font-weight: 800; margin: 18pt 0 8pt; border-bottom: 1px solid #111; padding-bottom: 4pt; }
  .print-root h3 { font-size: 12pt; font-weight: 800; margin: 10pt 0 4pt; }
  .print-root p { margin: 0 0 8pt; }
  .print-root strong { color: #0f172a; }
  .print-root .eyebrow { font-size: 8pt; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #555; margin-bottom: 6pt; }
  .print-root .ask-box { border: 2pt solid #111; padding: 12pt 16pt; margin: 14pt 0; }
  .print-root .ask-box .price { font-size: 26pt; font-weight: 900; line-height: 1; margin-bottom: 6pt; }
  .print-root table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 6pt 0; }
  .print-root th, .print-root td { border: 1px solid #999; padding: 5pt 7pt; text-align: left; vertical-align: top; }
  .print-root th { background: #f1f5f9; font-weight: 800; }
  .print-root ul { padding-left: 16pt; margin: 4pt 0 10pt; }
  .print-root li { margin-bottom: 3pt; }
  .print-root .pillars { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; }
  .print-root .pillar { border: 1px solid #999; padding: 8pt 10pt; }
  .print-root .pillar .title { font-weight: 800; font-size: 10.5pt; margin-bottom: 3pt; }
  .print-root .pillar .body { font-size: 9.5pt; color: #333; }
  .print-root .footer { font-size: 8.5pt; color: #555; margin-top: 14pt; border-top: 1px solid #ccc; padding-top: 6pt; }
  .print-root .page-break { page-break-before: always; break-before: page; }
  @media screen { .print-root { padding: 32px 24px; } body { background: #f5f5f5; } .print-root { background: #fff; box-shadow: 0 1px 8px rgba(0,0,0,0.08); margin-top: 24px; margin-bottom: 24px; padding: 48px; } }
`;

export default function AcquirePrintPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="print-root">
        {/* PAGE 1 — Cover */}
        <div className="eyebrow">Partnership Brief · $10M возвратный аванс · доход 51/49 · Confidential · 2026</div>
        <h1>Planet AEVION.<br />One settlement unit.<br />30+ modules in production.</h1>
        <p>
          Все деньги, всё IP и весь dev-цикл переезжают в интернет. AEVION — единственное место, где все три перехода
          случаются под одной расчётной единицей (AEV) и одним правовым контуром. Не «будут работать».
          Уже работают, измерены, доступны для верификации сегодня.
        </p>

        <div className="ask-box">
          <div className="eyebrow">Одно предложение · партнёрство, не выкуп</div>
          <div className="price">$10M возвратный аванс</div>
          <p style={{ margin: 0 }}>
            $10M возвратным авансом — возврат из доли основателя по мере роста проекта; аванс освобождает основателя
            от текущих компаний и работы по найму.<br />
            Доход проекта делится 51/49 (основатель/партнёр), дальше обсуждается; основатель остаётся Chief Idea Officer.
            Бренд AEVION сохраняется · AEV token вынесен из периметра сделки (ring-fenced).
          </p>
        </div>

        <h3>Что покупатель проверит сам</h3>
        <ul>
          <li><strong>aevion.app/launch-status</strong> — daily smoke 24/24</li>
          <li><strong>aevion.app/transparency</strong> — health-board всех модулей</li>
          <li><strong>aevion.app/constitution</strong> — учредительный документ (RU/EN/KK), QSign envelope</li>
          <li><strong>aevion.app/devhub</strong> — 9 интеграций в проде, единый AEV-биллинг</li>
          <li><strong>/api/aevion/registry · /api/aevion/stats · /api/planet/stats</strong> — JSON метрики</li>
        </ul>

        <div className="footer">
          Контакт: <strong>yahiin1978@gmail.com</strong> · Эксклюзивность 60 дней по сигнингу LOI · Юрисдикция на выбор покупателя: Делавэр / DIFC Dubai / Singapore
        </div>

        {/* PAGE 2 — Three macro-waves + 5 pillars */}
        <div className="page-break" />
        <div className="eyebrow">Почему сейчас</div>
        <h2>Три макроволны сошлись в одной точке</h2>
        <table>
          <thead>
            <tr><th style={{ width: "30%" }}>Волна</th><th>Тезис</th><th style={{ width: "22%" }}>TAM 2030</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Деньги → API</strong></td><td>Banking-as-a-service вырос с $4B до $30B+ за 5 лет. К 2030 — $90B. Расчётная рельса для после-отделений.</td><td>$20T flow</td></tr>
            <tr><td><strong>IP → on-chain attestation</strong></td><td>AI-объекты требуют notary-as-default. Момент создания становится главным юр-вопросом эпохи.</td><td>$400B → $700B</td></tr>
            <tr><td><strong>Dev → agent-layer</strong></td><td>15 SaaS-кабинетов схлопываются в один. AI-нативный DevOps выводит per-developer ARR на новый уровень.</td><td>$200B → $400B</td></tr>
          </tbody>
        </table>

        <h2>Пять столпов планеты</h2>
        <div className="pillars">
          <div className="pillar">
            <div className="title">1. Финансовый слой</div>
            <div className="body">AEV (cap 21M) · QPayNet · AEVION Bank · Payments Rail · QTrade · QTradeOffline. Расчётная единица + платёжная рельса + retail-банковский UI.</div>
          </div>
          <div className="pillar">
            <div className="title">2. Защита и право</div>
            <div className="body">QSign v2 (FIPS 204 ML-DSA-65 GA) · QShield (threshold + Lagrange) · QRight · QContract · QChainGov · QMaskCard · VeilNetX · Z-Tide.</div>
          </div>
          <div className="pillar">
            <div className="title">3. Dev-слой / DevHub</div>
            <div className="body">DevHub (9 интеграций live: GitHub, Vercel, Railway, Cloudflare, ElevenLabs, Brevo, Stripe, DALL·E, Drive) · QCoreAI (5+ AI-провайдеров) · QBuild · Bureau v2.</div>
          </div>
          <div className="pillar">
            <div className="title">4. Consumer-витрины</div>
            <div className="body">CyberChess (AEVION CPI) · HealthAI v3 · Multichat · KidsAI · Smeta Trainer · MapReality · LifeBox · StartupX. Proof of execution.</div>
          </div>
          <div className="pillar" style={{ gridColumn: "span 2" }}>
            <div className="title">5. Governance / Trust</div>
            <div className="body">Constitution v1 (опубликован через QSign envelope, commit 1cacd5a1, три языка RU/EN/KK) · /planet attestation registry · /transparency health-board · open coordination protocol.</div>
          </div>
        </div>

        {/* PAGE 3 — Modules */}
        <div className="page-break" />
        <div className="eyebrow">Каталог</div>
        <h2>30+ модулей под одной крышей</h2>
        <table>
          <thead><tr><th>Группа</th><th>Модули</th><th style={{ width: "28%" }}>Стейтус</th></tr></thead>
          <tbody>
            <tr><td>Финансовый</td><td>AEV, QPayNet, AEVION Bank, Payments Rail, QTrade, QTradeOffline</td><td>5/6 в проде, AEV в обращении</td></tr>
            <tr><td>Защита и право</td><td>QSign v2, QShield, QRight, QContract, QChainGov, QMaskCard, VeilNetX, Z-Tide</td><td>7/8 в проде, QSign GA</td></tr>
            <tr><td>Dev / DevHub</td><td>DevHub (9 integrations), QCoreAI (5+ providers, 230 routes), QBuild (60+ endpoints), Bureau v2</td><td>23 vitest · 490 vitest · 30/30 ATS tests</td></tr>
            <tr><td>Consumer</td><td>CyberChess, HealthAI, Multichat, KidsAI, Smeta Trainer, MapReality, LifeBox, StartupX, PsyApp, QFusionAI, VeilNetX consumer, Q-Good, ShadowNet, QLife, QPersona, DeepSan, Voe</td><td>7+ retention-products live</td></tr>
            <tr><td>Governance</td><td>Constitution v1, /planet, /transparency, /launch-status, AEVION_COORDINATION, /awards, /press, /changelog</td><td>Constitution attested via QSign envelope</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: "9.5pt", color: "#555" }}>
          Подробный per-module breakdown с бенефитом для покупателя и привилегиями — `promo/01_MODULES.md` в press-kit архиве.
        </p>

        <h3>Что нельзя купить за деньги (compositional moat)</h3>
        <ul>
          <li><strong>AEV в обращении</strong> — доверие к расчётной единице накапливается транзакциями, не маркетингом.</li>
          <li><strong>Constitution v1 + Planet attestations</strong> — правовой режим, опубликованный через QSign envelope.</li>
          <li><strong>9 интеграций DevHub</strong> — 36+ месяцев комплаенс-работы для нового игрока.</li>
          <li><strong>30+ модулей с health-pings</strong> — 200+ человеко-лет инжиниринга в сумме.</li>
        </ul>

        {/* PAGE 4 — Deal */}
        <div className="page-break" />
        <div className="eyebrow">Условия</div>
        <h2>Одно предложение</h2>
        <table>
          <tbody>
            <tr><th style={{ width: "32%" }}>Предложение</th><td>$10M возвратным авансом — возврат из доли основателя по мере роста проекта</td></tr>
            <tr><th>Доход проекта</th><td>51% основатель / 49% партнёр — стартовая рамка, дальше обсуждается</td></tr>
            <tr><th>Что покупает аванс</th><td>Освобождает основателя от текущих компаний и работы по найму → фул-тайм на идеях AEVION</td></tr>
            <tr><th>Роль основателя</th><td>Chief Idea Officer · автор и двигатель следующих идей (мажоритарная доля, остаётся)</td></tr>
            <tr><th>Риск партнёра</th><td>Время + небольшая возвратная сумма; большие деньги — по факту роста, не на старте</td></tr>
          </tbody>
        </table>
        <h3>Неизменные условия</h3>
        <table>
          <tbody>
            <tr><th style={{ width: "32%" }}>Бренд</th><td>AEVION сохраняется (не merge в покупателя)</td></tr>
            <tr><th>AEV token</th><td>Вынесен из периметра сделки (ring-fenced)</td></tr>
            <tr><th>Юрисдикция</th><td>Делавэр US / DIFC Dubai / Singapore — на выбор партнёра</td></tr>
            <tr><th>Контакт</th><td><strong>yahiin1978@gmail.com</strong></td></tr>
          </tbody>
        </table>

        <p>Условия выше — готовы подписать term sheet в течение 5 рабочих дней.</p>

        {/* PAGE 5 — Comparables + close */}
        <div className="page-break" />
        <div className="eyebrow">Калибровка</div>
        <h2>Comparable transactions</h2>
        <table>
          <thead><tr><th>Сделка</th><th>Год</th><th>Сумма</th><th>Что входило</th></tr></thead>
          <tbody>
            <tr><td>Microsoft × GitHub</td><td>2018</td><td>$7.5B</td><td>Dev-platform</td></tr>
            <tr><td>Plaid (Visa, отменено)</td><td>2020</td><td>$5.3B</td><td>API-агрегатор счетов</td></tr>
            <tr><td>Square × Afterpay</td><td>2021</td><td>$29B</td><td>Payments + BNPL</td></tr>
            <tr><td>Adobe × Figma (отменено)</td><td>2022</td><td>$20B</td><td>Design-collab</td></tr>
            <tr><td>Stripe (private mark)</td><td>2023</td><td>$50-95B</td><td>Payments rail</td></tr>
          </tbody>
        </table>
        <p>
          AEVION = <strong>Plaid + GitHub + ранний Stripe + Figma + on-chain notary</strong> в одном контуре.
          Это сравнимые по масштабу рынки — но предложение одно, и это не выкуп: $10M возвратным авансом
          и партнёрская доля дохода 51/49 (подробнее — `promo/05_FINANCIAL_APPENDIX.md`).
        </p>

        <h2>Закрытие</h2>
        <p>
          Одно предложение — $10M возвратным авансом + доход проекта 51/49 (основатель/партнёр), дальше
          обсуждается. Основатель сохраняет мажоритарную долю и остаётся Chief Idea Officer; партнёр рискует
          ресурсами и небольшой возвратной суммой, не капиталом на старте. Готовы подписать term sheet
          в течение пяти рабочих дней.
        </p>

        <div className="footer">
          Полный пакет промо · 8 markdown-файлов · ~42 KB · aevion.app/promo/aevion-acquire-pack.zip<br />
          Live brief · aevion.app/acquire · NDA + data room → yahiin1978@gmail.com
        </div>
      </div>
    </>
  );
}
