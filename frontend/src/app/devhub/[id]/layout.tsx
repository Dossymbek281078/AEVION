import type { Metadata } from "next";

// Метаданные — на языке СТРАНИЦЫ. Рабочее окно русское; заголовок и описание
// читаются во вкладке браузера, в истории и в предпросмотре ссылки, то есть
// человек видит их раньше самого окна. Соседний layout модуля переведён
// 28.08, а этот остался английским — метаданные легко пропустить, они не
// попадаются на глаза при работе со страницей. Замер 04.09.2026.
/*
 * 28.09.2026: заголовок был ЖЁСТКО русским, а тело страницы переключается на язык
 * посетителя. Западный гость (замер соседнего окна живым браузером) выбирал English,
 * получал английский интерфейс — и русскую надпись во вкладке, в истории браузера и
 * в предпросмотре ссылки, то есть ровно там, где он читает раньше самой страницы.
 *
 * Язык берём из Accept-Language: тело выбирает его в браузере, а метаданные строит
 * сервер, и другого источника у него нет. Незнание — английский: корневой макет
 * объявляет lang="en", и это единственный ответ, который не спорит с разметкой.
 */
const ЗАГОЛОВКИ: Record<string, { title: string; description: string; locale: string }> = {
  ru: {
    title: "Рабочее окно проекта — DevHub",
    description: "Правьте, генерируйте и публикуйте проект с помощью ИИ.",
    locale: "ru_RU",
  },
  kk: {
    title: "Жоба жұмыс терезесі — DevHub",
    description: "Жобаны ЖИ көмегімен өңдеңіз, жасаңыз және жариялаңыз.",
    locale: "kk_KZ",
  },
  en: {
    title: "Project workspace — DevHub",
    description: "Edit, generate and publish your project with AI.",
    locale: "en_US",
  },
};

export function языкИзЗаголовка(accept: string | null | undefined): "ru" | "en" | "kk" {
  const v = String(accept ?? "").toLowerCase();
  // Первый по порядку выигрывает: «ru-RU,en;q=0.9» — это русский посетитель.
  for (const кусок of v.split(",")) {
    const код = кусок.trim().slice(0, 2);
    if (код === "ru" || код === "kk") return код;
    if (код === "en") return "en";
  }
  return "en";
}

export async function generateMetadata(): Promise<Metadata> {
  const { headers } = await import("next/headers");
  let язык: "ru" | "en" | "kk" = "en";
  try {
    язык = языкИзЗаголовка((await headers()).get("accept-language"));
  } catch {
    // Заголовков может не быть (сборка, предпросмотр) — это не повод падать.
  }
  const т = ЗАГОЛОВКИ[язык];
  return { ...metadata, title: т.title, description: т.description, openGraph: { locale: т.locale } };
}

export const metadata: Metadata = {
  title: ЗАГОЛОВКИ.en.title,
  description: ЗАГОЛОВКИ.en.description,
  // Без этой строки предпросмотр в мессенджерах считает страницу английской:
  // корневой макет объявляет lang="en". Тот же приём, что в layout модуля.
  openGraph: { locale: "ru_RU" },
  // Рабочее пространство проекта индексировать не нужно, и это не только про SEO.
  //
  // Замер 02.09.2026: /devhub/nosuchpage отдаёт 200 и ПОЛНУЮ страницу редактора
  // (30 КБ, заголовок «Project IDE»), потому что маршрут динамический и любой
  // путь принимается за идентификатор проекта. Признака «не найдено» в ответе
  // нет вовсе. Следствий два: поисковик индексирует бесконечный мусор, а любая
  // проверка «200 значит страница есть» перестаёт что-либо доказывать — на этом
  // я и поймал себя, когда отрицательный контроль ответил 200.
  //
  // Образец взят у /account и /acquire — там ровно та же строка.
  robots: { index: false, follow: false },
};

export default function DevHubProjectLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
