import { ImageResponse } from "next/og";
import { getApiBase } from "@/lib/apiBase";

export const runtime = "edge";
export const alt = "Запрос на оплату · QPayNet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface RequestMeta {
  amount?: number;
  currency?: string;
  description?: string;
  status?: string;
}

async function loadRequest(token: string): Promise<RequestMeta | null> {
  try {
    const base = getApiBase();
    const r = await fetch(`${base}/api/qpaynet/requests/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as RequestMeta;
  } catch {
    return null;
  }
}

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default async function PayRequestOg({ params }: { params: { token: string } }) {
  const meta = await loadRequest(params.token);
  const amount = meta?.amount;
  const description = meta?.description?.slice(0, 80) ?? "Запрос на оплату через QPayNet";
  const status = meta?.status ?? "pending";
  const accent = status === "paid" ? "#34d399" : status === "pending" ? "#a78bfa" : "#94a3b8";
  const statusLabel =
    status === "paid"      ? "ОПЛАЧЕНО" :
    status === "cancelled" ? "ОТМЕНЁН" :
    status === "expired"   ? "ИСТЁК" : "ОЖИДАЕТ ОПЛАТЫ";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background:
            "radial-gradient(circle at 80% 20%, rgba(167,139,250,0.30), transparent 60%), linear-gradient(135deg, #020617 0%, #1e1b4b 60%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: accent, textTransform: "uppercase", display: "flex" }}>
            QPayNet · AEVION
          </div>
          <div
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: `1px solid ${accent}`,
              background: `${accent}15`,
              fontSize: 16,
              fontWeight: 800,
              color: accent,
              letterSpacing: 1,
              display: "flex",
            }}
          >
            {statusLabel}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 24, color: "#cbd5e1", letterSpacing: 1, textTransform: "uppercase", display: "flex" }}>
            Запрос на оплату
          </div>
          {amount != null ? (
            <div
              style={{
                fontSize: 160,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: -4,
                color: accent,
                display: "flex",
                alignItems: "baseline",
                gap: 18,
              }}
            >
              <span>{fmt(amount)}</span>
              <span style={{ fontSize: 64, color: "#cbd5e1", fontWeight: 700 }}>{meta?.currency ?? "₸"}</span>
            </div>
          ) : (
            <div style={{ fontSize: 96, fontWeight: 900, color: "#cbd5e1", display: "flex" }}>
              Оплатить онлайн
            </div>
          )}
          <div style={{ fontSize: 28, color: "#e2e8f0", maxWidth: 1080, lineHeight: 1.4, display: "flex" }}>
            {description}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 18,
            color: "#94a3b8",
            letterSpacing: 2,
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex" }}>aevion.kz/qpaynet</div>
          <div style={{ display: "flex", color: accent }}>безопасные платежи</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
