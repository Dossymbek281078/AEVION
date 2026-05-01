// Tiny URL → embed resolver. Recognizes YouTube, Vimeo and direct-mp4
// links. Anything unknown → null so the caller can fall back to a plain
// link. Server-component-safe: no hooks, no client state.

function youtubeId(url: URL): string | null {
  if (url.hostname.endsWith("youtu.be")) {
    return url.pathname.slice(1).split("/")[0] || null;
  }
  if (url.hostname.endsWith("youtube.com") || url.hostname.endsWith("youtube-nocookie.com")) {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2] || null;
    if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || null;
  }
  return null;
}

function vimeoId(url: URL): string | null {
  if (!url.hostname.endsWith("vimeo.com")) return null;
  const m = url.pathname.match(/^\/(\d+)/);
  return m ? m[1] : null;
}

export function VideoEmbed({ url }: { url: string }) {
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const yt = youtubeId(parsed);
  if (yt) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}`}
          title="Intro video"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }
  const vm = vimeoId(parsed);
  if (vm) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black">
        <iframe
          src={`https://player.vimeo.com/video/${encodeURIComponent(vm)}`}
          title="Intro video"
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(parsed.pathname)) {
    return (
      <video
        src={url}
        controls
        playsInline
        className="aspect-video w-full rounded-lg border border-white/10 bg-black"
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-emerald-300 hover:bg-white/10"
    >
      ▶ Watch intro video ({parsed.hostname})
    </a>
  );
}
