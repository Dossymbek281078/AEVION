# QSkyway — Session Handoff (2026-07-26)

> Supersedes `AEVION_QSKYWAY_HANDOFF_2026-07-22.md` for everything after 22.07.
> That file's "What's next" section is now DONE — read this one first.
>
> Worktree: `C:\Users\user\aevion-qskyway`. Root `CLAUDE.md` and `HANDOFF.md` in
> this worktree are stale/shared with other modules (smeta-trainer / CyberChess)
> — ignore them.

## Headline

The last big illustrative piece is gone. Airspace restrictions used to be
invented point+radius circles; two of the three cities are now governed by data
their actual regulator publishes, and the third says so honestly instead of
faking it.

| City | Regulator layer | Kind |
|---|---|---|
| NYC | **FAA UAS Facility Map** — 9 published cells, 99% twin coverage, ceilings 0–122 m, edition 7/9/2026 | ceiling grid (ingested, vector) |
| Tokyo | **MLIT / JCAB** — Densely Inhabited District, 100% of the twin | permission regime (raster-sampled) |
| Astana | none found | — |

**The number worth quoting:** in real FAA-published airspace, only **21 of 42**
Midtown vertiport pairs fly a corridor that stays within the published ceiling,
28% of grid cells sit under a 0 ft ceiling (no automatic authorization at all),
and pad vp0 is inside one — so strict mode refuses all 12 of its pairs. This is
measured from the regulator's own feed, not modelled.

## Open PRs (NOT merged — merging to main is the founder's call)

| PR | Contents | CI |
|---|---|---|
| **#930** | FAA ceilings: ingest, advisory verdict + strict routing mode, pad ceilings | **fully green** (Backend, Frontend, Payments Rail) |
| **#934** | everything after: freshness, attestation, OTS anchor, justification document, QRight bridge, RegulatorySourceChip, permission regimes, smoke/OpenAPI/i18n | see the CI trap below |

**Full local CI-equivalent on the final state (26.07):** pricing audit ✅, backend
build ✅, **frontend build ✅ (exit 0)**, i18n parity en/ru/kk ✅, smoke 112/112 ✅,
new vitest files 37/37 ✅. `npm test` as a whole exits 1, but only on
`devhub-integrations` and `paywallProvisionFlow` — neither touched by this
branch, both failing on *different* tests run to run (order/state dependence,
see memory `reference_paywall_test_state_leak`). Both pass when run alone.

**⚠️ CI trap — read before trusting #934's badges.** `ci.yml` only triggers on
PRs targeting `main`/`master`/`develop`. #934's base is #930's branch, so
**Backend and Frontend checks never ran on it** — only Vercel's, which are easy
to mistake for a passing CI. They start automatically once #930 merges and
GitHub retargets #934. Until then, run the CI steps by hand (all green as of
26.07): `npm run audit:projects-pricing`, backend `npm run build`, backend
`npm test` (1232 pass), **`node scripts/i18n-kk-extract.mjs` from the repo root**
(en/ru/kk parity — catches an EN key added without ru/kk siblings), frontend
`npm run build`. Memory: `feedback_stacked_pr_no_ci`.

## What exists now

**Ceilings (`qskyway.airspace.ts`)** — FAA UASFM ingested verbatim, regenerable
via `node scripts/fetch-faa-airspace.mjs nyc`. Advisory by default: routing is
unchanged and every route carries a verdict (exceeding segments, max exceedance,
lowest ceiling). Strict on request: `POST /route {respectCeiling:true}` makes it
a hard A* edge constraint and refuses with `reason:"airspace-ceiling"` plus what
an unrestricted flight would have needed.

**Freshness (`qskyway.airspace.freshness.ts`)** — the backend replays the
identical bbox query every 12h and reports whether the committed snapshot still
matches. Drift is **reported, never auto-applied** (auto-adopting would break
the attestation and skip human review of a rule change). Unchecked reports
`null`, never "fresh". The comparator is a pure exported function so the drift
branches are testable: `npm run smoke:airspace-freshness` (12/12).

**Attestation** — Ed25519 over the ceiling layer as well as the city twin;
`GET /verify` returns both. Signed payload is ASCII-only (ceilings, geometry,
edition — no localized prose), per the transport bug in #712.

**Bitcoin anchor** — `POST /airspace/anchor` submits the layer's contentHash to
OpenTimestamps (reuses `src/lib/opentimestamps/anchor.ts` from #699). Verify
reports two things *separately on purpose*: the proof anchors the hash, and that
hash still matches what we serve. They come apart legitimately after a reissue —
an old proof stays valid for its edition, which is a correct historical record.

**Permission regimes (`qskyway.permission.ts`)** — the second kind of published
rule, deliberately NOT merged into ceilings: a ceiling constrains route geometry
and belongs in the router, a permission regime constrains the operation and
belongs on the paperwork. `basis` records `ingested` vs `raster-sampled`, because
"the authority published a vector" and "we sampled the authority's map image"
are different strengths of claim. Regenerable: `node scripts/sample-did-permission.mjs tokyo`.

**Flight justification** — `POST /route/justification` returns ONE Ed25519-signed
document (twin hash + airspace hash + edition + ceiling verdict + permission
regime + wind source) for attaching to a filing, plus a verify endpoint that
reports content-tamper and signature failure separately. Reachable from the page,
not only the API. Signed as a whole, not part by part: it is the *combination*
being attested.

**QRight bridge** — `POST /airspace/register` puts the signed edition in the
platform registry, idempotent on content hash. DB unreachable → 503 with the
reason, never a success response for a write that did not happen.

**RegulatorySourceChip (platform)** — second trust axis beside
DataProvenanceChip: not "how was this NUMBER obtained" but "whose RULE is this"
(`official / illustrative / none`). A source claiming `official` without naming
an authority renders as illustrative; an official source always carries its scope
limit one hover away. /qskyway is the reference: ceilings green as FAA, point
zones amber as ours, side by side. **Adoption in Smeta / QContract / Constitution
is the obvious follow-up** — do it on a branch from main after the stack merges,
or the build fails Module-not-found.

## Verified (26.07)

- `npm run smoke:qskyway` — **112/112** (was 44 on 22.07); under `READ_ONLY=1` the
  two write legs self-skip and the summary says so explicitly rather than
  counting skips as passes. QSkyway is now in `smoke:all`, so the daily cron
  covers it.
- **37 tests that actually run in CI**, where the module had none. The smoke
  needs a live server, so the Backend check covered nothing here: a regression
  in the ceiling rasterizer, in the signed bytes, or in the
  prohibition/permission distinction would have shipped green.
  `tests/qskywayAirspace.test.ts` (22) covers the pure layer against the REAL
  committed data — rasterization, out-of-grid cells reporting "no constraint"
  rather than a zero ceiling, ASCII/order-independent hashing, drift detection
  including "a reissue is not drift", and that the shipped Bitcoin proof still
  matches the edition served. `tests/qskywayRoutes.test.ts` (15) mounts the real
  router with supertest — advisory vs strict, the 0 ft refusal with its reason,
  justification round-trip and tamper attribution, and the filing never telling a
  regulator a banned flight merely needs permission. Slot market and OTS anchor
  are left to the smoke on purpose: they need a database and the network.
  Every group was mutation-checked — disabling the strict gate, desyncing the
  proof, relabelling the prohibition and injecting prose into the signed payload
  each fail the expected tests.
- `/qskyway` added to `scripts/pages-live-smoke.js` — it had 96 API assertions
  and zero daily checks that the page opens.
- QSkyway documented in `/api/openapi.json` — it was absent entirely.
- Live click-tested: strict mode, refusal banner, justification build + verify
  (`✓ signature valid`), coverage banner, both chips, language switch to English.

## Not done / blocked

- **Success path of the QRight registry write** — Postgres listens on 5432 but
  the credential is commented out in `.env`; passwords are not guessed. The
  failure path is covered. Needs a working `DATABASE_URL` or prod.
- ~~Bitcoin confirmation of the anchor~~ — **DONE**: confirmed at block 959707,
  `fullyProven:true`. The confirmed proof now ships in
  `qskyway.airspace.proof.ts` and `GET /airspace/proof` verifies it with no
  arguments — a proof nobody keeps is a proof that does not exist.
- **Prod verification of everything above** — waits on the merge.

## Researched and closed (do not redo)

**Japan:** MLIT publishes no data downloads; `kokuarea` (airport airspace) 404s on
every documented GSI tile path and is absent from the official catalogue, so it
is an app-internal overlay; DIPS 2.0 is an application portal with no export.
`did2020` IS live and usable — that is what the permission layer uses.

**Kazakhstan:** no feed, but the eAIP publishes prohibited areas in ICAO
coordinates and **UAP28 covers 100% of the Astana twin** (4.5 km circle,
GND–4800 ft, H24). The earlier "nothing found" came from searching for an API
instead of for the rule — the single most useful correction of 26.07.

**Is NYC complete?** Yes, for these categories. The FAA's `Prohibited_Areas`,
`Special_Use_Airspace` and `Part_Time_National_Security_UAS_Flight_Restrictions`
services all return zero features over the Midtown twin. The query shape was
validated against a known positive (P-56 over Washington DC returns 1), so the
zero is a real absence rather than a broken request. The UASFM ceilings are the
applicable rule there.

**The technique worth reusing:** look for the normative document — an AIP, an
order, a published service — not for a developer-friendly feed. Coordinates are
usually published; they are just inside HTML or a map layer rather than JSON.
Details with URLs are in the header comment of `qskyway.airspace.ts`.

## Still illustrative (be honest about it)

The point no-fly zones in `qskyway.zones.ts` are ours, not a regulator's. The
chip says so. Wind aloft is still an extrapolation — only the ground reading is
real METAR.

## Known platform bug, still open

The translate-on-rerender concatenation bug from the 22.07 handoff is unfixed
(old + new text glued together in non-Russian locales after a client-side
re-render). It is why the trust-critical strings on this page were moved to i18n
keys rather than left to the runtime translator. Memory:
`bug_translation_concat_on_rerender.md`.

## Environment note

Frontend `next build` can take 40+ minutes when several worktrees build at once
(7 parallel `next build` processes observed on 26.07). If a build is killed
mid-run it leaves `.next/lock` and every later build fails with "Another next
build process is already running" — wait for the live pid, or remove `.next`
entirely; do not blind-delete the lock while a build still holds it. Run long
builds with `run_in_background`.

## Pre-merge checks (run 26.07, end of session)

Done so the merge decision rests on facts rather than hope:

- **Mount risk: none.** The diff touches zero mount points — `index.ts` and
  `moduleManifest.ts` are untouched, and qskyway already mounts via the
  append-only `EXTRA_MOUNTS` list in `moduleManifest.ts`. The squash-merge
  mount-drop that bit this repo five times cannot apply here.
- **No conflicts with main.** `main` moved 15 commits since the branch point and
  three shared files were edited in parallel (`i18n-data.ts` ×2,
  `all-smokes.js` ×1, `package.json` ×3). A dry-run merge auto-merged all three
  cleanly, with zero conflicted paths.
- **The merged result is sound, not just textually mergeable.** On the merged
  tree: i18n parity (en/ru/kk) ✅, backend `tsc` ✅, frontend `tsc` ✅ (run from
  `frontend/` — invoking it from the repo root picks up a different `tsc` binary
  that prints "This is not the tsc command you are looking for" and exits 0,
  which looks like a pass and checks nothing). On the branch itself a full
  `next build` is green too.

### After merging, verification is one command

```
READ_ONLY=1 BASE=https://api.aevion.app node scripts/qskyway-smoke.js
```

`READ_ONLY=1` skips the two write legs (slot booking, QRight registry) so a prod
run leaves nothing behind; everything else — ceilings, permission regime,
freshness, both signatures, the shipped Bitcoin proof, the justification
document — is read-only and gets checked. Expect the freshness verdict to read
`checked:false` for the first minute after a deploy: the timer restarts on every
boot, and this backend redeploys often.

---

## Дополнение 10.08.2026 — у бага склейки переводов найдена причина

Пункт «Known platform bug» выше говорил «likely mechanism: MutationObserver
races». Это оказалось неверно. Причина установлена и лежит в
`frontend/src/components/AutoTranslate.tsx`, ветка склеенной фразы (~строка 483).

1. JSX вида `candidate site · {n}` рендерится как СОСЕДНИЕ текстовые узлы
   (`"candidate site · "`, `"67"`). Переводить их по отдельности — получить
   гибриды, поэтому код склеивает их, пишет перевод целиком в **нулевой узел**,
   а остальные обнуляет. Комментарий там утверждает, что это безопасно, потому
   что идентичности узлов сохраняются. Инвариант выбран не тот: идентичность
   сохраняется, а соответствие «узел → значение, которое в нём считает React» —
   нет.
2. React перерисовывает и правит только изменившийся фрагмент — узел №1,
   который он по-прежнему помнит как `"67"` — в `"83"`. Нулевой узел остаётся
   со старым склеенным переводом.
3. Итог: `"candidate site · 67"` + `"83"` = `"candidate site · 6783"`. Именно
   эта арифметика совпадает с реально зафиксированной порчей — поэтому механизм
   считается установленным, а не просто правдоподобным.
4. Само не чинится: на `characterData` наблюдатель зовёт `walk(m.target)` —
   ТЕКСТОВЫЙ УЗЕЛ, а не его родителя, так что склейка никогда не пересчитывается.

**Форма починки (не применена):** хранить исходный текст каждого узла
(`WeakMap<Node, string>`), чтобы после правки одного фрагмента пересобрать ключ
склейки; узел, чей текущий текст отличается от того, что записал сам
переводчик, изменён Реактом — его текущий текст и есть новый исходник. Плюс на
`characterData` обходить РОДИТЕЛЬСКИЙ элемент, а не один узел. Убирать склейку
нельзя — она существует против гибридов вида «умный вызовs».

Почему стоит делать это отдельной задачей: `AutoTranslate.tsx` — 600 строк,
общий для всей платформы, и зона не qskyway. Но с 10.08.2026 фронтовые юнит-тесты
реально гоняются в CI, поэтому регрессионный тест на этот случай впервые
исполним — раньше он бы просто не запускался.

---

## Пред-мерж 10.08.2026 — пробный мерж в изолированном worktree

GitHub приостановлен с 27.07, поэтому `main` физически не двигался: `origin/main`
= `4d113031c` от 27.07.2026 и есть актуальная цель. Ветка на 59 коммитов вперёд,
main на 182 от точки ветвления. Мерж прогонял в отдельном worktree на detached
HEAD, свою ветку не трогал и `main` в неё не вливал (правило
`feedback_main_merge_via_pr_only`: параллельные сессии рвут локальный мерж).

**Конфликтов 4, все в файлах, которые правились сегодня.**

Два тривиальных — обе стороны дописали в одно место, решение «взять оба»:
- `package.json` — main добавил `test:qreal`, ветка `test`/`test:backend`/`test:frontend`;
- `.gitignore` — main добавил `benchmark-out/`, ветка `**/data/subscriptions.jsonl`.

Два содержательных, и оба показывают, что **main независимо нашёл то же самое**:

- **`.github/workflows/ci.yml`** — main уже добавил шаг «Frontend unit tests»
  (`npm run test -- --run`) с комментарием про те же 476 тестов, которые «gated
  exactly nothing». Моя правка это ДУБЛИРУЕТ. При мерже брать версию main —
  она равнозначна, а плодить второй способ незачем.

- **`aevion-globus-backend/src/routes/provisioning.ts`** — main тоже нашёл
  привязку пути на импорте и ту же порчу `buyer@test.aevion.dev` («Seventeen
  subscriptions later»). Но починил ПОЛОВИНУ: `subsFile()` считается на вызов,
  а внутри остался `join(process.cwd(), ...)`. Именно cwd-половина и клала
  записи в корневой `data/subscriptions.jsonl`, то есть в git. При мерже брать
  версию ветки — она надмножество: и на вызов, и от каталога пакета.

**Чего в main нет и что мерж действительно принесёт:** привязка пути к каталогу
пакета; корневые `npm test` / `scripts/run-all-tests.mjs` / `vitest.config.ts`
(в main корневой команды нет вовсе, и `npx vitest run` там так же проверяет не
то); `testTimeout` (в main прежние 10 с); пять гвардий
(`testsActuallyRun`, `subscriptionStorePath`, `ciStepsResolve`,
`compareClaimsMatchTwins`, `qskywayOpenapiCoverage`); правки формулировок и
цифр QSkyway; `/airspace/impact` в openapi.

**Вывод на будущее:** перед починкой ПЛАТФОРМЕННОЙ инфраструктуры смотреть, не
сделали ли это уже в main — здесь две сессии независимо потратились на один
дефект. Для правок внутри своего модуля это не нужно, для общих файлов нужно
всегда.

### Живая проверка контракта чипа (10.08.2026, вечер)

Поля, которые чип источника начал читать сегодня, проверены на РАБОТАЮЩЕМ
сервисе, а не только по коду. Бэкенд поднят на порту 4913, принадлежность
процесса подтверждена по командной строке (`Get-CimInstance Win32_Process`), а не
по факту ответа — см. ниже почему.

```
nyc  freshness: checked=true, added=0, removed=0, changed=0, upToDate=true,
                publishedEffective=8/6/2026, snapshotEffective=7/9/2026
astana permission: authority="Казаэронавигация / AIP KZ",
                effective="AIRAC 2026-05-14", sampled="2026-07-26"
tokyo  permission: authority="MLIT / JCAB",
                effective="2020 census", sampled="2026-07-26"
```

Оба новых поля отдаются живым API. Нью-Йорк даёт ровно тот случай, ради которого
сегодня добавлено третье состояние: потолки совпадают, а редакция разошлась —
чип скажет «регулятор переиздал карту (редакция 8/6/2026), числа не изменились»
вместо прежнего неверного «снимок совпадает с тем, что публикует регулятор».
Астана и Токио дают `sampled`, из которого чип берёт дату последней ручной
сверки вместо обещания автоматической.

**Грабля, стоившая ложной тревоги.** Первая попытка шла на порт 4077, и оттуда
пришло `upToDate=false, added=9, removed=9, changed=0` — то есть все девять ячеек
разом и добавлены, и удалены. Это выглядело как регрессия ключей ячеек FAA и как
ложное ⚠ на чипе доверия. На деле порт держал ЧУЖОЙ процесс (pid 117120, старт
18:55; мой — 19:16), то есть отвечал код другого worktree. Ровно случай из памяти
`feedback_backend_port_collision`, и уникальный порт от него не спасает — спасает
проверка PID слушателя. Вывод не был опубликован до проверки; на своём процессе
расхождения нет.
