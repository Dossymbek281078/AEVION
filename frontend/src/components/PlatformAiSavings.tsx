"use client";

// Platform "AI spent rationally" widget. Reads the shared cross-module savings
// tally (GET /api/qcoreai/smart/savings) that every module routing through
// smartComplete feeds, and shows one live "⚡ saved $X · N calls" pill in the
// header. Fetches in useEffect (never in render) so the client base URL can't
// desync server/client hydration; renders nothing until the first successful
// read AND at least one routed run exists.
import { useEffect, useState } from "react";
import { fetchAiSavings, счётчикГоденДляПоказа, type AiSavings } from "@/lib/aiSavings";


export default function PlatformAiSavings() {
  const [data, setData] = useState<AiSavings | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      // Через общий загрузчик: тот же счётчик независимо просят /pricing,
      // /pitch, /acquire и /studio, а число у него одно на всех.
      const j = await fetchAiSavings();
      if (alive && j) setData(j);
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  /*
   * 🔴 Условия «есть хоть один вызов» не хватало. Замер прода 01.10.2026:
   * вызовов 145, а экономия считалась у 3 — и значок сообщал покупателю
   * «AI saved $0.23» в шапке КАЖДОЙ страницы, включая ту, где мы просим $400
   * в месяц. Число было правдой и работало против нас; доля при этом считалась
   * по двум разным совокупностям и расходилась с полями того же ответа в
   * 41.7 раза.
   *
   * Теперь показываем только при достаточном ОХВАТЕ, и порог назван в
   * lib/aiSavings.ts, а не спрятан здесь. Неизвестный охват (старый сервер без
   * поля) — тоже молчание: «не знаю» не равно «можно».
   */
  if (!data || data.runs <= 0 || !счётчикГоденДляПоказа(data)) return null;

  const usd = data.savedUsd >= 0.005 ? `$${data.savedUsd.toFixed(2)}` : "<$0.01";
  const tip =
    `${data.runs} smart call${data.runs === 1 ? "" : "s"} routed rationally: ` +
    `${data.facts} factual → single flagship, ` +
    `${data.light} focused → light council, ` +
    `${data.deep} heavy → deep council. ` +
    `Saved ${usd} (${Math.round(data.savedPct)}%) vs always running the full Council.`;

  return (
    <span
      title={tip}
      aria-label={tip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        color: "#065f46",
        background: "rgba(16,185,129,0.12)",
        border: "1px solid rgba(16,185,129,0.35)",
        cursor: "default",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden>⚡</span>
      AI saved {usd}
      <span style={{ fontWeight: 600, opacity: 0.75 }}>· {data.runs}</span>
    </span>
  );
}
