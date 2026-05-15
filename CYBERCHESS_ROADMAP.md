# CyberChess — Master Roadmap

**Зона:** aevion-core/main · **Обновлено:** 2026-05-12 · **Статус:** post-MVP, beat lichess + chess.com

## Стратегическая цель

Обойти lichess.org и chess.com не только killer-фичами, а **системно**: лучшая механика ходов, лучшие задачи и анализ, лучший коуч, стрим-в-приложении, валюта Chessy, и **принципиально новая система рейтинга** (CPI).

---

## Фазы (F1-F8 + sub-tasks)

### F0 — Quick wins (✅ DONE 2026-05-12)
| Задача | Коммит | Время |
|---|---|---|
| Knight Riders FEN (7→6 коней) | `a6f8bde8` | 5 мин |
| Twin Kings royal-queen через capture-history | `40485a86` | 15 мин |
| Pawn Apocalypse castling off | `a6f8bde8` | 5 мин |
| Diceblade pass-button (был и так) | — | — |

### F1 — CPI spec + preview page (✅ DONE)
| Задача | Файл | Коммит |
|---|---|---|
| CYBERCHESS_CPI_SPEC.md формула | root | `572ebce1` |
| `/cyberchess/cpi` preview | `cpi/page.tsx` | `145fed47` |

### F2 — Stockfish multiPV integration (✅ DONE phase-1+2)
| Задача | Файл | Коммит |
|---|---|---|
| `stockfishMetrics.ts` MetricsCollector | `cyberchess/stockfishMetrics.ts` | `ff8e07db` |
| Game loop wire-up (heuristic CPL) | `page.tsx exec()` | `ff8e07db` |
| **Real multiPV=3 + recordMoveWithMultiPV** | `page.tsx` + `stockfishMetrics.ts` | `c49b10e4` |

### F3 — CPI engine (✅ DONE)
| Задача | Файл | Коммит |
|---|---|---|
| `cpi.ts` computeGameCPI() + weights + applyGameToCPI | `cyberchess/cpi.ts` | `ae6f2065` |

### F4 — CPI dashboard (✅ DONE + mobile-ready)
| Задача | Файл | Коммит |
|---|---|---|
| `/cyberchess/cpi/dashboard` SVG graphs | `cpi/dashboard/page.tsx` | `7d5a2aca` |
| Mobile responsive pass | same | `e465a80a` |

### F5 — Coach by CPI (✅ DONE)
| Задача | Файл | Коммит |
|---|---|---|
| Coach Knowledge weak-factor card | `CoachKnowledgeModal.tsx` | `521cf6d0` |

### F6 — WorkspacePiP (✅ DONE + UX polish)
| Задача | Файл | Коммит |
|---|---|---|
| Component (drag/resize/Twitch chat) | `WorkspacePiP.tsx` | `e6b46a5a` |
| Wire-up в page.tsx (📺 кнопка) | `page.tsx` | `604ce504` |
| Auto-restore + variant-day suggest | `page.tsx` | `c49b10e4` |

### F7 — Chessy economy hub (✅ DONE + mobile-ready)
| Задача | Файл | Коммит |
|---|---|---|
| `/cyberchess/economy` (auction+coach+streamer) | `economy/page.tsx` | `72e73892` |
| Mobile pass | same | `e465a80a` |

### F8 — CPI Leaderboard (✅ DONE frontend + cross-zone request pending)
| Задача | Файл | Коммит |
|---|---|---|
| `/cyberchess/cpi/leaderboard` mock | `cpi/leaderboard/page.tsx` | `79e85269` |
| Mobile pass | same | `e465a80a` |
| Backend API endpoint | `frontend-qcore` зона | **PENDING** (`703f9539` request) |

### Дополнительно (DONE)
- ✅ `/cyberchess/training` daily hub (`a07d2f7d`)
- ✅ OnboardingOverlay 3-step (`c5f29dc3`)
- ✅ Coach SR data layer (`184d3d84`)
- ✅ QPayNet billing wire (`a579d0b1`)
- ✅ Stockfish NNUE binary swap (`421d7261`)
- ✅ Tournament polish (`78538d94`)
- ✅ Sitemap +5 routes (`c54a78d5`)
- ✅ JSON-LD WebPage schema на 5 страниц (this commit)
- ✅ Coordination doc 5-min heartbeat (`f56b6062` + auto-script)

---

## Что осталось до production-ready

### Технический долг
1. **Stockfish Level 3** — миграция на `lila-stockfish-web` npm (latest Stockfish 17/18 NNUE + true Lichess infrastructure). 2-3 часа. Заменит наш ручной класс SF.
2. **CPI Leaderboard backend** (`/api/cyberchess/cpi/leaderboard`) — endpoint в `aevion-globus-backend/src/routes/cyberchess.ts`. Cross-zone (frontend-qcore). Request open.
3. **Postgres table** `cyberchess_cpi_state` для per-user CPI + factor history. Бэкенд-зона.
4. **WebAssembly headers** — проверить через DevTools что SharedArrayBuffer реально активен (COEP=credentialless в next.config.ts). Если нет — multi-thread не работает.
5. **E2E тесты** — Playwright для 12 вариантов (правила, win conditions, FENs).
6. **F2 phase-3** — Stockfish multiPV depth 25+ (сейчас depth 18 для recall). Точнее CPI, но медленнее. Toggle в settings.

### Дизайн/UX долг
7. **Tournament UI page** — `tournament.ts` имеет логику (bracket/leaderboard), но нет визуального `/cyberchess/tournament` маршрута. ~3 часа.
8. **Time-control selector в Setup screen** — сейчас Quick Game / Variants есть, но фактический TC иногда теряется.
9. **Mobile playboard** — сама доска на мобайле может быть тесной. Нужен dedicated mobile layout (CSS `aspect-ratio: 1`, touch handling). ~4-6 часов.
10. **Dark/Light theme toggle** — сейчас всё dark. Light mode желателен.

### Контент-долг
11. **Coach Knowledge: 93 → 150+ entries** — больше тем по эндшпилям, миттельшпилю, классическим партиям.
12. **Puzzle DB expansion**: сейчас 5818, цель 10000+ (script готов, нужен Lichess CSV download).
13. **Masters tab**: добавить ещё 50 классических партий с annotated PGN.

### Маркетинг/SEO
14. **OG images** для всех новых cyberchess sub-pages (нужны edge-rendered `opengraph-image.tsx`).
15. **Twitter card metadata** — расширить за пределы CPI spec.
16. **Sitemap auto-generation** из routes (сейчас manual).

---

## ETA до production-ready

**Темп:** ~18 commits/сессия, 1-2 сессии/день.

| Стадия | Что | Дней при таком темпе |
|---|---|---|
| MVP-ready (текущее состояние) | ✅ DONE | — |
| **Frontend-complete** | пп. 7, 9, 10, 11, 12, 13, 14 | ~5 дней |
| **Backend-complete** | пп. 1, 2, 3, 4 | ~3 дня |
| **Production-ready** | + пп. 5, 6, 8, 15, 16 | **~10 дней total** |

При ускорении (параллельные агенты, ~3-4 в день) — **~5-7 дней**.

---

## Killer differentiators vs lichess + chess.com (final score)

| Фича | lichess | chess.com | AEVION |
|---|---|---|---|
| Stockfish NNUE multi-thread | ✅ | ✅ | ✅ (loader готов, нужна верификация SAB) |
| Composite CPI rating (11 факторов) | ❌ | ❌ | ✅ |
| Points for losses if quality high | ❌ | ❌ | ✅ |
| Leaderboard ranked by ANY factor | ❌ | ❌ | ✅ |
| Coach auto-picks weak-zone drills | ❌ | partial | ✅ |
| AEV-native currency | ❌ | ❌ | ✅ |
| Auction / coach rental / streamer subs | ❌ | ❌ | ✅ |
| Picture-in-Picture stream over board | ❌ | ❌ | ✅ |
| Spaced-repetition Coach knowledge | ❌ | partial | ✅ |
| 12 chess variants (Knight Riders/Atomic/KotH/Twin Kings/Diceblade и т.д.) | partial | partial | ✅ |
| Game DNA / Game Insights cards | ❌ | partial | ✅ |
| Ghost Duel mode (vs past-self) | ❌ | ❌ | ✅ |
| Multiverse mode (parallel alt-history) | ❌ | ❌ | ✅ |

**9 уникальных killer-фичей** которых нет ни у lichess, ни у chess.com.

---

## Дальше после "Все варианты сразу"

После закрытия 6 вариантов из последнего блока, осталось:

1. **DevTools verification** of NNUE + thread count (юзер должен глянуть console на `/cyberchess`)
2. **Tournament UI page** (`/cyberchess/tournament`) — визуализировать готовую логику из `tournament.ts`
3. **Real backend CPI Leaderboard** — pending cross-zone request
4. **Stockfish Level 3** — миграция на lila-stockfish-web

См. также:
- `CYBERCHESS_CPI_SPEC.md` — полная формула рейтинга
- `CYBERCHESS_STOCKFISH_UPGRADE.md` — пути апгрейда движка L1/L2/L3
- `AEVION_COORDINATION.md` — кросс-зонные правила, BROADCAST #1-#5, WIP
