// /ru/verify/<cert> → /verify/<cert>. Замер Продаж 19.10.2026: адрес с префиксом /ru
// отвечал 404 — русскоязычный человек, увидев переключатель RU, мог поставить префикс
// руками и получить мёртвую страницу доказательства. Сама страница проверки одна,
// язык берёт из переключателя сайта (словарь verify/[id]/verifyI18n.ts).
import { redirect } from "next/navigation";

export default async function RuVerifyRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const qs = Object.entries(sp)
    .flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v === undefined ? [] : [[k, v]]))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  redirect(`/verify/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`);
}
