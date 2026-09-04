"use client";

/**
 * Словарь витрины DevHub.
 *
 * ЯЗЫК берётся из общего механизма сайта (`useI18n` в lib/i18n.tsx) — того же,
 * которым управляет переключатель в шапке. Своего ключа хранения здесь нет
 * НАМЕРЕННО: 21.08.2026 выяснилось, что у шахмат он был свой, и переключатель в
 * шапке на их панели не действовал вовсе. Второй способ хранить одно и то же —
 * это два состояния, которые рано или поздно разойдутся.
 *
 * СТРОКИ лежат локально, а не в `lib/i18n-data.ts`: тот файл на 23 тысячи строк
 * правят десять сессий разом, и добавление тридцати ключей туда — гарантированный
 * конфликт. Механизм языка при этом общий, расходиться нечему.
 *
 * ЯЗЫКОВ у сайта одиннадцать, здесь три. Остальные восемь получают английский —
 * тот же текст, что был на странице до сегодняшнего дня, то есть хуже не стало
 * никому.
 *
 * ⚠️ Казахский написан без носителя языка. Он лучше английского для казахского
 * читателя, но перед запуском 13.09 его стоит вычитать.
 */
import { useCallback } from "react";
import { useI18n } from "@/lib/i18n";

type Key = keyof typeof EN;

const EN = {
  "pro.perks": "50 AI videos · 200 images · unlimited deploys · public *.pages.dev URL · team collaborators",
  "ve.body": "Open any Static project, click an element in the live preview, and edit its text, color, size and alignment in place — or describe a change and let AI apply it. Every AI change is checkpointed with one-click undo. Click an image to generate a replacement from a prompt.",
  "dep.title": "🌐 Deploy → a live public address in one click",
  "dep.body": "One click deploys a Static project to Cloudflare's edge and provisions a real subdomain. A deploy is only marked live after the backend has actually opened the page and got a 2xx — no fake green statuses.",
  "modal.title": "New Project",
  "modal.phName": "My awesome app",
  "modal.phDesc": "Short description of the project",
  "caps.configured": "Configured on the server",
  "caps.off": " · temporarily unavailable: ",
  "caps.note": "Configured means the key is in place — not that we re-checked the provider just now. Hover a name to see why it is off.",
  "hero.sub": "Build and deploy apps with AI. No GitHub or cloud accounts needed.",
  "hero.ideaAria": "Describe what to build",
  "project.new": "+ New Project",
  "pro.title": "Studio Pro — unlock the full IDE",
  "pro.plans": "See all plans →",
  "ve.title": "🖱️ New: Visual Edit — click the page, not the code",
  "ve.where": "In the IDE → 🖱️ Visual Edit tab",
  "dep.where": "In the IDE → Deploy",
  "proj.loading": "Loading projects...",
  "proj.empty": "No projects yet",
  "proj.emptyHint": "Create your first project and let AI build it for you.",
  "proj.stale": "Files were edited after the last deploy — the live page is behind. Open the IDE and deploy to update it.",
  "proj.confirmDelete": "Delete this project and all its files?",
  "snip.title": "Snippet shelf",
  "snip.sub": "Last 5 publicly shared snippets. Copy, star, or share your own.",
  "snip.loading": "Loading snippets…",
  "snip.empty": "No snippets yet. Be the first to share one below.",
  "snip.share": "Share a snippet",
  "snip.shareBtn": "Share snippet",
  "snip.sharing": "Sharing…",
  "snip.remove": "Remove",
  "snip.removeAria": "remove this snippet from the public shelf",
  "snip.phTitle": "Title",
  "snip.phLang": "Language (e.g. javascript)",
  "snip.phCode": "// paste your snippet here",
  "snip.codeAria": "Snippet code",
  "snip.copyAria": "Copy snippet",
  "snip.starAria": "Star snippet",
  "snip.phTags": "tags, comma, separated",
  "snip.starErr": "Could not star snippet",
  "snip.removeErr": "Could not remove the snippet — it is still published",
  "snip.refresh": "Refresh",
  "err.create": "Failed to create project",
} as const;

const RU: Record<Key, string> = {
  "pro.perks": "50 видео с ИИ · 200 картинок · выкатки без ограничений · публичный адрес *.pages.dev · соавторы",
  "ve.body": "Откройте любой статический проект, щёлкните элемент в живом превью и меняйте текст, цвет, размер и выравнивание прямо там — или опишите правку словами, и ИИ применит её. Каждая правка ИИ сохраняется точкой возврата в один клик. Щёлкните картинку, чтобы сгенерировать замену по описанию.",
  "dep.title": "🌐 Выкатка → живой публичный адрес за один клик",
  "dep.body": "Один клик выкладывает статический проект на край сети Cloudflare и выдаёт настоящий поддомен. Выкатка помечается живой только после того, как сервер сам открыл страницу и получил 2xx — зелёных статусов «на веру» здесь нет.",
  "modal.title": "Новый проект",
  "modal.phName": "Моё приложение",
  "modal.phDesc": "Коротко о проекте",
  "caps.configured": "Настроено на сервере",
  "caps.off": " · временно недоступно: ",
  "caps.note": "«Настроено» значит, что ключ на месте, — а не что мы прямо сейчас переспросили поставщика. Наведите на название, чтобы увидеть причину.",
  "hero.sub": "Собирайте и публикуйте приложения с ИИ. Без GitHub и облачных аккаунтов.",
  "hero.ideaAria": "Опишите, что построить",
  "project.new": "+ Новый проект",
  "pro.title": "Studio Pro — полная среда разработки",
  "pro.plans": "Все тарифы →",
  "ve.title": "🖱️ Новое: правка кликом — по странице, а не по коду",
  "ve.where": "В среде → вкладка 🖱️ Правка кликом",
  "dep.where": "В среде → Выкатка",
  "proj.loading": "Загружаем проекты…",
  "proj.empty": "Проектов пока нет",
  "proj.emptyHint": "Создайте первый — ИИ соберёт его за вас.",
  "proj.stale": "Файлы изменены после последней выкатки — на живой странице старая версия. Откройте среду и выкатите заново.",
  "proj.confirmDelete": "Удалить проект и все его файлы?",
  "snip.title": "Полка сниппетов",
  "snip.sub": "Последние 5 публичных сниппетов. Копируйте, ставьте звезду или поделитесь своим.",
  "snip.loading": "Загружаем сниппеты…",
  "snip.empty": "Сниппетов пока нет. Поделитесь первым.",
  "snip.share": "Поделиться сниппетом",
  "snip.shareBtn": "Опубликовать",
  "snip.sharing": "Публикуем…",
  "snip.remove": "Снять",
  "snip.removeAria": "снять сниппет с публичной полки",
  "snip.phTitle": "Название",
  "snip.phLang": "Язык (например, javascript)",
  "snip.phCode": "// вставьте сниппет сюда",
  "snip.codeAria": "Код сниппета",
  "snip.copyAria": "Скопировать сниппет",
  "snip.starAria": "В избранное",
  "snip.phTags": "метки, через, запятую",
  "snip.starErr": "Не удалось поставить звезду",
  "snip.removeErr": "Не удалось снять сниппет — он всё ещё опубликован",
  "snip.refresh": "Обновить",
  "err.create": "Не удалось создать проект",
};

const KK: Record<Key, string> = {
  "pro.perks": "50 ЖИ бейне · 200 сурет · шексіз жарияланым · жалпыға ортақ *.pages.dev мекенжайы · бірлескен авторлар",
  "ve.body": "Кез келген статикалық жобаны ашып, тікелей алдын ала қараудағы элементті басыңыз да, оның мәтінін, түсін, өлшемін және туралауын сол жерде өзгертіңіз — немесе өзгерісті сөзбен сипаттаңыз, ЖИ оны қолданады. ЖИ енгізген әрбір өзгеріс бір басумен қайтарылады. Суретті басып, сипаттама бойынша ауыстырма жасаңыз.",
  "dep.title": "🌐 Жариялау → бір басумен тірі жалпы мекенжай",
  "dep.body": "Бір басу статикалық жобаны Cloudflare шетіне жайғастырып, нақты қосалқы домен береді. Жарияланым сервер бетті шынымен ашып, 2xx алғаннан кейін ғана тірі деп белгіленеді — «сенім бойынша» жасыл күй мұнда жоқ.",
  "modal.title": "Жаңа жоба",
  "modal.phName": "Менің қолданбам",
  "modal.phDesc": "Жоба туралы қысқаша",
  "caps.configured": "Серверде бапталған",
  "caps.off": " · уақытша қолжетімсіз: ",
  "caps.note": "«Бапталған» дегені кілт орнында дегенді білдіреді — жеткізушіден дәл қазір қайта сұрадық дегенді емес. Себебін көру үшін атауға меңзерді апарыңыз.",
  "hero.sub": "Қолданбаларды ЖИ көмегімен жинаңыз және жариялаңыз. GitHub пен бұлттық тіркелгісіз.",
  "hero.ideaAria": "Нені құру керектігін сипаттаңыз",
  "project.new": "+ Жаңа жоба",
  "pro.title": "Studio Pro — толық әзірлеу ортасы",
  "pro.plans": "Барлық тарифтер →",
  "ve.title": "🖱️ Жаңа: кодты емес, беттің өзін басып өңдеу",
  "ve.where": "Ортада → 🖱️ Басып өңдеу қойындысы",
  "dep.where": "Ортада → Жариялау",
  "proj.loading": "Жобалар жүктелуде…",
  "proj.empty": "Әзірге жоба жоқ",
  "proj.emptyHint": "Алғашқысын жасаңыз — ЖИ оны сіз үшін жинайды.",
  "proj.stale": "Соңғы жарияланымнан кейін файлдар өзгерді — ашық беттегі нұсқа ескі. Ортаны ашып, қайта жариялаңыз.",
  "proj.confirmDelete": "Жобаны және оның барлық файлдарын жою керек пе?",
  "snip.title": "Сниппеттер сөресі",
  "snip.sub": "Соңғы 5 жалпыға ортақ сниппет. Көшіріңіз, жұлдыз қойыңыз немесе өзіңіздікімен бөлісіңіз.",
  "snip.loading": "Сниппеттер жүктелуде…",
  "snip.empty": "Әзірге сниппет жоқ. Алғашқысымен бөлісіңіз.",
  "snip.share": "Сниппетпен бөлісу",
  "snip.shareBtn": "Жариялау",
  "snip.sharing": "Жариялануда…",
  "snip.remove": "Алып тастау",
  "snip.removeAria": "сниппетті жалпы сөреден алып тастау",
  "snip.phTitle": "Атауы",
  "snip.phLang": "Тіл (мысалы, javascript)",
  "snip.phCode": "// сниппетті осында қойыңыз",
  "snip.codeAria": "Сниппет коды",
  "snip.copyAria": "Сниппетті көшіру",
  "snip.starAria": "Таңдаулыға",
  "snip.phTags": "белгілер, үтір, арқылы",
  "snip.starErr": "Жұлдыз қою мүмкін болмады",
  "snip.removeErr": "Сниппетті алып тастау мүмкін болмады — ол әлі жарияланған",
  "snip.refresh": "Жаңарту",
  "err.create": "Жобаны жасау мүмкін болмады",
};

const DICT: Partial<Record<string, Record<Key, string>>> = { en: EN, ru: RU, kk: KK };

/** Перевод по ключу. Нет языка — английский; нет ключа — тоже английский. */
export function tDevhub(lang: string, key: Key): string {
  return DICT[lang]?.[key] ?? EN[key];
}

/** Ключи словаря — для проверок и внешнего перебора. */
export const DEVHUB_KEYS = Object.keys(EN) as Key[];
export const DEVHUB_DICT = DICT;

export function useDevhubT() {
  const { lang } = useI18n();
  return useCallback((key: Key) => tDevhub(lang, key), [lang]);
}
