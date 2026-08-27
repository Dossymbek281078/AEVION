import { redirect } from "next/navigation";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они решают отдельную задачу: закрыть его от поисковика.
// Короткий адрес — это вход для человека из подписи под роликом, а не
// страница: в выдаче ему делать нечего, и без noindex он соревновался бы за
// показы с той страницей, на которую ведёт.
export const metadata: Metadata = {
  title: "AEVION",
  robots: { index: false, follow: true },
};


// /en/ig — короткий адрес для подписи под АНГЛИЙСКИМ роликом в Instagram.
// Тот же приём, что у русского /ig: метка канала доезжает даже когда адрес
// набирают руками, а не переходят по ссылке из шапки профиля.
export const dynamic = "force-static";

export default function Page() {
  redirect("/en/go?c=ig");
}
