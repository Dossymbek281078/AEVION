"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { apiUrl } from "@/lib/apiBase";
import { ЦЕПОЧКА_ПЛАНЕТЫ } from "@/lib/planetChain";

/**
 * Чек цепочки — одна страница, на которой видно ВЕСЬ путь.
 *
 * Зачем отдельная страница. Четыре комнаты платформы (отметка авторства,
 * договор, подпись, выплата) каждая по отдельности показывает свой результат.
 * Человеку со стороны это читается как четыре несвязанных сервиса. Здесь путь
 * виден целиком, и каждый шаг можно проверить ОТДЕЛЬНО, не веря нам на слово:
 * ручка /api/qsign/v2/verify/:id публична (замер 03.09.2026: выдуманный
 * идентификатор даёт 404, а не 401).
 *
 * Почему состояний ЧЕТЫРЕ, а не два. «Подтверждено / не подтверждено» — ложная
 * пара: между ними лежат «не найдено» (шага нет вовсе) и «проверить не удалось»
 * (сеть, сервер). Схлопывать их в «не подтверждено» значит обвинять человека в
 * подделке из-за собственного обрыва связи.
 *
 * Про предварительный режим. Пока ключ платформы не задан, подпись — это хэш
 * содержимого, который пересчитает любой; авторства он не доказывает. Молчать
 * об этом на странице, обещающей проверяемость, нельзя, поэтому есть врезка.
 */

type Состояние = "ok" | "revoked" | "missing" | "failed";

type Шаг = {
  id: string;
  состояние: Состояние;
  createdAt: string | null;
  payloadHash: string | null;
  /**
   * Состояний ТРИ, а не два, и это не педантизм.
   *
   * `real`    — подпись ключом платформы;
   * `preview` — хэш содержимого, который пересчитает кто угодно;
   * `unknown` — блока подписи в ответе НЕТ вовсе (сервер отдаёт `null`
   *             для записей, у которых поля подписи не было).
   *
   * Первая редакция читала `d?.dilithium?.mode === "preview"` и схлопывала
   * третий случай во второй по значению `false` — то есть отсутствие
   * доказательства показывалось как полноценная подпись. На странице,
   * которая обещает проверяемость, это худший из возможных дефектов:
   * переобещание УМОЛЧАНИЕМ, о котором никто не узнает.
   */
  подпись: "real" | "preview" | "unknown";
};

function разобратьШаги(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function ChainReceiptContent() {
  const { t } = useI18n();
  const params = useSearchParams();
  const ids = разобратьШаги(params.get("steps"));
  const [шаги, setШаги] = useState<Шаг[] | null>(null);

  useEffect(() => {
    let живо = true;
    if (ids.length === 0) {
      setШаги([]);
      return;
    }
    Promise.all(
      ids.map(async (id): Promise<Шаг> => {
        try {
          const r = await fetch(apiUrl(`/api/qsign/v2/verify/${encodeURIComponent(id)}`));
          if (r.status === 404) {
            return { id, состояние: "missing", createdAt: null, payloadHash: null, подпись: "unknown" };
          }
          if (!r.ok) {
            return { id, состояние: "failed", createdAt: null, payloadHash: null, подпись: "unknown" };
          }
          const d = await r.json();
          // Предварительный режим виден по длине значения подписи: полная
          // ML-DSA много длиннее хэша. Читаем поле, если сервер его назвал.
          const блок = d?.dilithium;
          const mode = блок ? String(блок.mode ?? "") : "";
          return {
            id,
            состояние: d?.revoked ? "revoked" : d?.valid ? "ok" : "failed",
            createdAt: typeof d?.createdAt === "string" ? d.createdAt : null,
            payloadHash: typeof d?.payloadHash === "string" ? d.payloadHash : null,
            // Ни одно значение не назначается по умолчанию: неизвестное
            // остаётся неизвестным, а не превращается в «всё хорошо».
            подпись: !блок ? "unknown" : mode === "real" ? "real" : "preview",
          };
        } catch {
          // Сеть молчала — это «не знаем», а не «подделка».
          return { id, состояние: "failed", createdAt: null, payloadHash: null, подпись: "unknown" };
        }
      }),
    ).then((r) => {
      if (живо) setШаги(r);
    });
    return () => {
      живо = false;
    };
    // ids приходит из адреса: пересобираем при его смене
  }, [params]);

  const всего = ids.length || ЦЕПОЧКА_ПЛАНЕТЫ.length;
  const естьPreview = (шаги ?? []).some((s) => s.подпись === "preview");
  // Отдельная врезка, а не общая: «подпись — это хэш» и «подписи в ответе
  // нет» — разные утверждения, и человеку важно знать, какое из них про
  // его чек. Показываем только когда есть что показать: шаги, которых не
  // нашли, к вопросу о подписи отношения не имеют.
  const естьНеизвестные = (шаги ?? []).some(
    (s) => s.подпись === "unknown" && s.состояние !== "missing" && s.состояние !== "failed",
  );

  const цвет: Record<Состояние, string> = {
    ok: "#1f6f6b",
    revoked: "#9a3b24",
    missing: "#6b7686",
    failed: "#6b7686",
  };
  const подпись: Record<Состояние, string> = {
    ok: t("chain.ok"),
    revoked: t("chain.revoked"),
    missing: t("chain.missing"),
    failed: t("chain.failed"),
  };

  return (
    /* lang НЕ объявляем. Весь текст страницы приходит из словаря, значит
       язык выбирает посетитель, а не мы. Сторож declaredLangRuPages поймал
       первую редакцию: пометка ru на странице без русских литералов врёт
       ровно так же, как её отсутствие на русской. */
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 64px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px" }}>{t("chain.title")}</h1>
      <p style={{ color: "#5a6472", margin: "0 0 24px", maxWidth: "42em" }}>{t("chain.lead")}</p>

      {естьPreview && (
        <p
          role="status"
          style={{
            border: "1px solid #b0803a",
            background: "#fdf6e9",
            color: "#6d4f1d",
            borderRadius: 8,
            padding: "10px 14px",
            margin: "0 0 24px",
            fontSize: 14,
          }}
        >
          {t("chain.previewWarn")}
        </p>
      )}

      {естьНеизвестные && (
        <p
          role="status"
          style={{
            border: "1px solid #7a8496",
            background: "#f2f4f7",
            color: "#4a5262",
            borderRadius: 8,
            padding: "10px 14px",
            margin: "0 0 24px",
            fontSize: 14,
          }}
        >
          {t("chain.unknownWarn")}
        </p>
      )}

      {шаги !== null && шаги.length === 0 && (
        <p style={{ color: "#6b7686" }}>{t("chain.empty")}</p>
      )}

      {/*
        Живая область: результат проверки обязан ОБЪЯВЛЯТЬСЯ, а не появляться.

        Находка соседнего окна 04.09.2026. Пока идут запросы, `шаги === null`,
        список пуст, и человек с читалкой слышит заголовок, потом тишину, потом
        ничего — результаты возникают молча. Он узнал бы исход, только если бы
        догадался перечитать страницу целиком. А это финальный экран пути:
        ради этого исхода он и пришёл по ссылке.

        Пустой экран во время проверки читается как «чека нет» — та же причина,
        по которой запасной вид Suspense сделан непустым. Здесь тот же случай,
        только секундой позже, и он касается зрячего тоже.

        Итог собирается из ТЕХ ЖЕ подписей, что стоят у шагов: два наших ответа
        об одном не должны расходиться в словах.
      */}
      <p role="status" aria-live="polite" style={{ color: "#5a6472", margin: "0 0 16px", fontSize: 14 }}>
        {шаги === null && ids.length > 0
          ? t("chain.checking")
          : шаги && шаги.length > 0
            ? t("chain.done", { n: String(шаги.length) }) +
              " " +
              (["ok", "revoked", "missing", "failed"] as Состояние[])
                .map((с) => [с, шаги.filter((x) => x.состояние === с).length] as const)
                .filter(([, n]) => n > 0)
                .map(([с, n]) => `${подпись[с]}: ${n}`)
                .join(", ")
            : ""}
      </p>

      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {(шаги ?? []).map((s, i) => {
          const комната = ЦЕПОЧКА_ПЛАНЕТЫ[i];
          return (
            <li
              key={s.id}
              style={{
                border: "1px solid #d9dee6",
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 16 }}>
                  {комната ? комната.имя : s.id.slice(0, 12)}
                </strong>
                <span style={{ color: цвет[s.состояние], fontWeight: 700, fontSize: 14 }}>
                  {подпись[s.состояние]}
                </span>
              </div>
              <div style={{ color: "#6b7686", fontSize: 13 }}>
                {t("chain.step", { n: String(i + 1), total: String(всего) })}
              </div>
              {s.createdAt && (
                <div style={{ color: "#6b7686", fontSize: 13 }}>
                  {t("chain.at")}: {s.createdAt}
                </div>
              )}
              {s.payloadHash && (
                <div
                  style={{
                    color: "#6b7686",
                    fontSize: 12,
                    fontFamily: "ui-monospace, monospace",
                    wordBreak: "break-all",
                  }}
                >
                  {t("chain.hash")}: {s.payloadHash}
                </div>
              )}
              <a
                href={`/qsign/verify/${encodeURIComponent(s.id)}`}
                style={{ fontSize: 13, color: "#1f6f6b" }}
              >
                {t("chain.open")}
              </a>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

/**
 * Граница ожидания обязательна, а не украшение.
 *
 * `useSearchParams()` в клиентском компоненте отключает статическую сборку
 * страницы, и Next ТРЕБУЕТ объявить это явно. В режиме разработки правило
 * не применяется: страница открывается и работает, поэтому дефект невидим
 * ровно там, где его ищут. Ловится только боевой сборкой — соседнее окно
 * поймало его у себя, собрав мою страницу: `useSearchParams() should be
 * wrapped in a suspense boundary at page "/chain"`, код 1.
 *
 * Запасной вид НЕ пустой: по ссылке на чек человек приходит проверять
 * чужую работу, и пустой экран в первый миг читается как «ничего нет».
 */
export default function ChainReceiptPage() {
  return (
    <Suspense fallback={<ChainReceiptSkeleton />}>
      <ChainReceiptContent />
    </Suspense>
  );
}

/**
 * Первый кадр: заголовок и подзаголовок настоящие, из словаря.
 *
 * Пустой запасной вид читался бы как «чек не найден» — а человек приходит
 * сюда по ссылке проверять чужую работу, и первые полсекунды решают, верит
 * он странице или закрывает её. Новых ключей не заводим: берём те же, что
 * покажет готовая страница, поэтому текст не «мигнёт» при подстановке.
 */
function ChainReceiptSkeleton() {
  const { t } = useI18n();
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 64px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px" }}>{t("chain.title")}</h1>
      <p style={{ color: "#5a6472", margin: 0, maxWidth: "42em" }}>{t("chain.lead")}</p>
    </main>
  );
}
