"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ConstitutionEmbed } from "@/components/ConstitutionEmbed";
import type { Sliders } from "@/lib/constitution";

type ArtifactSummary = {
  id: string;
  title: string;
  regimeId: string;
  regimeName: string;
  signedAt: string;
  publishedAt: string;
};

type ArtifactFull = ArtifactSummary & {
  algo?: string;
  signature?: string;
  payload?: {
    sliders?: Sliders;
    regime?: { id?: string; name?: string; era?: string };
  };
};

export default function ConstitutionLeaderboardPage() {
  const [items, setItems] = useState<ArtifactSummary[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [stub, setStub] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Full artifacts cache so we can render Embed with sliders
  const [fullById, setFullById] = useState<Record<string, ArtifactFull>>({});

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        "/api-backend/api/planet/constitution-artifacts?limit=50",
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as {
        items: ArtifactSummary[];
        total: number;
        stub?: boolean;
      };
      setItems(j.items ?? []);
      setTotal(j.total ?? 0);
      setStub(Boolean(j.stub));
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Eagerly fetch full data for all items so each card renders a radar.
  // For 50 items × ~2KB = ~100KB total — acceptable on initial load.
  useEffect(() => {
    if (items.length === 0) return;
    const todo = items.filter((it) => !(it.id in fullById)).map((it) => it.id);
    if (todo.length === 0) return;
    Promise.all(
      todo.map(async (id) => {
        try {
          const r = await fetch(
            `/api-backend/api/planet/constitution-artifacts/${id}`,
          );
          if (!r.ok) return null;
          const j = (await r.json()) as ArtifactFull;
          return [id, j] as const;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      const additions: Record<string, ArtifactFull> = {};
      for (const r of results) {
        if (r) additions[r[0]] = r[1];
      }
      if (Object.keys(additions).length > 0) {
        setFullById((prev) => ({ ...prev, ...additions }));
      }
    });
  }, [items, fullById]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <Link
            href="/constitution"
            className="text-[#d4af37] hover:underline text-sm"
          >
            ← Constitution
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 text-[#d4af37]">
            Planet Constitutions — Leaderboard
          </h1>
          <p className="text-[#9aa3c0] mt-2 max-w-3xl">
            Подписанные QSign конституции, опубликованные на Planet. Сортировка
            по дате публикации. Клик «Применить» — переход в редактор с
            подгруженными ползунками.
          </p>
          {stub && (
            <p className="text-xs text-amber-300 mt-2 max-w-3xl">
              ⚠ Хранилище — in-memory ring buffer (stub). Артефакты переживут
              сервер до рестарта Railway. Production-storage — следующий шаг.
            </p>
          )}
        </header>

        {loading && (
          <div className="text-center text-[#9aa3c0] py-10">Загрузка…</div>
        )}

        {error && (
          <div className="text-rose-400 border border-rose-500/30 rounded p-4 bg-rose-500/5">
            Ошибка загрузки: {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="text-center text-[#9aa3c0] py-10 border border-[#d4af37]/20 rounded">
            Пока нет опубликованных артефактов. Зайди в{" "}
            <Link href="/constitution" className="text-[#d4af37] underline">
              /constitution
            </Link>{" "}
            и нажми «🌍 Опубликовать на Planet».
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            <div className="mb-4 text-sm text-[#9aa3c0]">
              Показано {items.length} из {total} артефактов
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((it) => {
                const full = fullById[it.id];
                const sliders = full?.payload?.sliders;
                return (
                  <div
                    key={it.id}
                    className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-xl p-4 flex flex-col"
                  >
                    <div className="text-xs text-[#9aa3c0] mb-2 flex justify-between">
                      <span className="font-mono truncate">
                        {it.id.slice(0, 8)}
                      </span>
                      <span>{new Date(it.publishedAt).toLocaleDateString()}</span>
                    </div>
                    {sliders ? (
                      <div className="self-center">
                        <ConstitutionEmbed
                          sliders={sliders}
                          label={it.title}
                          size="sm"
                        />
                      </div>
                    ) : (
                      <div className="h-[240px] flex items-center justify-center text-[#9aa3c0] text-xs">
                        Загрузка отпечатка…
                      </div>
                    )}
                    <Link
                      href={`/constitution?artifact=${it.id}`}
                      className="mt-3 px-3 py-2 rounded bg-[#d4af37] text-[#0b1736] font-semibold text-center text-sm hover:opacity-90"
                    >
                      Применить ползунки →
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
