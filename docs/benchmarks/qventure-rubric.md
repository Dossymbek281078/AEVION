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

   All six are fixed and pinned (`tests/qventureDisclosedCorpus.test.ts`, 708
   assertions). Reservations are deliberately parsed into their own field that
   backs **no** factor and raises a flag instead: a reservation book is the
   largest number a pre-revenue hardware plan has and the one its customers can
   cancel, so it is shown to the reader rather than credited.

5. **Measured on the disclosed-figures corpus (30 entries, 29 real companies,
   rubric v6):** parse coverage **95/95**, mean success **71.2** vs mean failure
   **60.3**, gap **10.9 points**. The split is **7 failed, 10 succeeded, 13
   `open`**. Infosys appears twice on purpose — once as the dollar release and
   once as the rupee release of the same quarter — because the pair is the only
   way to check that both readings of one set of accounts agree. Open cases are
   Rivian,
   Deliveroo, Peloton, Beyond Meat, Affirm, Groupon, Lemonade, Rocket Lab and
   Sunrun, Infosys (twice) and Kaspi.kz (the disclosure-free control, Fast, is labelled `failed` and excluded
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

21. **Closed: a competitor's numbers were read as the applicant's.** The
   intention work went into the deck path, and the same question asked of the
   main parser found three defects in the reader itself:

   | Sentence | Credited to the applicant |
   |---|---|
   | `Our competitor reached $10M ARR last year.` | $10M revenue |
   | `The market leader has 500,000 customers.` | 500,000 customers |
   | `Incumbents charge a 25% take rate.` | a 25% take rate |

   Two neighbouring sentences — "industry gross margins are typically 70%" and
   "typical churn in this category is 5% monthly" — are *not* credited, but only
   because the intervening words happen to break the pattern. Luck, the same
   luck the PPA and peer-review entries were living on, and it will not hold for
   the next phrasing.

   This matters more than anything else on this list. A comparison is the most
   common sentence in a pitch deck and it names the **largest numbers in the
   document**: the incumbent's revenue, the leader's user base, the category's
   margins. Reading those as the applicant's own is a wrong figure of the worst
   available kind.

   A third-party subject standing in the figure's own clause before it now
   disqualifies the figure — competitor, incumbent, market leader, peers,
   industry, typically, on average — inside the same shared gate every reader
   consults. Revenue keeps its own forward-looking filter and asks this one too.

   The first attempt at this was written and reverted an hour earlier: it did
   not fire and diagnosing why was heading past the end of a session with a
   green tree to protect. The second put the check directly in the gate instead
   of behind an exported helper, and verified it through the parser's behaviour
   rather than the helper's.

   **The cost, measured rather than argued:** it also declines "unlike our
   competitor, we reached $10M ARR". That is a real sentence and a rarer one
   than "the competitor has X", and losing a figure is recoverable where scoring
   a rival's revenue as the plan's is not. Clause-bounding keeps the trade
   affordable — "we reached $10M ARR; our competitor is at $4M" still reads
   $10M — and the corpus is unchanged at 73/73, so no figure in any real filing
   was lost to it.

   **The deck path got it for free, which is the part worth pinning.** When a
   model reads an uploaded slide deck, its figures are vetoed by
   `metricStatedAsIntention`, which asks the same gate. So a deck saying "our
   competitor reached $10M ARR" no longer yields `arrUsd: 10000000` — without a
   line of new extraction code. Inheritance like that is true today and stops
   being true the moment someone adds a second gate beside the first, so it is
   asserted rather than assumed.

22. **Closed: money written the way most of the world writes it.** A probe of
   non-US filing conventions found two defects of different severity, and the
   difference matters more than the count.

   | Written as | Read as | Actually | Class |
   |---|---|---|---|
   | `INR 2,604.7 crore` | **$27** | ~$313M | wrong number — **fixed** |
   | `RM 458.2 million` | **$458.2M** | ~$97M | wrong number — **fixed** |
   | `Rs. 26,047 lakh` | nothing | ~$313M | miss — open |
   | `revenue of R$ 1,697.6 million` | nothing | ~$334M | miss — open |
   | `revenue of S$ 12.5 billion` | nothing | ~$9.7B | miss — open |

   **Fixed:** crore (10^7) and lakh (10^5) are now scale units, beside the
   Cyrillic ones that were added for the same reason. Every DRHP filed with
   SEBI states money in them; without them the scale word was dropped and the
   bare number kept. Pinned in `qventureDisclosedCorpus.test.ts` (708
   assertions), including a case proving the `(?![a-z])` unit guard still
   rejects a scale word glued to another word.

   **Also fixed, and it is the rule rather than the table entry.** An
   unrecognised currency token used to be ignored, and the figure then took the
   plan's currency — dollars. "RM 458.2 million in revenue" returned $458.2M
   against a real ~$97M; "HK$" was worse, read as USD outright because of the
   dollar sign. A currency this table cannot convert, sitting directly in front
   of a figure, now **refuses the figure**. That turns a wrong number into an
   honest miss, which coverage can see.

   Adding rates would have fixed today's list and left tomorrow's, so the list
   (`UNSUPPORTED_CURRENCY_BEFORE_NUMBER`) only has to be good enough to catch
   the common ones. ISO codes that are also English words a sentence can put in
   front of a number — `ALL`, `TOP`, `PEN`, `MAD`, `BOB`, `CUP`, `GEL` — are
   deliberately excluded, and a test proves "our top 5 million users" still
   reads the figure beside it.

   **The cost, measured rather than argued:** corpus unchanged at 73/73, gap
   unchanged at 10.9, hard cases 30/30, full backend suite green. No figure in
   any real filing in the corpus was refused by it.

   **The asymmetry underneath both is also closed, and it was the real lesson.**
   `R$`, `S$`, `C$`, `A$` and `Rs.` were in the currency detector but not in the
   number-prefix pattern, so the same currency parsed in one sentence shape and
   not the other: "we recorded R$ 1,697.6 million in revenue" converted, while
   "revenue of R$ 1,697.6 million" returned nothing. A reader whose coverage
   depends on which way round the sentence is built has coverage nobody can
   reason about. All five are now in both, with a test that reads each amount
   twice — once each way round — and requires the same answer.

   Fixing it introduced a defect of the very class this file is about, which is
   worth recording rather than quietly repairing. Adding `Rs.` to the prefix
   pattern let the figure parse, but `Rs.` was still not in the *detector*, so
   the figure took the plan currency: Zomato's Rs. 2,604.7 crore read as **$26
   billion** instead of ~$270M. Recognised in one table and not the other is
   exactly how a miss becomes a wrong number. It was caught by the control case
   sitting in the same probe, not by the tests, which had no reason to cover a
   currency the engine had never claimed to read.

   That is luck, not a process, so it is now a guard. Every currency in the rate
   table is checked against both patterns — the detector knows it, the prefix
   pattern lets its figure through, both sentence shapes agree, and the result
   is converted rather than passed through as dollars. The list is **derived
   from `UNITS_PER_USD`**, not typed out, so adding a currency without wiring
   both tables turns the suite red on its own. Proven by mutation rather than
   assumed: dropping `sgd` from the prefix pattern reddens exactly three tests,
   each naming the currency and which property broke.

23. **The two-table shape is the defect, not the currency.** Limit 22 ends with
   a guard over the currency pair. Looking for the same shape elsewhere found it
   immediately, one file over: `MONEY_UNIT_PATTERN` says which tokens count as a
   scale word, `MONEY_MULTIPLIER` says what each multiplies by, and a missing key
   falls through to **1**. A unit in the pattern but not the table does not fail
   — it silently scales by one. That is exactly how `crore` would have behaved
   if only half of the fix in limit 22 had landed: the word consumed, the
   magnitude dropped, the figure returned looking read.

   Guarded the same way and for the same reason: both lists are read out of the
   source rather than restated in the test, so a scale word added to either side
   has to be added to both. Includes an assertion that the alternation is still
   where the test looks for it — a guard that silently iterates an empty list
   passes forever.

   Proven by mutation: removing `crore` from the multiplier table reddens five
   tests, each naming the token. The lookup is also guarded with
   `hasOwnProperty`, because `MONEY_MULTIPLIER` is a plain object and a key like
   `constructor` would multiply a number by a function.

   The metric noun lists (`REV_NOUN`, `CUST_NOUN`, `GMV_NOUN`) were named here
   as the next candidate, and checking them produced a more useful answer than
   expected. Each list is now read out of the source and every noun in it is
   asserted to reach its field — but a mutation that *added* a noun passed,
   because for these lists the list **is** the wiring: one alternation feeds one
   field, so the currency-style divergence cannot occur. What the guard actually
   buys is coverage, not divergence detection: it fails when a noun's phrasing
   is one the surrounding pattern cannot match, which is the real failure mode
   here (`net revenues` died on a trailing `s` in exactly this way).

   Worth stating because the distinction is easy to lose: two of the three
   guards in limits 22–23 catch two tables drifting apart; this one catches a
   list entry that never worked. Calling them all the same thing would overstate
   what is protected.

24. **Closed: a stated target was scored as a stated result.** Found by running
   sentences taken verbatim from live SEC filings through the parser, which is
   the only reason it surfaced — every test in this file passed with it present.

   `INTENDED_WORD` shipped with three of its branches dead. The lookahead reads
   `(?=\s+(?:to|a|an|[0-9$£€]))` in the source, but held literal 0x08
   backspace characters where each `` should have been. The character is
   invisible in an editor, invisible in grep output, and makes the alternative
   unmatchable, so `target` only fired in front of a digit or currency symbol.

   | Sentence | Was scored as | Should be |
   |---|---|---|
   | `We target a 30% gross margin.` | achieved 30% | refused |
   | `The company targets a 25% gross margin.` | achieved 25% | refused |
   | `We targeted a 30% gross margin.` | achieved 30% | refused |

   A goal counted as a result, on the factor a screening tool is asked about
   most. Pinned, together with a test asserting the parser source contains **no
   control characters at all** — the class, not the instance.

25. **Closed: a date's year was read as a metric value.** Found by the same
   live-filing probe.

   | Sentence | Reads as |
   |---|---|
   | `For the year ended December 31, 2025, revenue grew sharply.` | revenue $2,025 |
   | `As of March 31, 2024, ARR continued to compound.` | ARR $2,024 |
   | `For the year ended December 31, 2025, customers grew.` | 2,025 customers |
   | `In the quarter ended June 30, 2026, TPV expanded.` | TPV $2,026 |

   Kaspi.kz's real marketplace GMV — tenge 9,053 billion, about $19bn — came
   back as **$4**, because the year matched first and then converted at the
   tenge rate. Five metrics, one cause: a bare four-digit number immediately
   before the metric noun.

   The fix masks month-anchored dates once before any pattern sees the text,
   rather than guarding five patterns and then the sixth. Masking uses
   equal-length spaces, so every index and clause boundary is identical between
   the masked text and its raw twin — which is what lets the period chooser
   still read years at the same offsets. Only month-anchored dates go: "we have
   2,025 customers" has no month and is untouched, and a test says so.

   **Why the first attempt was reverted, and what it turned out to be.** Masking
   broke period selection on two corpus cases (Lemonade, Moderna), and passing
   the unmasked twin to `clauseYearAt` did not fix them. The reason was a third
   instance of the shape in limits 22–23: `clauseYear`, a local closure inside
   the top-line parser, was a **byte-for-byte duplicate** of `clauseYearAt`,
   closed over the masked text. Fixing one implementation left the other reading
   spaces and finding no year at all. The duplicate is now a one-line call to
   the shared function, so "what year is this figure from" has one answer.

   Both halves proven by mutation: disabling the mask reddens 6 tests; pointing
   the year reader back at the masked text reddens 7.

   Worth stating plainly, since it took two attempts: the bug was not the
   masking. It was that the codebase had two implementations of the same
   question, and only one of them was in view.

26. **Closed: three phrasings that only a real filing would have shown.** The
   same live-document probe that found limits 24 and 25 left three misses
   behind. They were misses rather than wrong numbers, so they were recorded and
   deferred; they are now fixed, and each is pinned to the sentence it came
   from.

   | Phrasing | Source | Was |
   |---|---|---|
   | `Revenue from operations was ₹48,211 crore` | Infosys 6-K, Q1 FY27 | nothing |
   | `GMV of our Marketplace segment including Türkiye was ₸9,053 billion` | Kaspi.kz 20-F, FY2025 | $4, then nothing |
   | `10.7 million Average MAU` | Kaspi.kz 20-F, FY2025 | nothing |

   `revenue from operations` is the standard top-line wording in Indian and IFRS
   filings, and `revenues?` matched "revenue" and then wanted a figure. The
   Kaspi sentence needed two things the parser lacked: `was` as a connector, and
   room for a segment name between the metric and its number. That span is
   bounded to 45 characters and forbids digits and clause breaks, because an
   earlier unbounded widening let "margin declined to 20% and churn rose to 7%"
   read churn as margin — a test asserts the span cannot reach another metric's
   figure.

   Kaspi's marketplace GMV now reads as tens of billions of dollars from the
   sentence its own 20-F states, having started the day as **$4**.

   One caveat found while pinning this was deliberately left alone at the time,
   and is now closed (limit 36).

27. **Closed: hunting the duplicates instead of stumbling on them.** Three defects
   today came from one concept living in two places. All three were found by
   accident, so the obvious next step was to search rather than wait.

   A line-for-line duplicate scan over the parser finds **nothing** — the two
   copies of `clauseYearAt` differed only in the name of the variable they read.
   Adding alpha-renaming (every identifier becomes `X`, keywords kept) and
   running it against the commit *before* the fix points straight at the two
   line numbers. So the method works.

   The guard built on it did not, and was removed rather than kept. `from` is in
   the keyword set — it has to be, for `import ... from` — so a copy that names
   its variable `start` no longer matches one that names it `from`, and a
   deliberately planted structural duplicate slipped past. A test that claims a
   protection it does not provide is worse than no test: it is the defect this
   whole branch is about, one level up.

   What the scan established, run by hand: exactly one structural repeat was
   left — "read a percentage range at its low end, validate it, set the field,
   state the choice". Reading the surrounding code showed the scan had
   understated it: the same idea appears at **fourteen** sites, and only two
   were textually identical enough for a line scan to pair them. Three of the
   fourteen shared both policy and validation (gross margin, retention, take
   rate) and are now one function, `percentBandLowEnd`, with the ceiling as a
   parameter because that difference is real — net revenue retention above 100%
   is the point of the metric, a gross margin above 100% is a parse error. The
   scan now reports zero. The other eleven differ in policy (conservative end
   rather than low end, money rather than percent) and were left alone.

   Extracting it paid immediately, in a way worth recording: mutating the guard
   from `low <= 0` to `low < 0` reddened **nothing**, so a band stating a floor
   of zero — which states no floor at all — would have been scored as a
   disclosed 0%. One reader meant one place to notice that, and one test to
   close it.

   The honest version of the guard needs a real parser rather than a regex over
   lines — that, or a keyword set that does not collide with ordinary variable
   names. Recorded with the reproduction so the next attempt starts from here.

28. **The first two filings that never quoted a dollar.** Every other case in
   the corpus comes from a filing stating money in USD or converting to it.
   Infosys reports in rupee crore and Kaspi.kz in tenge, and adding them took
   parse coverage from 73 figures to 83.

   Between them they account for four of today's defects — the crore scale word,
   the year-of-a-date read as a metric, `revenue from operations`, and a segment
   name sitting between a metric and its figure. Adding the cases then found a
   fifth on the spot: `TCV of large deal wins was $3.6 billion` — the standard
   IT-services disclosure of signed-but-unrecognised revenue — was not read,
   because `tcv` was absent from the backlog nouns and `was` from its connector
   list. Two entries in two lists; the sixth new company found a new defect, and
   the yield still is not falling.

   Infosys is entered twice by design: the dollar release and the rupee release
   of the same quarter. A single case can only prove a figure was read; the pair
   proves the two readings of one set of accounts agree.

29. **A third currency, a seventh new company, another defect.** Hepsiburada
   reports in Turkish lira. Its own sentence — "our GMV increased by 4.3% to TRY
   257.5 billion" — was not read: revenue has understood that shape for a long
   time via `TO_LEVEL`, and GMV's connector list simply never got it. Fixed by
   using the existing mechanism rather than adding a second one. Coverage goes
   from 83 figures to 89.

   Seven new companies in this session, seven new defects. The corpus has not
   yet reached the point where adding a company teaches nothing.

30. **Limit 6 now has a test, not just a paragraph.** Hepsiburada's 20-F leads
   with a loss that tripled in two years — net income of TRY 142.8M, then a loss
   of TRY 2,100.7M, then TRY 5,699.2M. Adding all three figures to its case
   changes the score by **nothing**: 74.8, top band, either way.

   That is limit 6 working as documented, and documented behaviour with a real
   number attached to it is worth more than a paragraph. It is now asserted in
   the suite — the score with the loss must equal the score without it, and the
   score must be high enough for the omission to matter. If someone teaches the
   engine to weigh cost, that test fails and has to be rewritten on purpose.

31. **Thirteen currencies moved from refused to read.** Limit 22 chose a rule
   over a table: an unrecognised currency refuses the figure rather than
   inheriting the plan's. That was right, and it left thirteen currencies real
   20-F issuers actually quote — Hong Kong, Taiwan, Korea, Malaysia, Indonesia,
   Thailand, Vietnam, the Philippines, Mexico, South Africa, Norway, Denmark,
   New Zealand — returning nothing. A refusal beats a wrong number, but it is
   still a figure not read.

   Rates fetched from the source this table already names, on the date it now
   records. The refusal rule is unchanged and still covers everything without a
   rate: a test asserts naira, Chilean and Argentine pesos, Egyptian pounds and
   Pakistani rupees are still refused rather than read as dollars, and a second
   asserts the thirteen new ones convert at the checked-in rate.

   `HK$` and `NT$` are the reason multi-character symbols sit before the bare
   `$` in both tables. Read as US dollars they overstate by 8x and 32x.

32. **The same asymmetry, caught by a probe rather than by the guard.** Adding
   the currencies wired their **codes** into both tables, and the derived guard
   from limit 23 passed — it builds "KRW 100 million" and checks that. The gap
   was in the **symbol** form: won, baht, dong and peso were recognised as
   currencies and then had no way to reach a figure written with them, because
   the number-prefix character class was never extended. Exactly the defect
   limit 22 closed for `R$` and `S$`, reintroduced four hours later by someone
   who had read that limit.

   A guard that tests one of two forms is a guard for one of two forms. There is
   now a second, deriving every currency symbol from the `MARKERS` block of the
   source and requiring each to reach a figure — proven by mutation, which
   reddens the exact symbol removed.

33. **Applying limit 32's lesson on purpose, and what it found.** The lesson
   there was to stop asking "is this covered" and start asking "how many ways
   can this be written, and is each one covered". Run deliberately across the
   parser, most answers came back clean: every money-unit token reaches the
   parser, every revenue and GMV noun reads in both sentence shapes, and
   retention, churn, gross margin, take rate and payback all read prefix-first
   and suffix-first alike. Worth recording that a search can come back empty.

   Two did not. **`Metric: value` is how a deck writes a metric**, and seven of
   the nine here already read it — revenue, ARR, GMV, gross margin, churn, take
   rate, backlog. The customer count, which decks state that way more often than
   any other, had no noun-first form at all: `Customers: 5,000` read as nothing.
   And `NOT_MONEY`, which stops `$5,000 customers` being read as a count, listed
   six currency symbols while the prefix pattern had grown to thirteen — so
   `₩5,000 customers` was a count of five thousand.

   The connector in the new form is required rather than optional, and that is
   proven rather than asserted: made optional, six ordinary sentences produce a
   customer count — "we serve customers 24 hours a day" reads 24, "users 18 and
   older" reads 18, "accounts 30 days past due" reads 30. Each is a test.

34. **The third notation: what a deck writes instead of a sentence.** After
   prose and the colon form, the remaining way a plan states a metric is a
   table row or a bullet. Bullets, tabs and newline-separated label/value pairs
   already worked. The pipe of a markdown table and the em/en dash of a slide
   label did not — in any of the **twenty-four** connector lists in the parser,
   which is also why nobody had added them: there was no one place to add them
   to. All twenty-four now carry the notation separators.

   **One metric is deliberately excluded, and it is the interesting part.**
   Gross margin still refuses `Gross margin — 45%`. Everywhere else a dash
   between a label and a figure is punctuation; on gross margin the sign *is*
   the finding — Solyndra's −45% was the headline of its case — and a rule
   turning the dash into a separator would read a negative margin as a positive
   one. The pipe works there; the dash does not, on purpose, with a test saying
   so.

   That exclusion was not planned. A test written earlier today pinned the
   refusal, the blanket change broke it, and the failure is what forced the
   question of whether a dash means "label" or "minus" per metric rather than
   globally. A guard that only ever agrees with you teaches nothing.

   The plain hyphen and the arrow stay out. A hyphen is a range separator and a
   minus sign in this corpus already; an arrow usually means "will become",
   which is an intention, not a result.

35. **Twenty-four connector lists become one constant.** Limit 34 added the
   pipe and the em dash by mechanical search-and-replace across twenty-four
   hand-written lists. It worked, and it worked by luck: one list was written in
   a different order and the replace missed it, which only surfaced because a
   probe checked customers separately.

   They now read from `LINK` — or `LINK_NO_DASH`, which exists for gross margin
   alone — and append only the words each genuinely needs (`between` for a band,
   `were|was` for a past-tense filing line). Proven by mutation: removing the
   pipe from the single constant reddens revenue, GMV, customers and gross
   margin together, which is exactly what could not happen before.

   Three assertions keep it that way: no list is written longhand, the constants
   are used rather than merely declared, and gross margin is the only metric on
   the dashless one — so moving a second metric there has to be a decision
   rather than a copy-paste.

   That is the fourth duplication of this shape closed today, after the currency
   tables, the money-unit tables and `clauseYear`. The pattern in all four: a
   concept written out per-site, correct everywhere, until one site needed
   changing.

36. **Closed: a figure too large to be a currency it did not name.** Strip the
   tenge sign from Kaspi's "GMV was 9,053 billion" and the engine returned
   **$9.05 trillion** — the documented rule for an unmarked figure is the plan's
   currency, defaulting to dollars, and the rule was working exactly as written.
   It was recorded rather than fixed in passing, because changing what the
   engine scores without measuring it is how rubrics rot.

   An unmarked figure above **$5 trillion** is now ignored and said so in a
   parse note, rather than scored. The ceiling is absurd on purpose: four times
   the largest GMV any company has reported, above every revenue figure ever
   filed, and it never sees Visa's ~$15tn of annual payment volume because that
   is marked. A figure that names its currency is believed at any size — the
   rule is about the absent marker, never about the magnitude of a real one.

   It lives in `moneyUsd`, the one door every money figure passes through, so
   the fourteen sites that read money inherit it. Corpus unchanged at 89/89.

37. **The notation sweep, finished.** Limits 33 and 34 asked "how many ways can
   this be written" of revenue, GMV, customers and the percentages. Asked of the
   remaining six fields, payback, LTV/CAC and churn came back clean and three
   did not:

   | Not read | Field |
   |---|---|
   | `$500 CAC`, `$2,000 LTV` | the suffix form every other money metric has |
   | `Customer acquisition cost of $500`, `Lifetime value of $2,000` | the spelled-out name |
   | `TAM \| $5 billion`, `TAM — $5 billion` | TAM's own connector list |

   The spelled-out names are the metric-noun lesson again: only the acronyms
   were listed, so the way a plan writes the term **the first time**, before
   switching to the abbreviation, read as nothing. TAM's list is the one limit
   35 missed — its words are in a different order, which is the second time that
   exact thing has happened and the reason the lists were consolidated at all.

   Guarded against the collisions that matter: `LTV/CAC of 4x` still yields
   neither a CAC nor an LTV, "our cost of goods" is not an acquisition cost, and
   the conservative end of each band still wins — CAC the higher, LTV the lower.
   Both additions proven by mutation.

38. **The deck cross-check knew fewer scales than the parser.** `figureAppearsInText`
   is what stops a model reporting a figure the uploaded deck never stated. Its
   scale list was written out as `[1e3, 1e6, 1e9]` — a fifth copy of a set that
   already lives in `MONEY_MULTIPLIER` and the unit pattern — and had never
   learned crore or lakh. So a deck stating "48,211 crore" and a model correctly
   reporting 482,110,000,000 disagreed, and the model's **right** answer was
   discarded as unsupported.

   Reading the scales from the table fixed that and cost something, which is
   worth stating because it nearly shipped: dividing by 10^7 let a model
   claiming $100M find a match in a deck saying "$10 million", since
   100,000,000 / 10^7 is 10. Stopping exactly that invention is the check's
   entire job.

   The rule is now that a scale applies only when **its word is in the text** —
   "10" counts as ten crore only if the deck says crore. That closed the defect
   the fix introduced and **three that pre-dated it**: a customer count inflated
   tenfold, a year read as money, and a percentage read as money all used to
   pass. Six negative cases and five positive ones are pinned.

   One detail that cost a round: the word test cannot be `${word}`, because
   an abbreviation is glued to its figure and there is no boundary between the
   0 and the M of "$10M". A preceding letter still disqualifies, so the m of
   "programme" is not a million.

39. **Five of twelve fields scored a target as a result.** Limit 24 fixed a
   0x08 artefact that let "we target a 30% gross margin" be read as an achieved
   margin. Asking the same question of every field found the same defect reached
   by a different route: the achievement gate is applied at each assignment
   site, and **five sites never got it** — LTV/CAC, CAC, LTV, payback and TAM.

   "We are targeting a CAC of $500" scored a CAC of $500. "We are targeting a
   TAM of $5 billion" scored the TAM. Seven other fields refused correctly,
   which is what made it invisible: the behaviour looked right wherever anyone
   checked.

   All twelve now refuse a target and still credit a stated result, and the
   conservative end of each band survives the gate — CAC the higher, LTV the
   lower, payback the longer. Twenty assertions.

   Found while reading the deck-extraction path rather than the parser, because
   its intention veto covers six fields where the figure check covers seven —
   `ltvCacRatio` is checked for existence in the deck and never vetoed. That
   asymmetry is what prompted asking which fields the *parser* gates, and the
   answer was worse.

   One more gap surfaced in passing and is fixed: `Our LTV/CAC is 5x` read as
   nothing, because `is` was missing from that metric's connector list while
   every other metric had it.

40. **The deck veto knew fewer nouns than the parser, and a type error nobody
   could see.** Sixth place the same knowledge was written twice. The veto
   carried its own regexes — `/(?:arr|mrr|revenues?)/` against a list that also
   knows net sales, revenue from operations and gross written premiums, and
   `/(?:customers|users|subscribers)/` against nineteen customer nouns. So "we
   plan to reach net sales of $10 million" was not seen as a metric stated as an
   intention, the veto never fired, and a stated goal survived as a reported
   figure. All ten metrics now read from `METRIC_NOUN_RE`, built from the
   parser's own lists, and `ltvCacRatio` joins the veto it was missing from.

   Two things fell out of doing it. `aim for` was not in the intention list —
   only `aims to` — so "we aim for gross written premiums of $10 million" was a
   result. And typechecking the change surfaced something the **2,141 passing
   tests could not**: an earlier blanket edit in this session had appended an
   argument to `detectRevenueRange`, `detectRevenueConflict`, four
   `moneyRangeEnds` calls and four `toUsd` calls. JavaScript ignores extra
   arguments; `tsc` does not, and CI runs `tsc`. Ten call sites, invisible to
   every test, would have failed the merge gate.

   Worth keeping as a rule: a green suite says nothing about types. The only
   reason this was caught before the branch was pushed is that the compiler was
   run deliberately, not because anything failed.

41. **The deck path declares its fields once.** Limit 40 aligned the contents
   of the two checks — "is this figure in the deck at all" and "is this metric
   stated as an intention". They were two hand-written lists that had diverged
   to seven fields and six, which is how `ltvCacRatio` could be a stated goal
   and survive as a reported figure.

   Aligning contents fixes the instance; one declaration removes the way it
   happened. Both loops now read the same table, and three assertions hold it:
   both loops read it, neither old list came back, and **every numeric field of
   `DeckFinancials` appears in it**. That last one is the guard that matters —
   the failure it prevents is a field added to the type and to the model prompt
   and to neither check, free to be invented and free to be a goal. Proven by
   mutation: removing a row reddens it.

   Seventh duplication of this shape closed today. The tally, because the
   pattern is more useful than any of the instances: currency tables, money-unit
   tables, `clauseYear`, twenty-four connector lists, the deck's scale list, the
   deck's noun regexes, and now the deck's field lists.

42. **A level stated with a rise verb was read as a growth rate.** Found on the
   first sentence of the eighth new company. TSMC's 20-F says "our gross margin
   increased to 59.9% of net revenue from 56.1% in 2024" — the margin rose 3.8
   percentage points, and the engine recorded **59.9% growth**.

   | Sentence | Growth recorded |
   |---|---|
   | `Our gross margin increased to 59.9%.` | 59.9% |
   | `Net revenue retention increased to 120%.` | 120% |
   | `Take rate increased to 15%.` | 15% |
   | `Churn declined to 3% monthly.` | −3% |

   Retention is the one to look at: a company with flat revenue and healthy
   retention was scored as growing 120%, on top of scoring the retention itself.
   The same figure counted twice, once under a name it does not belong to.

   A percentage attached to a level metric in its own clause is now excluded
   from the growth read — each of those four already reads the figure correctly
   under its own name. Bounded to the clause, so "revenue grew 42%; margin rose
   to 60%" still records 42%.

   Eight new companies this session, eight new defects, and this one was in the
   first sentence read from the eighth. The corpus is nowhere near exhausted.

43. **Closed: growth written as a noun.** Every growth pattern
   in the parser is built from a verb — `increased 31.6% year over year` reads,
   and these do not:

   | Sentence | Growth read |
   |---|---|
   | `Net revenue was NT$3,809,054 million in 2025, a 31.6% increase over 2024.` | nothing |
   | `A 31.6% increase in revenue.` | nothing |
   | `Revenue grew 31.6% over 2024.` | nothing |

   The first is TSMC's own wording. This is the verb-versus-noun rule from limit
   19 arriving from the other direction: those pattern lists were rebuilt around
   verbs precisely because noun-anchored ones matched too much, and the growth
   patterns now match too little.

   It was recorded as open with nine minutes left, with the TSMC case asserting
   the figure was **not** read — and closed twenty minutes later, at which point
   that assertion went red exactly as intended. Written down because it is the
   cheapest thing in this file to copy: an assertion that pins a known miss
   costs nothing and fails loudly the moment the miss is fixed, which is more
   than a TODO ever does.

   Two shapes were added: the figure in front of the noun (`a 31.6% increase`)
   and the verbs `grew`, `rose`, `climbed`, which DIR_VERB knew and the growth
   patterns did not. `decline` is deliberately absent from the noun list — a
   fall belongs to the decline parser, which knows to make it negative.

   Fixing it exposed a second, worse thing. The level-metric filter from limit
   42 ran **after** the ordered pattern loop had already stopped on
   `found.length`, so a sentence naming a margin consumed the growth read and
   the filter then discarded it — hiding the growth stated in the sentence
   beside it. TSMC's own case demonstrated it: 31.6% growth, stated plainly,
   read as nothing because the next sentence mentioned a margin. The filter now
   runs inside the selection, where it belongs.

   Parse coverage 95/95. A guard placed one step too late is not a guard; it is
   a way of losing data quietly.

44. **Closed, on the third pass: a fall written as a noun — and the two
   attempts it took to get there.** The mirror of limit 43. `Revenue saw a 12% decline in
   2025` reads as nothing, so a stated fall is a missing figure rather than a
   negative one and the factor falls back to a sector prior.

   Adding the noun shape to the decline pattern works on every case in
   isolation, and creates a **wrong number** on the eleventh:

   | Sentence | With the fix |
   |---|---|
   | `Revenue grew 42% year over year; costs saw a 12% decline.` | **−12% growth** |

   The decline path is consulted before the rise path and, unlike the growth
   patterns, does not classify what the figure belongs to. So a fall in costs
   became a fall in revenue — one metric's number under another metric's name,
   which is the exact defect limit 5's basis classification was built to stop.
   Growth got that treatment; decline never did.

   Reverted rather than shipped: turning a missing figure into a wrong one is
   the wrong direction.

   **A second attempt found the actual cause, and was also reverted.** Giving
   the decline path the rise path's rule — a classified match beats an
   unclassified one — fixed eleven cases of twelve and left that one. The
   reason is a level deeper than the decline path: `basisFor` scans backwards
   about ninety characters for a metric noun and **does not stop at the clause
   boundary**. So in "revenue grew 42% year over year; costs saw a 12%
   decline", the fall in costs is classified as belonging to revenue, because
   the word revenue is close enough behind it. The precedence rule cannot help
   when the classification itself is wrong.

   The obvious conclusion was to bound `basisFor` to the clause, the way
   `statedAsAchieved`, `clauseYearAt` and the level-metric filter already are.
   **Measured, and it is wrong.** Bounding it reddens two real cases: Affirm's
   93% revenue growth comes back as 77% — the GMV figure from the sentence
   before — and Deliveroo's volume label is lost. Real filings routinely name
   the metric in one sentence and state its rate in the next, so the
   ninety-character look-back is doing work no clause-bounded version can.

   That cost one corpus run to learn: the diagnosis was right about the cause
   and wrong about the cure. Attribution needed something better than "nearest
   noun backwards", not a tighter version of it.

   **The answer was that "costs" is not the absence of a metric — it is a
   different one.** A `NOT_A_BASIS` list (costs, expenses, opex, burn,
   headcount, marketing, churn, inventory, debt and the rest) now claims a
   figure away from any basis noun standing further back. The window is
   unchanged, so Affirm's 93% still crosses the sentence boundary correctly;
   what changed is that something nearer can now contradict it. With that in
   place the precedence rule earns its keep — a classified rise outranks a
   decline classified as belonging to nothing we score — and the noun-shaped
   decline became safe to add. "Revenue saw a 12% decline" reads −12% where it
   used to read nothing and fall back to a sector prior.

   Fourteen traps, all held, including the four that reverted the earlier
   attempts. Corpus unchanged at 95/95, hard cases 30/30.

   Three passes for one limit, and the two failures were worth more than the
   success: the first found the cause, the second refuted the obvious cure.
   Neither reached the branch.

   Third time today the same judgement. Masking dates was reverted, diagnosed,
   and closed an hour later; this is diagnosed and waiting. The diagnosis is the
   deliverable — the next attempt starts from "bound basisFor to the clause"
   rather than from the symptom.

45. **Ninth new company, ninth new defect — two of them in eight words.** Sony
   states its growth as "sales increased approximately 3% year-on-year". Both
   halves failed: `year-on-year` is how most of the world writes it and the
   pattern knew only `year-over-year`, so the rate came back with no period at
   all — and a rate without its period is not a number, which is the first rule
   in the metrics module. And the qualifier between the verb and the figure
   (`approximately`, `about`, `nearly`) broke the match outright.

   Nine companies, nine defects, and the last one was found with twelve minutes
   left in a session by reading one sentence.

46. **Closed: two ways of writing a negative.** A sweep of
   negative-figure notations — the class this corpus cares most about, since
   Solyndra's −45% margin was its headline finding — came back four for six.
   Parentheses, the word "negative", the hyphen-minus and the Unicode minus all
   read correctly, and a positive margin and a parenthetical "(unaudited)" are
   both untouched. Two do not read:

   | Sentence | Read as |
   |---|---|
   | `Gross margin of ▲45%.` | nothing |
   | `Gross margin was a negative 45%.` | nothing |

   The triangle is the Japanese convention for a negative figure — ▲ and △ mean
   what parentheses mean in a US filing, and Sony's own statements use it. The
   second is not about the sign at all: `was` is missing from the gross-margin
   connector list, which is the only list on this branch that does not sit on
   the shared LINK constant, because a dash there is a minus rather than
   punctuation (limit 34).

   Both were recorded rather than patched with four minutes left, and closed
   with the trap testing they deserved once there was time. ▲ and △ join the
   negative markers; `was`, `were` and `was a` join the gross-margin connectors.

   Eighteen traps, all held: the em and en dash are still refused — the whole
   reason that connector list is separate — a range still reads its low end, a
   target is still refused, a competitor's margin is still not the plan's, an
   *operating* margin is still not a gross margin, and the pipe still works. A
   further eight checks confirm the triangle reached no other metric.

   Note what was added and what was not. `was` and the triangle are a word and a
   symbol; neither is a dash. The dash stays out because before a margin figure
   it is ambiguous between a label separator and a minus sign, and that is the
   one ambiguity here with a wrong-number failure mode.

47. **Growth stated as a multiple.** A deck writes "revenue grew 3x" and
   "revenue doubled" constantly, and every growth pattern wanted a percent
   sign, so both read as nothing.

   The danger is entirely in the neighbours. A multiple is also how an LTV/CAC
   ratio and a valuation are written, and reading `LTV/CAC of 4x` or `valued at
   10x revenue` as growth would invent 300% and 900%. A growth verb is
   therefore required in front of the multiple, an explicit rate in the same
   sentence always wins, and the multiple passes through the same achievement
   gate and level-metric filter as everything else.

   Fourteen traps: a target, a plan, a rival'''s multiple, a doubling margin, a
   doubling churn, a bare "revenue 3x", "grew 1x", an absurd 500x, the ratio
   and the valuation. All refused. The reader is told in a parse note that the
   figure arrived as a multiple, because 3x scored as 200% is an interpretation
   and not a disclosure.

48. **A quarter scored beside somebody else'''s year, and nothing said so.** A
   sweep of how a period attaches to the top line found the arithmetic already
   right — ARR, MRR, run-rate, annualised, LTM, TTM and "per month" all read
   correctly, and "$1 million per month" annualises with a note. One thing was
   missing, and it was not arithmetic.

   A figure covering a quarter or a half-year is scored as stated, in the same
   field as another company'''s full year, with no indication of the difference.
   WeWork'''s case in this corpus states $1.54B for the first half of 2019 — a
   business running at roughly twice that annually — and Infosys states a
   quarter. Comparing them to an annual figure is comparing different things.

   **Not annualised, named.** Doubling a half-year assumes no seasonality, and
   inventing a figure the plan never stated is worse than scoring the one it
   did. A parse note now says which period the top line covers and that it was
   not annualised. Every score is unchanged — corpus 95/95, gap 10.9 — because
   this adds a sentence to the reader, not a number to the model.

   The month is the one period still converted, and that is deliberate: MRR
   means a run rate by definition, and a month carries no seasonality argument.
   That conversion has always announced itself and still does.

49. **Auditing the notes themselves.** The parse notes are the only place the
   engine tells a reader it changed their number, so they were audited as a
   set: twenty-one classes, every one naming what was disclosed and what was
   scored, and the six that promise arithmetic were checked against the
   arithmetic. Payback years to months, monthly revenue annualised, gigawatts
   to megawatts and a multiple to a percentage all matched exactly.

   One did not announce itself at all. Churn quoted annually is converted to a
   monthly rate — 20% a year becomes 1.84% a month, compounding properly — and
   the reader saw a monthly figure they never wrote, with nothing saying where
   it came from. Same class as the retention factor fixed earlier on this
   branch, which silently awarded up to six points.

   It now says so, and says it in English: the period values are adjectives
   ("annual", "weekly") and the sentence wanted an adverb. That text is shown to
   a person.

   Also pinned: the note has to reach that person. It travels parseNotes →
   engine assumptions → the list the result page renders, and the middle link
   is the one a refactor can drop while every parser test stays green.

50. **A red flag that could never fire.** The red flags were audited the same
   way the parse notes were, by firing each one deliberately. Five of six
   behaved. The sixth could not behave: the rule was "twenty-five points above
   the sector norm", and B2B SaaS carries a 78% norm, so the threshold was 103%
   — a gross margin no company can report. Biotech, at 85%, needed 110%.

   Dead for the two sectors this tool sees most, in exactly the way the
   intention gate was dead this morning: it reads like a protection and cannot
   act as one. A 98% claimed gross margin in SaaS passed without comment.

   A 90% absolute ceiling now sits on top of the relative rule. The best gross
   margins in software are mid-to-high eighties, so a claim above ninety is
   worth checking in any sector; sectors whose norm is below 65% keep their
   relative threshold, since the ceiling is above it anyway. A test iterates
   **every** sector and requires the flag to be reachable, so a new sector with
   a high prior cannot arrive dead.

   Corpus, hard cases and calibration all unchanged.

51. **A correction to the test counts reported on this branch.** The full
   backend suite is **not** deterministic: run repeatedly on an unmodified
   tree it produced 6, then 1, then 2 failures, in different tests each time,
   all in  — another module's zone, and green when that
   file is run alone.

   Which means the "N backend tests green" figures quoted in commit messages
   here were runs that happened to miss the flaky ones, not a baseline. The
   QVenture numbers are unaffected and were measured directly: 
   returns 1,000 passing three times out of three, and the three harnesses are
   run separately every time.

   Recorded rather than quietly corrected, because a number stated confidently
   and derived from a flaky source is the thing this whole document is against.

52. **Auditing the factors — the score itself.** Firing each of the eight
   factors deliberately, the way the notes and flags were audited, showed the
   design is more honest than a first reading suggested: every factor carries a
   basis label, six of eight become company-evidence on a rich plan, and the
   coverage figure already excludes the two that cannot. Worth stating, because
   my first pass read 27% of the score as inert and that was wrong — market
   does move on the plan.

   Two things were not honest.

   **Competition said "sector-prior" while the plan had moved it twenty points.**
   An adverse disclosure — "the incumbent offers equivalent functionality free"
   — charges the competition factor 20, and its basis was hardcoded, so the
   reader was told an industry average produced a number the company produced,
   and the coverage figure left it out. Now corrected after the disclosures are
   read, which is the only place both are known. It relabels and does not
   rescore: corpus, hard cases and calibration are all unchanged.

   Timing stays a sector prior and a test now says so — it is a pure function of
   the sector CAGR, nothing in a plan can move it, and the label should not gain
   a false promotion later.

   **The market rationale called a $10M bottom-up TAM "credible"** and scored it
   exactly as it scored $900B. The +3 credit is for having done the bottom-up
   work at all, which is defensible and now says so; the word was not, and is
   gone. A TAM under ten times the raise now raises a flag instead — a $10M
   market against a $5M round means the whole market is twice the money going
   in. Text, not score: what multiple a fund needs is a mandate question, not
   one this rubric should decide.

53. **Three adverse disclosures that could not act.** The margin flag was dead
   because its threshold was unreachable. Asking the same question of all
   nineteen adverse disclosures, by firing each one deliberately, found three
   more:

   | Disclosure | Why it could not fire |
   |---|---|
   | `no 510(k) or CE mark` | the alternative ended in a word boundary, and a closing parenthesis is not a word character — that branch could never match |
   | `3 months of runway remaining` | the pattern wanted the noun before the number, and a plan writes it either way round |
   | `no working prototype`, `yields below plan` | gated to sectors that build things, and there is no "hardware" sector — such a plan resolves to `other`, which was not in the gate |

   All sixteen now charge. Corpus, hard cases and calibration unchanged, so
   nothing was recalibrated — these were charges that should always have been
   made and never were.

   The third is worth its own note: I first added "hardware" and "deeptech" to
   the gate, and both resolve to `other`, so the fix did nothing. Checking what
   a sector name actually resolves to took one probe and would have saved a
   wrong commit.

54. **The control-character guard now covers the test file too.** The same 0x08
   artefact that killed three branches of the intention gate appeared inside an
   assertion *in the test file* while writing limit 53 — a regex reading
   `no (?:510(k))` that held a backspace where a word boundary belonged, which
   asserts something weaker than it appears to and can pass for the wrong
   reason. The guard over the parser source could not see it.

   It now guards itself, and it caught its own comment on the first run.

55. **The last two surfaces, audited and clean.** Strategy and stress were the
   only parts not yet put through the reachability question. Both came back
   clean, and saying so is part of the audit.

   **Strategy.** All three verdicts reach. `high` conviction does not — and that
   is already known, tested and documented in
   `tests/qventureBandsReachable.test.ts`, which records it rather than
   asserting it away. A "pass" verdict returning
   ticket figures looked wrong until read end to end: the tranches say 0% at
   entry, the reasoning says "no ticket recommended — the figures below are the
   terms this deal would have to earn on a re-score, not an offer", and the
   result page labels the field "Ticket (indicative)" instead of "Lead ticket".
   Coherent from engine to screen.

   **Stress.** Every label it can print is reachable — four resilience values,
   three scenario health values — and with nothing to model it says
   `insufficient-data` and names what it needs, rather than inventing a verdict.

   Both are now pinned, because a label that becomes unreachable later fails
   silently and nothing else in the suite would notice. That is precisely how
   the gross-margin flag spent months unable to fire.

56. **An average contract value is not a backlog.** Probing the efficiency
   metrics a SaaS plan actually discloses — Rule of 40, magic number, ACV, NDR,
   gross and logo retention, pipeline — turned up one wrong number and one
   false description.

   The backlog nouns included `contract value`, so `Average contract value of
   $45,000` was read as $45,000 of contracted revenue. ACV is what one contract
   is worth; contracted revenue is everything signed and not yet recognised.
   A category error, and a wrong number rather than a missing one. Excluded by
   lookbehind, with the five real backlog phrasings — total contract value,
   sales backlog, offtake, TCV of large deal wins, contracted revenue — checked
   unchanged.

57. **A retention figure now says which retention it is.** Net, gross and logo
   retention are three different numbers: net can exceed 100% and routinely
   does, gross and logo cannot. All three read into one field, and the report
   described every one of them as "net revenue retention" — so a plan
   disclosing 92% *logo* retention was told back that it had disclosed 92% net
   revenue retention. A sentence about a figure the plan never wrote, in the
   same class as the TAM the rubric called "credible".

   The signal carries the kind now and the rationale states it. Scoring is
   untouched on purpose: whether gross retention should be judged on tiers
   calibrated for net is a calibration question, and this was a description
   problem. Recorded here so the calibration question is visible rather than
   buried by having fixed the wording.

   Still unread, and left that way: Rule of 40, magic number, qualified
   pipeline and cohort retention. Each would need a factor to feed, and burn
   multiple was already refuted by arithmetic in limit 6.

58. **The calibration question from limit 57, answered with a count.** Should
   gross retention be judged on tiers calibrated for net? Counting first: all
   four retention figures across both corpora are **net**. Zero gross, zero
   logo. A tier change for gross retention could not be seen on either corpus,
   and limit 4 already says a rubric change invisible to your corpus has not
   been validated by it. So: not changed, and the count is the reason.

   Making the question answerable was the better use of the time. Procore's S-1
   states **both** on the same dates — gross retention 94% and net retention
   107% as of 31 December 2020 — which is exactly the case needed to calibrate
   one against the other.

59. **Closed on the second attempt: a trend stated in one sentence read its oldest figure.**
   Fetching Procore turned up something worse than the question it was fetched
   to answer.

   An S-1 presents a trend in a single sentence, and the metric noun appears
   once:

   > Our revenue was \$186.4 million in 2018, \$289.2 million in 2019, and
   > \$400.3 million in 2020.

   One noun, one match, nothing for the latest-period rule to choose between —
   so the first figure wins, which is the **oldest**. Procore's top line reads
   \$186.4M instead of \$400.3M, understated 2.1x. Retention reads 121% instead
   of 107%. Four metrics behave this way; the rule itself is correct and only
   fails when the noun is not repeated, which is why it went unnoticed.

   **Attempted and reverted, with the diagnosis worth more than the attempt.** A
   series walker that steps forward through ", <figure>" while the clause holds
   passed eighteen traps — comparison words, a second metric noun, a sentence
   boundary, a range, a monthly figure, and years written in descending order
   (Infosys writes 2025 before 2024, so choosing by position rather than by year
   picks the older figure; the walker chooses by year).

   It still had to go. The hard-cases mean gap fell from **16.5 to 15.8** and
   `invest` stopped being reachable at all — and the reason was one fixture
   reading a top line of **$62**. The walker had stepped onto a number that was
   not revenue. Eighteen traps did not include "the tail figure must be the same
   order of magnitude as the head", which is the missing rule.

   Worth noting where the alarm came from: the disclosed-figures corpus stayed
   at 95/95 throughout. The hard cases caught it, and the band-reachability test
   caught it, and the doc gate caught the headline claim moving. Three
   independent guards, none of them the one that usually fires.

   **The second attempt added that one rule and everything else held.** A tail
   figure must be within a factor of ten of the head: a trend across a few years
   does not move 100x, and a figure that does is a different quantity wearing
   the same punctuation. With it, Procore's revenue reads $400.3M, its net
   retention 107% and its gross retention 94%; Infosys, which writes its years
   descending, still gives 2025 rather than the positional last.

   Fourteen traps, all held, and all four guards clean this time — corpus 95/95,
   hard-cases gap back at **16.5**, calibration range unchanged, verdict bands
   still reachable. The two pins went red on the fix: fifth use of that
   technique here, four closures out of four.

   Worth keeping the sequence rather than just the fix. Attempt one passed
   eighteen traps and still broke the headline claim; the corpus never noticed;
   three other guards did. Attempt two differs by a single condition, and that
   condition came from reading what attempt one actually got wrong rather than
   from thinking harder about the problem.

60. **The series rule extended to the metrics that share its shape.** Revenue
   and retention were closed in limit 59; the customer count and gross margin
   are stated the same way and were extended once the magnitude bound made the
   walk safe. "3,000 customers in 2018, 5,000 in 2019, and 8,000 in 2020" gives
   8,000; "gross margin was 60%, 70%, and 80%" gives 80%.

   One exception, deliberate: a **negative** margin never enters a series.
   Carrying a sign forward through a walk is a way to lose it, and a filing that
   states a negative margin states it once — Solyndra'''s −45% is the headline of
   its case. Seventeen traps across the two metrics, and everything the margin
   already refused it still refuses: the dash, the range, a stated target.

   All four guards clean: corpus 95/95, hard-cases gap 16.5, calibration range
   unchanged, verdict bands reachable.

## How this stays true

The harnesses used to be hand-run, which is how the rubric decayed the first
time: v1 could not reach a "pass" verdict on any input and nobody noticed for
months. The invariants now run on every push
(`aevion-globus-backend/tests/qventureHardCases.test.ts`, 28 assertions, and
`tests/qventureDisclosedCorpus.test.ts`, 708):

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
