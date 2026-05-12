import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";

export const qnewsRouter = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  publishedAt: string;
  tags: string[];
}

// ─── Static categories ────────────────────────────────────────────────────────

const CATEGORIES = ["tech", "crypto", "ai", "business", "science", "world"];

// ─── In-memory store ──────────────────────────────────────────────────────────

const memNews = new Map<string, NewsItem>();

// Seed with 10 realistic fake news items on startup
const SEED: Omit<NewsItem, "id">[] = [
  {
    title: "OpenAI Releases GPT-5 Turbo with Extended Context Window",
    summary:
      "OpenAI has announced GPT-5 Turbo featuring a 2M token context window, improved reasoning, and reduced hallucination rates. The model is now available via API to all Plus subscribers.",
    url: "https://openai.com/blog/gpt5-turbo",
    source: "OpenAI Blog",
    category: "ai",
    publishedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    tags: ["openai", "gpt", "llm"],
  },
  {
    title: "Bitcoin Surpasses $120,000 as Institutional Demand Accelerates",
    summary:
      "Bitcoin reached a new all-time high of $122,400 driven by spot ETF inflows and renewed interest from sovereign wealth funds. Analysts cite regulatory clarity in the EU as a key catalyst.",
    url: "https://coindesk.com/bitcoin-120k",
    source: "CoinDesk",
    category: "crypto",
    publishedAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    tags: ["bitcoin", "btc", "crypto"],
  },
  {
    title: "Google DeepMind Achieves Breakthrough in Protein Folding Accuracy",
    summary:
      "DeepMind's latest AlphaFold 3.5 model achieves 97.2% accuracy on new protein structures, potentially accelerating drug discovery timelines by a decade according to researchers.",
    url: "https://deepmind.google/alphafold-3-5",
    source: "DeepMind",
    category: "science",
    publishedAt: new Date(Date.now() - 8 * 3600_000).toISOString(),
    tags: ["deepmind", "protein", "biology"],
  },
  {
    title: "Apple Unveils Vision Pro 2 with Standalone Neural Processing",
    summary:
      "Apple's second-generation Vision Pro features an M4 Ultra chip enabling fully local AI inference without cloud dependency. The device is priced at $2,999 and ships next quarter.",
    url: "https://apple.com/vision-pro-2",
    source: "Apple Newsroom",
    category: "tech",
    publishedAt: new Date(Date.now() - 12 * 3600_000).toISOString(),
    tags: ["apple", "vr", "hardware"],
  },
  {
    title: "EU AI Act Enforcement Begins: Major Fines Expected in Q3",
    summary:
      "The European Union's AI Act entered enforcement phase this week. Regulators are reviewing 47 high-risk AI deployments across healthcare and financial services with fines up to 6% of global revenue.",
    url: "https://ec.europa.eu/ai-act-enforcement",
    source: "EU Commission",
    category: "business",
    publishedAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
    tags: ["regulation", "eu", "policy"],
  },
  {
    title: "Ethereum Layer-2 Ecosystem Hits $80B Total Value Locked",
    summary:
      "Combined TVL across Arbitrum, Optimism, Base, and zkSync surpassed $80 billion for the first time. Base, Coinbase's L2, leads monthly active users with 42 million unique addresses.",
    url: "https://defillama.com/l2-tvl",
    source: "DeFi Llama",
    category: "crypto",
    publishedAt: new Date(Date.now() - 30 * 3600_000).toISOString(),
    tags: ["ethereum", "layer2", "defi"],
  },
  {
    title: "NVIDIA Reports Record Revenue of $36B in Q1 2026",
    summary:
      "NVIDIA's data center segment accounted for 87% of total revenue as hyperscalers ramp H200 deployments. CEO Jensen Huang teased the Blackwell Ultra architecture for release in late 2026.",
    url: "https://investor.nvidia.com/q1-2026",
    source: "NVIDIA IR",
    category: "business",
    publishedAt: new Date(Date.now() - 48 * 3600_000).toISOString(),
    tags: ["nvidia", "gpu", "ai-chips"],
  },
  {
    title: "MIT Researchers Develop Room-Temperature Quantum Memory",
    summary:
      "Scientists at MIT have demonstrated quantum coherence at room temperature using nitrogen-vacancy centers in diamond. The breakthrough could enable practical quantum networks without cryogenic cooling.",
    url: "https://news.mit.edu/quantum-memory",
    source: "MIT News",
    category: "science",
    publishedAt: new Date(Date.now() - 60 * 3600_000).toISOString(),
    tags: ["quantum", "physics", "computing"],
  },
  {
    title: "Anthropic Raises $4B Series E at $45B Valuation",
    summary:
      "AI safety company Anthropic has secured $4 billion in its latest funding round led by Google and Amazon. The funds will be used to scale Claude's capabilities and expand safety research.",
    url: "https://anthropic.com/series-e",
    source: "Anthropic",
    category: "ai",
    publishedAt: new Date(Date.now() - 72 * 3600_000).toISOString(),
    tags: ["anthropic", "claude", "funding"],
  },
  {
    title: "Global 5G Connections Exceed 3 Billion, Standalone Networks Dominate",
    summary:
      "The GSMA reports that standalone 5G connections surpassed 3 billion worldwide in April 2026. Asia-Pacific leads with 1.9 billion connections; North America and Europe are accelerating rollouts.",
    url: "https://gsma.com/5g-report-2026",
    source: "GSMA",
    category: "world",
    publishedAt: new Date(Date.now() - 96 * 3600_000).toISOString(),
    tags: ["5g", "telecom", "global"],
  },
];

for (const item of SEED) {
  const id = crypto.randomUUID();
  memNews.set(id, { id, ...item });
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : String(v ?? "");
}

// ─── GET /api/qnews/health ───────────────────────────────────────────────────
qnewsRouter.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "qnews" });
});

// ─── GET /api/qnews/categories ───────────────────────────────────────────────
qnewsRouter.get("/categories", (_req: Request, res: Response) => {
  const counts: Record<string, number> = {};
  for (const cat of CATEGORIES) counts[cat] = 0;
  for (const item of memNews.values()) {
    if (counts[item.category] !== undefined) counts[item.category] += 1;
  }
  const result = CATEGORIES.map((cat) => ({ id: cat, count: counts[cat] ?? 0 }));
  res.json({ categories: result });
});

// ─── GET /api/qnews/trending — top 5 most recently added ────────────────────
qnewsRouter.get("/trending", (_req: Request, res: Response) => {
  const articles = Array.from(memNews.values())
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 5);
  res.json({ articles });
});

// ─── GET /api/qnews/articles ─────────────────────────────────────────────────
qnewsRouter.get("/articles", (req: Request, res: Response) => {
  const { category, q, limit } = req.query as Record<string, string | undefined>;
  const limitN = Math.min(Number(limit) || 20, 100);
  let articles = Array.from(memNews.values());

  if (category && CATEGORIES.includes(category)) {
    articles = articles.filter((a) => a.category === category);
  }
  if (q) {
    const lq = q.toLowerCase();
    articles = articles.filter(
      (a) =>
        a.title.toLowerCase().includes(lq) ||
        a.summary.toLowerCase().includes(lq) ||
        a.tags.some((t) => t.toLowerCase().includes(lq)),
    );
  }

  articles = articles
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limitN);

  res.json({ articles, total: articles.length });
});

// ─── GET /api/qnews/articles/:id ─────────────────────────────────────────────
qnewsRouter.get("/articles/:id", (req: Request, res: Response) => {
  const id = param(req, "id");
  const article = memNews.get(id);
  if (!article) return res.status(404).json({ error: "not_found" });
  return res.json({ article });
});

// ─── POST /api/qnews/articles ────────────────────────────────────────────────
qnewsRouter.post("/articles", (req: Request, res: Response) => {
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });

  const { title, summary, url, source, category, tags } = req.body as {
    title?: string;
    summary?: string;
    url?: string;
    source?: string;
    category?: string;
    tags?: string[];
  };

  if (!title || !summary || !url || !source || !category) {
    return res.status(400).json({ error: "title, summary, url, source, category required" });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of ${CATEGORIES.join(", ")}` });
  }

  const article: NewsItem = {
    id: crypto.randomUUID(),
    title: title.trim(),
    summary: summary.trim(),
    url: url.trim(),
    source: source.trim(),
    category,
    publishedAt: new Date().toISOString(),
    tags: Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : [],
  };
  memNews.set(article.id, article);
  return res.status(201).json({ article });
});

// ─── POST /api/qnews/ai/summarize ────────────────────────────────────────────
qnewsRouter.post("/ai/summarize", async (req: Request, res: Response) => {
  const { articleId, text } = req.body as { articleId?: string; text?: string };

  let contentToSummarize = text ?? "";
  if (articleId) {
    const article = memNews.get(articleId);
    if (article) {
      contentToSummarize = `${article.title}\n\n${article.summary}`;
    }
  }

  if (!contentToSummarize) {
    return res.status(400).json({ error: "articleId or text required" });
  }

  // Try to use the QCoreAI provider; stub if unavailable
  try {
    const { callProvider } = await import("../services/qcoreai/providers");
    const result = await callProvider(
      "openai",
      [
        {
          role: "user",
          content: `Summarize the following article in 2-3 sentences and provide 3 key bullet points.\n\nArticle:\n${contentToSummarize}\n\nRespond in JSON: {"summary": "...", "keyPoints": ["...", "...", "..."]}`,
        },
      ],
      "gpt-4o-mini",
      0.3,
    );
    const raw = result.reply ?? "";
    try {
      const parsed = JSON.parse(raw) as { summary?: string; keyPoints?: string[] };
      return res.json({
        summary: parsed.summary ?? raw,
        keyPoints: parsed.keyPoints ?? [],
      });
    } catch {
      return res.json({ summary: raw, keyPoints: [] });
    }
  } catch {
    // Stub response when provider unavailable
    const words = contentToSummarize.split(/\s+/).slice(0, 30).join(" ");
    return res.json({
      summary: `${words}... (AI summarization requires a configured LLM provider)`,
      keyPoints: [
        "Key insight from the article",
        "Secondary observation worth noting",
        "Takeaway for further research",
      ],
    });
  }
});
