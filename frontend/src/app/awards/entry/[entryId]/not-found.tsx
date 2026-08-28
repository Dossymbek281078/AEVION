import Link from "next/link";

/**
 * Ответ «такой заявки нет» с ЧЕСТНЫМ кодом 404.
 *
 * Раньше страница отвечала 200 и рисовала этот же текст: для поисковика
 * «страница существует», а выдуманных идентификаторов бесконечно много.
 *
 * Своя страница, а не общая: здесь смотрят конкретную заявку, и «такой нет»
 * — ответ, за которым пришли, а не ошибка навигации. Показывается ТОЛЬКО
 * когда сервер авторитетно ответил 404; при недоступности бэкенда страница
 * остаётся с кодом 200 и прежним видом.
 *
 * Идентификатор в тексте не назван: not-found.tsx не получает params. Он
 * остаётся в адресной строке.
 */
export default function AwardsEntryNotFound() {
  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", padding: "48px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div
          style={{
            border: "1px solid rgba(234,179,8,0.4)",
            borderRadius: 14,
            padding: 20,
            background: "rgba(254,252,232,0.6)",
            color: "#854d0e",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 16 }}>Entry not found</div>
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            No award entry matches this id. Check the link — the id may have
            been copied incompletely.
          </div>
          <Link
            href="/awards"
            style={{ color: "#0d9488", fontWeight: 800, textDecoration: "none", fontSize: 13 }}
          >
            Browse AEVION Awards →
          </Link>
        </div>
      </div>
    </main>
  );
}
