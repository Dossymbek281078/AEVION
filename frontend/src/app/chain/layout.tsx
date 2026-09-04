import type { Metadata } from "next";

/**
 * Метаданные вынесены в макет, потому что сама страница клиентская.
 *
 * Next не читает `export const metadata` из файла с "use client" — и это
 * не ошибка сборки, а тихая пропажа: страница уходит в поиск без заголовка
 * и описания. У нас на это есть отдельный сторож (pageMetadata.guard), он же
 * и поймал мою страницу через десять минут после её появления.
 */
export const metadata: Metadata = {
  title: "Чек цепочки AEVION — весь путь на одной странице",
  description:
    "Отметка авторства, договор, подпись и выплата — каждый шаг подписан отдельно " +
    "и проверяется публично, без входа в аккаунт и без доверия к нам на слово.",
  openGraph: {
    title: "Чек цепочки AEVION",
    description:
      "Весь путь работы: авторство → договор → подпись → выплата. Каждый шаг " +
      "проверяется отдельно.",
    type: "website",
    url: "https://aevion.app/chain",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "Чек цепочки AEVION",
    description: "Каждый шаг подписан отдельно и проверяется публично.",
  },
  alternates: {
    canonical: "https://aevion.app/chain",
  },
};

export default function ChainLayout({ children }: { children: React.ReactNode }) {
  return children;
}
