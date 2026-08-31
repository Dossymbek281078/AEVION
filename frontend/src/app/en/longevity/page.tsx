import type { Metadata } from "next";
import { WaitlistCapture } from "@/components/WaitlistCapture";
import { LandingView } from "@/components/LandingView";
import { BuyLink } from "@/components/BuyLink";
import { PageTracking } from "@/components/PageTracking";
import { productById, channelFrom, withChannel } from "@/lib/products";
import { LongevityTool } from "./_tool";

// /en/longevity — англоязычный разбор протокола, бесплатно и целиком.
//
// ЗАЧЕМ. Русскому зрителю мы отдаём протокол долголетия даром на /longevity, и
// это работающая часть воронки. Английского аналога не было: адрес отдавал 404
// (замер 28.08.2026), то есть англоязычному трафику нечего было предложить
// бесплатно, а самый дешёвый вход был платным.
//
// ОТКУДА СОДЕРЖАНИЕ. Не переведено с русской страницы и не сочинено: всё взято
// из готового английского издания протокола
// (Desktop\АЕВИОН\12-Долголетие-и-здоровье\AEVION-Longevity-Protocol-EN.pdf,
// Edition 1.0, 6 страниц) — включая градацию доказательности и раздел о том,
// что переоценено. Медицинские утверждения, которых нет в источнике, здесь не
// появляются.
//
// ПОЧЕМУ БЕЗ ИНТЕРАКТИВА. Русская страница считает персональный стек через
// /api/longevity/*, но бэкенд отдаёт русские тексты (проверено: в ответе
// health 20 русских слов). Английский интерактив требует правки бэкенда —
// это отдельная работа. Разбор при этом ценен сам по себе: он и есть то, что
// обещают ролики.
export const metadata: Metadata = {
  title: "The Longevity Protocol: what to measure, what is proven, what is overrated",
  description:
    "Free breakdown: which markers to test, which interventions are actually evidenced (graded A/B/C), and which popular ones are not. Twelve weeks, measure and measure again. Wellness and education, not diagnosis or treatment.",
  keywords: [
    "longevity protocol",
    "biological age",
    "PhenoAge",
    "ApoB",
    "VO2max",
    "omega-3 index",
    "evidence-based supplements",
    "NMN evidence",
  ],
  alternates: { canonical: "https://aevion.app/en/longevity" },
  openGraph: {
    title: "The Longevity Protocol: measure, intervene, measure again",
    description:
      "What to test, what is evidenced, and what is overrated — graded honestly, including the items marked as having no demonstrated effect.",
    url: "https://aevion.app/en/longevity",
    type: "article",
  },
};

const PAPER = "#f7f6f2";
const INK = "#16161a";
const MUTED = "#5d5f66";
const LINE = "#e2e0d8";
const GOLD = "#a9781a";

/** Цвета градации — те же, что на русской странице, чтобы разбор читался одинаково. */
const GRADE_COLOR: Record<string, string> = { A: "#1d7a5f", B: "#2b6f8a", C: "#8a6a12", E: "#6b4fa0" };

type Row = { name: string; shows: string; target: string; ev: keyof typeof GRADE_COLOR };

// Все строки ниже — из английского издания протокола, дословно по смыслу.
const PANEL: Array<{ block: string; note: string; rows: Row[] }> = [
  {
    block: "Deficiencies and micronutrients",
    note: "The fastest and best-evidenced source of improvement. Always start here.",
    rows: [
      { name: "Vitamin D (25-OH)", shows: "Immunity, bone, mood", target: "40–60 ng/mL", ev: "A" },
      { name: "Vitamin B12", shows: "Nerves, blood formation, energy", target: "> 500 pg/mL", ev: "A" },
      { name: "Ferritin", shows: "Iron stores, energy", target: "50–150 ng/mL", ev: "A" },
      { name: "Magnesium (RBC)", shows: "Over 300 enzymes, sleep, muscle", target: "upper third of range", ev: "B" },
      { name: "Zinc / Copper ratio", shows: "Immunity, pigment, antioxidation", target: "8–12 : 1", ev: "B" },
      { name: "Omega-3 index", shows: "Membranes, inflammation, brain", target: "> 8 %", ev: "A" },
      { name: "Homocysteine", shows: "Vessels, methylation", target: "< 8 µmol/L", ev: "B" },
    ],
  },
  {
    block: "Metabolism and inflammation",
    note: "The block that best predicts how you will live through the coming decades.",
    rows: [
      { name: "Fasting glucose", shows: "Blood sugar right now", target: "< 99 mg/dL", ev: "A" },
      { name: "HbA1c", shows: "Average sugar over three months", target: "< 5.4 %", ev: "A" },
      { name: "HOMA-IR", shows: "Insulin resistance", target: "< 1.5", ev: "A" },
      { name: "ApoB", shows: "Atherogenic particles — sharper than LDL", target: "< 80 mg/dL", ev: "A" },
      { name: "hs-CRP", shows: "Systemic inflammation", target: "< 1.0 mg/L", ev: "A" },
      { name: "Uric acid", shows: "Metabolism, inflammation, blood pressure", target: "< 5.5 mg/dL", ev: "B" },
    ],
  },
  {
    block: "Ageing biomarkers — and where the marketing is",
    note: "This block is more often sold above its worth than any other. Read the evidence column carefully.",
    rows: [
      { name: "PhenoAge (biological age)", shows: "Biological age from nine blood markers", target: "younger than calendar age", ev: "B" },
      { name: "Epigenetic clocks (DNAm)", shows: "Pace of ageing — informative but expensive", target: "younger than calendar age", ev: "B" },
      { name: "Telomere length (LTL)", shows: "Noisy test, reproduces poorly, gives no guide to action", target: "not a priority", ev: "C" },
      { name: "Mitochondrial function", shows: "No cheap validated test exists", target: "use VO₂max and lactate as proxies", ev: "C" },
    ],
  },
  {
    block: "Functional measurements",
    note: "The most underrated block of all. The top three predict lifespan more strongly than most blood tests — and they cost nothing.",
    rows: [
      { name: "VO₂max", shows: "Aerobic power — one of the strongest known predictors of mortality", target: "above average for age", ev: "A" },
      { name: "Grip strength", shows: "Systemic strength and robustness", target: "higher", ev: "A" },
      { name: "Gait speed, sit-to-stand", shows: "Functional age, fall risk", target: "higher", ev: "A" },
      { name: "Waist / visceral fat", shows: "Metabolic risk, muscle, bone", target: "lower", ev: "A" },
      { name: "HRV, blood pressure, resting pulse", shows: "Recovery, autonomic tone, vessels", target: "HRV higher, BP in range", ev: "B" },
    ],
  },
];

const STACK: Array<{ block: string; rows: Array<{ name: string; comment: string; ev: keyof typeof GRADE_COLOR }> }> = [
  {
    block: "Nutrition and supplements",
    rows: [
      { name: "Close deficiencies: D, B12, omega-3, magnesium, iron", comment: "First priority, strictly by your own numbers.", ev: "A" },
      { name: "Protein 1.6–2.2 g/kg + fibre 30–40 g", comment: "Muscle, satiety, microbiome.", ev: "A" },
      { name: "Creatine 3–5 g daily", comment: "Muscle, brain, energy.", ev: "A" },
      { name: "GlyNAC (glycine + NAC)", comment: "Signals from randomised trials on ageing markers.", ev: "B" },
    ],
  },
  {
    block: "Physical activity",
    rows: [
      { name: "Resistance training 2–3× per week", comment: "Muscle and bone against sarcopenia.", ev: "A" },
      { name: "Zone 2 easy cardio, 150–180 min per week", comment: "Mitochondria, metabolism.", ev: "A" },
      { name: "VO₂max intervals (4×4), once a week", comment: "Raises the aerobic ceiling.", ev: "A" },
      { name: "8–10 thousand steps a day", comment: "Baseline activity, glucose control.", ev: "A" },
    ],
  },
  {
    block: "Hormesis",
    rows: [
      { name: "Sauna 4× per week, 15–20 min", comment: "Finnish cohort: lower cardiovascular mortality.", ev: "B" },
      { name: "Eating window 12–16 hours", comment: "Metabolism; human longevity data are mixed.", ev: "B" },
      { name: "Cold: shower or immersion", comment: "Mood, brown fat, metabolism; longevity data modest.", ev: "C" },
    ],
  },
  {
    block: "Mental",
    rows: [
      { name: "Sleep 7–9 hours, regular rhythm", comment: "The foundation of everything else.", ev: "A" },
      { name: "Social connection, working on loneliness", comment: "One of the strongest psychosocial predictors of lifespan.", ev: "A" },
      { name: "Purpose, stress management, meditation", comment: "Lower inflammation and risk.", ev: "B" },
      { name: "Self-affirmation", comment: "Buffers stress in trials; no direct longevity data.", ev: "C" },
    ],
  },
];

const OVERRATED: Array<{ name: string; why: string }> = [
  {
    name: "NMN and NR (NAD⁺ boosters)",
    why: "They do raise NAD⁺ levels — that part is true. But there is little human data on benefit to healthspan. Not the item to spend your budget on first.",
  },
  { name: "Taurine", why: "Strong animal data; still being studied in humans." },
  {
    name: "Metformin and rapamycin",
    why: "Prescription only and through a doctor, never on your own. Trials are ongoing.",
  },
  {
    name: "Wave devices, PEMF, binaural beats, home photobiomodulation",
    why: "Preliminary; no effect on lifespan shown. Genuine wave-based methods do exist in medicine — they are regulated hospital cancer treatments, and pointing at them raises the evidence behind a consumer gadget by exactly nothing.",
  },
];

const WEEKS: Array<{ when: string; phase: string; what: string }> = [
  { when: "0", phase: "Baseline", what: "Full blood panel, functional tests, biological age. Everything recorded before any intervention." },
  { when: "1–2", phase: "Foundation", what: "Close deficiencies, fix sleep and steps, start training gently." },
  { when: "3–8", phase: "Full stack", what: "Progressive strength and cardio, supplements per plan, eating window." },
  { when: "9–11", phase: "Peak", what: "Add hormesis, take volume to maximum, watch HRV." },
  { when: "12", phase: "Re-measure", what: "The same tests, an honest delta. Keep what worked, drop what did not." },
];

function Grade({ ev }: { ev: keyof typeof GRADE_COLOR }) {
  return (
    <span
      style={{
        display: "inline-block",
        minWidth: 20,
        textAlign: "center",
        fontFamily: "monospace",
        fontSize: 12,
        fontWeight: 700,
        color: GRADE_COLOR[ev],
        border: `1px solid ${GRADE_COLOR[ev]}`,
        borderRadius: 4,
        padding: "1px 5px",
      }}
    >
      {ev}
    </span>
  );
}

export default async function EnLongevityPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  // Метка канала доезжает до кассы: без неё покупка отсюда пришла бы как
  // «источник неизвестен».
  const channel = channelFrom((await searchParams).c);
  const pdf = productById("kkiavh");

  return (
    <main style={styles.page}>
      <PageTracking page="en-longevity" />
      <LandingView source="en-longevity" />
      <div style={styles.wrap}>
        <header style={styles.head}>
          <div style={styles.brand}>AEVION</div>
          <h1 style={styles.h1}>The Longevity Protocol</h1>
          <p style={styles.lede}>
            Twelve weeks: measure, intervene, measure again. No promises, and not
            a single recommendation without a mark showing how well it is
            evidenced — including the popular things marked as overrated.
          </p>
          <p style={styles.legend}>
            <Grade ev="A" /> strong &nbsp; <Grade ev="B" /> moderate or mixed
            &nbsp; <Grade ev="C" /> weak or preliminary &nbsp; <Grade ev="E" />{" "}
            no demonstrated effect on human longevity
          </p>
        </header>

        <section style={styles.section}>
          <h2 style={styles.h2}>Step 1 · The baseline</h2>
          <p style={styles.note}>
            Without starting numbers you will not be able to tell effect from
            self-deception twelve weeks from now.
          </p>
          {PANEL.map((b) => (
            <div key={b.block} style={styles.block}>
              <h3 style={styles.h3}>{b.block}</h3>
              <p style={styles.note}>{b.note}</p>
              {b.rows.map((r) => (
                <div key={r.name} style={styles.row}>
                  <div style={styles.rowMain}>
                    <span style={styles.rowName}>{r.name}</span>
                    <Grade ev={r.ev} />
                  </div>
                  <div style={styles.rowShows}>{r.shows}</div>
                  <div style={styles.rowTarget}>{r.target}</div>
                </div>
              ))}
            </div>
          ))}
          <p style={styles.note}>
            PhenoAge is calculated from an ordinary blood panel — you have
            already paid for everything it needs. Skip the telomere test and the
            &quot;mitochondrial analysis&quot; at the start: neither changes a
            single decision you will make.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Check your own numbers</h2>
          <p style={styles.note}>
            Type in whatever you already have. Nothing is sent anywhere — the
            comparison happens in your browser, against the same target ranges
            listed above.
          </p>
          <LongevityTool channel={channel} />
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Step 2 · The intervention stack</h2>
          <p style={styles.note}>
            Sorted by strength of evidence rather than by popularity. Start at
            the top of each block.
          </p>
          {STACK.map((b) => (
            <div key={b.block} style={styles.block}>
              <h3 style={styles.h3}>{b.block}</h3>
              {b.rows.map((r) => (
                <div key={r.name} style={styles.row}>
                  <div style={styles.rowMain}>
                    <span style={styles.rowName}>{r.name}</span>
                    <Grade ev={r.ev} />
                  </div>
                  <div style={styles.rowShows}>{r.comment}</div>
                </div>
              ))}
            </div>
          ))}
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Contraindications — read before you start</h2>
          <p style={styles.note}>
            Sauna — not during pregnancy or with uncontrolled hypertension. Cold
            immersion — not during pregnancy or with heart disease. Eating window
            and fasting — not with diabetes, during pregnancy, or when
            underweight. If any of these describe you, that item comes out of the
            stack — it is not done &quot;carefully&quot;.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>What is overrated: the honest section</h2>
          <p style={styles.note}>
            You will meet these in every second longevity article. We are not
            throwing them out, but we are not presenting them as proven either.
          </p>
          {OVERRATED.map((o) => (
            <div key={o.name} style={styles.row}>
              <div style={styles.rowMain}>
                <span style={styles.rowName}>{o.name}</span>
                <Grade ev="E" />
              </div>
              <div style={styles.rowShows}>{o.why}</div>
            </div>
          ))}
        </section>

        <section style={styles.section}>
          <h2 style={styles.h2}>Step 3 · The twelve weeks</h2>
          {WEEKS.map((w) => (
            <div key={w.when} style={styles.row}>
              <div style={styles.rowMain}>
                <span style={styles.rowName}>
                  Week {w.when} · {w.phase}
                </span>
              </div>
              <div style={styles.rowShows}>{w.what}</div>
            </div>
          ))}
          <p style={styles.note}>
            The main mistake is starting everything at once. Count as improvement
            only shifts that exceed your laboratory&apos;s margin of error: one
            metric out of seven moving by a couple of percent is noise. Three or
            four in the right direction — the cycle worked.
          </p>
        </section>

        {pdf && (
          <BuyLink
            href={withChannel(pdf.href, channel, "en-longevity")}
            source="en-longevity"
            productId={pdf.id}
            priceUsd={pdf.priceUsd}
            channel={channel}
            style={styles.buyCard}
          >
            <div>
              <div style={styles.buyKicker}>PDF guide</div>
              <div style={styles.buyTitle}>The Anti-Grey Protocol</div>
              <p style={styles.buyNote}>
                The same evidence-first approach applied to pigment ageing —
                what actually slows it, and what is overrated.
              </p>
            </div>
            <div style={styles.buyRight}>
              <span style={styles.buyPrice}>${pdf.priceUsd}</span>
              <span style={styles.buyBtn}>Read it</span>
            </div>
          </BuyLink>
        )}

        <section style={styles.section}>
          <h2 style={styles.h2}>Told when the grading changes</h2>
          <p style={styles.note}>
            This breakdown is revised when new research lands: some items move up
            the grading, some move down. Leave an address and you get a note when
            that happens — nothing else.
          </p>
          <div style={{ marginTop: 12 }}>
            <WaitlistCapture
              // Английская страница СВЕТЛАЯ (#fff), в отличие от русской (#070b14),
              // где тема задана dark осознанно. Без этой строки форма брала бы
              // тёмное умолчание и стояла бы чёрным блоком на белом.
              tone="light"
              source="en-longevity"
              lang="en"
              title="Told when the grading changes"
              description="This breakdown is revised when new research lands: some items move up the grading, some move down."
              promise="Only when the grading or the panel changes. Unsubscribe with a single link."
              buttonLabel="Keep me posted"
            />
          </div>
        </section>

        <p style={styles.foot}>
          Educational and wellness material. Not diagnosis, not treatment. Target
          ranges depend on sex, age and laboratory. Prescription medicines and
          some tests go through a doctor. Do not stop treatment you have been
          prescribed.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: PAPER, color: INK, padding: "32px 18px 56px" },
  wrap: { maxWidth: 640, margin: "0 auto" },
  head: { borderBottom: `2px solid ${INK}`, paddingBottom: 18 },
  brand: { fontFamily: "monospace", fontSize: 13, letterSpacing: "0.3em", fontWeight: 700, color: GOLD },
  h1: { fontFamily: "Georgia, serif", fontSize: 32, lineHeight: 1.12, margin: "12px 0 0", fontWeight: 700 },
  lede: { color: MUTED, fontSize: 15.5, lineHeight: 1.6, margin: "12px 0 0" },
  legend: { color: MUTED, fontSize: 13, lineHeight: 2, margin: "14px 0 0" },
  section: { marginTop: 34 },
  h2: { fontFamily: "Georgia, serif", fontSize: 21, margin: "0 0 10px", fontWeight: 700 },
  h3: { fontSize: 15, margin: "0 0 6px", fontWeight: 700 },
  note: { color: MUTED, fontSize: 14, lineHeight: 1.6, margin: "0 0 12px" },
  block: { marginTop: 18 },
  row: { borderTop: `1px solid ${LINE}`, padding: "10px 0" },
  rowMain: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  rowName: { fontSize: 15, fontWeight: 600 },
  rowShows: { color: MUTED, fontSize: 13.5, lineHeight: 1.55, marginTop: 3 },
  rowTarget: { fontFamily: "monospace", fontSize: 12.5, color: INK, marginTop: 3 },
  buyCard: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    border: `1px solid ${LINE}`,
    background: "#fff",
    borderRadius: 12,
    padding: "18px 20px",
    marginTop: 34,
    textDecoration: "none",
    color: INK,
  },
  buyKicker: { fontFamily: "monospace", fontSize: 11.5, letterSpacing: "0.08em", color: GOLD },
  buyTitle: { fontSize: 18, fontWeight: 700, margin: "6px 0 0" },
  buyNote: { color: MUTED, fontSize: 13.5, lineHeight: 1.55, margin: "6px 0 0", maxWidth: 380 },
  buyRight: { display: "flex", alignItems: "center", gap: 12 },
  buyPrice: { fontSize: 20, fontWeight: 700 },
  buyBtn: { border: `1px solid ${INK}`, borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" },
  foot: { marginTop: 36, color: MUTED, fontSize: 12.5, lineHeight: 1.6 },
};
