/**
 * Язык ответа агентов консилиума.
 *
 * ПОВОД (замер на проде 30.10.2026, сайт 4f71ad70f, бэк 04f65bbb7, /en, ?c=probe-multichat): на
 * английский вопрос двое агентов ответили по-английски, а третий — по-русски. Системная подсказка
 * говорила агенту только роль (`You are ${role}`), а роль приходит со страницы по-русски
 * («Аналитик…») — язык ответа оставался на усмотрение модели. Страница с 30.10 присылает lang
 * (dispatch), сервер по нему уже строит карту разногласий; теперь тот же lang называет агенту
 * язык ответа явно.
 *
 * Русский — по умолчанию (как было фактически): без lang и на неизвестном значении агенту
 * говорится отвечать по-русски. Казахский назван отдельно: на /kk роль тоже русская, и до этого
 * ответы на казахской странице шли по-русски.
 */
export type AnswerLang = "ru" | "en" | "kk";

export function answerLang(v: unknown): AnswerLang {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "en" || s.startsWith("en-")) return "en";
  if (s === "kk" || s === "kz" || s.startsWith("kk-")) return "kk";
  return "ru";
}

/** Фраза для системной подсказки агента — одно предложение, без точки в конце не оставлять. */
export function answerLanguageInstruction(v: unknown): string {
  switch (answerLang(v)) {
    case "en":
      return "Answer in English.";
    case "kk":
      return "Answer in Kazakh (жауапты қазақ тілінде бер).";
    default:
      return "Отвечай по-русски.";
  }
}
