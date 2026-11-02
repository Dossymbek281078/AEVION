import type { ReactNode } from "react";
import type { Metadata } from "next";
import { serverLang } from "@/lib/serverLang";
import { AEVION_TITLES, tabTitleLang } from "@/lib/tabTitles";

/**
 * The founder's inbox is addressed by a secret in the URL, so this route needs
 * the opposite treatment from the listing it belongs to.
 *
 *  — noindex/nofollow: a crawler that reaches this URL must not put it in an
 *    index, where the token would become public;
 *  — no-referrer: the page links out to investor mailboxes, and a Referer
 *    header would hand the token to whatever the founder clicks next.
 *
 * Without this the parent [id] layout would apply, and it deliberately asks to
 * be indexed.
 */
export async function generateMetadata(): Promise<Metadata> {
  const lang = tabTitleLang(await serverLang("ru"));
  return {
    // «AEVION» в хвосте не пишем: корневой шаблон добавляет "· AEVION".
    title: AEVION_TITLES.startupxOffers[lang],
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
  };
}

export default function OffersLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
