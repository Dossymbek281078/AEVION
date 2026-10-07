"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

/**
 * Прибор основателя: что показывает воронка, человеческими глазами.
 *
 * 🔴 Зачем страница вообще. Замер 06.10.2026: ручку `/api/pricing/events/funnel`
 * не спрашивал НИ ОДИН файл фронта (поиск `events/funnel` по `frontend/src` дал
 * ноль). То есть все разрезы — каналы, посты, страницы входа, незнакомые метки,
 * источники переходов — существовали только для того, кто спросит ручку
 * командой. Числа, которых никто не видит, решений не меняют.
 *
 * 🔴 Почему таблицы рисуются ОБОБЩЁННО, а не по списку имён. За сутки до этой
 * страницы класс «посчитал разрез и не отдал» укусил трижды, и каждый раз
 * причина была одна: код перечислял известные имена, а новое дописать забывали.
 * Поэтому здесь в отрисовке нет ни одного имени разреза: страница берёт КАЖДОЕ
 * поле ответа, похожее на разрез, и рисует его. Новый разрез появляется сам.
 *
 * Единицы названы отдельно и словами: у визитов это сессии, у «начали оплату» —
 * события. Без подписи два честных числа складывают между собой — так и вышло
 * «итог 438 против 431» внутри одного ответа.
 *
 * Токен администратора здесь НЕ спрашивается, и это не упущение: ручка воронки
 * публичная по устройству, рядом с ней живёт сторож
 * `publicFunnelHasNoPersonalData`, запрещающий личные поля в ответе. Рисовать
 * форму ввода ключа, который ничего не открывает, значило бы обещать защиту,
 * которой нет.
 */

type Клетка = Record<string, number>;
type Ответ = Record<string, unknown>;

const ОКНА = [1, 7, 14] as const;

/** Словами: какая единица у чисел в этом разрезе. */
const ЕДИНИЦЫ: Record<string, string> = {
  byChannel:
    "сессии; визит уникален В ПРЕДЕЛАХ канала, поэтому сумма по каналам больше итога",
  byPost: "сессии, по паре «канал + пост»",
  byEntryPage: "сессии, по первой странице захода",
  byUnknownTag:
    "сессии; метка, которой каталог каналов не знает. Приставка ref: — метку дописала площадка, без неё — наша",
  byReferrerHost:
    "сессии, по хосту страницы-источника; «(не назван)» — встроенный браузер, закладка, адрес руками; «(внутри сайта)» — переход с нашего домена",
  byApp: "события начала оплаты и оплаты, по приложению",
  byHour: "сессии в пределах часа (UTC); сумма по часам больше итога",
};

/** Похоже ли поле ответа на разрез: словарь, где у каждой строки есть числа. */
export function этоРазрез(значение: unknown): значение is Record<string, Клетка> {
  if (!значение || typeof значение !== "object" || Array.isArray(значение)) return false;
  const строки = Object.values(значение as Record<string, unknown>);
  if (!строки.length) return true; // пустой разрез — это ответ «никого не было»
  return строки.every(
    (с) =>
      !!с &&
      typeof с === "object" &&
      !Array.isArray(с) &&
      Object.values(с as Record<string, unknown>).some((v) => typeof v === "number"),
  );
}

function живое(клетка: Клетка): { всего: number; наши: number; живые: number } | null {
  const всего = клетка.visits ?? клетка.сессий ?? null;
  if (всего === null) return null;
  const наши = клетка.visitsOurs ?? клетка.сессийНаших ?? 0;
  return { всего, наши, живые: всего - наши };
}

export function FunnelAdminClient() {
  const [дни, setДни] = useState<number>(14);
  const [ответ, setОтвет] = useState<Ответ | null>(null);
  const [ошибка, setОшибка] = useState<string | null>(null);
  const [идёт, setИдёт] = useState(false);

  const спросить = useCallback(async (окно: number) => {
    setИдёт(true);
    setОшибка(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/events/funnel?days=" + окно));
      if (!r.ok) throw new Error("ручка ответила " + r.status);
      setОтвет((await r.json()) as Ответ);
    } catch (e) {
      // Отказ НЕ рисуем нулями: ноль читается как «людей не было», а правда —
      // «не спросили». Это главная ошибка, которую может сделать панель.
      setОтвет(null);
      setОшибка(e instanceof Error ? e.message : String(e));
    } finally {
      setИдёт(false);
    }
  }, []);

  useEffect(() => {
    void спросить(дни);
  }, [дни, спросить]);

  const разрезы = useMemo(() => {
    if (!ответ) return [] as Array<[string, Record<string, Клетка>]>;
    return Object.entries(ответ).filter(
      ([ключ, значение]) => ключ.startsWith("by") && этоРазрез(значение),
    ) as Array<[string, Record<string, Клетка>]>;
  }, [ответ]);

  const итог = (ответ?.total ?? null) as Клетка | null;

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 1100,
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Воронка — прибор</h1>
      <p style={{ color: "#475569", fontSize: 14, marginTop: 6 }}>
        Живое число = всего минус наши заходы (метка <code>probe-</code> или{" "}
        <code>?probe=</code>). Ручка публичная, личных полей в ответе нет.
      </p>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {ОКНА.map((о) => (
          <button
            key={о}
            type="button"
            onClick={() => setДни(о)}
            aria-pressed={дни === о}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              background: дни === о ? "#0f172a" : "#fff",
              color: дни === о ? "#fff" : "#0f172a",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {о} дн.
          </button>
        ))}
        {идёт && (
          <span style={{ alignSelf: "center", color: "#64748b", fontSize: 13 }}>спрашиваю…</span>
        )}
      </div>

      {ошибка && (
        <div
          style={{
            padding: 14,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            borderRadius: 10,
            fontSize: 14,
          }}
        >
          <strong>Спросить не удалось:</strong> {ошибка}. Это НЕ «людей не было» — числа
          неизвестны.
        </div>
      )}

      {итог && (
        <section style={{ margin: "20px 0" }}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Итог за окно</h2>
          <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
            <tbody>
              {(
                [
                  ["визиты", итог.visits, итог.visitsOurs],
                  ["до цен", итог.pricing, итог.pricingOurs],
                  ["начали оплату", итог.checkoutStart, итог.checkoutStartOurs],
                  ["оплаты (касса)", итог.paid, итог.paidOurs],
                ] as Array<[string, number | null | undefined, number | null | undefined]>
              ).map(([имя, всего, наши]) => (
                <tr key={имя}>
                  <td style={{ padding: "4px 14px 4px 0", fontWeight: 600 }}>{имя}</td>
                  <td style={{ padding: "4px 14px" }}>
                    всего {всего === null || всего === undefined ? "не измерялось" : String(всего)}
                  </td>
                  <td style={{ padding: "4px 14px", color: "#64748b" }}>наши {наши ?? 0}</td>
                  <td style={{ padding: "4px 14px", fontWeight: 700 }}>
                    живые{" "}
                    {всего === null || всего === undefined
                      ? "неизвестно"
                      : String(Number(всего) - Number(наши ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {typeof ответ?.totalUnits === "string" && (
            <p style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
              Единицы: {ответ.totalUnits as string}
            </p>
          )}
        </section>
      )}

      {разрезы.map(([имя, разрез]) => {
        const строки = Object.entries(разрез)
          .map(([ключ, клетка]) => ({ ключ, клетка, ж: живое(клетка) }))
          .sort((a, b) => (b.ж?.живые ?? 0) - (a.ж?.живые ?? 0));
        return (
          <section key={имя} style={{ margin: "24px 0" }} data-razrez={имя}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{имя}</h2>
            <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 8px" }}>
              Единица:{" "}
              {ЕДИНИЦЫ[имя] ??
                "НЕ ОПИСАНА — допишите в ЕДИНИЦЫ, иначе число прочтут неверно"}
            </p>
            {строки.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>За окно никого.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr
                    style={{ textAlign: "left", borderBottom: "1px solid rgba(15,23,42,0.12)" }}
                  >
                    <th style={{ padding: "4px 8px" }}>ключ</th>
                    <th style={{ padding: "4px 8px" }}>всего</th>
                    <th style={{ padding: "4px 8px" }}>наши</th>
                    <th style={{ padding: "4px 8px" }}>живые</th>
                    <th style={{ padding: "4px 8px" }}>прочие числа</th>
                  </tr>
                </thead>
                <tbody>
                  {строки.map(({ ключ, клетка, ж }) => (
                    <tr key={ключ} style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                      <td style={{ padding: "4px 8px", fontFamily: "ui-monospace, monospace" }}>
                        {ключ}
                      </td>
                      <td style={{ padding: "4px 8px" }}>{ж ? ж.всего : "—"}</td>
                      <td style={{ padding: "4px 8px", color: "#64748b" }}>{ж ? ж.наши : "—"}</td>
                      <td style={{ padding: "4px 8px", fontWeight: 700 }}>{ж ? ж.живые : "—"}</td>
                      <td style={{ padding: "4px 8px", color: "#475569" }}>
                        {Object.entries(клетка)
                          .filter(
                            ([к]) =>
                              !["visits", "visitsOurs", "сессий", "сессийНаших"].includes(к),
                          )
                          .map(([к, v]) => к + " " + v)
                          .join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </main>
  );
}
