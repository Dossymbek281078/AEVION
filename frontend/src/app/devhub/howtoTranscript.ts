/**
 * Расшифровка обучающего видео — та же речь словами.
 *
 * ЗАЧЕМ. Озвучка и вшитые субтитры русские, английской версии ролика нет. Для
 * посетителя с Show HN двухминутное видео на чужом языке бесполезно, а
 * подписи «озвучка русская» честно, но не помогает. Расшифровка делает ту же
 * пользу доступной без звука и без знания языка — и заодно закрывает
 * требование текстовой альтернативы к видео.
 *
 * ОТКУДА ТЕКСТ. Строки взяты из манифеста сценария ролика (поле vo_line), а не
 * пересказаны: расшифровка обязана совпадать с тем, что человек услышит, иначе
 * это уже не расшифровка. Английский — перевод тех же двенадцати строк.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ СЛОВАРЬ ВИТРИНЫ. Двенадцать длинных строк на два
 * языка утопили бы i18n.ts, который читают ради коротких подписей. Здесь же
 * рядом лежит источник и оговорка о происхождении.
 *
 * КАЗАХСКИЙ. Не заведён намеренно: машинный перевод двенадцати абзацев без
 * носителя языка хуже честного английского, а весь модуль и так падает на
 * английский при незнакомом языке.
 */
export const HOWTO_TRANSCRIPT: Record<string, string[]> = {
  ru: [
    "Большинство получает от ИИ мусор. Не потому что модель слабая — просто задачу ей ставят одной строкой, без контекста и цели.",
    "Все меняют модель и ждут чуда. Хотя разница между слабым и сильным ответом почти всегда сидит в самой постановке вопроса.",
    "Приём первый: давайте контекст, а не команду. Назовите роль, цель, данные и формат — ответ станет точнее в разы.",
    "Приём второй: сперва просите план. Сверьте шаги, уберите лишнее — и лишь потом пусть ИИ делает всё сам.",
    "Приём третий: проверяйте ответ делом. Запустите код и откройте источник сами — на слово модели не верьте никогда.",
    "Приём четвёртый: модель — под задачу. Рутину дайте быстрой, сложное — сильной, а разные шаги не ждут друг друга.",
    "Ещё сильнее — спросить несколько моделей разом. В мультичате АЕВИОН вопрос уходит сразу всем, а вы сравниваете ответы рядом.",
    "Для целого продукта есть ДевХаб. Скажите словами, что нужно, — агент сам всё спланирует, соберёт и покажет результат.",
    "Дайте ИИ руки — это MCP-серверы. Их сотни на Гитхабе: файлы, код, базы, почта — и это не всё.",
    "Запишите правила проекта в файл памяти, и каждый новый диалог стартует с вашим контекстом, а промпты работают снова.",
    "Теперь главное: сильная модель умножает и небрежность. Чем мощнее инструмент, тем дороже ошибка — растёт не только польза.",
    "Контекст, план, проверка и свои инструменты — вот вся система. Большинство кормит ИИ мусором, а вы теперь — нет.",
  ],
  en: [
    "Most people get junk out of AI. Not because the model is weak — the task is given in one line, with no context and no goal.",
    "Everyone switches models and waits for a miracle, while the gap between a weak and a strong answer almost always sits in how the question was put.",
    "Habit one: give context, not a command. Name the role, the goal, the data and the format — the answer gets several times more precise.",
    "Habit two: ask for a plan first. Check the steps, drop the extra ones — and only then let the AI do the work.",
    "Habit three: verify the answer by doing. Run the code and open the source yourself — never take the model's word for it.",
    "Habit four: match the model to the task. Give routine work to a fast one and hard work to a strong one; separate steps need not wait for each other.",
    "Stronger still: ask several models at once. In AEVION multichat the question goes to all of them and you compare the answers side by side.",
    "For a whole product there is DevHub. Say what you need in words — the agent plans it, builds it and shows you the result.",
    "Give the AI hands — that is what MCP servers are. There are hundreds on GitHub: files, code, databases, mail, and more.",
    "Write your project's rules into a memory file, and every new conversation starts with your context, so your prompts work again.",
    "And the main thing: a strong model multiplies carelessness too. The more powerful the tool, the more an error costs — it is not only the upside that grows.",
    "Context, a plan, verification and your own tools — that is the whole system. Most people feed AI junk. You no longer do.",
  ],
};

/** Строки на языке читателя; незнакомый язык получает английский. */
export function howtoTranscript(lang: string): string[] {
  return HOWTO_TRANSCRIPT[lang] ?? HOWTO_TRANSCRIPT.en;
}
