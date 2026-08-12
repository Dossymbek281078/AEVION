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

**The number worth quoting** (замер 26.07, УСТАРЕЛ — см. раздел про 52% → 29% в конце файла): in real FAA-published airspace, only **21 of 42**
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

### Заметка для следующего браузерного захода (10.08.2026)

Попытка посмотреть чип живьём не удалась: страница `/qskyway?city=nyc` отдаёт
200 и рисуется, но за ~60 с после старта холодного dev-сервера данные города не
успели подгрузиться — карта пустая, телеметрия в нулях, чипа ещё нет.

Проверено по коду, чтобы не гоняться за призраком: **тихой деградации тут нет.**
Загрузка города обёрнута в try/catch, и при неудаче страница показывает явную
красную карточку «Не удалось загрузить город: …» (`_client.tsx`, ~строка 711).
Значит пустая карта БЕЗ этой карточки означает ровно «ещё грузится», а не
«сломалось»: NYC — 2976 зданий и сетка высот, на холодном Turbopack первый заход
долгий.

Что делать в следующий раз: подняться, дождаться появления телеметрии с
ненулевой дистанцией (это признак, что `setLoaded(true)` отработал), и только
потом искать чип. Порты проверять по PID слушателя — на 4077 сегодня отвечал
чужой worktree.

**Вторая попытка (тот же вечер), результат тот же — и это подсказка.** Прогрел
API до открытия страницы (`/api/qskyway/city?city=nyc` — 200 за 0.08 с напрямую
и 200 за 0.37 с через прокси фронта), дождался готовности фронта, открыл
страницу, подождал 10 с. Карта по-прежнему пустая, телеметрия в нулях — и при
этом красной карточки ошибки НЕТ.

Это сужает круг: сеть и прокси работают, значит либо запрос из клиента не
уходит вовсе, либо висит. Проверять дальше в тот заход не стал — две неудачные
попытки подряд, дальше это кроличья нора.

**Что здесь стоит проверить следующему заходу — и это может оказаться реальным
пробелом UX:** пока город грузится (или если запрос завис), страница выглядит
ТОЧНО так же, как сломанная — пустая карта и нули, без всякого индикатора.
Отличить «идёт загрузка» от «не работает» пользователь не может. Ошибку
страница показывает честно (`setErr` → красная карточка), а вот состояния
«гружусь» у неё нет. Гипотеза не доказана: я не установил, висит запрос или
просто долгий.

### 🔴 На проде прямо сейчас висит ложная тревога — эта ветка её снимает (10.08.2026)

Проверено на живом aevion.app, не на догадке. Чип потолков для Нью-Йорка
показывает **⚠** — маркер, который по коду ставится ровно при `upToDate === false`
(«живой фид расходится со снимком — данные требуют обновления»). Прод-API
подтверждает это данными:

```
GET https://aevion.app/api-backend/api/qskyway/city?city=nyc
airspace.freshness = {
  checked: true, cellsAdded: 9, cellsRemoved: 9, cellsChanged: 0,
  upToDate: false, publishedEffective: "8/6/2026", snapshotEffective: "7/9/2026"
}
```

Все девять ячеек одновременно «добавлены» и «удалены» при нуле изменённых — то
есть разошлись КЛЮЧИ ячеек, а не потолки. Никакого дрейфа нет, регенерировать
нечего, а пользователю на слое доверия показывают предупреждение.

На этой ветке того же самого нет: собственный процесс на своём порту (PID
сверен) дважды дал `upToDate: true, 0/0/0` при тех же `publishedEffective:
8/6/2026` и `snapshotEffective: 7/9/2026`. Чинят это коммиты `712163d40` (ключ
ячейки описывает ячейку, а не строку в базе публикатора) и `0238d90ea` (сверять
свежесть по геометрии). То есть мерж снимает с прода видимую ложную тревогу на
регуляторном чипе — а поверх ещё и заменяет неверную формулировку «снимок
совпадает с тем, что публикует регулятор» на честную про переиздание.

Побочно там же видно, что прод стоит на старом твине: `89.7% измерено` против
`96.7%` на ветке (Нью-Йорк перешёл на обмер города).

**И отдельно — прод жив и интерактивен.** Карта Астаны рисуется, маршрут
строится, переключение городов работает. Значит негидрация, которую я ловил
локально, — свойство моего dev-инстанса, а не продукта.

### Открытый пункт: рынок слотов и смоук-брони (10.08.2026, ПОПРАВЛЕНО 11.08)

Починено сегодня: `GET /slots` больше не выдаёт наши тестовые брони за глубину
рынка — рядом с `count` появились `liveCount` и `test` у каждой записи, и
панель показывает «N + M тестовых». Признак живёт на сервере
(`src/lib/slotOrigin.ts`), фронт ему верит.

**Не починено и требует решения основателя:** прод-смок продолжает бронировать
5–6 слотов каждый прогон и ничего не убирает. То есть таблица
`qskyway_slots` растёт линейно — на 10.08 там 34 записи, из них 33 тестовые.
Само по себе это не ломает ничего (лимит выборки 500, признак `test` их
отделяет), но через год записей будут тысячи.

Варианты, между которыми надо выбрать:

1. **Смок убирает за собой.** Нужен DELETE-эндпоинт для слота. Это самый
   прямой путь и самый неприятный: удаление записи в РЫНКЕ ПРАВ — операция,
   которой лучше не существовать вовсе, чем существовать «для тестов».
2. **Смок бронирует в отдельное пространство.** Например `?scope=smoke` или
   отдельная таблица; публичный список читает только рабочее. Ничего не
   удаляем, рост уходит в служебную область. Дороже по коду, безопаснее по сути.
3. **Оставить как есть и чистить руками раз в N месяцев.** Дёшево сейчас,
   возвращает задачу позже.

Фиксированный routeId для смока НЕ годится: он даст коллизию с бронями прошлых
прогонов, и смок перестанет проверять сам факт бронирования (это уже разобрано
в комментарии `scripts/qskyway-smoke.js:417`).

Моя рекомендация — вариант 2: он единственный не заводит операцию удаления в
реестре прав и не откладывает проблему.

### Найдено на проде, НЕ починено: поле `withFeed` считает не фиды (10.08.2026)

`GET /api/qskyway/cities` отдаёт:

```
airspaceCoverage: { withFeed: 3, withCeilings: 1, withPermissionRegime: 2, total: 3 }
города: astana (фид: нет), nyc (фид: FAA), tokyo (фид: нет)
```

Фид есть у ОДНОГО города. У двух других правило опубликовано документом (eAIP
Казахстана) и растровым слоем (MLIT) — что сам ответ честно поясняет в `note`, а
баннер на странице формулирует верно: «регуляторный слой: 3 из 3». Неверно
именно ПОЛЕ: `qskyway.ts:668` считает `AIRSPACE[id] || PERMISSION[id]`, то есть
любой регуляторный слой, а называется `withFeed`. Тот, кто читает API напрямую —
а мы этим модулем как раз зовём читать API — сделает вывод, что фид есть у всех
трёх.

**Форма починки:** ввести `withRegulatoryLayer` с текущим смыслом (3), а
`withFeed` оставить ровно про фиды (1) — и обновить чтение во фронте, где
баннер сейчас берёт `withFeed`. Оба поля отдавать вместе: они отвечают на разные
вопросы, и разница между ними — как раз то, чем модуль гордится («нет API» не
равно «нет правила»).

Сделано в том же окне: `withRegulatoryLayer` получил текущий смысл (3), а
`withFeed` теперь считает только настоящие фиды (1). Фронт читает новое поле с
откатом на старое, чтобы баннер не поехал, пока прод не выкачен. Тест в
`qskywayAirspace.test.ts` держит оба числа и то, что первое строго больше
второго. tsc обеих частей чист, файл теста 23/23.

### ⚠️ Главная цифра модуля падает после мержа — с 52% до 29%, и это правильно

Замерено 11.08.2026 на одном и том же запросе `/airspace/impact?city=nyc`:

| | прод (старый твин) | ветка |
|---|---|---|
| укладываются в потолок | **22 из 42** (52%) | **12 из 42** (29%) |
| проходят в строгом режиме | 30 | 20 |
| ячеек с нулевым потолком | 2520 из 8858 | 2520 из 8858 (те же) |
| площадок без автодопуска | 1 | 1 |

Сетка потолков и площадки идентичны — изменились ВЫСОТЫ ЗДАНИЙ. На проде
Нью-Йорк обмерен на 89.7%, на ветке на 96.7%: коммит «Нью-Йорк берёт высоты из
обмера города» заменил слепой дефолт у 205 зданий на измеренные значения. Здания
оказались выше, коридоры поднялись, и чаще не влезают в опубликованный потолок.

**То есть после мержа headline-цифра модуля почти вдвое хуже — и это ровно то,
чего мы добивались.** Прежние 52% держались на предположении, что две сотни
зданий ниже, чем они есть; маршрут, «уложившийся в потолок» над таким зданием,
уложился в него только на бумаге. Знать это до мержа важнее, чем красивое число:
если 29% где-то процитированы как достижение, цитату надо менять вместе с кодом.

Заодно: строка «Headline» в начале этого файла говорит «21 of 42» — она не
совпадает ни с продом (22), ни с веткой (12). Цифра зависит от версии твина и
потому в статическом тексте живёт плохо; ниже по файлу она уже приведена как
замер с датой, и опираться надо на него.

### Поправка 11.08.2026: «растёт вечно» — мой неверный вывод

Выше я написал, что прод-смок бронирует 5–6 слотов КАЖДЫЙ прогон, таблица растёт
линейно и через год там будут тысячи. **Это неверно, и вывел я это из чтения
скрипта, а не из замера.** Замер:

```
слоты на проде по датам: 2026-07-13 → 10, 2026-07-16 → 2, 2026-07-22 → 22
```

Все 34 записи — три дня в июле. После 22.07 не добавилось ничего. Причина:
дневной джоб `daily-smoke.yml` поднимает ЭФЕМЕРНЫЙ Postgres и бьёт в
`127.0.0.1:4001`, то есть прода не касается вовсе; прод-адрес передаётся руками
через `workflow_dispatch` с `BASE_URL`, и для прода есть отдельный безопасный
режим `smoke:read-only`. Значит в прод писали несколько раз вручную в июле.

**Что из этого следует для решения.** Роста нет — срочности нет, и три варианта
выше (DELETE-эндпоинт, отдельное пространство, ручная чистка) можно не выбирать
прямо сейчас. Достаточно правила: **против прода запускать только
`npm run smoke:read-only`**, пишущий вариант — против эфемерной базы, как это уже
делает дневной джоб.

Что остаётся верным без изменений: 33 записи из 34 действительно оставлены
смоком, и до сегодняшней правки страница выдавала их за глубину рынка. Пометка
и `liveCount` нужны независимо от того, растёт таблица или нет.

Урок для меня тот же, что я весь день применял к чужим утверждениям: «прочитал в
коде» — не замер. Проверять надо и собственные выводы, особенно те, что звучат
тревожно.

### Падение 52% → 29% проверено: высоты честные, не ошибка единиц

Прежде чем принимать неприятную цифру, проверил вход, от которого она зависит.
Распределение высот Нью-Йорка на ветке:

```
max=443 м · топ-10: 443, 427, 423, 395, 386, 378, 366, 325, 320, 317
p50=20 · p90=90 · p99=210
выше 300 м: 13 · выше 400 м: 3 · выше 500 м: 0
```

Сходится с реальностью: 443.2 — Эмпайр-стейт с антенной, 427 — One Vanderbilt,
365.8 — Bank of America Tower, 318.9 — Крайслер. Тринадцать зданий выше 300 м и
три выше 400 при нуле выше 500 — это и есть Мидтаун. Пересчёт из футов дал бы
максимум под 1450 и поднял бы ВСЮ шкалу, включая медиану.

Закреплено тестом в `qskywayCityTwin.test.ts` (три случая: верхушка в полосе
380–500, число сверхвысоких в диапазоне Мидтауна, медиана низкая — последнее
ловит именно сдвиг всей шкалы, который максимум может и не показать). Проверено
негативно: сузил полосу — тест краснеет.

Зачем это нужно: высоты — единственный вход, влияющий на КАЖДЫЙ маршрут, и
ошибка единиц при пересборке твина ничего не роняет. Она молча поднимает все
коридоры и превращает верные маршруты в «не влезающие в потолок» — то есть
выглядит ровно как сегодняшнее честное падение с 52% до 29%.

### Найдено 11.08.2026: движок летает по высоте, которой интерфейс не верит

Астана, здание с индексом 195: `h: 382`, источник `hs: 1` (заявлено в OSM, не
обмер). Модуль его уже помечает: `dataQuality.suspect = [{ i:195, h:382,
times:4.66, why:"towers over the city" }]` — то есть в 4.66 раза выше всей
остальной застройки твина. Следующее по высоте здание там — 88 м.

**Но максимум в СЕТКЕ высот, по которой строятся коридоры, тоже 382.** Значит
каждый маршрут над центром Астаны поднимается, чтобы разойтись со зданием,
которому мы сами на экране не верим. Самое высокое реальное здание Астаны —
Абу-Даби Плаза, 311 м; 382 в OSM выглядит завышением.

Это не «данные плохие» — это РАСХОЖДЕНИЕ ДВУХ НАШИХ ЖЕ ОТВЕТОВ: чип говорит
«высоте не верим», движок закладывается на неё. Что бы ни было правдой, две
части продукта обязаны отвечать одинаково.

Варианты:

1. **Исключить сомнительные высоты из сетки маршрутизации**, оставив их в
   карточке и в провенансе. Коридор считается по здравой высоте (счёт этажей или
   типичная для квартала), а человек по-прежнему видит, что источник спорный.
   Минус: мы начинаем принимать решение за источник — ровно то, чего модуль
   до сих пор избегал.
2. **Оставить как есть и сказать это вслух**: «маршрут учитывает высоту, которую
   мы считаем сомнительной» — прямо в блоке маршрута, а не только в провенансе
   зданий. Дёшево и честно, но полёты остаются завышенными.
3. **Разобрать конкретный случай**: проверить здание 195 по статье/обмеру
   (аудит `npm run audit:heights` это умеет) и либо подтвердить 382, либо
   зафиксировать поправку с обоснованием. Точечно и не создаёт правила.

Рекомендую 3, затем 2: сначала выяснить правду про конкретный объект, а общее
правило вводить, только если такие случаи окажутся частыми.

**Проверено попутно:** высоты Токио правдоподобны (max 241 при мэрии 243.4,
30 зданий выше 150 м, ни одного выше 250) — там расхождения нет.

### Замечание в OSM подготовлено (11.08.2026) — отправляет основатель

Модуль считает правильной починкой правку в самом источнике, а не у себя. Текст
замечания по `way/486561786` готов, с числами из прогона аудита, обоснованием
через счёт этажей и ссылкой на статью — на английском и на русском:

`C:\Users\user\OneDrive\Desktop\АЕВИОН\02-QSkyway\2026-08-11\osm-замечание-abu-dhabi-plaza.md`

Там же записано, что делать, если правку примут: пересобрать твин Астаны и
обновить разбор. Тест `qskywayHeightReview.test.ts` специально падает, когда
разбор описывает объект, которого в твине больше нет, — чтобы запись не пережила
починку и не стала враньём.

### Поправка: занижённые теги Токио на НАШИ маршруты не влияют

Аудит Токио 11.08.2026 нашёл шесть зданий, где тег OSM ниже опубликованного в
статье: мэрия Токио 133 м против 241.9, Docomo Yoyogi 153 против 240, Shinjuku
Park Tower 174 и 201 против 235, Yoyogi Seminar 72 против 134, Odakyu Southern
Tower 84 против 146.55. Занижение — опасная сторона: твин доверяет высоте, и
занижённое препятствие пролетается без запаса.

**Но в твине Токио этих значений нет.** Замер: самое высокое здание — 241 м с
источником `hs: 0`, то есть ОБМЕР (PLATEAU/городская съёмка), а не тег; 241 при
опубликованных 241.9 — это и есть мэрия. Распределение источников: 3504 обмерено,
161 заявлено, 116 догадка. Плохие теги перекрыты обмером ровно так, как написано в
шапке самого аудита: «where the city has an authority survey (NYC, Tokyo) a bad
tag is usually corrected downstream anyway».

Значит находка настоящая, но это дефект данных OSM, а не наших коридоров. Ценность
её в другом: она показывает, чего стоит Астана, где обмера НЕТ и тег несущий —
там единственная неразобранная сомнительная высота уже заведена в разбор.

Я эту разницу сначала не проверил и подал занижения как живую опасность. Правило
то же, что и весь день: прежде чем тревожиться, спросить, доходит ли найденное до
того, что реально считает продукт.

### Замер 12.08.2026: спорная высота до маршрутов НЕ доходит

Опасение из записи выше — «каждый маршрут над центром Астаны поднимается, чтобы
разойтись со зданием, которому мы сами не верим» — **замером не подтвердилось**.
Прогнал движком все пары площадок Астаны: **0 из 42 маршрутов** опираются на
башню с тегом 382 м. Причина простая и её видно в коде: шаг A* стоит
`1 + (alt - FLOOR)/90`, то есть высота оплачивается, а ячеек у башни всего шесть
(c 61–62, r 72–74) — обойти дешевле, чем перелететь.

Вывод из «максимум в сетке высот тоже 382» я сделал рассуждением, а не прогоном.
Максимум сетки говорит, что такая высота в данных ЕСТЬ, и ничего не говорит о
том, летает ли кто-нибудь над ней. Это ровно та же ошибка, что и с занижёнными
тегами Токио днём раньше: прежде чем тревожиться — проверить, доходит ли
находка до того, что продукт реально считает.

**Что сделано, чтобы вопрос больше не решался рассуждением:**

1. `GET /api/qskyway/height-dispute?city=` — движок сам считает по всем парам
   площадок: какие здания твин считает спорными, сколько маршрутов на них
   опирается, какова максимальная разница по крейсерской высоте. Кэшируется
   (данные компилтайм-детерминированные, как у `/airspace/impact`).
   Астана сейчас: `affectedPairs: 0`, и это видно на странице — чип «⚠ высота
   под вопросом» дополнен строкой «на маршруты не влияет (0 из 42)».
   Токио и Нью-Йорк отвечают `available:false`: все их спорные случаи — «тег
   спорит с собственным счётом этажей», и движок их уже переопределил.
2. `POST /route` отдаёт `heightDispute`, когда коридор ДЕЙСТВИТЕЛЬНО поднят
   спорной высотой: сколько участков, какая была бы крейсерская и длина по
   опубликованному числу. Считается теневым маршрутом по подставленным высотам —
   то есть учитывается и крюк, а не только эшелон.
3. То же поле входит в ПОДПИСАННОЕ обоснование рейса (`/route/justification`),
   всегда — `null` означает «проверено, расхождения нет», отсутствие поля
   означало бы «не проверяли». Для бумаги, которую понесут регулятору, это
   разные вещи.

Высота по-прежнему не переписывается и из маршрутизации не выбрасывается:
починка принадлежит OSM (замечание готово, отправляет основатель). Изменилось
одно — теперь названа цена расхождения, и названа она числом из прогона.

**Тест `qskywayHeightDispute.test.ts`.** Отдельно про его устройство: на живых
городах детектор молчит (маршрутов над башней нет), и молчащий детектор
неотличим от сломанного. Поэтому тест подставляет синтетический твин — коридор
шириной в одну ячейку, башня посередине, обойти негде — и проверяет, что
расхождение найдено, а с опубликованной высотой коридор ниже минимум на две
высотные полосы. Проверено негативно двумя мутациями: убрал подстановку высоты —
красный; перестал сопоставлять ячейку с самым высоким препятствием ребра —
красный.

### Замер 12.08.2026: «уверенность высоты 86%» там, где обмерено ноль зданий

Твин Астаны: **470 зданий, обмерено 0**. 230 — вывод (тег `height` OSM либо
`levels`×3.2 + парапет), **240 — слепой дефолт 12 м**. При этом телеметрия
рейса показывала «Увер. высоты (маршрут): 78–97%».

Ошибки в расчёте нет: показатель считает долю участков, чей худший источник —
`measured`, а открытая земля (высота 0) идёт как известная — там действительно
ничего не стоит. Но человек читает это рядом с чипом города «0% обмерено», и
две наши цифры спорят друг с другом. Ровно та же болезнь, что и со спорной
высотой: продукт отвечает по-разному в двух местах.

Починка — не подмена числа, а второе число рядом: `obstacleSegments` и
`measuredObstacleSegments` (участки, где под крылом ДЕЙСТВИТЕЛЬНО есть здание, и
сколько из них на городском обмере). В телеметрии стоит «(по зданиям 0%)»,
жёлтым при нуле; обе цифры входят в подписанное обоснование. Нью-Йорк проверен
обратным тестом: там обмер есть, и цифра по зданиям не ноль.

Замеры попутно (все — из прогона движка, не из рассуждения):
- маршруты Астаны задевают слепые высоты на **7% участков** (293 из 4504);
- средний страховочный запас за неуверенность — **1.6 м**;
- в сетке 11 040 ячеек: 9180 пустых, 0 обмеренных, 1219 выведенных, 641 слепая.

**Следующий шаг, если брать эту нить:** 240 слепых 12 м — не «нет данных», а
выдуманное число, одинаковое для сарая и для жилой башни. Честное улучшение,
не изобретающее правду: брать медиану по ТИПУ здания из тех домов ТОГО ЖЕ
города, где этажность известна (`building=house` → своя медиана, `apartments`
→ своя), и оставлять класс `guessed`, чтобы страховочный запас не уменьшался.
Требует пересборки твина через `fetch-city-twin.mjs` (тип здания в твин сейчас
не сохраняется — понадобится добавить поле).

### 🔴 Замер 12.08.2026: слепые 12 м — это не «неточность», а возможное препятствие НАД коридором

Новый отчёт: `node scripts/audit-guessed-heights.mjs astana` (только читает,
кэширует Overpass, ничего не меняет). Что он показал по Астане:

```
448 зданий в границах твина
  с тегом height                : 4
  без height, но со счётом этажей: 220
  без того и другого (слепые 12 м): 224

  тип            слепых  свидетельств  медиана типа  против 12 м  выше коридора 43 м
  yes              172        53          11.2 м       -0.8 м     3 из 53 (до 88 м)
  apartments        22        80          33.6 м      +21.6 м    30 из 80 (до 85 м)
  office             3        12          24   м      +12.0 м     4 из 12 (до 82 м)
  commercial         3        14          14.4 м       +2.4 м     4 из 14 (до 382 м)
```

Читается так. Над слепым зданием коридор идёт на **43 м**: дефолт 12 + просвет
15 + страховка за класс `guessed` 16. Для зданий типа `yes` (их большинство)
дефолт угадан почти точно — медиана 11.2 м. **А для 22 зданий с тегом
`apartments` он занижен на 21.6 м, и по собственному распределению города
каждое третье такое здание (30 из 80 известных) ВЫШЕ 43 метров, вплоть до 85 м.**

То есть это не «лишний крюк», а вероятное препятствие над трассой — та самая
опасная сторона, о которой предупреждает шапка аудита высот. Маршруты туда
заходят: замер того же дня — коридоры Астаны задевают слепые ячейки на 7%
участков (293 из 4504).

**Что делать (не сделано, требует пересборки твина):** для слепого здания брать
медиану по ЕГО ТИПУ из зданий того же города с известной этажностью — город
отвечает про себя сам, ничего не изобретается. Покрытие: 203 из 224 слепых
зданий (91%); оставшимся 21 город ответить нечем, там 12 м честнее подстановки.
Класс высоты обязан остаться `guessed`: медиана по типу — догадка получше, но
догадка, и страховочный просвет за неё платить надо.

Работы: сохранить тип здания в твин (`fetch-city-twin.mjs` его сейчас
выбрасывает), заменить дефолт на медиану по типу, пересобрать Астану, сверить
дельту по маршрутам. Ветку не начинал — блок не влезал в окно, а недоделанная
пересборка твина хуже, чем её отсутствие.

**Токио для сравнения (тот же отчёт, 12.08.2026).** В сырых тегах OSM Токио
слеп сильнее Астаны: 2210 зданий из ~2900 без height и без этажности, у типа
`yes` медиана 23.6 м против дефолта 12, у `hotel` — 49.6 м. Но **до коридоров
это не доходит**: в твине Токио обмерено 3504 здания (PLATEAU), угадано 116.
Слепой тег там перекрыт городским обмером, и цифры применимы только к тем 116.

Поэтому в отчёт добавлена последняя секция «а доходит ли это до коридоров»: он
сам читает `dataQuality` твина и говорит, несущий тег в этом городе или
декоративный. Без неё отчёт по Токио пугал бы зря — ровно так я ошибся 11.08 с
занижёнными тегами, подав их как живую опасность до проверки.

---

## Где всё стоит на конец 12.08.2026 (для следующей сессии)

Ветка `feat/qskyway-airspace-trust`, сборная — `feat/qskyway-airspace-trust-merged`,
обе в зеркале `OneDrive\AEVION-GIT-MIRROR`. Наружу за день не отправлялось ничего.

**Сделано за день, всё зелёное:** расхождение по спорной высоте (`heightDispute`
в маршруте и в подписанном обосновании, `GET /height-dispute` с замером по всем
парам), вторая цифра уверенности по зданиям (`obstacleSegments` /
`measuredObstacleSegments`), отчёт о слепых высотах
(`npm run audit:guessed-heights`), пять новых проверок смока и починка двух его
собственных дефектов.

**Прогоны на этот коммит:** бэкенд 1588+ тестов, набор qskyway 230, фронтенд
tsc + 18 тестов, смок модуля 123/123 против своего инстанса и 115/123 против
прода (разница — то, что не выкачено с 27.07, разбор в
`Desktop\АЕВИОН\02-QSkyway\2026-08-12\`).

**Открытые пункты, требующие человека:**
1. Мерж и выкатка — упирается в приостановку GitHub.
2. Замечание в OSM по Абу-Даби Плаза — текст готов с 11.08.
3. Решение по слепым высотам Астаны (22 дома `apartments`) — записка
   `Desktop\АЕВИОН\02-QSkyway\2026-08-12\решение-слепые-высоты-Астаны.md`.

**Практика запуска в этом worktree:** бэкенд поднимать на своём порту
(`PORT=4073 npx ts-node-dev --respawn --transpile-only src/index.ts`), стартует
около двух минут; гасить строго по владельцу порта, не по шаблону командной
строки — 12.08 широкий фильтр уронил серверы двух чужих worktree. Смок:
`BASE=http://127.0.0.1:4073 READ_ONLY=1 node scripts/qskyway-smoke.js`.

**Проверка утверждения из плана (12.08, чтобы записка основателю не стояла на
предположении).** «Тип здания выбрасывается при сборке» — так и есть:
`fetch-city-twin.mjs` кладёт в твин `{ h, hs, r, stated }`, а `el.tags.building`
никуда не попадает. Рядом уже есть параллельный массив `meta` (`{ id, name }`),
помеченный «diagnostics only — never emitted»: тип логичнее добавить туда же
или в саму запись здания, решать при работе. Ещё одна деталь для оценки: один
элемент OSM даёт СТОЛЬКО записей, сколько у него колец (`for (const r of
ringsOf(...))`), поэтому «зданий» в твине больше, чем элементов в ответе
Overpass — 470 против 448 по Астане.

### Сделано в тот же день: слепые высоты Астаны получили процентиль своего типа

Решение принято и исполнено 12.08.2026 — техническое улучшение внутри модуля,
согласования не требовало.

Правило в `fetch-city-twin.mjs` (перед растеризацией, после всех источников
обмера): слепой высоте подставляется **75-й процентиль высот того же типа среди
домов того же города**, при 3+ известных высотах. Три решения, каждое по замеру:

1. **Не медиана.** При медиане (34 м у `apartments`) выше получившегося коридора
   остаются 16 из 80 известных домов этого типа — половина опасности. При p75
   (59 м) не остаётся ни одного. Занижение дороже завышения.
2. **Тип `yes` пропускается** (и `construction`, `roof`): он о высоте не говорит
   ничего, медиана 11 м при p75 27 — распределение смешанное, подстановка подняла
   бы 172 дома на 15 м без основания.
3. **Никогда ниже прежних 12 м** — у угаданного здания уменьшать запас не за что.
   Итог: 38 зданий подняты, 0 опущено, максимальный сдвиг 47 м.

Класс остаётся `guessed` со всеми 16 м страховочного просвета.

**Эффект на маршруты** (все 42 пары, твин до/после): 4 пары выше, максимум
+50 м, 38 без изменений, ни одной ниже, длина не изменилась вовсе. Средняя
крейсерская 67.3 → 70.8 м.

Твин пересобран, вместе с этим приехал дрейф OSM: 475 зданий вместо 470 и 21
ячейка, где в твине пусто, а в OSM здание есть. Эффекты разделяются флагом
`--no-type-median`: дрейф сам по себе даёт 49 изменённых ячеек, подстановка —
ещё 152.

**Что поймали сторожа** (лучшая часть работы): разбор Абу-Даби Плаза съехал по
индексу 195 → 194; профиль слепоты изменился 470/240 → 475/237; страж `/compare`
заметил, что витрина обещает 7227 зданий вместо 7232. Последний заодно требовал
формы «зданий» и падал на грамматически ВЕРНОМ «7232 здания» — регулярка
исправлена: проверка числа не должна диктовать грамматику.

### Проверено 12.08: наша ветка совместима со сборной веткой дня

Другая сессия собирает `integration/merge-check-2026-08-12`, и **нашей работы
там нет** — при мерже её надо включить отдельно. Совместимость проверил, не
трогая чужую сборку: во временной ветке от неё смержил
`feat/qskyway-airspace-trust-merged`.

- Конфликтов в коде модулей НЕТ. Конфликтуют четыре общих файла, и все —
  «обе стороны дописали своё в одно место»: `package.json` (скрипты),
  `aevion-globus-backend/vitest.config.ts` и `frontend/vitest.config.ts`
  (таймауты; обе стороны поднимают их по одной и той же причине),
  `.gitignore`. Разрешаются объединением обеих сторон.
- После объединения: **1726 тестов зелёные** (одно падение — известный флак
  `devhub-integrations`, в изоляции файл даёт 191/191), живой смок модуля
  **123/123** против поднятого инстанса, уже на пересобранном твине Астаны.

То есть порядок мержа значения не имеет, но включить надо обе ветки.
Временная ветка проверки — `tmp/qskyway-compat-2026-08-12`, локальная, никуда
не отправлялась; удалить можно в любой момент (сам не удаляю — правило про
ветки).

### Состояние на конец 12.08.2026 — итог дня

Ветка `feat/qskyway-airspace-trust` (сборная `...-merged`), обе в зеркале.
Наружу за день не отправлено ничего.

**Что изменилось в данных:** твин Астаны пересобран дважды (второй раз — ради
`osm` в спорных высотах). Итог: 475 зданий, обмерено 0, выведено 238, угадано
237, из них 38 получили 75-й процентиль своего типа, 199 остались на слепых 12 м.
Спорная высота одна — `way/486561786`, 382 м при 310.8 в статье, индекс 194.

**Проверено после пересборки, а не до:** `/height-dispute` по Астане
по-прежнему `affectedPairs: 0` — то есть строка на странице «на маршруты не
влияет (0 из 42)» осталась правдой; живой смок 123/123; полный набор бэкенда
1601 зелёный; набор qskyway 243.

**Единственный непроверенный твин — Токио.** Сравнение требует ~420 МБ PLATEAU,
кэша на диске нет, а `aevion-commit-check.ps1` дважды за окно ответил «подожди»
(три чужие сборки, свободно меньше нужного). Команда для следующего захода —
в шапке `fetch-city-twin.mjs`, с `--plateau-cache`: первый прогон заплатит
один раз, дальше бесплатно. Риск умеренный: Токио пересобирали 27.07, дрейф
за две недели, а не за месяц, как было у Астаны (там накопилось 21 невидимое
препятствие).

**Ещё не сделано и требует человека:** мерж с выкаткой (плюс включить сборную
ветку дня — совместимость проверена), замечание в OSM по Абу-Даби Плаза,
перезапуск бэкендов в `aevion-multiagent` и `aevion-qbuild-lighten`.

**Про красный полный прогон на этой ветке (12.08, вечер).** Один тест
(`qtradeInternalCredit`) падает В ПОЛНОМ прогоне и проходит 5/5 в одиночку.
Это не наша регрессия и не «просто флак»: qtrade мы сегодня не трогали вовсе,
а причина названа — в этой ветке лежит ИСХОДНЫЙ `src/lib/jsonFileStore.ts`
(последняя правка — базовый коммит платформы). Обе починки хранилища —
гонка при параллельной записи и подметание брошенных temp-файлов — сделаны
10–11.08 другой сессией и лежат в `feat/multichat-agent-council`, то есть
приедут вместе с мержем сборной ветки дня. Проверка: `git merge-base
--is-ancestor f07649038 HEAD` на нашей ветке отвечает «нет».

### Токио проверен (12.08, поздно вечером) — пересобирать не нужно

Последний непроверенный твин закрыт: `node scripts/fetch-city-twin.mjs tokyo
--compare --plateau-cache .aevion-data/plateau-cache`.

```
buildings           3781 vs 3781
measured heights    3504 (92.7%) vs 3504 (92.7%)
cells differing     2 of 5688 (0%)
⚠ twin EMPTY, OSM built   0   ← невидимых препятствий нет
```

Итог по всем трём городам: **дрейфила только Астана** (21 ячейка, где в твине
пусто, а в OSM здание — накопилось с 13 июля) и она пересобрана. Нью-Йорк и
Токио чисты, трогать их незачем.

Кэш PLATEAU (~420 МБ) теперь лежит в `.aevion-data/plateau-cache` и закрыт
gitignore'ом (`aevion-globus-backend/.gitignore:6` — проверено `git check-ignore`),
так что следующая проверка Токио бесплатна.

**Попутно найден и починен дефект самого флага:** `--plateau-cache` не создавал
свой каталог, поэтому первый прогон скачивал все четыре архива CityGML и падал
на первой же записи с ENOENT. Флаг «ускорить повторные прогоны» не ускорял ни
одного — он работал только на каталоге, наполненном кем-то другим. Нашлось
потому, что команду с этим флагом я за два часа до того записал в шапку скрипта
как рабочую и впервые выполнил.

**Полный фронтенд тоже прогнан (12.08, в конце):** 45 файлов, 503 теста, все
зелёные. До этого по фронтенду я гонял только `src/app/qskyway` — то есть
проверял свою правку, а не её последствия для соседей.
