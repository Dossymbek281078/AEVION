#!/usr/bin/env node
/**
 * AEVION Demo Content Seeder
 * Seeds QStore products, QLearn courses, QEvents events, QNews articles.
 * Safe to run multiple times (idempotent via title dedup checks).
 *
 * Usage:
 *   BASE=https://aevion-production-a70c.up.railway.app JWT=<token> node scripts/seed-demo-content.js
 *   BASE=http://localhost:4001 JWT=<token> node scripts/seed-demo-content.js
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const JWT = process.env.JWT || "";

let ok = 0, fail = 0;

async function req(method, path, body, auth = false) {
  const headers = { "Content-Type": "application/json" };
  if (auth && JWT) headers["Authorization"] = `Bearer ${JWT}`;
  const opts = { method, headers, signal: AbortSignal.timeout(15000) };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(`${BASE}${path}`, opts);
    const text = await r.text();
    try { return { status: r.status, body: JSON.parse(text) }; }
    catch { return { status: r.status, body: text }; }
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}

function log(emoji, label, detail = "") {
  console.log(`${emoji} ${label}${detail ? " — " + detail : ""}`);
}

// ── QStore products ──────────────────────────────────────────────────────────
async function seedQStore() {
  console.log("\n📦 QStore products");
  const products = [
    { title: "AEVION IP Protection Starter Kit", description: "Step-by-step guide to protecting your digital IP using QRight, QSign and Bureau. Includes templates for NDAs, copyright notices, and IP registration checklists.", price: 1900, currency: "KZT", category: "legal", tags: ["ip", "legal", "template"] },
    { title: "QCoreAI Prompt Engineering Course", description: "Master multi-agent AI prompting with AEVION QCoreAI. 12 modules covering sequential, parallel and debate strategies, eval harness, and cost optimization.", price: 4900, currency: "KZT", category: "education", tags: ["ai", "prompting", "course"] },
    { title: "Kazakhstan Business Launch Checklist", description: "Comprehensive 50-item checklist for launching a business in Kazakhstan. Covers registration, tax, banking, permits, and digital infrastructure.", price: 990, currency: "KZT", category: "business", tags: ["kz", "business", "checklist"] },
    { title: "Web3 Smart Contract Templates (KZ Law)", description: "Ready-to-use smart contract templates adapted for Kazakhstan legal framework. Includes sale, service, and partnership agreements.", price: 2900, currency: "KZT", category: "legal", tags: ["web3", "contracts", "kz"] },
    { title: "HealthAI Wellness Tracker Spreadsheet", description: "Excel/Google Sheets template synced with AEVION HealthAI concepts. Track BMI, sleep, mood, exercise with auto-calculated WHO compliance scores.", price: 490, currency: "KZT", category: "health", tags: ["health", "tracker", "template"] },
    { title: "CyberChess Opening Repertoire Pack", description: "GM-level opening repertoire for e4 and d4 systems. 200+ annotated lines with common mistakes to avoid. Compatible with CyberChess on AEVION.", price: 1490, currency: "KZT", category: "gaming", tags: ["chess", "opening", "repertoire"] },
  ];

  for (const p of products) {
    if (!JWT) { log("⏭", `Skipping QStore (no JWT): ${p.title}`); continue; }
    // Check if exists
    const list = await req("GET", `/api/qstore/products?search=${encodeURIComponent(p.title.slice(0, 20))}&limit=1`);
    if (list.body?.products?.some((x) => x.title === p.title)) {
      log("✓", `QStore already has: ${p.title.slice(0, 50)}`); ok++; continue;
    }
    const r = await req("POST", "/api/qstore/me/products", p, true);
    if ([200, 201].includes(r.status)) { log("✅", `QStore created: ${p.title.slice(0, 50)}`); ok++; }
    else { log("❌", `QStore failed: ${p.title.slice(0, 40)}`, `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`); fail++; }
  }
}

// ── QLearn courses ───────────────────────────────────────────────────────────
async function seedQLearn() {
  console.log("\n📚 QLearn courses");
  const courses = [
    {
      title: "AEVION Platform: Complete Guide",
      description: "Master the entire AEVION ecosystem in one course. From Globus 3D map to QCoreAI multi-agent workflows, QRight IP protection, and fintech modules.",
      category: "platform",
      level: "beginner",
      tags: ["aevion", "platform", "overview"],
      lessons: [
        { title: "Introduction to AEVION Ecosystem", content: "AEVION is a unified AI-powered platform with 34+ live modules...", duration: 15 },
        { title: "Navigating the Globus Map", content: "The Globus 3D map shows all modules as markers on a world map...", duration: 10 },
        { title: "Getting Started with QCoreAI", content: "QCoreAI is your AI engine: 5 LLM providers, multi-agent sessions...", duration: 20 },
      ],
    },
    {
      title: "IP Protection with QRight & QSign",
      description: "Protect your intellectual property using AEVION's legal tech stack. Learn to register IP objects, create digital signatures, and use Bureau for certification.",
      category: "legal",
      level: "intermediate",
      tags: ["ip", "qright", "qsign", "legal"],
      lessons: [
        { title: "What is IP Registration?", content: "Intellectual property registration creates a timestamped, cryptographically-signed record...", duration: 12 },
        { title: "Creating Your First QRight Object", content: "POST /api/qright/objects with title, description, kind and content...", duration: 15 },
        { title: "Digital Signing with QSign v2", content: "QSign v2 supports Ed25519 and HMAC-SHA256 signatures...", duration: 20 },
      ],
    },
    {
      title: "Fintech on AEVION: QTradeOffline & QMaskCard",
      description: "Build offline-first payment flows with ECDSA-signed transfers, virtual card masking, and anti-fraud risk scoring.",
      category: "fintech",
      level: "advanced",
      tags: ["fintech", "payments", "qtradeoffline", "qmaskcard"],
      lessons: [
        { title: "Offline P2P Payments Architecture", content: "QTradeOffline uses ECDSA P-256 keypairs for offline-signed transfers...", duration: 25 },
        { title: "Virtual Card Masking with QMaskCard", content: "Issue virtual PANs (aev-mask-<hex>) for secure payment isolation...", duration: 20 },
        { title: "Anti-Fraud Risk Scoring", content: "Each charge gets a risk score 0-100 based on geo, velocity, and amount...", duration: 15 },
      ],
    },
    {
      title: "HealthAI: AI-Powered Wellness",
      description: "Use AEVION HealthAI to build personalized wellness plans with real biomarker tracking, AI recommendations, and multi-provider LLM integration.",
      category: "health",
      level: "beginner",
      tags: ["health", "ai", "wellness"],
      lessons: [
        { title: "Creating Your Health Profile", content: "POST /api/healthai/profile with age, sex, height, weight, conditions...", duration: 10 },
        { title: "Logging Daily Wellness Data", content: "Track sleep, mood, water intake, and exercise via POST /log...", duration: 8 },
        { title: "AI-Generated Wellness Plans", content: "GET /api/healthai/plan/:id generates rule-based + LLM-enhanced plans...", duration: 15 },
      ],
    },
  ];

  for (const course of courses) {
    if (!JWT) { log("⏭", `Skipping QLearn (no JWT): ${course.title}`); continue; }
    // Check if exists
    const list = await req("GET", `/api/qlearn/courses?limit=50`);
    if (list.body?.courses?.some((x) => x.title === course.title)) {
      log("✓", `QLearn already has: ${course.title.slice(0, 50)}`); ok++; continue;
    }
    const { lessons, ...courseData } = course;
    const r = await req("POST", "/api/qlearn/me/courses", courseData, true);
    if ([200, 201].includes(r.status)) {
      const courseId = r.body?.id || r.body?.course?.id;
      log("✅", `QLearn course: ${course.title.slice(0, 50)}`, `id=${courseId?.slice(0, 8)}`);
      ok++;
      if (courseId && lessons) {
        for (const lesson of lessons) {
          const lr = await req("POST", `/api/qlearn/me/courses/${courseId}/lessons`, lesson, true);
          if ([200, 201].includes(lr.status)) { log("  ✓", `Lesson: ${lesson.title.slice(0, 40)}`); ok++; }
          else { log("  ✗", `Lesson failed: ${lesson.title.slice(0, 40)}`, String(lr.status)); fail++; }
        }
      }
    } else {
      log("❌", `QLearn failed: ${course.title.slice(0, 40)}`, `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
      fail++;
    }
  }
}

// ── QEvents ──────────────────────────────────────────────────────────────────
async function seedQEvents() {
  console.log("\n📅 QEvents");
  const now = new Date();
  const events = [
    { title: "AEVION Platform Launch Webinar", description: "Join us for the official AEVION platform demo — 34 live modules, real AI, real payments, real IP protection. Q&A session included.", location: "Online (Zoom)", startAt: new Date(now.getTime() + 7 * 86400000).toISOString(), endAt: new Date(now.getTime() + 7 * 86400000 + 5400000).toISOString(), capacity: 200, category: "webinar", tags: ["aevion", "launch", "webinar"] },
    { title: "QCoreAI Multi-Agent Hackathon", description: "Build with AEVION QCoreAI's multi-agent framework. Use sequential, parallel, or debate strategies to solve real problems. Prizes in AEV tokens.", location: "Almaty + Online", startAt: new Date(now.getTime() + 14 * 86400000).toISOString(), endAt: new Date(now.getTime() + 15 * 86400000).toISOString(), capacity: 100, category: "hackathon", tags: ["ai", "hackathon", "qcoreai"] },
    { title: "IP Protection Workshop: QRight & Bureau", description: "Hands-on workshop on registering and protecting intellectual property using AEVION's legal tech stack. Certificates of completion provided.", location: "Nur-Sultan Business Hub", startAt: new Date(now.getTime() + 21 * 86400000).toISOString(), endAt: new Date(now.getTime() + 21 * 86400000 + 10800000).toISOString(), capacity: 50, category: "workshop", tags: ["ip", "legal", "workshop"] },
    { title: "AEVION FinTech Summit 2026", description: "Explore AEVION's fintech ecosystem: QTradeOffline P2P transfers, QMaskCard virtual cards, QPayNet embedded payments, and Revenue Hub analytics.", location: "Almaty Expo", startAt: new Date(now.getTime() + 30 * 86400000).toISOString(), endAt: new Date(now.getTime() + 31 * 86400000).toISOString(), capacity: 500, category: "conference", tags: ["fintech", "payments", "summit"] },
    { title: "CyberChess Weekly Tournament", description: "Weekly rapid chess tournament on AEVION CyberChess. ELO 1200-2400. Prizes in Chessy tokens. Registration open to all AEVION users.", location: "Online (CyberChess)", startAt: new Date(now.getTime() + 3 * 86400000).toISOString(), endAt: new Date(now.getTime() + 3 * 86400000 + 7200000).toISOString(), capacity: 128, category: "competition", tags: ["chess", "tournament", "weekly"] },
  ];

  for (const event of events) {
    if (!JWT) { log("⏭", `Skipping QEvents (no JWT): ${event.title}`); continue; }
    const r = await req("POST", "/api/qevents/me/events", event, true);
    if ([200, 201].includes(r.status)) { log("✅", `QEvent: ${event.title.slice(0, 50)}`); ok++; }
    else if (r.status === 409) { log("✓", `QEvent exists: ${event.title.slice(0, 50)}`); ok++; }
    else { log("❌", `QEvent failed: ${event.title.slice(0, 40)}`, `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`); fail++; }
  }
}

// ── QNews ────────────────────────────────────────────────────────────────────
async function seedQNews() {
  console.log("\n📰 QNews articles");
  const articles = [
    { title: "AEVION Reaches 34 Live Modules: The Complete Platform Story", summary: "From a single Globus map to 34 live modules — how AEVION built a complete AI-powered ecosystem in under 90 days.", url: "https://aevion.app/news/34-live-modules", source: "AEVION Blog", category: "tech", tags: ["aevion", "milestone", "launch"] },
    { title: "QCoreAI Now Powers 5 LLM Providers: Anthropic, OpenAI, Gemini & More", summary: "QCoreAI multi-agent framework now supports 5 LLM providers with automatic failover, A/B testing, and cost tracking.", url: "https://aevion.app/news/qcoreai-5-providers", source: "AEVION Blog", category: "ai", tags: ["qcoreai", "ai", "llm"] },
    { title: "QTradeOffline: The First ECDSA P2P Payment System in Kazakhstan", summary: "How AEVION built offline-first P2P payments using ECDSA P-256 cryptography — no internet required for transfers.", url: "https://aevion.app/news/qtradeoffline-ecdsa", source: "AEVION Tech", category: "crypto", tags: ["fintech", "payments", "ecdsa"] },
    { title: "HealthAI LLM Plans: AI-Powered Wellness Meets Real Medical Data", summary: "AEVION HealthAI now generates AI-enhanced wellness plans using real biomarker data from Postgres + Anthropic/OpenAI.", url: "https://aevion.app/news/healthai-llm-plans", source: "AEVION Blog", category: "ai", tags: ["healthai", "ai", "wellness"] },
    { title: "Revenue Hub: AEVION's Unified Monetization Platform", summary: "Revenue Hub brings Stripe, YouTube AdSense, and Twitch affiliate tracking into one dashboard for all 12 AEVION products.", url: "https://aevion.app/news/revenue-hub", source: "AEVION Blog", category: "business", tags: ["revenue", "stripe", "monetization"] },
  ];

  for (const article of articles) {
    if (!JWT) { log("⏭", `Skipping QNews (no JWT): ${article.title}`); continue; }
    const r = await req("POST", "/api/qnews/articles", article, true);
    if ([200, 201].includes(r.status)) { log("✅", `QNews: ${article.title.slice(0, 50)}`); ok++; }
    else if (r.status === 409) { log("✓", `QNews exists: ${article.title.slice(0, 50)}`); ok++; }
    else { log("❌", `QNews failed: ${article.title.slice(0, 40)}`, `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`); fail++; }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nAEVION Demo Content Seeder → ${BASE}`);
  if (!JWT) {
    console.log("⚠️  No JWT token — only public endpoints will be tested.");
    console.log("   Set JWT=<your-token> to seed content.\n");
  }

  await seedQStore();
  await seedQLearn();
  await seedQEvents();
  await seedQNews();

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  Total: ${ok + fail}, ok: ${ok}, failed: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
