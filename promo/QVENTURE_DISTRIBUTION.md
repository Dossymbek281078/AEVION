# QVenture — Distribution kit

> Live: https://aevion.vercel.app/qventure
> One-click demo (no signup): https://aevion.vercel.app/qventure/a/demo-neurodx
>
> Reach lever, not vanity metrics. Post these where investors and builders actually
> read, then reply to every comment — the discussion is the distribution.

---

## 1. Show HN (news.ycombinator.com/submit)

**Title** (80-char limit, no emoji, no hype — HN culture):
```
Show HN: QVenture – turn any startup description into a fund-grade screening memo
```

**URL:** `https://aevion.vercel.app/qventure`

**Text** (the first comment you post right after submitting — HN wants the "how" and the honest limitations):
```
I kept seeing "AI for VCs" tools that spit out a vibe score you can't interrogate,
so I built the opposite.

You paste a plain description of any company, in any sector, and get three things
in ~30s:

1. A deterministic 0–100 score. Eight weighted factors (market, timing, moat, unit
economics, execution, science, legal, competition), each grounded in an 18-sector
knowledge base with cited market-size sources. Same input → same number, every
factor shows its weight and rationale. The scoring is plain code, not an LLM — so
it's auditable and reproducible.

2. A four-role council (scientist / data-analyst / economist / lawyer). This part
IS an LLM — each writes a view and flags risk, then a synthesis memo lands on
invest/watch/pass. It degrades to a deterministic template if no model key is set.

3. An entry strategy: ticket + range, target ownership, valuation band, staged
tranches, risk-adjusted MOIC/IRR, fractional-Kelly sizing.

New this week: a benchmark signal — every analysis is stored, so a new deal gets
a real percentile against every deal QVenture has already scored. It's honest
about sample size and says "not enough data yet" instead of faking a distribution.

Honest limits: the council is an LLM and can be wrong; the score encodes MY factor
weights (arguable — I'd love the pushback); it's a screening tool, explicitly not
investment advice. No signup on the demo above.

Stack: Express + Postgres backend, Next.js frontend. Happy to answer anything about
the scoring model or the council prompting.
```

**After posting:** reply to every comment within the first 2 hours — HN ranking rewards active author discussion. Expect (and welcome) skepticism about the factor weights; "here's why I weighted market 0.20" is a great reply.

Best time to submit: weekday ~08:00–10:00 US Eastern.

---

## 2. r/venturecapital  (or r/startups "Share Your Startup", r/SideProject)

> ⚠️ r/venturecapital removes overt self-promo. Frame as a method question + tool,
> not an ad. If it gets removed, r/SideProject and r/startups (weekend Share thread)
> are friendlier. Post as TEXT, drop the link in a comment if the sub blocks link posts.

**Title:**
```
I built a tool that scores a startup 0–100 across 8 factors — would love diligence people to tear the weights apart
```

**Body:**
```
I got tired of "AI investment" tools that give you a number you can't argue with,
so I built one where you can argue with every point.

You describe a company (any sector) and it returns a deterministic 0–100 score
across 8 weighted factors — market, timing, moat, unit economics, execution,
science, legal, competition — each grounded in an 18-sector knowledge base with
cited market sizes. Same input always gives the same number, and every factor
exposes its weight and reasoning. On top of that: a 4-role AI council
(scientist/data-analyst/economist/lawyer) and a concrete entry strategy (ticket,
valuation band, tranches, risk-adjusted return).

I'm not here to sell it — it's free to try and there's a no-signup demo. What I
actually want from this sub:

- If you run diligence: which of the 8 factors would you weight differently, and why?
- What factor am I missing entirely?

Demo (no signup): https://aevion.vercel.app/qventure/a/demo-neurodx
Run your own: https://aevion.vercel.app/qventure

It's a screening aid, not investment advice — happy to get roasted on the methodology.
```

**Also worth it:** r/SideProject, r/EntrepreneurRideAlong, r/startups (Saturday "Share Your Startup"), Indie Hackers.

---

## 3. Investor DM / cold email template

> Keep it under 6 lines. One personal opener, one crisp value line, one ask, one link.
> Personalize the [bracket] every time — no blast.

**Short DM (Twitter/LinkedIn):**
```
Hi [Name] — saw your note on [their post/thesis on X]. I built a tool that turns a
plain company description into a fund-grade screening memo in ~30s: a deterministic
0–100 score across 8 factors, a 4-expert AI council, and an entry strategy.

Would value 60 seconds of your eyes on the demo (no signup) — and one line on what
you'd change: https://aevion.vercel.app/qventure/a/demo-neurodx
```

**Cold email (slightly longer):**
```
Subject: a 30-second screening memo — would value your read

Hi [Name],

I follow [fund/their work on X]. I built QVenture because "AI for investors" tools
give you a score you can't interrogate — I wanted one a partner could defend in an
IC meeting.

You paste any company description and get a deterministic 0–100 score (8 weighted,
cited factors), a 4-role expert council, and a concrete entry strategy — in ~30s.
It's a screening aid, not advice.

Live example, no signup: https://aevion.vercel.app/qventure/a/demo-neurodx

If it's useful I'd love one line of feedback; if not, no worries at all.

— Dosymbek
```

---

## Priority order (biggest reach per hour of effort)
1. **Show HN** — highest ceiling, one shot, be online to reply for 2h.
2. **3–5 personalized investor DMs/day** — low volume, high signal, compounding.
3. **r/SideProject + r/startups** — steady trickle, friendly to "I built this".
4. Product Hunt launch (schedule a Tue–Thu) — needs a bit more prep (gallery, tagline).

— drafted 2026-07-10, AEVION
