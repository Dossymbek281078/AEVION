import type { Metadata } from "next";

/* Запрет индексации: страница ручной проверки личности для конкретной заявки.
 *
 * Требует входа и показывает загрузку документов владельца — роботу видна
 * пустая оболочка. Без своего правила она молча наследовала canonical "/bureau"
 * из макета раздела (сторож canonicalNotInherited, волна 8, 21.10.2026).
 * Образец — cert/[certId]/notarize/layout.tsx. */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function BureauKycManualLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
