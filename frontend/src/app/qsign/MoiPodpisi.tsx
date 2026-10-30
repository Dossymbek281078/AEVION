"use client";
/**
 * «Мои подписи» для вошедшего — ворота 5 «возврат на второй день».
 *
 * 30.10.2026, замер прода: регистрация → подпись → выход → вход — и своей
 * подписи на /qsign не найти: страница показывала форму и публичную ленту
 * /recent (чужие). Ручка своих уже была — GET /api/qsign/v2/audit (Bearer,
 * отбор по issuerUserId), экрана не было. Отказ показываем отказом: упавший
 * запрос — текст ошибки, а не «вы ничего не подписали».
 */
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "@/lib/auth";
import { useQsignT } from "./i18n";

type Запись = { event: "sign" | "revoke"; signatureId: string; at: string | null; publicUrl: string };

// Токен — ТОЛЬКО из хранилища входа, не из поля «Токен доступа» на странице:
// поле правится руками, и на каждое нажатие уходил бы запрос с неполным
// токеном → 401 → красная ошибка (вычитка Продукта 30.10). Читаем один раз.
export function MoiPodpisi() {
  const t = useQsignT();
  const [token, setToken] = useState("");
  useEffect(() => { setToken(getAuthToken() ?? ""); }, []);
  const [записи, setЗаписи] = useState<Запись[] | null>(null);
  const [ошибка, setОшибка] = useState(false);

  useEffect(() => {
    if (!token.trim()) return;
    let жив = true;
    setОшибка(false);
    fetch(apiUrl("/api/qsign/v2/audit?limit=10"), { headers: { Authorization: `Bearer ${token.trim()}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { items?: Запись[] }) => { if (жив) setЗаписи(Array.isArray(d.items) ? d.items : []); })
      .catch((e) => {
        console.warn("[qsign] мои подписи не загрузились:", e instanceof Error ? e.message : e);
        if (жив) setОшибка(true);
      });
    return () => { жив = false; };
  }, [token]);

  if (!token.trim()) return null;
  return (
    <section data-qsign-mine style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, margin: "16px 0", background: "#fff" }}>
      <div style={{ fontWeight: 900, fontSize: 15 }}>{t("mine.title")}</div>
      <div style={{ fontSize: 12, color: "#64748b", margin: "2px 0 10px" }}>{t("mine.lead")}</div>
      {ошибка ? (
        <div role="alert" style={{ fontSize: 13, color: "#b91c1c" }}>{t("mine.error")}</div>
      ) : записи === null ? null : записи.length === 0 ? (
        <div style={{ fontSize: 13, color: "#475569" }}>{t("mine.empty")}</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {записи.map((z) => (
            <li key={`${z.event}-${z.signatureId}-${z.at}`} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: z.event === "revoke" ? "#b91c1c" : "#047857" }}>
                {z.event === "revoke" ? t("mine.revoked") : t("mine.signed")}
              </span>
              <code style={{ fontSize: 12 }}>{z.signatureId.slice(0, 8)}</code>
              {z.at && <span style={{ color: "#64748b" }}>{z.at.slice(0, 16).replace("T", " ")} UTC</span>}
              <a href={z.publicUrl} style={{ color: "#0d9488", fontWeight: 700 }}>{t("mine.open")} →</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
