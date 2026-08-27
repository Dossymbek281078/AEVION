import { redirect } from "next/navigation";

// /en/tt — короткий адрес для подписи под АНГЛИЙСКИМ роликом в TikTok.
// Тот же приём, что у русского /tt: метка канала доезжает даже когда адрес
// набирают руками, а не переходят по ссылке из шапки профиля.
export const dynamic = "force-static";

export default function Page() {
  redirect("/en/go?c=tt");
}
