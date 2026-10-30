import { DevHubGuestIdentity } from "@/components/DevHubGuestIdentity";
import { ServerLangProvider } from "@/lib/serverLangContext";

// 30.10.2026: /en/devhub показывает тот же конструктор, что /devhub (замер
// Продаж: английский Shorts вёл на посадочную без конструктора). Язык здесь не
// выбирается по заголовкам — адрес /en/ и есть выбор: "en" всегда.
export default function EnDevhubLayout({ children }: { children: React.ReactNode }) {
  return (
    <ServerLangProvider lang="en">
      <DevHubGuestIdentity />
      {children}
    </ServerLangProvider>
  );
}
