/**
 * Компактный ответ на «такой подписи нет» ДЛЯ ВСТРАИВАНИЯ.
 *
 * Зачем отдельный файл. Страница живёт в чужом iframe, а `notFound()` без
 * местной not-found.tsx показал бы общую страницу сайта — с шапкой, меню и
 * переключателем языка внутри маленькой карточки на чужом ресурсе.
 *
 * Код ответа при этом honest 404: раньше встраиваемая карточка отвечала 200
 * на любой выдуманный идентификатор, и поисковик индексировал бесконечный
 * мусор. Показывается это ТОЛЬКО когда сервер авторитетно ответил «нет»;
 * при недоступности бэкенда страница остаётся с кодом 200 и прежним видом.
 */
export default function EmbedNotFound() {
  return (
    <main
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: 20,
        maxWidth: 420,
        margin: "0 auto",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 20,
          background: "#fff",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
          Signature not found
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "#475569" }}>
          This signature id is not in the AEVION registry. Check the link — the
          id may have been copied incompletely.
        </div>
      </div>
    </main>
  );
}
