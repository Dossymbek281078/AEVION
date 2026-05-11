"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { buildApi, type BuildStory } from "@/lib/build/api";

export default function StoriesPage() {
  const [items, setItems] = useState<BuildStory[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    buildApi
      .storiesFeed({ limit: 40 })
      .then((r) => setItems(r.items))
      .catch((e) => setErr((e as Error).message));

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const charCount = content.trim().length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (charCount < 3) return;
    setBusy(true);
    setErr(null);
    try {
      await buildApi.createStory({
        content: content.trim(),
        mediaUrl: mediaUrl.trim() || null,
        mediaType: mediaUrl.match(/\.(mp4|webm|mov)$/i)
          ? "video"
          : mediaUrl.trim()
          ? "image"
          : null,
      });
      setContent("");
      setMediaUrl("");
      setComposeOpen(false);
      refresh();
    } catch (er) {
      setErr((er as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BuildShell>
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Link href="/build" className="text-xs text-slate-500 hover:text-slate-300">
                ← QBuild
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-white">Site Stories</h1>
            <p className="mt-1 text-sm text-slate-400">
              Короткие обновления прямо с объекта — прогресс, фото, находки дня.
              Работники строят портфолио, работодатели видят живую активность.
            </p>
          </div>
          <button
            onClick={() => setComposeOpen((o) => !o)}
            className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            {composeOpen ? "Свернуть" : "+ История"}
          </button>
        </div>

        {/* Compose form */}
        {composeOpen && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5"
          >
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Что нового на объекте? Опиши прогресс, поделись находкой или фото."
                rows={4}
                maxLength={1000}
                className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
              />
              <span
                className={`absolute bottom-2 right-3 text-[11px] ${
                  charCount > 900 ? "text-amber-300" : "text-slate-600"
                }`}
              >
                {charCount}/1000
              </span>
            </div>
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="URL фото или видео (опционально)"
              className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>Поддерживаются jpg, png, gif, mp4, webm, mov</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/5"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={busy || charCount < 3}
                  className="rounded-lg bg-emerald-500 px-4 py-1.5 font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {busy ? "Публикую…" : "Опубликовать"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Error */}
        {err && (
          <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {err}
          </p>
        )}

        {/* Loading */}
        {items === null && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-white/5 bg-white/[0.02] p-5 h-32"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {items && items.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="text-4xl">📣</p>
            <p className="mt-3 text-base font-semibold text-slate-200">Лента пока пуста</p>
            <p className="mt-1.5 max-w-sm mx-auto text-xs text-slate-500 leading-relaxed">
              Site Stories — это короткие обновления прямо с объекта: фото сварки, прогресс
              монтажа, находки дня. Работодатели используют как сигнал активности.
              Работники — как живое портфолио.
            </p>
            <button
              onClick={() => setComposeOpen(true)}
              className="mt-5 rounded-xl bg-emerald-500/20 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30 transition"
            >
              Поделиться первым →
            </button>
          </div>
        )}

        {/* Feed */}
        {items && items.length > 0 && (
          <div className="space-y-4">
            {items.map((s) => (
              <StoryCard key={s.id} story={s} onChanged={refresh} />
            ))}
          </div>
        )}

        {/* Bottom link */}
        {items && items.length > 0 && (
          <p className="mt-8 text-center text-xs text-slate-600">
            Посмотрите{" "}
            <Link href="/build/success-stories" className="text-emerald-400 hover:underline">
              истории успешных наймов →
            </Link>
          </p>
        )}
      </div>
    </BuildShell>
  );
}

function StoryCard({
  story,
  onChanged,
}: {
  story: BuildStory;
  onChanged: () => void;
}) {
  const [likeCount, setLikeCount] = useState(story.likeCount);
  const [liked, setLiked] = useState(story.likedByMe ?? false);
  const [liking, setLiking] = useState(false);
  const ago = relativeTime(story.createdAt);

  // Prefer the userName field; fall back to authorName for older API responses
  const displayName = story.userName || story.authorName || "Без имени";
  const initials = displayName !== "Без имени" ? displayName[0].toUpperCase() : "?";

  async function handleLike() {
    if (liking) return;
    setLiking(true);
    // Optimistic update
    setLiked((v) => !v);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
    try {
      const r = await buildApi.toggleStoryLike(story.id);
      setLikeCount(r.likeCount);
      setLiked(r.liked);
      onChanged();
    } catch {
      // Revert on failure
      setLiked((v) => !v);
      setLikeCount(story.likeCount);
    } finally {
      setLiking(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-white/20">
      {/* Author row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        {story.userPhoto ? (
          <img
            src={story.userPhoto}
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-600 to-slate-700 text-sm font-bold text-white ring-1 ring-white/10">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/build/u/${story.userId}`}
              className="text-sm font-semibold text-white hover:underline leading-tight"
            >
              {displayName}
            </Link>
            {story.userSpecialty && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                {story.userSpecialty}
              </span>
            )}
            {story.userTier && story.userTier !== "DEFAULT" && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                {story.userTier}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {story.userCity && <span>{story.userCity} · </span>}
            {ago}
          </div>
        </div>
      </div>

      {/* Content */}
      <p className="whitespace-pre-wrap px-4 py-2 text-sm leading-relaxed text-slate-200">
        {story.content ?? story.text}
      </p>

      {/* Media */}
      {story.mediaUrl && story.mediaType === "image" && (
        <img
          src={story.mediaUrl}
          alt="Story media"
          className="mt-1 max-h-96 w-full object-cover"
        />
      )}
      {story.mediaUrl && story.mediaType === "video" && (
        <video src={story.mediaUrl} controls className="mt-1 max-h-96 w-full" />
      )}

      {/* Footer / actions */}
      <div className="flex items-center gap-3 border-t border-white/[0.06] bg-white/[0.015] px-4 py-2.5 text-xs text-slate-400">
        <button
          onClick={handleLike}
          disabled={liking}
          aria-label={liked ? "Unlike" : "Like"}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition ${
            liked
              ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
              : "border-white/10 hover:bg-white/5 hover:text-white"
          }`}
        >
          <span aria-hidden>{liked ? "❤️" : "🤍"}</span>
          <span>{likeCount}</span>
        </button>
        <Link
          href={`/build/u/${story.userId}`}
          className="ml-auto text-slate-500 hover:text-slate-300 transition"
        >
          Профиль →
        </Link>
      </div>
    </article>
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "только что";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} дн назад`;
  const mo = Math.floor(d / 30);
  return `${mo} мес назад`;
}
