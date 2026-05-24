# AEVION Constitution — ProductHunt Launch Kit

> Status: READY. Review checklist below before clicking "Post Today".
>
> Do NOT launch on Mondays or Fridays. Best day: Tuesday or Wednesday, 00:01 PT (Pacific Time).

---

## 1. Product name & tagline

**Name:** AEVION Constitution

**Tagline (140 chars max):**
> World-system simulator: 8 sliders → 10 regimes. See where your society slides on rule-of-law, floor below, rotation, and positive sum.

**Alternative taglines (A/B test):**
- "Design any society in 2 minutes. 8 sliders × 10 regimes, from Open Access to Feudalism."
- "Political economy simulator backed by North, Acemoglu & Ostrom. 8 sliders, QSign-signed scenarios."

---

## 2. Product description (first 260 chars shown without "read more")

```
Constitution is an interactive political-economy simulator. 8 sliders calibrated on
North/Wallis/Weingast's Violence and Social Orders + Acemoglu/Robinson + Ostrom + Taleb.
Drag the sliders, watch what historical regime your society slides into.
```

**Full description (paste in ProductHunt long description):**

> **What is it?**
> Constitution is an open-source political-economy simulator. Eight governance sliders — floor below, rule of law, rotation/sortition, elite transparency, multiple status axes, skin in the game, polycentricity, positive sum — map to 10 classified regimes: from Open Access Order to Totalitarian Dictatorship to Late Feudalism.
>
> **Why it's different:**
> - Based on real political science: North/Wallis/Weingast's three social orders, Acemoglu/Robinson's inclusive institutions, Elinor Ostrom's polycentricity, Nassim Taleb's skin in the game.
> - You can *save* your scenario as a QSign-signed artifact on the AEVION Planet — making a hypothetical constitution verifiably yours.
> - AI advisor (via QCoreAI) suggests 8-slider values from a free-text description of your country.
> - Public REST API (1h cached) — bots, research tools, AI agents pull the regime taxonomy in one call.
> - Open-source, 11 languages, no signup required, free tier forever.
>
> **Key features:**
> - 8 sliders × 10 historical regimes × 15-country world scatter
> - 4 stress-test shocks (war, pandemic, financial crisis, tech leap)
> - Side-by-side compare of two saved scenarios
> - Guided tour "From Feudalism to Open Access in 8 centuries"
> - Spider/radar chart fingerprint
> - Real-time collab (WebSocket) when opening a shared artifact URL
> - 8-lesson Academy course (RU/EN, certificate via PDF)
> - Blog with 3 deep-dives (Magna Carta, Norway rule-of-law, positive sum)
> - Status monitoring at /constitution/status

---

## 3. Thumbnail prompt (1270×760)

**Midjourney / DALL-E prompt:**

```
A glowing 8-axis radar chart (octagon silhouette, cyan fill, 
dark navy background, gold axis lines), floating in space with 
small constellation-like nodes at each axis tip labeled with 
white text: "Floor", "Law", "Rotation", "Transparency", 
"Multi-status", "Skin", "Polycentricity", "Positive sum". 
Below the radar: gold text "AEVION Constitution". 
Style: minimal dark-mode data-viz infographic, no people.
1270x760, 16:9
```

**Gallery images (4 screenshots):**
1. `/constitution` editor — sliders panel + regime card "Open Access"
2. `/constitution/stats` — analytics bar chart + histogram
3. `/constitution/learn` — Academy cards grid
4. `/constitution/showcase` — showcase hero with animated radar

---

## 4. Launch day timeline (all times in PT)

| Time | Action |
|---|---|
| **00:01** | Submit product — click "Post Today" on PH |
| **00:05** | Drop maker comment (see template below) |
| **00:15** | Share on Twitter/X: "We shipped Constitution..." (see template) |
| **00:20** | Share in Telegram: dev/startup groups |
| **01:00** | Reply to all early comments personally |
| **07:00** | Second wave — LinkedIn post |
| **10:00** | Share in Indie Hackers (new product post) |
| **12:00** | Mid-day check: if < 50 upvotes, activate backup plan B |
| **18:00** | Ask 5 close colleagues to upvote + comment their "regime" |
| **23:30** | Final reply thread, thank-you comment |

---

## 5. Maker comment template

```
Hey PH! 👋

I've been obsessed with political economy for years — Acemoglu/Robinson, 
North/Wallis/Weingast, Elinor Ostrom. One day I asked: what if you could 
PLAY with these ideas instead of reading 600-page books?

Constitution is that simulator. Eight sliders, calibrated on real political 
science, that classify your society into 10 historical regimes in real time.

The most interesting thing I discovered: Norway scores 90 on rule-of-law not 
because they have "more laws" — but because the same law applies to a minister 
and a fisherman equally. That's a cultural achievement, not a legislative one.

Try it: what regime does your country sit at? Slide ruleOfLaw down to 30 and 
watch it turn into "Late Feudalism" in seconds 🫢

Would love to hear what regime YOUR society falls into!
— [your name]
```

---

## 6. Twitter/X launch thread template

```
Tweet 1:
We launched AEVION Constitution on @ProductHunt today 🗳️

8 sliders × 10 historical regimes. See where your society slides.
Based on North/Wallis/Weingast + Acemoglu/Robinson + Ostrom + Taleb.

→ aevion.app/constitution/showcase

[screenshot: radar chart animated GIF]

Tweet 2:
The big insight: elites stop fearing the bottom NOT when the bottom is 
disarmed — but when the bottom has something to lose.

"Floor below" slider: 0 → everyone for themselves. 100 → nobody falls below.

Watch how the regime card changes when you pull it to 80+ ⬆️

Tweet 3:
Norway calibrated sliders (from the app):
floor: 90  ruleOfLaw: 90  rotation: 50  transparency: 90
multiStatus: 60  skinInGame: 55  polycentricity: 30  positiveSum: 70

That's a near-perfect octagon. The Industrial Revolution gave us positiveSum. 
The social contract gave us floor. Both together → Open Access Order.

Tweet 4:
For developers: there's a public REST API, 1h cached.

curl https://aevion.app/api-backend/api/constitution/public/regimes

10 stable IDs, never renamed within v1. Your AI agents can pull the 
taxonomy in one call.

Docs: [link to /constitution/api]
```

---

## 7. 10 hunters to contact (dev-tools / EdTech / OSS)

Approach: DM 48h before launch asking if they'd "hunt" you, provide tagline + GIF.

| Hunter | Niche | Why |
|---|---|---|
| @rlancioni | Dev tools / OSS | Active hunter, dev-friendly |
| @benln | AI/ML products | QCoreAI angle |
| @_jacksmith | EdTech | Academy course angle |
| @niftyux | UI/UX tools | Spider chart / visualization angle |
| @tdinh_me | Indie hackers | Has hunted 500+ tools |
| @PatrickJTaylor | Dev tools | API-first products |
| @nicholasgasior | Open-source | All features are open-source |
| @erictwillis | Startups | Political economy is broadly interesting |
| @chrismessina | Broad reach | Veteran PH hunter |
| @rauchg | Engineering | Next.js stack might resonate |

---

## 8. 5 communities to post in (launch day)

| Community | Post type |
|---|---|
| Hacker News: Ask HN | "Show HN: Constitution – 8-slider political economy simulator" |
| r/PoliticalScience | "Made a simulator based on Acemoglu/Robinson — would love feedback" |
| r/dataisbeautiful | Radar chart GIF animated across presets |
| IndieHackers | Full product post with metrics |
| Telegram: @machinelearning | "Tool for political economy researchers, has open API" |

---

## 9. Backup plans

**If < 50 upvotes by noon:**
A. Activate personal network: ask 10 friends to upvote + comment their "constitution"
B. Post a "reverse headline" on Twitter: "My political economy simulator ranked #7 on PH today — but the real win is the user who made a 1971-Saudi-Arabia scenario and told me it was more accurate than they expected"
C. Do a Twitter Space "Live building a new regime classifier" — show code + simulator simultaneously
D. Reddit-first strategy: re-post on r/PoliticalScience with more academic framing

**If < 10 upvotes by 6am:**
E. Do NOT add "PH of the day" badge (it won't be accurate)
F. Pivot to soft launch: post on LinkedIn for educators/think-tanks with different positioning
G. Schedule proper PH re-launch for next Tuesday with hunting partner locked in advance

---

## 10. Post-launch (Day 2-7)

| Day | Action |
|---|---|
| Day 2 | Write "What I learned from PH" post on /constitution/blog |
| Day 3 | Email waitlist first batch: "Constitution is live on PH, here's 30% off Pro" |
| Day 4 | DM everyone who commented on PH |
| Day 5 | Post on IH "Revenue Day 0: 0 paying users, what we're trying next" |
| Day 7 | Activate affiliate program if engagement is strong |

---

## 11. Success metrics (North Star)

| Metric | Threshold | "Ship it" |
|---|---|---|
| Day-1 upvotes | ≥ 100 | PH confirmation Constitution resonates |
| Day-7 WAU | ≥ 500 | Product has organic retention loop |
| Day-30 Pro conversions | ≥ 10 | Basic monetization signal |
| Waitlist signups (post-launch) | ≥ 100 | Email channel validated |

---

## 12. Links checklist (verify before launch)

- [ ] `https://aevion.app/constitution` loads within 3s
- [ ] `https://aevion.app/constitution/showcase` renders hero radar animation
- [ ] `https://aevion.app/constitution/pricing` shows 3 tiers
- [ ] `https://aevion.app/constitution/learn` shows 8 lesson cards
- [ ] `https://aevion.app/constitution/status` shows ≥5 green services
- [ ] OG preview for `/constitution` shows radar chart (check with [opengraph.xyz](https://www.opengraph.xyz))
- [ ] API `GET /api/constitution/public/regimes` returns 200 with 10 items
- [ ] `node aevion-globus-backend/scripts/constitution-prod-smoke.js` exits 0

---

*Last updated: 2026-05-24. Author: AEVION team.*
