// Честность чата /qcoreai (решение Оркестратора 31.10.2026): подмена поставщика без предупреждения запрещена.
// Замер 31.10 (?c=probe-multichat): человек выбирал GPT, Gemini, DeepSeek или Grok — отвечал Claude, и экран
// писал только «Last response: Claude» внизу. Сервер выбирает следующего живого поставщика (resolveProvider) и
// возвращает в ответе `mode` — id того, кто ответил. Если он не совпал с выбранным — над ответом пометка.

export type ChatLang = "ru" | "en" | "kk";

type Cap = { t: string; d: string };
type Txt = {
  note: (used: string, wanted: string) => string;
  offline: string;
  notConfigured: string;
  subtitle: string;
  selectProvider: string;
  askLabel: string;
  askPlaceholder: string;
  capsTitle: string;
  caps: [Cap, Cap, Cap, Cap];
};

const T: Record<ChatLang, Txt> = {
  ru: {
    note: (used, wanted) => `Ответил ${used}: ${wanted} сейчас недоступна.`,
    offline: "Сейчас ИИ не отвечает: на сервере не настроен ни один поставщик моделей или все недоступны. Попробуйте позже или откройте модули платформы напрямую.",
    notConfigured: "Не подключены",
    subtitle: "Мультимодельный ИИ-помощник экосистемы AEVION",
    selectProvider: "Выберите модель",
    askLabel: "Вопрос QCoreAI",
    askPlaceholder: "Спросите QCoreAI о чём угодно…",
    capsTitle: "Возможности QCoreAI",
    caps: [
      { t: "Несколько моделей", d: "Claude, GPT, Gemini и открытые модели — по подключённым поставщикам; если выбранная недоступна, ответит другая, с пометкой" },
      { t: "Знает контекст", d: "Учитывает ваши записи QRight, Trust Score и историю" },
      { t: "В реальном времени", d: "Ответ приходит по мере написания" },
      { t: "Многоязычность", d: "Русский, казахский, английский и ещё 50+ языков" },
    ],
  },
  en: {
    note: (used, wanted) => `Answered by ${used}: ${wanted} is unavailable right now.`,
    offline: "I am currently offline. The AI engine needs an API key configured on the backend. Try again later or explore the platform modules directly.",
    notConfigured: "Not configured",
    subtitle: "Multi-model AI assistant for the AEVION ecosystem",
    selectProvider: "Select Provider",
    askLabel: "Ask QCoreAI",
    askPlaceholder: "Ask QCoreAI anything...",
    capsTitle: "QCoreAI capabilities",
    caps: [
      { t: "Multi-model", d: "Claude, GPT, Gemini and open models, depending on connected providers; if your pick is down, another answers and says so" },
      { t: "Context-aware", d: "Knows your QRight records, Trust Score, history" },
      { t: "Real-time", d: "The answer streams in as it is written" },
      { t: "Multilingual", d: "English, Russian, Kazakh, and 50+ languages" },
    ],
  },
  kk: {
    note: (used, wanted) => `${used} жауап берді: ${wanted} қазір қолжетімсіз.`,
    offline: "Қазір ЖИ жауап бермейді: серверде бірде-бір модель провайдері бапталмаған немесе бәрі қолжетімсіз. Кейінірек қайталаңыз немесе платформа модульдерін тікелей ашыңыз.",
    notConfigured: "Қосылмаған",
    subtitle: "AEVION экожүйесінің көпмодельді ЖИ-көмекшісі",
    selectProvider: "Модельді таңдаңыз",
    askLabel: "QCoreAI-ға сұрақ",
    askPlaceholder: "QCoreAI-дан кез келген нәрсені сұраңыз…",
    capsTitle: "QCoreAI мүмкіндіктері",
    caps: [
      { t: "Бірнеше модель", d: "Claude, GPT, Gemini және ашық модельдер — қосылған провайдерлер бойынша; таңдалғаны қолжетімсіз болса, басқасы жауап береді, белгімен" },
      { t: "Контексті біледі", d: "QRight жазбаларыңызды, Trust Score және тарихты ескереді" },
      { t: "Нақты уақытта", d: "Жауап жазылған сайын келеді" },
      { t: "Көптілділік", d: "Қазақша, орысша, ағылшынша және 50+ тіл" },
    ],
  },
};

export function chatLang(lang: string | undefined): ChatLang {
  return lang === "ru" || lang === "kk" ? lang : "en";
}

export function chatText(lang: string | undefined) {
  return T[chatLang(lang)];
}

/**
 * Пометка над ответом, если ответил не тот поставщик, которого выбрал человек.
 * requested — id выбранного; usedId — `mode` из ответа сервера; usedName — `provider` из ответа.
 * Без выбора (пусто) или при совпадении — null: подмены не было.
 */
export function пометкаПодмены(
  requested: string | undefined,
  usedId: string | undefined,
  usedName: string | undefined,
  providers: Array<{ id: string; name: string }>,
  lang: string | undefined,
): string | null {
  if (!requested || !usedId || requested === usedId) return null;
  const wanted = providers.find((p) => p.id === requested)?.name ?? requested;
  const used = usedName || providers.find((p) => p.id === usedId)?.name || usedId;
  return chatText(lang).note(used, wanted);
}
