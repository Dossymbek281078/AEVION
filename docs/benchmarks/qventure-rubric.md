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
> one **in the same sector and stage** by a mean of **16.5 points** (min 8.8,
> max 30.8), including business models with no SaaS metrics — defence contracts,
> clinical phases, offtake agreements, GMV × take rate, design wins.

That is a statement about *reading disclosure*, not about predicting outcomes.

## The claim we are **not** willing to make

QVenture does not predict success. The calibration corpus (32 companies)
separates known failures from known successes by **6.6 points of mean
composite**, and **8 of 15 failures still score at or above the weakest
success**. Those descriptions were reconstructed by an author who knew the
outcome, so even that 6.6 is generous to the rubric, not conservative.

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

   All six are fixed and pinned (`tests/qventureDisclosedCorpus.test.ts`, 311
   assertions). Reservations are deliberately parsed into their own field that
   backs **no** factor and raises a flag instead: a reservation book is the
   largest number a pre-revenue hardware plan has and the one its customers can
   cancel, so it is shown to the reader rather than credited.

5. **Measured on the disclosed-figures corpus (26 real companies, rubric v6):**
   parse coverage **73/73**, mean success **71.2** vs mean failure **60.3**, gap
   **10.9 points**. The split is **7 failed, 10 succeeded, 9 `open`** — Rivian,
   Deliveroo, Peloton, Beyond Meat, Affirm, Groupon, Lemonade, Rocket Lab and
   Sunrun (the disclosure-free control, Fast, is labelled `failed` and excluded
   from parse coverage by a different route: it states no figures at all).

   `open` is not a hedge: those companies are still trading, and forcing them
   into failed/succeeded to pad the separation statistic would be choosing the
   outcome that suits the number. They count toward parse coverage, which needs
   no outcome, and are excluded from the gap.

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

   **A burn multiple would not fix this, and the arithmetic says so** (limit 15
   below tests a second ratio and refutes that one too). Snowflake
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

7. **Closed: the "declined to X" family.** A level stated after a direction
   verb was dropped in seven fields out of eight — filings say which way a
   number moved constantly, and every metric pattern accepted `of / = / : / at`
   between the name and the figure while none accepted this.

   | Sentence | Field that was lost |
   |---|---|
   | `Churn fell to 3% monthly, down from 8%.` | churn |
   | `Churn improved from 8% to 3% monthly.` | churn |
   | `Net revenue retention declined to 85%.` | retention |
   | `Gross margin improved to 62%.` | gross margin |
   | `Take rate declined to 9%.` | take rate |
   | `Customers fell to 900 from 1,200.` | customers |
   | `LTV/CAC fell to 0.8.` | LTV/CAC |
   | `Payback lengthened to 26 months.` | payback |
   | `Revenue fell to $5M in 2024.` | revenue |

   Fixed with **one shared connector**, not nine patched patterns: nine
   near-identical regexes drift apart, and this family is what that drift looks
   like — the eight fields had been maintained separately until one of them
   grew a case the others never got. In `from X to Y` the current value is Y;
   reading X would report the number the company moved away from as fact.

   Guarded in the same commit, because a direction verb is ordinary prose: the
   connector stays anchored to the metric's own name, so `the team grew to 40
   people` and `headcount fell to 900` still read nothing, and every plain form
   is untouched. Neutering the connector reddens 18 tests.

8. **The second inversion, and the sharpest reminder of what this is not.**
   Affirm's S-1 states GMV up 77% and revenue up 93% in consecutive sentences.
   The parser took the first match, so **77% was reported as the company's
   revenue growth** — one metric's number under another metric's name. Like the
   decline, that is a wrong figure rather than a missing one.

   Every growth match is now classified by the nearest metric noun in front of
   it, a revenue-attached rate wins when several are disclosed, and the rate
   carries a `growthBasis` so the report prints "64.3% YoY GMV growth" when that
   is what Deliveroo disclosed, instead of quietly filing volume growth under
   revenue.

   And the corpus produced its own best warning label. **Groupon scores 74.5 and
   reaches `invest`** — the highest of any open case, above Datadog — on
   revenue of $1.5B growing more than tenfold and 115.7 million subscribers.
   Every one of those figures is true and was disclosed. **Adyen, a durable
   success, scores 66.6.** The engine reads disclosure; it does not know what
   happens next, and this pair is the cheapest way to see that.

9. **Non-American, non-software, not-yet-true.** An insurer, a Chinese
   marketplace and a European payments company added six more reader defects and
   one wrong number:

   - **A currency code written against the digits lost the currency.** The code
     patterns required a word boundary *after* themselves, which a digit does not
     provide, so `RMB52,504 million`, `USD8,463 million` and `EUR218 million` —
     ordinary filing style — dropped their marker. Only the symbol forms (`€218M`)
     ever worked, and those are what the fixtures had used.
   - **An insurer's top line is not called revenue** (`in-force premium`) and its
     customers are not called customers (`policyholders`).
   - **The larger side of a two-sided marketplace was swapped for the smaller.**
     Alibaba disclosed 279M active buyers and 8.5M active sellers; `buyers` was
     not a customer noun, so the parser skipped to `sellers` and reported **8.5M**
     as the customer count. A wrong number, not a missing one — the third of that
     class.
   - **A target was read as traction.** "We target $20M ARR next year" set
     revenue to $20M. The contradiction check already had a forward-looking
     test; the revenue parser never asked it. Now it does, bounded to the
     figure's own clause — a 60-character lookback crossed the sentence and
     suppressed the real disclosure in "…next year. Revenue of $5M today.",
     which trades one wrong reading for another.
   - **The contradiction check only knew one of the two shapes it guards.** It
     matched `$5M ARR` but never `ARR of $5M` — the form the parser itself has
     always supported — so a plan stating two different revenue figures in the
     ordinary phrasing raised nothing. Both readers now share one module-level
     noun list, because they had already drifted.

   **Settled since:** Lemonade's filing states in-force premium of $116M for 2019
   and $133M as of Q1 2020, and the engine scored 2019 — not as a judgement, but
   because it appeared first in the text and `firstMatch` stops there. The 14.7%
   gap also sits under the threshold that treats a difference as rounding, so
   nothing was flagged either.

   When a plan discloses the same metric for more than one period, **the later
   period is now what gets scored**, and the choice is written into the
   assumptions the reader sees rather than made silently.

   The revenue fix turned out to be one field of eight. `firstMatch` was used by
   every metric, so "churn of 8% in 2019, churn of 3% in 2020" scored 8%, and
   margin, retention, customers, GMV, take rate, payback and backlog all did the
   same. The direction was arbitrary — for churn and payback the stale figure was
   the harsher one, for the rest the kinder — which is the tell that it was never
   a judgement. All eight now share one `latestMatch`, identical to `firstMatch`
   unless two matches carry different years. Figures nothing dates
   keep the old ordering, so ordinary plans are unaffected, and a prior-year
   comparison ("up 97% from $100.8M in 2017") was never a candidate — it is
   context for the growth rate, not a competing disclosure. Disabling the rule
   reddens 4 tests.

10. **A band was read by seven fields and mishandled by six.** Same question as
   the stale period, asked of the other shared rule — and the two worst defects
   of the whole exercise came out of it.

   | Written as | Was read as | Now |
   |---|---|---|
   | `GMV of $100-150M` | **$100** — the multiplier stayed on 150 | $100M |
   | `Contracted backlog of $20-60M` | **$20** | $20M |
   | `Growing 20-40% year over year` | 40 — the flattering end | 20 |
   | `12,000-15,000 customers` | 15,000 — the flattering end | 12,000 |
   | `Net revenue retention of 110-130%` | nothing | 110 |
   | `Take rate of 9-14%` | nothing | 9 |

   The first two are magnitude errors of six orders on a marketplace's headline
   number, and they were silent: the report showed "$100" and scored it. The
   next two broke the repository's own stated rule — a band resolves to the end
   that is *worse* for the plan — while the seven fields that already had band
   readers followed it. Nothing about that split was a decision; it is where
   band handling had been written and where it had not.

   Currency conversion was checked the same way and came back clean: all seven
   money fields convert. That one is a verified negative, not an assumption.

11. **Periods and units, asked the same way.** The churn-period machinery — the
   thing that stops "4% churn" being scored as 4% a month when the plan meant a
   year — covered the period word BEFORE the figure and the "per year" form
   after it, and missed the bare adverb, which is the most natural phrasing
   there is. `Churn of 24% annually` was read as **24% a month** and charged as
   a company bleeding out; the correct reading is 2.26%. The cause was small and
   exact: the connector accepted a bare `a` ("a year"), which ate the first
   letter of "annually".

   `Payback of 2 years` disclosed nothing — only the word "months" was accepted.
   The unit is now captured and converted rather than assumed, because assuming
   months would have turned two years into an excellent two-month payback.

   Negation was checked at the same time and came back clean: a denial is never
   adopted as a figure, including "we do not disclose gross margin; the industry
   average is 70%". Recorded as a verified negative.

12. **Two more, from the same question.** Normalisation and the contradiction
   check were the fourth and fifth shared rules put through it.

   - **The top line stated monthly was annualized only when abbreviated.** "MRR
     of $500k" became $6M; "monthly recurring revenue of $500k" and "revenue of
     $500k per month" stayed $500k and were scored as ANNUAL revenue — the same
     figure understated twelvefold, on the phrasing an early-stage plan is most
     likely to use.
   - **`detectRevenueConflict` guarded exactly one field.** A plan stating
     "gross margin of 70%" and "gross margin of 40%", or two different churn
     rates or customer counts, scored one of them and said nothing at all.
     Revenue was never special; it was the field someone got to. The check now
     covers margin, churn and the customer count, and deliberately does NOT fire
     on figures the plan dates to different periods — the latest-period rule
     resolves those, and flagging them would turn every ordinary year-on-year
     disclosure into a warning.

13. **The exact input path was held to a lower standard than the prose.** Two
   more, from the seventh and eighth applications of the same question.

   - The text path rejects impossible figures — churn above 100%, retention
     above 500%, a payback longer than twenty years. The structured path did
     not, so **250% monthly churn and 900% retention supplied as "exact" numbers
     were scored as facts.** The precise input is meant to be more trustworthy
     than a regex, not less.
   - **A decline could be written in prose and not stated exactly.** The parser
     reads "revenue declined 20%"; `growthPct: -20` was dropped by a
     non-negative guard — the same asymmetry that made a below-cost margin
     unstateable in exact form, one field over.

   The stress test was checked in the same pass and came back clean: a plan
   whose LTV/CAC is already below 1 reads `underwater` in every scenario, and a
   healthy one reads healthy in all of them. Verified negative.

   That is eight shared rules examined this way: **five defects found, three
   verified negatives** (currency conversion, negation, stress test). The
   question is cheap and keeps paying, which is itself the finding — rules get
   written where they were needed and nobody goes back to the other fields.

14. **The yield finally dropped.** Nubank — a bank, a customer base an order of
   magnitude larger than any other case, a nine-month reporting period — parsed
   3 of 3 stated figures on the first run and produced **no new defect**. It is
   the first company added to this corpus that did not.

   That is worth recording rather than celebrating. Twenty-one companies each
   found something; the twenty-second did not, which is weak evidence that the
   readers are catching up with the shapes real filings use. It is not evidence
   that they are finished — the shapes still missing from the corpus are the
   ones most likely to break them: a clinical pipeline with phases and
   endpoints, a bank's net interest margin, a filing in yen. Those were
   attempted this session and left out because the figures could not be sourced
   to a document, which is the right reason to leave a case out.

15. **Two hypotheses about the WeWork / Blue Apron inversion, both tested and
   both wrong.** The two failures that outscore the weakest success do so on
   real, disclosed revenue. Two ways of charging for the cost of that revenue
   were proposed here and are now withdrawn, because the arithmetic refutes
   them:

   | Measure | Blue Apron (failed) | Snowflake (succeeded) |
   |---|---|---|
   | Burn multiple (loss ÷ revenue) | 0.07 | **1.32** |
   | Loss per dollar of net-new revenue | 0.12 | **2.07** |

   Blue Apron lost $54.9M on $795.4M of revenue that had grown from $340.8M;
   Snowflake lost $348.5M on $264.7M grown from $96.7M. On either ratio the
   FAILURE looks an order of magnitude healthier than the SUCCESS, so a rule
   built on either would have ranked them exactly backwards.

   What actually killed Blue Apron — marketing at 18% of revenue buying
   customers who churned — is a CAC-and-retention story, and the engine has
   machinery for both. It could not use it, because Blue Apron **did not
   disclose churn or CAC at that round**. That is not a gap in the rubric; it is
   the limit the second section of this document already states, now with
   arithmetic behind it: on disclosure alone these two companies are not
   separable, and no ratio of the figures they did disclose separates them.

   Recorded so the idea is not implemented later by someone who has not run
   the numbers.

16. **Open, with the source already in hand: `decreased 13% to $99.6M`.**
   Moderna's S-1 was pulled from EDGAR directly — SEC refuses anonymous fetches
   but serves the filing to a request that declares who is asking, which is how
   the "unsourceable" shapes should have been chased in the first place.

   It states total revenue of $205.8M in 2017, up 90% from $108.4M, and revenue
   *decreased by $14.3 million, or 13%, to $99.6 million* for the nine months
   ended 30 September 2018 — a science company whose most recent period is a
   decline against a prior year of 90% growth. Both readers added today meet in
   one filing.

   The engine read the decline but scored the 2017 revenue, because the
   connector between a direction verb and its figure allowed only a short fixed
   span and this phrasing puts an amount in between. **Fixed, on the second
   attempt.** The first tried a length-bounded span and was reverted the same
   session: it let "gross margin declined to 20% *and churn rose to 7%*" read
   the churn figure as the margin. The span is now constrained by **shape** —
   only amount-like tokens and the words that introduce them — so a conjunction
   or another metric's name ends it by construction rather than by a length
   guess. Both the lazy quantifier and a lookbehind were needed to stop the span
   splitting `13%` into `1` and `3%`.

   Moderna is now in the corpus (66 figures, all recovered). The caveat noted
   when this landed — that a decline won regardless of which period it described
   — is closed: when both a rise and a fall are stated **and both are dated**,
   the later date decides, so "fell 30% in 2023, grew 40% in 2024" reports the
   growth while Moderna still reports its decline. Undated pairs keep the old
   rule. It was the one field left inconsistent after every other reader learned
   to prefer the later disclosure, and "the rule covers all fields except this
   one" is the shape of every defect found today.

17. **Closed: installed capacity is now a signal.** Sunrun's 2015 S-1 states "we
   have deployed an aggregate of 430 megawatts as of March 31, 2015" beside
   roughly 79,000 customers. The customer count parsed; the megawatts did not,
   because there was no field for physical capacity — and for a solar, storage
   or grid company that number is the business, since it is what the contracted
   revenue is earned on.

   **This took two attempts, and the first one is the reason it is worth
   writing down.** A naive unit list reads "16 GWh of installed capacity" as
   16,000 MW. GWh is energy, GW is power, and Northvolt's own fixture in this
   corpus states its factory in GWh — so the obvious pattern would have
   introduced a thousand-fold silent error while closing a miss. Energy units
   are now rejected outright rather than converted, because converting them
   needs a duration the plan rarely states.

   The reader also refuses a plan to build: "we plan to have 430 megawatts
   deployed by 2027" is not an installed base. That check is the same
   `statedAsAchieved` helper the regulatory milestones use — written once,
   because the same distinction decides a clearance and a megawatt, and writing
   it twice is how the two drift apart.

   Like `reservations`, capacity backs **no factor** and is rendered on both
   surfaces instead. Whether delivered infrastructure should move a score the
   way revenue does is a rubric decision that needs calibration, not a regex.

18. **Closed: the milestone reader recorded intentions as achievements.** The
   comment above the regulatory list had always promised that "FDA approval
   expected in 2027 is a plan, not a milestone; the negation layer plus the
   explicit past-tense wording keep those out". It was not true — that exact
   string recorded a clearance held. The negation layer catches "no FDA
   approval" and knows nothing about a future tense placed after the phrase, and
   **every entry in the list inherited the hole**: an applicant who had obtained
   nothing could be credited with a clearance, a PPA, a defence contracting
   status or a banking licence.

   Four of fifteen probe sentences were counted wrongly. The rule now runs
   inside the milestone's own clause — an explicit achievement word wins
   outright, otherwise an intention marker in that clause disqualifies it — and
   clause-bounding is what lets "FDA clearance granted; we expect launch in
   2027" keep its clearance, because the intention is in the next clause and is
   about something else.

   Two entries written earlier and **deliberately held back** are released with
   it: emergency use authorization, and ISO 27001 / SOC 2 / HITRUST / FedRAMP —
   what a security or infrastructure company leads with. They were withheld
   because they leaked the same way, and adding two more leaks to an open hole
   makes a report more confidently wrong rather than more complete.

   Disabling the filter reddens 7 tests. Nothing else moved: corpus 71/71, hard
   cases 30/30, calibration identical to the decimal.

19. **The last non-SaaS milestone met a real filing, and broke both ways.**
   AeroVironment's 10-K was fetched to test the one entry in the regulatory list
   that had never seen a real document: defence contracting status. It failed in
   both directions inside the same filing.

   - The sentence *explaining what an IDIQ contract is* — "we do not include
     unfunded ceiling amounts for sole-source or multi-awardee IDIQ contracts in
     unfunded backlog" — was credited as a defence contracting status, because a
     bare `IDIQ` matched any mention of the words. A definition read as an award,
     and the negation layer could not help: the sentence negates *including
     amounts*, not the contract.
   - The natural passive **"we were awarded a defense contract"** did not match
     at all, because the pattern was fixed to the word order "defense contract
     awarded".

   Both fixed: the token now needs an award verb beside it, and the passive is
   accepted. The ITAR risk-factor language in the same filing — "contractors are
   subject to extensive legal and regulatory requirements, including ITAR" —
   correctly stays out, because that half of the pattern already required
   "registered".

   Worth stating what this cost and returned: one filing, fetched and read, to
   test one list entry. Every entry in that list had been written against
   sentences this repository invented for itself, and the first real document
   broke the one it met.

20. **A milestone's words also describe a business.** Two more entries taken to
   real filings, and both bent the same way: the vocabulary that announces an
   achievement is the vocabulary that explains a product.

   Sunrun's S-1 says "homeowners who buy energy from us under leases or **power
   purchase agreements** are covered by production guaranties". No agreement is
   announced there — that sentence is the product description. It escaped the
   milestone list only because the plural `agreements` broke a word boundary:
   luck, not a rule, and the singular form of the same descriptive sentence
   would have been credited. The entry now requires the agreement to be stated
   as concluded, which is the thing that makes it a milestone rather than a
   noun.

   Nubank's F-1 supplied the licence half. "**We may apply for** a banking
   licence in the future" was read as a licence held, because the intention list
   knew "applying for" and "applied for" but not the modal. It also states "none
   of our subsidiaries is licensed to operate as a bank", which the negation
   layer already handled correctly.

   **Both lists have now met real documents in full** — regulatory milestones
   and technical validation, every entry. Ten of fourteen were wrong on the
   first real sentence they met, and the failures share one shape:

   > **The entries that failed recognised a NOUN. The entries that held
   > recognised an EVENT, through a verb.**

   A noun matches every context the word appears in, and a filing uses the same
   word four ways: to announce an achievement, to define a procedure, to list a
   risk, and to name a financial term. Hence a *definition* of an IDIQ contract
   read as an award, `benchmark interest rates` read as a technical benchmark,
   a `state of the art 97,000 square foot facility` — a building — read as a
   benchmark result, and the sentence explaining that clinical trials are
   "conducted in three sequential phases, known as Phase 1, Phase 2 and Phase 3"
   read as three clinical milestones reached.

   The two that held from the start — `510(k) cleared` and `breakthrough
   designation granted` — were the two written around what happened rather than
   what it is called. Every other entry has now been rebuilt that way.

   Three filters, applied in order and shared by both lists: the negation layer
   (`no FDA approval`, `never been a Phase 3 trial`), the intention filter
   (`we plan to pursue`, `may apply for`, `expect ... next year`), and the verb
   requirement. The first two were not enough on their own — a definition
   states no intention and a contract clause denies nothing.

## How this stays true

The harnesses used to be hand-run, which is how the rubric decayed the first
time: v1 could not reach a "pass" verdict on any input and nobody noticed for
months. The invariants now run on every push
(`aevion-globus-backend/tests/qventureHardCases.test.ts`, 28 assertions, and
`tests/qventureDisclosedCorpus.test.ts`, 311):

| Guard | Floor | Measured today |
|---|---|---|
| Each strong/weak pair separates | ≥ 6 pts | 8.8 – 30.8 |
| Mean gap across the six models | ≥ 10 pts | 16.5 |
| Known successes vs known failures | ≥ 4 pts | 6.6 |
| Capital-intensive arm (≥4 cases per side) | ≥ 3 pts | 6.6 |
| `pass` and `watch` both reachable on real cases | — | both present |
| Every figure real filings state is recovered | 73/73 | 73/73 |
| Separation on disclosed figures | ≥ 6 pts | 10.9 |
| A large ask with no disclosure cannot reach `watch` | — | Fast, 43.9, `pass` |

The visibility gate derives its own field list from what the parser actually
filled, rather than a hand-maintained list — a list someone has to remember to
update would have missed `reservations` in exactly the way the renderers did.
Adding a numeric field to the parser and to nothing else reddens it by name.

One of those guards is not a floor but an equality: parse coverage must stay at
73/73. A silent reader failure is the defect class this corpus exists to catch,
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
