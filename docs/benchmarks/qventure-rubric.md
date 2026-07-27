# QVenture rubric — what has actually been measured

Follows `PLAYBOOK.md`. Numbers here come from three checked-in harnesses that
anyone can re-run; nothing in this file is typed in from memory.

| Harness | Command | What it can prove |
|---|---|---|
| Calibration | `npx tsx scripts/qventure-calibration.ts` | Discrimination and range on companies with known public outcomes |
| Hard cases | `npx tsx scripts/qventure-hardcases.ts` | Whether a non-SaaS business model's own evidence is read and scored |
| Disclosed figures | `npx tsx scripts/qventure-disclosed.ts` | Whether real filing prose is read at all — every figure sourced to an S-1/F-1, 10-Q or the round's reporting |

Persisted results: `qventure-rubric-latest.json` (`historical` is the curated
baseline; `latest` is whatever a re-run produced).

## The claim we are willing to make

> On plans that disclose evidence, QVenture separates a strong deal from a weak
> one **in the same sector and stage** by a mean of **16.2 points** (min 8.8,
> max 30.8), including business models with no SaaS metrics — defence contracts,
> clinical phases, offtake agreements, GMV × take rate, design wins.

That is a statement about *reading disclosure*, not about predicting outcomes.

## The claim we are **not** willing to make

QVenture does not predict success. The calibration corpus (32 companies)
separates known failures from known successes by **6.6 points of mean
composite**, and **8 of 15 failures still score at or above the weakest
success**. Those descriptions were reconstructed by an author who knew the
outcome, so even that 6.7 is generous to the rubric, not conservative.

## Known limits, stated plainly

1. **On evidence-free plans the scale compresses.** Real range used across the
   calibration corpus is 49.6–68.0 of a nominal 0–100. A plan that discloses
   nothing cannot move the score, which is correct behaviour — but the 0–100
   presentation implies more resolution than the input supports.
2. **`invest` is unreachable without disclosure.** No calibration case reaches
   it. With disclosed metrics it is reachable (marketplace strong case, 72.6),
   so the band is live, not decorative.
3. **Capital-intensive discrimination is now measured, and it is ordinary.**
   The arm was extended to 8 failures and 6 successes (SpaceX, Moderna, First
   Solar, Enphase, Illumina; Northvolt, Solyndra, Nikola) and separates by
   **6.6 points** — marginally better than the software-like arm's 5.6, and on
   the same order. Worth stating plainly: that is *discrimination*, not skill.

   Northvolt is the case to look at. It held the largest contracted backlog in
   the corpus ($55B of offtake) and failed. Under v5 it scored **60.5**, above
   the mean success — the engine credited the order book and ignored the two
   negatives the same disclosure stated: yields below plan, and a capital
   requirement an order of magnitude past the round. Both are now charged, and
   it scores **55.7** with two flags. A screening tool that reads only the good
   half of a disclosure is worse than no tool.
4. **v5 changed nothing on the calibration corpus** — identical to the decimal.
   That is the expected result (the fixtures state no figures), and it is worth
   keeping visible: a rubric change that cannot be seen on your existing corpus
   has not been validated by that corpus.

   This is what the disclosed-figures corpus was built to answer, and the answer
   was bad: on the first run the engine failed to read **6 of 31** figures that
   real companies had stated in real filings. Each miss was silent — the factor
   fell back to the sector prior, so a filed disclosure scored identically to no
   disclosure at all:

   | Not read | Written as | Consequence |
   |---|---|---|
   | Negative gross margin | `-45%`, `(45)%`, `negative 45%` | Solyndra, selling at $3.42/W against a $6.29/W cost, was scored on the 40% climate-sector prior |
   | Net dollar expansion | `net dollar expansion rate 140%` | Zoom's expansion disclosure dropped; only the literal phrase "net revenue retention" parsed |
   | Retention with "rate" | `retention rate of 158%` | The standard S-1 phrasing missed the reader entirely |
   | Non-SaaS customer nouns | `527,000 memberships` | WeWork read as disclosing no customer count |
   | Reservations / pre-orders | `14,000 reservations` | Nikola's 10-Q parsed to **zero** fields — coverage 0% |
   | Units delivered | `937 Roadsters sold to customers` | Tesla's shipped product read as no traction |

   All six are fixed and pinned (`tests/qventureDisclosedCorpus.test.ts`, 81
   assertions). Reservations are deliberately parsed into their own field that
   backs **no** factor and raises a flag instead: a reservation book is the
   largest number a pre-revenue hardware plan has and the one its customers can
   cancel, so it is shown to the reader rather than credited.

5. **Measured on the disclosed-figures corpus (16 real companies, rubric v6):**
   parse coverage **43/43**, mean success **71.9** vs mean failure **60.3**, gap
   **11.6 points**. Five of the sixteen are labelled `open` — Rivian, Peloton,
   Beyond Meat, Deliveroo and, by a different route, the disclosure-free control. `open` is
   not a hedge: those companies are still trading, and forcing them into
   failed/succeeded to pad the separation statistic would be choosing the outcome
   that suits the number. They count toward parse coverage, which needs no
   outcome, and are excluded from the gap.

   Extending the corpus from 11 companies to 16 surfaced **four more silent
   reader failures**, which is the argument for extending it again: `net
   revenues` (the plural matched "revenue" and then died on the trailing `s`, so
   the single most standard phrasing in the corpus dropped its figure), a
   qualified customer noun (`511,202 Connected Fitness Subscribers`), a margin
   stated as a share of revenue (`gross profit of $17.6 million, or 20% of net
   revenue`), and `gross transaction value` — what a marketplace outside a US
   filing calls GMV.

   The last one is worth its own line. v5 claims money is read in the currency it
   was quoted in and converted at a checked-in rate, and that claim had never met
   a real filing quoting pounds. Deliveroo's prospectus is the first, and it
   failed at the second step: the engine detected GBP correctly and then did not
   recognise the noun the number was attached to, so there was nothing to
   convert. Five new companies, four new defects — the yield is not falling.

6. **Two failures still outscore the weakest success** — WeWork 69.6 and Blue
   Apron 66.6 against Tesla's 65.2 — and the honest reason is that both disclosed
   large, real revenue and the engine reads it. What it does not read is the cost
   of that revenue: WeWork's $729.7M quarterly operating loss and $24.6B of
   liabilities, Blue Apron's $144.1M of marketing against $795.4M of revenue.

   **A burn multiple would not fix this, and the arithmetic says so.** Snowflake
   disclosed a $348.5M net loss on $264.7M of revenue in the same fiscal year —
   a burn multiple of 1.32. WeWork's FY2018 loss against FY2018 revenue is under
   1.0. Charging burn would rank the success worse than the failure. On top of
   that, WeWork's S-1 states the loss quarterly and the revenue half-yearly, and
   published FY2018 loss figures differ by ~$300M depending on which line is
   taken, so "the loss" is not even one number.

   What actually separates them is loss *per unit of growth bought*, and whether
   the growth is contracted or rented — Blue Apron's marketing was 18% of revenue
   for customers who churned. That is a real design problem, not a regex, and it
   is recorded here unsolved rather than closed with a rule that would do damage.

## How this stays true

The harnesses used to be hand-run, which is how the rubric decayed the first
time: v1 could not reach a "pass" verdict on any input and nobody noticed for
months. The invariants now run on every push
(`aevion-globus-backend/tests/qventureHardCases.test.ts`, 28 assertions, and
`tests/qventureDisclosedCorpus.test.ts`, 81):

| Guard | Floor | Measured today |
|---|---|---|
| Each strong/weak pair separates | ≥ 6 pts | 8.8 – 30.8 |
| Mean gap across the six models | ≥ 10 pts | 16.2 |
| Known successes vs known failures | ≥ 4 pts | 6.6 |
| Capital-intensive arm (≥4 cases per side) | ≥ 3 pts | 6.6 |
| `pass` and `watch` both reachable on real cases | — | both present |
| Every figure real filings state is recovered | 43/43 | 43/43 |
| Separation on disclosed figures | ≥ 6 pts | 11.6 |
| A large ask with no disclosure cannot reach `watch` | — | Fast, 43.9, `pass` |

One of those guards is not a floor but an equality: parse coverage must stay at
43/43. A silent reader failure is the defect class this corpus exists to catch,
and "most figures parsed" is the state it was already in.

They are floors, not targets — set well under the measured values so ordinary
tuning does not trip them. They exist to catch a change that *collapses*
discrimination, not one that moves it.

The live deployment is checked separately by `scripts/qventure-smoke.js`
(sections 14–15): churn periods, the stage-bar projection check, non-SaaS
evidence, currency conversion and the self-contradiction flag all asserted
against prod, so a merge is verified rather than assumed.

## Rubric version history

| Version | What moved |
|---|---|
| v3 | Adverse disclosures penalised; weights moved to company evidence |
| v4 | Churn read in its stated period; `<n>% monthly` no longer counted as growth; projections judged against the stage's venture bar |
| v6 | Readers fixed against real filing prose (see limit 4): negative gross margins read at their sign, `net dollar expansion` / `retention rate of` read as retention, memberships and other non-SaaS customer nouns counted, units delivered counted as deployments, reservations parsed into a field that backs no factor and raises a flag. No weight or formula changed — only what the engine can see, and composites moved anyway (Solyndra 68.5 → 63.6). |
| v5 | Non-SaaS evidence read and scored: GMV × take rate, contracted backlog, non-dilutive awards, pilots/design wins, regulatory milestones held, technical validation. Science and legal can be company evidence instead of always sector constants. Money is read in the currency it was quoted in and converted to USD at a checked-in, dated rate (EUR/GBP/KZT figures were previously scored as if the number were dollars). |
