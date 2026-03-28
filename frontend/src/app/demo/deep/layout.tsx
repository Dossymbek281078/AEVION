import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Демо — углублённо",
  description:
    "Архитектура Wave 1, потоки данных Auth–QRight–QSign–Bureau, Planet, параллельные треки разработки и ссылки на живые модули.",
};

export default function DemoDeepLayout({ children }: { children: React.ReactNode }) {
  return children;
}
