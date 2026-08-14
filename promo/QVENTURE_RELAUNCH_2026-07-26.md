# QVenture — relaunch posts, 2026-07-26 (rubric v4)

> Live: https://aevion.vercel.app/qventure
> Demo report (no signup): https://aevion.vercel.app/qventure/a/demo-neurodx
> Worked examples: https://aevion.vercel.app/qventure/gallery
> Batch funnel: https://aevion.vercel.app/qventure/batch
> Price: $39/mo · Not investment advice.

**What is verifiably true today** (checked live before writing this, 2026-07-26):
deterministic 0–100 score across 8 weighted factors · 18 sectors with cited
2024–2026 market sources · 4-role AI council on live Anthropic · live comparable
rounds via Serper (cached 24h per sector×stage, falls back to a labelled
"illustrative" mode) · financial stress test · bottom-up TAM triangulation ·
revenue plan vs the venture bar for the stage · percentile rank against the
analysed-deal corpus (67 analyses) · pitch-deck upload → autofilled structured
financials · batch funnel (many decks → one ranked table + one PDF) · PDF memo,
PDF comparison, PDF funnel · public shareable reports with OG cards · watchlist
that syncs across devices when signed in.

---

## Lead post — X / Twitter (single)

I ran real pitch decks through my own AI investment analyst today and it was
wrong four different ways. All four were the same bug class: a number that looked
right and meant something else.

1. "4% annual churn" was scored as 4% *monthly* (~39%/yr). Great company, read as
   a dying one.
2. "20% monthly churn" was read as 20% MoM *growth* — a bare "<n>% monthly"
   matched the growth pattern. The high-churn deal outscored the healthy one.
3. "CAC $3, LTV $2, monthly churn 14%" → LTV parsed as $2 **m**illion, because
   the money-unit regex matched the "m" of "monthly". LTV/CAC 666,666:1.
4. Revenue plans were benchmarked against the *market* CAGR. A seed plan growing
   at market rate was labelled "credible" (it never takes share); an ordinary
   $4.8M→$17M Series A plan came back HOCKEY STICK.

Fixed, tested (84 unit + 73 smoke asserts), shipped. Rubric v4.

The uncomfortable part: 89 tests were green the whole time. Only real decks found
these.

QVenture → https://aevion.vercel.app/qventure

---

## X / Twitter — thread (6)

**1/**
I built an AI investment analyst that writes a fund-grade screening memo instead
of a vibe: paste a plan or drop a pitch deck → 0–100 score, 4-expert council,
entry strategy with ticket / valuation band / tranches.

Live demo, no signup:
https://aevion.vercel.app/qventure/a/demo-neurodx

**2/**
The score is deterministic, not a black box. 8 weighted factors — market, timing,
moat, unit economics, execution, science, legal, competition. Same input → same
number. Every factor says whether its number came from *this company's* disclosed
evidence or from a sector prior, so you can see how much of the score is really
about the deal.

**3/**
Diligence depth, all deterministic (no LLM invents a number):
• red flags from the plan's own metrics
• financial stress test — CAC ×2, churn ×2, margin −15pp
• bottom-up TAM triangulation (derived ACV → implied accounts → SOM)
• revenue plan vs the venture bar for the stage
• percentile rank vs every deal ever analysed here

**4/**
Then four AI experts write their view — 🔬 scientist, 📊 data analyst,
📈 economist, ⚖️ lawyer — each anchored to the quant factor it owns, plus a
jurisdictional legal read (US Reg D / EU Prospectus+MiCA / UK FSMA).

Comparable rounds come from live web search with links, and say so when they are
memory-based instead.

**5/**
Drop a folder of decks into the batch funnel → every deck extracted, scored and
ranked in one league table, with one funnel PDF.
https://aevion.vercel.app/qventure/batch

Export a memo PDF, compare two deals side by side, share a public report, keep a
watchlist that syncs across devices.

**6/**
Today's shipping note, because honesty is the product here: real decks exposed
four defects in my own engine (churn period ignored, "% monthly" read as growth,
"LTV $2, monthly" parsed as $2M, plans benchmarked against market CAGR instead of
the stage bar). Fixed and covered by tests. Rubric v4.

$39/mo · not investment advice → https://aevion.vercel.app/qventure

---

## LinkedIn (EN)

**What broke in my AI investment analyst today — and why I am posting it**

QVenture turns a business plan or a pitch deck into a screening memo: a
deterministic 0–100 score across 8 weighted factors, a four-role expert council
(scientist / data analyst / economist / lawyer), a stress test of the unit
economics, a bottom-up TAM triangulation, live comparable rounds, and an entry
strategy with ticket size, valuation band and staged tranches.

Today I stopped adding features and instead pushed three real pitch decks through
the live product. The engine was wrong four ways — and every one of them was the
same class of failure: a number that looked plausible and meant something else.

• Churn was read without its period. "4% annual churn" — excellent — was scored
  as 4% per month, roughly 39% a year.
• A bare "20% monthly churn" matched the growth pattern and was counted as 20%
  month-over-month growth. The result: a deal with catastrophic churn outscored
  the identical deal with healthy annual churn.
• "CAC $3, LTV $2, monthly churn 14%" parsed LTV as $2 million, because the money
  unit "m" matched the first letter of "monthly". LTV/CAC came out at 666,666:1.
• Revenue projections were benchmarked against the sector's market CAGR. A seed
  plan growing at market rate was called credible — a company that grows at
  market rate never takes share. An ordinary $4.8M→$17M Series A plan was
  labelled a hockey stick.

All four are fixed, covered by 84 unit assertions and 73 live smoke assertions,
and shipped. The scoring rubric is versioned (v4) so scores stay comparable only
against scores produced by the same rules.

The part worth sitting with: 89 tests were green the entire time these bugs were
live. Tests written against my own assumptions could not find them. Three real
decks did, in twenty minutes.

If you screen deals — angel, micro-fund, scout, syndicate — the product is live
and the demo needs no signup:
https://aevion.vercel.app/qventure/a/demo-neurodx
Worked examples: https://aevion.vercel.app/qventure/gallery
Batch funnel for a folder of decks: https://aevion.vercel.app/qventure/batch

$39/month. Screening signal, not investment advice.

#venturecapital #duediligence #ai #startups #buildinpublic

---

## Show HN

**Title**
Show HN: QVenture – deterministic screening memos for startup deals (rubric v4)

**First comment**
I built QVenture because every "AI for VCs" tool I tried returned prose I could
not audit. This one separates the two jobs: numbers are deterministic, language
is the LLM's.

The score is 0–100 across 8 weighted factors (market, timing, moat, unit
economics, execution, science, legal, competition). No LLM produces a number.
Every factor declares whether it used the plan's own disclosed metrics or a
sector prior, and the report shows what share of the score is company-specific —
usually 40–75% for a deck with real figures, 0% for a plan with no numbers.

On top: deterministic red flags, a unit-economics stress test (CAC ×1.5/×2,
churn ×1.5/×2, margin −15pp), a bottom-up TAM triangulation (ACV → implied
accounts → SOM at 1%), a revenue-plan check against the venture growth bar for
the stage, and a percentile rank against every deal analysed on the platform so
far (67, so treat the percentile as directional). Comparable rounds come from
live web search with URLs and are explicitly labelled when they fall back to
model memory instead.

Today's release is a bug-fix release, and the bugs are instructive. Real decks
found four defects that 89 green tests missed:

- churn parsed without its period (4% annual scored as 4% monthly)
- "20% monthly churn" read as 20% MoM growth by the growth regex
- "LTV $2, monthly churn 14%" → LTV $2,000,000, because the unit "m" matched the
  "m" of "monthly"
- revenue plans benchmarked against the sector's market CAGR instead of the
  venture bar for the stage, so market-rate plans read as "credible" and ordinary
  venture plans read as hockey sticks

Demo report, no signup: https://aevion.vercel.app/qventure/a/demo-neurodx
Try it: https://aevion.vercel.app/qventure
Batch (many decks → ranked table + one PDF):
https://aevion.vercel.app/qventure/batch

Stack: TypeScript/Express + Postgres on Railway, Next.js on Vercel, Anthropic for
the council, Serper for live rounds. Paid tier is $39/mo; the demo, gallery and
shared reports are free and need no account. Not investment advice.

Happy to be told where the rubric is still wrong — that is the most useful reply
I can get.

---

## r/venturecapital

**Title**
I benchmarked startup revenue plans against sector CAGR for months. That was
backwards — writeup + free tool

**Body**
I maintain a screening tool that scores deals deterministically, and until today
it judged founders' revenue projections against the sector's market CAGR. That
seemed rigorous. It is actually backwards:

- a seed plan growing at the market's rate (say 16%/yr in fintech) never takes
  share, but my tool called it "grounded — credible"
- a perfectly ordinary $4.8M→$17M Series A plan (88%/yr) was 3.7× "the sector"
  and came back "HOCKEY STICK — treat the out-years as unproven"

The fix was to benchmark against the growth a fund actually underwrites at that
stage (the T2D3 path: ~180%/yr at seed decaying to ~60%/yr at scale) and keep the
market CAGR only as a floor — a plan growing slower than its own market is losing
share. New verdicts: below-market / conservative / venture-grade / aggressive /
hockey-stick.

Three other parsing bugs went with it, including churn being read without its
period (4% annual scored as 4% monthly) and "LTV $2, monthly churn 14%" being
parsed as LTV $2 million.

Tool is live, the demo report needs no signup:
https://aevion.vercel.app/qventure/a/demo-neurodx

Curious how others here bound "aggressive" vs "unfinanceable" on a plan — my
bands are 0.5–1.5× the stage bar = venture-grade, 1.5–2× = aggressive, >2× =
hockey stick. Happy to be argued out of them.

---

## r/SideProject

**Title**
My AI investment analyst was wrong 4 ways — found by real pitch decks, not by 89
green tests

**Body**
I ship a tool that scores startup deals (deterministic 0–100 rubric + a 4-role
LLM council + PDF memo). Today instead of adding a feature I generated three
realistic pitch decks and ran them through the live product end to end.

Four defects fell out, all of the "plausible number, wrong meaning" class:
churn parsed without its period; "20% monthly churn" counted as 20% MoM growth;
"LTV $2, monthly churn 14%" read as LTV $2 million (the unit "m" matched
"monthly"); and revenue plans benchmarked against market CAGR instead of the
stage's venture bar, so normal plans were labelled hockey sticks.

89 tests were green through all of it, because the tests shared my assumptions.
The decks did not.

Live: https://aevion.vercel.app/qventure ·
demo report, no signup: https://aevion.vercel.app/qventure/a/demo-neurodx

---

## Product Hunt — update text (kit lives in QVENTURE_PRODUCTHUNT.md)

**Rubric v4 — the boring release that matters**

Four scoring defects found by running real pitch decks through the live flow:
churn read without its period, "% monthly" mistaken for growth, a money unit
matching the next word's first letter, and revenue plans benchmarked against
market CAGR instead of the venture bar for the stage. All fixed, all covered by
tests, rubric version bumped so old scores are never silently compared with new
ones.

New since launch: batch deal funnel (a folder of decks → one ranked table + one
PDF), live comparable rounds with links, unit-economics stress test, bottom-up
TAM triangulation, cross-device watchlist.

---

## Investor DM / cold email (short)

Subject: a screening memo for {company}, in 30 seconds

{Name} — I built a screening tool that turns a plan or a deck into an auditable
memo: deterministic 0–100 score across 8 weighted factors, a stress test of the
unit economics, a bottom-up TAM triangulation, live comparable rounds with links,
and an entry strategy (ticket, valuation band, tranches).

Here is a full report with no signup: https://aevion.vercel.app/qventure/a/demo-neurodx

If it is useful, drop your current deck folder into the batch funnel and it will
rank them in one table: https://aevion.vercel.app/qventure/batch

Would value your view on where the rubric is wrong — that feedback is worth more
to me than a signup.
