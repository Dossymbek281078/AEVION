// Честность чата /qcoreai (решение Оркестратора 31.10.2026): подмена поставщика без предупреждения запрещена.
// Замер 31.10 (?c=probe-multichat): человек выбирал GPT, Gemini, DeepSeek или Grok — отвечал Claude, и экран
// писал только «Last response: Claude» внизу. Сервер выбирает следующего живого поставщика (resolveProvider) и
// возвращает в ответе `mode` — id того, кто ответил. Если он не совпал с выбранным — над ответом пометка.

export type ChatLang = "ru" | "en" | "kk";

const T: Record<ChatLang, { note: (used: string, wanted: string) => string; offline: string; notConfigured: string }> = {
  ru: {
    note: (used, wanted) => `Ответил ${used}: ${wanted} сейчас недоступна.`,
    offline: "Сейчас ИИ не отвечает: на сервере не настроен ни один поставщик моделей или все недоступны. Попробуйте позже или откройте модули платформы напрямую.",
    notConfigured: "Не подключены",
  },
  en: {
    note: (used, wanted) => `Answered by ${used}: ${wanted} is unavailable right now.`,
    offline: "I am currently offline. The AI engine needs an API key configured on the backend. Try again later or explore the platform modules directly.",
    notConfigured: "Not configured",
  },
  kk: {
    note: (used, wanted) => `${used} жауап берді: ${wanted} қазір қолжетімсіз.`,
    offline: "Қазір ЖИ жауап бермейді: серверде бірде-бір модель провайдері бапталмаған немесе бәрі қолжетімсіз. Кейінірек қайталаңыз немесе платформа модульдерін тікелей ашыңыз.",
    notConfigured: "Қосылмаған",
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
