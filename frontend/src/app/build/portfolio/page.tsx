"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

type Photo = {
  id: string;
  url: string;
  caption: string | null;
  projectType: string | null;
  takenAt: string | null;
  createdAt: string;
};

export default function PortfolioPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const user = useBuildAuth((s) => s.user);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!user?.id) return;
    try {
      const r = await buildApi.portfolioPhotos(user.id);
      setPhotos(r.items ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { load(); }, [user?.id]);

  async function upload() {
    const url = urlRef.current?.value.trim();
    if (!url) return;
    setUploading(true);
    setError(null);
    try {
      await buildApi.uploadPortfolioPhoto({
        url,
        caption: captionRef.current?.value.trim() || undefined,
        projectType: typeRef.current?.value.trim() || undefined,
      });
      if (urlRef.current) urlRef.current.value = "";
      if (captionRef.current) captionRef.current.value = "";
      if (typeRef.current) typeRef.current.value = "";
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    setDeleting(id);
    try {
      await buildApi.deletePortfolioPhoto(id);
      setPhotos((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio photos</h1>
          <p className="mt-1 text-sm text-slate-400">
            Show your work. Photos appear on your public profile. Max 30.
          </p>
        </div>
        <Link
          href="/build/profile"
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10"
        >
          ← Profile
        </Link>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      {/* Upload form */}
      <section className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-300">Add photo</h2>
        <div className="flex flex-col gap-3">
          <input
            ref={urlRef}
            type="url"
            placeholder="Photo URL (https://...)"
            className="w-full rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
          />
          <div className="flex gap-3">
            <input
              ref={captionRef}
              type="text"
              placeholder="Caption (optional)"
              className="flex-1 rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
            />
            <input
              ref={typeRef}
              type="text"
              placeholder="Project type (e.g. Welding)"
              className="flex-1 rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <button
            onClick={upload}
            disabled={uploading}
            className="self-start rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Add photo"}
          </button>
        </div>
      </section>

      {/* Gallery */}
      {!photos && !error && <p className="text-sm text-slate-400">Loading…</p>}
      {photos && photos.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-400">
          No photos yet. Add your first work photo above.
        </div>
      )}
      {photos && photos.length > 0 && (
        <>
          <p className="mb-3 text-xs text-slate-500">{photos.length} / 30 photos</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? "Portfolio photo"}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225' viewBox='0 0 400 225'%3E%3Crect width='400' height='225' fill='%231e293b'/%3E%3Ctext x='50%25' y='50%25' fill='%2394a3b8' text-anchor='middle' dy='.3em' font-size='14' font-family='system-ui'%3EImage unavailable%3C/text%3E%3C/svg%3E";
                  }}
                />
                <div className="p-3">
                  {photo.caption && (
                    <p className="text-sm font-medium text-slate-100">{photo.caption}</p>
                  )}
                  {photo.projectType && (
                    <p className="text-[11px] text-slate-400">{photo.projectType}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[10px] text-slate-600">
                      {new Date(photo.createdAt).toLocaleDateString()}
                    </p>
                    <button
                      onClick={() => remove(photo.id)}
                      disabled={deleting === photo.id}
                      className="text-[11px] text-rose-400 hover:text-rose-300 disabled:opacity-40"
                    >
                      {deleting === photo.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
