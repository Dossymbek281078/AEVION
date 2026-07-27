# Бесплатный флот AEVION: где взять ключи и что каждый даёт

Код бесплатных провайдеров написан и смёржен. Ключей нет — и поэтому он не работает.

**Факт на 27.07.2026** (живой запрос к `https://aevion.vercel.app/api-backend/api/qcoreai/providers`):
17 провайдеров, 13 помечены бесплатными, **настроены два** — `gemini` и `openrouter`.
Остальные одиннадцать ждут одной переменной окружения каждый.

Один ключ включает провайдера **везде сразу**: все умные поверхности планеты
(Constitution, HealthAI, Pricing, QRight, DevHub, сам QCoreAI) ходят через
`/api/qcoreai/smart`, а тот собирает участников из бесплатного флота. Правок кода не нужно.

## Что и где брать

Числа — из публикаций провайдеров и обзоров, сверенных 27.07.2026. Провайдеры меняют лимиты
без предупреждения, поэтому перед тем как строить на них нагрузку, смотрите свою консоль.

| Провайдер | Переменная | Карта | Что реально даёт | Где взять |
|---|---|---|---|---|
| **Cerebras** | `CEREBRAS_API_KEY` | не нужна | **1 000 000 токенов в сутки**, 30 запросов/мин, контекст на бесплатном ограничен 8 192 | cloud.cerebras.ai |
| **Groq** | `GROQ_API_KEY` | не нужна | 30 запросов/мин, 1 000–14 400 запросов в сутки (зависит от модели), лимит на организацию, а не на ключ | console.groq.com |
| **NVIDIA NIM** | `NVIDIA_API_KEY` | не нужна | 1 000 кредитов при регистрации (до 5 000 по запросу), ~40 запросов/мин (до 200 по запросу), 100+ моделей включая Nemotron, DeepSeek-R1, Qwen | build.nvidia.com |
| **GitHub Models** | `GITHUB_MODELS_TOKEN` | не нужна | суточные потолки на модель: у крупных ~10 запросов/мин и ~50 в сутки, у mini ~150 в сутки; 8k вход / 4k выход, 2 параллельных | github.com/marketplace/models (обычный PAT) |
| **Mistral** | `MISTRAL_API_KEY` | не нужна | бесплатный тариф Experiment: ~2 запроса/мин, ~1 млрд токенов в месяц; точные числа больше не публикуются, смотреть в консоли | console.mistral.ai |
| **Together** | `TOGETHER_API_KEY` | нужна для оплаты | ⚠️ **бесплатного тарифа фактически нет** — это $25–50 пробных кредитов; в каталоге есть модели с суффиксом `-Free`, но общий доступ упирается в кредиты | api.together.ai |

Порядок подключения по реальной ёмкости: **Cerebras → Groq → NVIDIA → GitHub → Mistral**.
Together подключать последним и не рассчитывать как на бесплатного: у нас он помечен `free: true`,
хотя по факту это триал. Это стоит поправить в каталоге отдельной правкой.

## Как включить (одна команда)

```bash
cd aevion-globus-backend
RAILWAY_TOKEN=<токен> ./scripts/set-provider-key-railway.sh nvidia nvapi-XXXX
```

Скрипт кладёт переменную в Railway, передеплоит сервис и **дожидается факта**: опрашивает живой
прод, пока `/api/qcoreai/providers` не покажет `configured: true` именно для этого провайдера.
2xx от Railway ничего не доказывает — переменная могла уехать не в тот проект (так уже было:
`OPENROUTER_API_KEY` лежит в проекте `nurturing-creativity`, а не в `aevion-production`), под мог
не перезапуститься, ключ мог быть неверным. Ключ в вывод не печатается.

После зелёного скрипт печатает команду для последней проверки — что провайдер **отвечает**,
а не просто числится в каталоге.

## Где проходит граница честности

- **Бесплатные тарифы — это прототип и демо, не прод-нагрузка.** Cerebras на миллионе токенов в
  сутки и Groq на 14 тысячах запросов выдержат витрину и демо; поток платящих клиентов — нет.
- **На денежном пути бесплатный провайдер не должен быть единственным.** В совете он участник
  толпы, а не председатель; при 429 авто-фолбэк уводит на следующую модель (это уже работает).
- **Прод-вариант NVIDIA другой:** NIM-контейнеры (софт бесплатный, платите за GPU) или
  AI Enterprise от $4 500 за GPU в год. «Бесплатные токены NVIDIA» на build.nvidia.com — это
  триальные кредиты, а не бесконечный источник.
- **Качество совета держит председатель.** Измерено 16 вопросами: Council L2 бьёт одиночный
  флагман в 92% раундов, но синтез делает платная модель. Бесплатный флот увеличивает
  разнообразие черновиков и снижает цену толпы, а не заменяет председателя.

## Источники

- [Groq free tier limits 2026 — TokenMix](https://tokenmix.ai/blog/groq-free-tier-limits-2026)
- [Is Groq Free? — costbench](https://costbench.com/software/llm-api-providers/groq/free-plan/)
- [Cerebras free tier 2026 — Get AI Perks](https://www.getaiperks.com/en/ai/cerebras-free-tier-guide)
- [Cerebras API key & rate limits — TokenMix](https://tokenmix.ai/blog/cerebras-api-key-rate-limits-free-tier-2026)
- [Mistral free tier — costbench](https://costbench.com/software/llm-api-providers/mistral-ai/free-plan/)
- [Prototyping with AI models — GitHub Docs](https://docs.github.com/github-models/prototyping-with-ai-models)
- [NVIDIA NIM API pricing, free tier & 40 RPM](https://decodethefuture.org/en/nvidia-nim-api-pricing-limits-guide/)
- [API credits for build.nvidia.com — NVIDIA Developer Forums](https://forums.developer.nvidia.com/t/api-credits-for-build-nvidia-com/306633/2)
- [Together AI pricing 2026 — eesel](https://www.eesel.ai/blog/together-ai-pricing)
