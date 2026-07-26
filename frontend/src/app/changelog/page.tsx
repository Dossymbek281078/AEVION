import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";

type Entry = {
  date: string;
  highlight: string;
  body: string;
  modules?: string[];
  kind: "feat" | "fix" | "docs";
};

const ENTRIES: Entry[] = [
  {
    date: "2026-07-26",
    highlight: "See the council disagree without signing in — and call it from the SDK",
    body:
      "The council spends tokens, so running one needs an account. Showing what it does should not. The split was resolved by a property of the dissent map itself: it is derived from the text of replies already received, without a single extra model call — so it costs nothing to compute and can be handed out freely. /multichat-engine now has a «show me an example» button open to everyone. The three replies are canned, but the map under them is computed by the SERVER, through the same public endpoint a real request uses — so the example runs the real algorithm rather than a picture of one: change the thresholds and the numbers on screen change with them. It is labelled as an example, because letting it pass for your own run would be no better than drawing the result. That endpoint, POST /api/multichat/dissent/preview, is public and free for anyone's answers — from this SDK, from your own models, from anywhere. All three multichat calls are now in the TypeScript client too, two of them needing no token: verifying a receipt must not require an account, or the receipt means nothing.",
    modules: ["Multichat", "SDK"],
    kind: "feat",
  },
  {
    date: "2026-07-26",
    highlight: "Multichat now shows where the agents disagree — and hands you a receipt for the answer",
    body:
      "Every multi-agent product synthesises the replies into one polished answer and throws the disagreement away. That disagreement is the signal: where the models diverged is exactly where the answer cannot be taken on trust — agreement proves little, since models trained on overlapping data fail in similar ways, and the console says so out loud when they agree. The council on /multichat-engine asks three differently-roled agents in parallel and puts the dissent map ABOVE the replies: pairwise similarity, the outlier (not «wrong» — «read this one first»), conflicts in NUMBERS (the most checkable form of disagreement), refusals and hedges. It costs nothing extra: the map is computed from the replies already received, with no additional model call, so it is free and reproducible. Each answer also carries a receipt — panel composition, prompt and reply hashes, dissent summary and cost, in RFC8785 canonical form with a sha256 digest and an ed25519 signature from the QSign v2 key registry. Download it, drop it on /multichat-engine/verify, and see whether the content still matches its hash. That page is public by design: demanding an account to verify someone else's receipt would defeat the point. And the spec is open — RFC8785 plus sha256 — so the hash can be recomputed by any third-party implementation without trusting our button.",
    modules: ["Multichat"],
    kind: "feat",
  },
  {
    date: "2026-07-26",
    highlight: "QReal keeps a character's face across shots — and can now prove it",
    body:
      "A storyboard is written shot by shot, so the model re-describes the same hero every time: «7yo boy, tousled hair, oversized sweater» in one shot, «little boy running» in the next — two different faces on screen. That drift is the weakness every competitor publicly admits, and it is the niche QReal claims. Now there is a scene cast: subjects across all shots are grouped into characters, the most detailed description becomes the canon and goes into every shot the hero appears in, plus an explicit continuity directive. The director can rewrite the canon on /qreal and the render prompts rebuild themselves; reference frames are passed to the engine that supports them (Seedance reference-to-video, addressed as @Image1 inside the prompt). Realism QC also stopped being a checklist: each of the 14 criteria now carries 1/3/5 anchors, a shot is scored into a verdict — accept, regenerate, or «too little judged to decide» — and regeneration is opt-in and capped, because every retry costs money. Continuity itself is measurable too: five criteria judged on the assembled film, and a scene where nobody recurs honestly returns «nothing to compare» instead of a cheerful pass.",
    modules: ["QReal"],
    kind: "feat",
  },
  {
    date: "2026-07-21",
    highlight: "QReal Studio is born — fully-alive AI video without an actor, first film rendered same day",
    body:
      "New planet module /qreal: a text brief becomes a finished scene — people, children, animals, birds, nature and sound, no actor and no reference footage. Pipeline: AI storyboard → render prompts with built-in realism directives → direct engine APIs (Seedance 2.0 / Kling v3 via fal.ai, no middleman) → 14-criterion realism QC → FFmpeg assembly with loudness normalization. Every frame carries a non-removable AI mark (C2PA-style manifest, sha256, EU AI Act art. 50) — realism is the product, deception is not. The seeded demo «Morning in the Steppe» (dawn steppe, a boy with an Alabai dog, a grandmother pouring tea in a yurt, a golden eagle take-off) was rendered end-to-end the same day for $2.52 in engine costs, with the AI disclosure embedded in the file metadata. Transparent unit economics on the page: per-engine $/s and a full-film estimate before you click render.",
    modules: ["QReal"],
    kind: "feat",
  },
  {
    date: "2026-04-27",
    highlight: "Bank story pages · Trust deep-dive · Receipts · Wallet card · Security model",
    body:
      "Five new indexable surfaces shipped: /bank/about (story), /bank/trust (factor breakdown + tier ladder + methodology), /bank/receipt/[id] (printable Ed25519-signed receipts with verify QR), /bank/card (virtual card whose tier follows Trust Score, flip + hide-balance + print), /bank/security (5-layer defence model + comparison table + FAQ). Each ships with locale-aware copy in EN/RU/KK and an edge-rendered OG image (1200×630). Story group surfaced in /bank/explore so the catalog reads narrative-first. Spend Forecast component, Smart Notifications Center, Multichat token meter and demo seed mode also landed in this push.",
    modules: ["Bank", "Multichat"],
    kind: "feat",
  },
  {
    date: "2026-04-26",
    highlight: "Multichat Engine goes live · Awards real submission UX · Demo refresh · Pitch evolution",
    body:
      "Multichat Engine moves from beta to live with a working parallel-agent grid (6 roles, persistent local sessions, 5 LLM providers, demo-mode fallback). Awards Music + Film get real submission forms, voting with rank #1/2/3 medals and AEC payout banners. /demo gains live ecosystem pulse and a 90-second pipeline timeline; /demo/deep gets a full technical rewrite (architecture, crypto stack, threat model, performance budgets, deployment, multilingual). /pitch picks up Customer voice quotes, Partners & press, Walkthroughs, plus a print-optimised /pitch/print route for PDF export.",
    modules: ["Multichat", "Awards", "Demo", "Pitch"],
    kind: "feat",
  },
  {
    date: "2026-04-26",
    highlight: "Investor pitch tour at /pitch · PitchValueCallout on every live module · 10-session launcher",
    body:
      "Full investor narrative shipped: thesis, $340B TAM, 4 network forces, 12 launched modules grouped by value bucket, 15 emerging nodes, 5-axis defensibility, 4-phase GTM, ARR trajectory through year 5, ask. Investor FAQ added to /help. Live API metrics in the hero. PowerShell launcher (START_SESSIONS.ps1) opens 10 Claude Code sessions across 6 worktrees with a single command.",
    modules: ["Pitch", "Help", "Tooling"],
    kind: "feat",
  },
  {
    date: "2026-04-26",
    highlight: "AEVION Bank — full multilingual MVP (EN / RU / KZ)",
    body:
      "Global i18n extended with Kazakh; ~700+ translation keys across 36 components; 12 hover tooltips on key metrics; backend wiring (Bearer auth, ApiError class, email→accountId resolver, BackendStatus offline banner); 13 _lib files become i18n-aware via *_KEY maps. /bank rendered as static, build green.",
    modules: ["Bank", "i18n"],
    kind: "feat",
  },
  {
    date: "2026-04-25",
    highlight: "Bank: 10 product features in one push",
    body:
      "Financial Copilot, Autopilot rules #1–#5, Panic Freeze, Wealth Constellation, Concept Primer, Tier Progression, Unified Audit Feed, holographic QR Share, ⌘K command palette, mobile bottom tabs.",
    modules: ["Bank"],
    kind: "feat",
  },
  {
    date: "2026-04-25",
    highlight: "Qright v3 — full stack on main",
    body:
      "Shamir Secret Sharing + One-Time Signatures + HMAC rotation + author co-signing (WebCrypto + IndexedDB) + offline verification bundle independent of AEVION. PRs #1, #4, #6 merged.",
    modules: ["QRight"],
    kind: "feat",
  },
];

export const metadata = {
  title: "AEVION · Changelog",
  description: "Recent shipped product updates across all AEVION modules.",
};

export default function ChangelogPage() {
  return (
    <main style={{ background: "#020617", color: "#e2e8f0", minHeight: "100vh", padding: "32px 24px 80px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Wave1Nav variant="dark" />
        <p
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(148,163,184,0.95)",
            margin: "0 0 12px",
          }}
        >
          What we shipped recently
        </p>
        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 44px)",
            fontWeight: 900,
            margin: "0 0 18px",
            letterSpacing: "-0.03em",
            background: "linear-gradient(120deg, #fff 0%, #99f6e4 45%, #7dd3fc 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          AEVION changelog
        </h1>
        <p style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.65, margin: "0 0 36px" }}>
          Notable updates only. The git log is the unfiltered source of truth — see{" "}
          <a href="https://github.com/Dossymbek281078/AEVION/commits/bank-payment-layer" style={{ color: "#5eead4" }}>
            commits/bank-payment-layer
          </a>{" "}
          on GitHub.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {ENTRIES.map((e, i) => {
            const kindColor = e.kind === "feat" ? "#5eead4" : e.kind === "fix" ? "#fbbf24" : "#94a3b8";
            const kindLabel = e.kind === "feat" ? "FEATURE" : e.kind === "fix" ? "FIX" : "DOCS";
            return (
              <article
                key={i}
                style={{
                  padding: 22,
                  borderRadius: 14,
                  background: "rgba(15,23,42,0.7)",
                  border: `1px solid ${kindColor}33`,
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline", marginBottom: 10 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.15em",
                      color: kindColor,
                      background: `${kindColor}18`,
                      padding: "3px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {kindLabel}
                  </span>
                  <span style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.05em" }}>{e.date}</span>
                  {e.modules?.map((m) => (
                    <span
                      key={m}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#cbd5e1",
                        background: "rgba(148,163,184,0.1)",
                        padding: "3px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(148,163,184,0.25)",
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: "0 0 8px", lineHeight: 1.35 }}>
                  {e.highlight}
                </h2>
                <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.65, margin: 0 }}>{e.body}</p>
              </article>
            );
          })}
        </div>

        <footer style={{ marginTop: 40, paddingTop: 18, borderTop: "1px solid rgba(51,65,85,0.5)", fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 12px" }}>
            For the investor view, see{" "}
            <Link href="/pitch" style={{ color: "#fbbf24", fontWeight: 700 }}>
              /pitch
            </Link>
            . For a product walkthrough,{" "}
            <Link href="/demo" style={{ color: "#5eead4" }}>
              /demo
            </Link>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}
