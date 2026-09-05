import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

/**
 * Страница предложений рендерится на клиенте и своей metadata иметь не может,
 * а без этого layout она наследовала бы canonical соседнего уровня и просила
 * поиск не индексировать себя (ровно находка 01.09 из сторожа
 * layoutCanonicalDoesNotHideChildren). canonical записан литералом: сторож
 * читает исходник текстом и переменную не увидел бы.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Предложения по заявке · Биржа стартапов AEVION",
    alternates: { canonical: `${SITE}/startup-exchange/${id}/offers` },
  };
}

export default function OffersLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
