import { redirect } from "next/navigation";

import { меткаДляПерехода } from "@/lib/shortEntry";

import type { Metadata } from "next";

// Метаданные обязательны у каждой публичной страницы (сторож pageMetadata), и
// у перенаправления они решают отдельную задачу: закрыть его от поисковика.
export const metadata: Metadata = {
  title: { absolute: "AEVION" },
  robots: { index: false, follow: true },
};

// /mail — короткий адрес для личных писем компаниям (бюро авторства).
//
// ЗАЧЕМ. Бюро — главный денежный канал по прямому слову основателя 28.09.2026,
// и рассылка идёт каждый день. Замер того же дня: 30 писем уже ушло, и все
// несли голый `aevion.app/bureau` без метки канала. Переход из письма при этом
// неотличим от прямого захода: на вопрос «сработала ли рассылка» ответа нет.
//
// Короткий адрес нужен именно письму: он читается человеком, коротко набирается
// и сам доносит метку. Следующие волны ставят `aevion.app/mail` вместо голого
// адреса. Прошедшие 30 писем разметить уже нельзя — канал отрабатывает один раз.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const метка = меткаДляПерехода((await searchParams).c, "mail");
  if (метка !== "mail") redirect(`/bureau?c=${метка}`);
  redirect("/bureau?c=mail");
}
