"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      .storiesFeed({ limit: 30 })
      .then((r) => setItems(r.items))
      .catch((e) => setErr((e as Error).message));

  useEffect(() => { refresh(); }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">📣 Site Stories</h1>
          <p className="text-sm text-slate-400">Что прямо сейчас происходит на стройплощадках платформы.</p>
        </div>
        <button
          onClick={() => setComposeOpen((o) => !o)}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
        >
          {composeOpen ? "Свернуть" : "+ Новая история"}
        </button>
      </div>

      {composeOpen && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (content.trim().length < 3) return;
            setBusy(true);
            try {
              await buildApi.createStory({
                content: content.trim(),
                mediaUrl: mediaUrl.trim() || null,
                mediaType: mediaUrl.match(/\.(mp4|webm|mov)$/i) ? "video" : mediaUrl ? "image" : null,
              });
              setContent(""); setMediaUrl(""); setComposeOpen(false);
              refresh();
            } catch (er) {
              setErr((er as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="mb-6 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Что нового на объекте? Опиши прогресс, или поделись фото."
            rows={4}
            className="w-full rounded-md border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-slate-500"
          />
          <input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="URL фото или видео (опционально)"
            className="w-full rounded-md border border-white/10 bg-black/30 p-2 text-sm text-white placeholder:text-slate-500"
          />
          <div className="flex justify-end gap-2 text-sm">
            <button type="button" onClick={() => setComposeOpen(false)} className="rounded-md border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/5">Отмена</button>
            <button type="submit" disabled={busy || content.trim().length < 3} className="rounded-md bg-emerald-500 px-3 py-1.5 font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50">
              {busy ? "Публикую…" : "Опубликовать"}
            </button>
          </div>
        </form>
      )}

      {err && <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{err}</p>}

      {items === null && <p className="text-sm text-slate-500">Загружаю…</p>}
      {items && items.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
          Лента пуста. Будь первым — поделись чем-то с площадки.
        </p>
      )}

      <div className="space-y-4">
        {items?.map((s) => <StoryCard key={s.id} story={s} onChanged={refresh} />)}
      </div>
    </main>
  );
}

function StoryCard({ story, onChanged }: { story: BuildStory; onChanged: () => void }) {
  const [likeCount, setLikeCount] = useState(story.likeCount);
  const [liked, setLiked] = useState(false);
  const ago = relativeTime(story.createdAt);

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-2 px-4 pt-3">
        {story.userPhoto ? (
          <img src={story.userPhoto} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">
            {(story.userName || "?")[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Link href={`/build/u/${story.userId}`} className="text-sm font-semibold text-white hover:underline">
            {story.userName || "Без имени"}
          </Link>
          <div className="text-xs text-slate-500">
            {story.userCity || "—"} · {ago}
          </div>
        </div>
      </div>
      <p className="whitespace-pre-wrap px-4 py-3 text-sm text-slate-200">{story.content}</p>
      {story.mediaUrl && story.mediaType === "image" && (
        <img src={story.mediaUrl} alt="" className="max-h-96 w-full object-cover" />
      )}
      {story.mediaUrl && story.mediaType === "video" && (
        <video src={story.mediaUrl} controls className="max-h-96 w-full" />
      )}
      <div className="flex items-center gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-2 text-xs text-slate-400">
        <button
          onClick={async () => {
            try {
              const r = await buildApi.toggleStoryLike(story.id);
              setLikeCount(r.likeCount);
              setLiked(r.liked);
              onChanged();
            } catch {/**/}
          }}
          className={`rounded-md border border-white/10 px-2 py-1 ${liked ? "bg-rose-500/15 text-rose-200" : "hover:bg-white/5"}`}
        >
          {liked ? "❤️" : "🤍"} {likeCount}
        </button>
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
  return `${d} дн назад`;
}
