/**
 * Общая отрисовка карточки предпросмотра для сертификата.
 *
 * Один модуль на ДВА маршрута — /bureau/cert/<id> и /verify/<id>. Вторая копия
 * той же картинки разошлась бы с первой при первой же правке текста, а
 * расхождение в том, что показывают посторонним, — ровно тот класс, который я
 * весь вечер и чинил.
 */
import { ImageResponse } from "next/og";
import { getApiBase } from "@/lib/apiBase";

export const CARD_SIZE = { width: 1200, height: 630 };

/**
 * Картинка карточки, которую видит человек, получивший ссылку на сертификат.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ. Страница объявляла `twitter:card: summary_large_image` и
 * картинку в SVG (`/api/bureau/cert/<id>/og.svg`). Крупные площадки — X,
 * LinkedIn, Facebook, Telegram — SVG в предпросмотре НЕ рисуют, поэтому большая
 * карточка оставалась пустой: хуже, чем маленькая с текстом.
 *
 * В проекте 149 растровых og-картинок через `next/og`; SVG здесь был
 * исключением, а не приёмом. Этот файл возвращает PNG и по правилам Next
 * перекрывает картинку для сегмента.
 *
 * Данные берутся из офлайн-пакета: он ТОЛЬКО ЧИТАЕТ. Ручку проверки брать
 * нельзя — она наращивает публичный счётчик «verified N×», и каждый показ
 * карточки в мессенджере накручивал бы число.
 */


type Cert = { title?: string; author?: string; kind?: string; protectedAt?: string };
type Anchor = { status?: string | null; bitcoinBlockHeight?: number | null } | null;

export async function load(certId: string): Promise<{ cert: Cert | null; anchor: Anchor }> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/pipeline/certificate/${encodeURIComponent(certId)}/bundle.json`,
      {
        // Таймаут обязателен: без него зависший API подвешивает ВЫДАЧУ
        // страницы — метаданные считаются до отправки ответа. Взято у
        // работающего образца (страница сертификата).
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return { cert: null, anchor: null };
    const j = (await res.json()) as {
      certificate?: Cert;
      proofs?: { openTimestamps?: Anchor };
    };
    return { cert: j?.certificate ?? null, anchor: j?.proofs?.openTimestamps ?? null };
  } catch {
    return { cert: null, anchor: null };
  }
}

/** Подпись про якорь. Обещаем ТОЛЬКО подтверждённое. */
export function anchorLine(a: Anchor): string {
  if (a?.status === "bitcoin-confirmed") {
    const h = a.bitcoinBlockHeight;
    return typeof h === "number" && Number.isFinite(h)
      ? `Bitcoin block ${h}`
      : "Anchored in Bitcoin";
  }
  if (a?.status === "pending") return "Bitcoin anchoring in progress";
  return "SHA-256 + Ed25519";
}

export async function renderCertCard(certId: string) {
  const { cert, anchor } = await load(certId);

  const title = (cert?.title || "AEVION Bureau certificate").slice(0, 70);
  const author = (cert?.author || "").trim();
  const who = author && author.toLowerCase() !== "anonymous" ? author : "Anonymous author";
  const when = (cert?.protectedAt || "").slice(0, 10);
  const whoLine = when ? `${who} · ${when}` : who;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0d9488 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, opacity: 0.9 }}>
          <span>⚖️</span>
          <span>AEVION IP Bureau</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          {/* Одна строка, а не два узла: отрисовщик требует явного
              display:flex у блока с НЕСКОЛЬКИМИ детьми и иначе бросает.
              Поймано тестом, который рисует карточку по-настоящему. */}
          <div style={{ fontSize: 30, opacity: 0.85 }}>{whoLine}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 26 }}>
          <div
            style={{
              display: "flex",
              padding: "10px 20px",
              borderRadius: 12,
              background: "rgba(248,250,252,0.12)",
            }}
          >
            {anchorLine(anchor)}
          </div>
          <div style={{ display: "flex", opacity: 0.75 }}>aevion.app</div>
        </div>
      </div>
    ),
    { ...CARD_SIZE },
  );
}
