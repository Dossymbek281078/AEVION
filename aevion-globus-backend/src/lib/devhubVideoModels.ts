/**
 * Video model catalogue for DevHub.
 *
 * The old list (minimax/video-01, stable-video-diffusion, animate-diff-v2,
 * hunyuan-video) predates the generation of models that actually look filmed
 * rather than "AI-generated": Veo 3 renders native audio, Seedance 1 Pro holds
 * motion and identity, Kling 2.1 does cinematic camera work. All four are
 * reachable with the REPLICATE_API_TOKEN we already have.
 *
 * Every entry maps our request shape onto that model's REAL input schema
 * (fetched from Replicate, not guessed) — the previous code sent num_frames
 * and width/height to models that accept neither, so the parameters were
 * silently dropped.
 */

export type VideoModel = {
  id: string;
  label: string;
  provider: string;
  /** Native soundtrack, no separate audio pass. */
  audio: boolean;
  /** Accepts a still to animate. */
  imageToVideo: boolean;
  durations: number[];
  note: string;
  toInput: (args: { prompt: string; imageUrl?: string; duration?: number; aspectRatio?: string; resolution?: string; negativePrompt?: string }) => Record<string, unknown>;
};

const AR = (a?: string) => (a && /^(16:9|9:16|1:1|4:3|3:4|21:9)$/.test(a) ? a : "16:9");

export const VIDEO_MODELS: VideoModel[] = [
  {
    id: "google/veo-3-fast",
    label: "Veo 3 Fast — realism + sound",
    provider: "Google",
    audio: true,
    imageToVideo: true,
    durations: [8],
    note: "Default. Native audio, the least 'AI-looking' output for talking scenes and b-roll.",
    toInput: ({ prompt, imageUrl, aspectRatio, resolution, negativePrompt }) => ({
      prompt,
      ...(imageUrl ? { image: imageUrl } : {}),
      aspect_ratio: AR(aspectRatio),
      resolution: resolution === "720p" ? "720p" : "1080p",
      generate_audio: true,
      ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
    }),
  },
  {
    id: "google/veo-3",
    label: "Veo 3 — highest fidelity + sound",
    provider: "Google",
    audio: true,
    imageToVideo: true,
    durations: [8],
    note: "Slower and pricier than Fast; use when the shot is the hero.",
    toInput: ({ prompt, imageUrl, aspectRatio, resolution, negativePrompt }) => ({
      prompt,
      ...(imageUrl ? { image: imageUrl } : {}),
      aspect_ratio: AR(aspectRatio),
      resolution: resolution === "720p" ? "720p" : "1080p",
      generate_audio: true,
      ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
    }),
  },
  {
    id: "bytedance/seedance-1-pro",
    label: "Seedance 1 Pro — motion & identity",
    provider: "ByteDance",
    audio: false,
    imageToVideo: true,
    durations: [5, 10],
    note: "Holds a subject's identity across the shot; best for product and character motion. Silent.",
    toInput: ({ prompt, imageUrl, duration, aspectRatio, resolution }) => ({
      prompt,
      ...(imageUrl ? { image: imageUrl } : {}),
      duration: duration && [5, 10].includes(duration) ? duration : 5,
      resolution: resolution === "720p" ? "720p" : "1080p",
      aspect_ratio: AR(aspectRatio),
      fps: 24,
    }),
  },
  {
    id: "bytedance/seedance-1-lite",
    label: "Seedance 1 Lite — cheap drafts",
    provider: "ByteDance",
    audio: false,
    imageToVideo: true,
    durations: [5, 10],
    note: "Draft pass before spending on a hero shot.",
    toInput: ({ prompt, imageUrl, duration, aspectRatio, resolution }) => ({
      prompt,
      ...(imageUrl ? { image: imageUrl } : {}),
      duration: duration && [5, 10].includes(duration) ? duration : 5,
      resolution: resolution === "1080p" ? "1080p" : "720p",
      aspect_ratio: AR(aspectRatio),
      fps: 24,
    }),
  },
  {
    id: "kwaivgi/kling-v2.1",
    label: "Kling 2.1 — cinematic camera",
    provider: "Kuaishou",
    audio: false,
    imageToVideo: true,
    durations: [5, 10],
    note: "Camera moves and physics; needs a start image in pro mode.",
    toInput: ({ prompt, imageUrl, duration, negativePrompt, resolution }) => ({
      prompt,
      ...(imageUrl ? { start_image: imageUrl } : {}),
      duration: duration && [5, 10].includes(duration) ? duration : 5,
      mode: resolution === "1080p" ? "pro" : "standard",
      ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
    }),
  },
  {
    id: "minimax/video-01",
    label: "Hailuo — expressive faces",
    provider: "MiniMax",
    audio: false,
    imageToVideo: true,
    durations: [6],
    note: "Kept for continuity: this was the previous default.",
    toInput: ({ prompt, imageUrl }) => ({
      prompt,
      ...(imageUrl ? { first_frame_image: imageUrl } : {}),
    }),
  },
];

export const DEFAULT_VIDEO_MODEL = "google/veo-3-fast";

export function findVideoModel(id: string | undefined): VideoModel | null {
  if (!id) return VIDEO_MODELS.find((m) => m.id === DEFAULT_VIDEO_MODEL) ?? null;
  return VIDEO_MODELS.find((m) => m.id === id) ?? null;
}

/** Catalogue for the UI and for agent tools — no secrets, safe to expose. */
export function videoModelCatalogue() {
  return VIDEO_MODELS.map(({ id, label, provider, audio, imageToVideo, durations, note }) => ({
    id,
    label,
    provider,
    audio,
    imageToVideo,
    durations,
    note,
    default: id === DEFAULT_VIDEO_MODEL,
  }));
}
