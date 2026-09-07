import type { ReactNode } from "react";
import ComplianceBanner from "@/components/ComplianceBanner";

export const metadata = {
  title: "QPayNet — Embedded Payments",
  // Английская часть идёт первой, русская сохранена: заголовок страницы
  // английский, а сниппет был чисто русским — человек с англоязычного
  // канала видел заголовок на своём языке и описание на чужом. Образец —
  // /qventure, /bureau, /qright (EN-часть, затем RU). Русские слова НЕ
  // удаляю: это ключи продвижения, а не язык интерфейса.
  description:
    "Embedded payment infrastructure: wallets, transfers and a merchant API. "
    + "Встроенная платёжная инфраструктура AEVION. Кошельки, переводы, merchant API.",
};

export default function QPayNetLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ComplianceBanner variant="financial" />
      {children}
    </>
  );
}
