"use client";

import { useEffect, useState } from "react";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useI18n } from "@/lib/i18n";

type VideoRoom = {
  id: string;
  roomUrl: string;
  hostId: string;
  guestId: string | null;
  scheduledAt: string | null;
  status: string;
  hostName: string | null;
  guestName: string | null;
  createdAt: string;
};

export default function VideoPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <VideoInner />
      </RequireAuth>
    </BuildShell>
  );
}

function VideoInner() {
  const { t } = useI18n();
  const [rooms, setRooms] = useState<VideoRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [guestId, setGuestId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [inviteRoomId, setInviteRoomId] = useState("");
  const [inviteGuestId, setInviteGuestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [newRoom, setNewRoom] = useState<VideoRoom | null>(null);

  function load() {
    buildApi.myVideoRooms().then((r) => setRooms(r.items)).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await buildApi.createVideoRoom({
        guestId: guestId.trim() || undefined,
        scheduledAt: scheduledAt || undefined,
      });
      setNewRoom(r as unknown as VideoRoom);
      setCreating(false);
      setGuestId("");
      setScheduledAt("");
      load();
    } catch {/**/} finally { setBusy(false); }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await buildApi.inviteToVideoRoom(inviteRoomId, inviteGuestId.trim());
      setInviteRoomId("");
      setInviteGuestId("");
      alert(t("build.video.inviteSent"));
    } catch {/**/} finally { setBusy(false); }
  }

  const STATUS_COLOR: Record<string, string> = {
    CREATED: "text-sky-300",
    ENDED: "text-slate-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🎥 {t("build.video.title")}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {t("build.video.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-400"
        >
          + {t("build.video.createRoomBtn")}
        </button>
      </div>

      {/* New room created banner */}
      {newRoom && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
          <p className="text-sm font-semibold text-sky-300">✅ {t("build.video.roomCreated")}</p>
          <p className="mt-1 text-xs text-slate-400">{t("build.video.connectionLink")}</p>
          <a
            href={newRoom.roomUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-400"
          >
            🎥 {t("build.video.enterRoom")}
          </a>
          <button
            onClick={() => { void navigator.clipboard.writeText(newRoom.roomUrl); }}
            className="ml-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
          >
            {t("build.video.copyLink")}
          </button>
          <button onClick={() => setNewRoom(null)} className="ml-2 text-xs text-slate-500 hover:text-slate-400">{t("build.video.close")}</button>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <form onSubmit={(e) => void createRoom(e)} className="space-y-4 text-sm">
            <h3 className="font-semibold text-white">{t("build.video.newRoomTitle")}</h3>
            <p className="text-xs text-slate-400">
              {t("build.video.poweredBy")}
            </p>
            <input
              value={guestId}
              onChange={(e) => setGuestId(e.target.value)}
              placeholder={t("build.video.guestIdPlaceholder")}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
            />
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="rounded-lg bg-sky-500 px-5 py-2 font-bold text-white hover:bg-sky-400 disabled:opacity-50">
                {busy ? t("build.video.creating") : t("build.video.createRoomBtn2")}
              </button>
              <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-white/10 px-4 py-2 text-slate-300">{t("build.video.cancel")}</button>
            </div>
          </form>
        </div>
      )}

      {/* Rooms list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-20 animate-pulse rounded-xl border border-white/5 bg-white/5" />)}
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <p className="text-4xl">📹</p>
          <p className="mt-3 text-slate-300">{t("build.video.empty")}</p>
          <button onClick={() => setCreating(true)} className="mt-4 rounded-lg bg-sky-500/20 px-4 py-2 text-sm text-sky-200 hover:bg-sky-500/30">
            {t("build.video.createFirst")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <div key={room.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${STATUS_COLOR[room.status] ?? "text-slate-400"}`}>
                    {room.status === "ENDED" ? t("build.video.status.ended") : t("build.video.status.active")}
                  </span>
                  {room.scheduledAt && (
                    <span className="text-xs text-slate-500">
                      📅 {new Date(room.scheduledAt).toLocaleString("ru")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  {room.hostName ?? t("build.video.defaultHost")} ↔ {room.guestName ?? t("build.video.noGuest")}
                </p>
                <p className="text-xs text-slate-500">{new Date(room.createdAt).toLocaleDateString("ru")}</p>
              </div>
              {room.status !== "ENDED" && (
                <a
                  href={room.roomUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-400"
                >
                  🎥 {t("build.video.enter")}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <form onSubmit={(e) => void invite(e)} className="space-y-3 text-sm">
          <h3 className="font-semibold text-white">{t("build.video.inviteTitle")}</h3>
          <p className="text-xs text-slate-400">{t("build.video.inviteSubtitle")}</p>
          <div className="flex gap-3">
            <input
              value={inviteRoomId}
              onChange={(e) => setInviteRoomId(e.target.value)}
              placeholder={t("build.video.roomIdPlaceholder")}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
            />
            <input
              value={inviteGuestId}
              onChange={(e) => setInviteGuestId(e.target.value)}
              placeholder={t("build.video.userIdPlaceholder")}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
            />
            <button type="submit" disabled={busy || !inviteRoomId || !inviteGuestId} className="rounded-lg bg-sky-500/20 px-4 py-2 text-sky-200 hover:bg-sky-500/30 disabled:opacity-50">
              {t("build.video.inviteBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
