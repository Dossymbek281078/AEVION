import type { ReactNode } from "react";
import type { Metadata } from "next";

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
export const metadata: Metadata = {
  title: "Предложения по заявке · Биржа стартапов AEVION",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function OffersLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
