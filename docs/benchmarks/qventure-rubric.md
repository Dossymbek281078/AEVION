# QVenture rubric — what has actually been measured

Follows `PLAYBOOK.md`. Numbers here come from two checked-in harnesses that
anyone can re-run; nothing in this file is typed in from memory.

| Harness | Command | What it can prove |
|---|---|---|
| Calibration | `npx tsx scripts/qventure-calibration.ts` | Discrimination and range on companies with known public outcomes |
| Hard cases | `npx tsx scripts/qventure-hardcases.ts` | Whether a non-SaaS business model's own evidence is read and scored |

Persisted results: `qventure-rubric-latest.json` (`historical` is the curated
baseline; `latest` is whatever a re-run produced).

## The claim we are willing to make

> On plans that disclose evidence, QVenture separates a strong deal from a weak
> one **in the same sector and stage** by a mean of **16.2 points** (min 8.8,
> max 30.8), including business models with no SaaS metrics — defence contracts,
> clinical phases, offtake agreements, GMV × take rate, design wins.

That is a statement about *reading disclosure*, not about predicting outcomes.

## The claim we are **not** willing to make

QVenture does not predict success. The calibration corpus separates known
failures from known successes by **7.0 points of mean composite**, and **6 of 12
failures still score at or above the weakest success**. Those descriptions were
reconstructed by an author who knew the outcome, so even that 7.0 is generous to
the rubric, not conservative.

## Known limits, stated plainly

1. **On evidence-free plans the scale compresses.** Real range used across the
   calibration corpus is 49.6–66.3 of a nominal 0–100. A plan that discloses
   nothing cannot move the score, which is correct behaviour — but the 0–100
   presentation implies more resolution than the input supports.
2. **`invest` is unreachable without disclosure.** No calibration case reaches
   it. With disclosed metrics it is reachable (marketplace strong case, 72.6),
   so the band is live, not decorative.
3. **Capital-intensive discrimination is unmeasured.** The calibration corpus
   has one capital-intensive success (Anduril, 52.1 → `pass`). Its description
   discloses no contract awards; the hard-cases defence pair shows that when
   that evidence *is* disclosed the same shape of company scores 62.3 vs 46.1.
   More known-outcome capital-intensive companies are needed before claiming
   anything here.
4. **v5 changed nothing on the calibration corpus** — identical to the decimal.
   That is the expected result (the fixtures state no figures), and it is worth
   keeping visible: a rubric change that cannot be seen on your existing corpus
   has not been validated by that corpus.

## Rubric version history

| Version | What moved |
|---|---|
| v3 | Adverse disclosures penalised; weights moved to company evidence |
| v4 | Churn read in its stated period; `<n>% monthly` no longer counted as growth; projections judged against the stage's venture bar |
| v5 | Non-SaaS evidence read and scored: GMV × take rate, contracted backlog, non-dilutive awards, pilots/design wins, regulatory milestones held, technical validation. Science and legal can be company evidence instead of always sector constants. |
