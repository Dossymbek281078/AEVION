"use client";

import { useState } from "react";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

export function VideoCallButton({ guestId, guestName }: { guestId: string; guestName: string }) {
  const token = useBuildAuth((s) => s.token);
  const [busy, setBusy] = useState(false);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);

  if (!token) return null;

  async function startCall() {
    setBusy(true);
    try {
      const room = await buildApi.createVideoRoom({ guestId });
      await buildApi.inviteToVideoRoom(room.id, guestId);
      setRoomUrl(room.roomUrl);
      window.open(room.roomUrl, "_blank", "noreferrer");
    } catch {/**/}
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        disabled={busy}
        onClick={() => void startCall()}
        className="shrink-0 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50 transition"
      >
        {busy ? "Создаём…" : "🎥 Видеозвонок"}
      </button>
      {roomUrl && (
        <a href={roomUrl} target="_blank" rel="noreferrer" className="text-[10px] text-sky-400 hover:underline text-center">
          Открыть комнату ↗
        </a>
      )}
    </div>
  );
}
