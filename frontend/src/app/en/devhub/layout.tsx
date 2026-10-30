import { ServerLangProvider } from "@/lib/serverLangContext";

// 30.10.2026: /en/devhub показывает тот же конструктор, что /devhub (замер
// Продаж: английский Shorts вёл на посадочную без конструктора). Язык здесь не
// выбирается по заголовкам — адрес /en/ и есть выбор: "en" всегда.
// DevHubGuestIdentity уже стоит в корневом app/layout.tsx — второй экземпляр слал adopt-guest дважды.
export default function EnDevhubLayout({ children }: { children: React.ReactNode }) {
  return (
    <ServerLangProvider lang="en">
      {children}
    </ServerLangProvider>
  );
}
