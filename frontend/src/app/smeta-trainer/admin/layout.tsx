import type { Metadata } from "next";

/*
 * Управление тренажёром сметчика. Найдено сторожем сразу после его написания:
 * раздел не был закрыт ни запретом показа, ни robots.txt — как и /build/admin.
 * Оба раза правило «адрес с admin закрыт» жило только в чужой голове.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SmetaAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
