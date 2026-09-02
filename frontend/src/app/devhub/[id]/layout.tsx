import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project IDE — DevHub | AEVION",
  description: "Edit, generate, and deploy your project with AI.",
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
