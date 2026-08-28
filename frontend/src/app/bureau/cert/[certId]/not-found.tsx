import Link from "next/link";

/**
 * Ответ «такого сертификата нет» с ЧЕСТНЫМ кодом 404.
 *
 * Раньше страница отвечала 200 и рисовала этот же текст. Для поисковика это
 * значило «страница существует», а несуществующих идентификаторов бесконечно
 * много — то есть бесконечный индексируемый мусор на доверительной
 * поверхности: выдуманный адрес сертификата выглядел как настоящий.
 *
 * Почему СВОЯ страница, а не общая. Здесь проверяют сертификат, и «нет такого
 * в реестре» — это ОТВЕТ, за которым человек пришёл, а не ошибка навигации.
 * Общая not-found.tsx («This node is not on the map») такого ответа не даёт.
 *
 * Цена решения названа честно: not-found.tsx не получает params, поэтому
 * назвать конкретный идентификатор здесь нельзя — он остаётся в адресной
 * строке. Показывается это ТОЛЬКО когда сервер авторитетно ответил 404;
 * при недоступности бэкенда страница остаётся с кодом 200 и прежним видом.
 *
 * Текст английский — как и весь модуль Bureau. Язык модуля целиком решает
 * основатель; смешивать два языка на одном экране нельзя.
 */
export default function CertNotFound() {
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
          <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 16 }}>
            Certificate not found
          </div>
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            No certificate matches this id in the AEVION Bureau registry.
            Check the link — the id may have been copied incompletely.
          </div>
          <Link
            href="/bureau"
            style={{ color: "#0d9488", fontWeight: 800, textDecoration: "none", fontSize: 13 }}
          >
            Browse the Bureau →
          </Link>
        </div>
      </div>
    </main>
  );
}
