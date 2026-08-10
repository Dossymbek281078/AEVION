"use client";

// /tiktok-publisher — first-party TikTok Content Posting UI.
//
// Built to satisfy the TikTok Content Posting API audit: it authenticates
// the creator through TikTok's own OAuth screen, then shows the creator's
// real nickname + avatar and the exact privacy levels TikTok reports as
// allowed (from creator_info/query — never hard-coded), a content preview,
// and interaction toggles that respect the creator's account settings.
//
// All backend calls go to /api-backend/api/tiktok/* (Vercel rewrites to the
// Railway backend). The OAuth start is a full navigation, not fetch.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatTimecode,
  errorText as errorTextFor,
  visiblePrivacyOptions,
  publishGate,
  commercialLabel,
} from "./publisherRules";

const API = "/api-backend/api/tiktok";

// TikTok reports processing through publish/status/fetch. Everything that is
// not one of these two is still in flight.
const TERMINAL_OK = "PUBLISH_COMPLETE";
const TERMINAL_FAIL = "FAILED";

const STATUS_LABELS: Record<string, string> = {
  PROCESSING_UPLOAD: "TikTok загружает файл…",
  PROCESSING_DOWNLOAD: "TikTok скачивает видео по ссылке…",
  SEND_TO_USER_INBOX: "Отправлено в приложение — подтвердите публикацию в TikTok",
  PUBLISH_COMPLETE: "Опубликовано в TikTok",
  FAILED: "TikTok отклонил публикацию",
};

// TikTok allows 6 requests per minute per access_token, and the publish call
// itself spends from the same budget. Polling every 3s (20/min) would have
// run straight into that limit and turned a healthy post into a status
// error. 15s keeps us at 4/min with room to spare.
const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

const MUSIC_USAGE_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
const BRANDED_CONTENT_POLICY_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";

// Backend rejection codes, spelled out for the creator. Anything not listed
// falls through to TikTok's own message.
const ERROR_TEXT: Record<string, string> = {
  video_url_required: "Укажите ссылку на видео.",
  video_url_malformed: "Ссылка не похожа на адрес — проверьте её.",
  video_url_must_be_https: "TikTok принимает только https-ссылки.",
  video_url_too_long: "Ссылка слишком длинная.",
  privacy_level_required: "Выберите, кто увидит ролик.",
  privacy_level_not_allowed: "Этот уровень приватности недоступен для вашего аккаунта.",
  branded_content_cannot_be_private: "Рекламу по договору нельзя публиковать со статусом «Только я».",
  cover_timestamp_invalid: "Не удалось разобрать выбранный кадр обложки — выберите его заново.",
  publish_no_id: "TikTok ответил без идентификатора задания — публикация не началась.",
  not_connected: "Сессия TikTok истекла — подключите аккаунт заново.",
  publish_failed: "TikTok отклонил публикацию.",
  publish_error: "Не удалось достучаться до TikTok. Попробуйте ещё раз.",
  creator_info_failed: "TikTok не отдал настройки аккаунта.",
  creator_info_error: "Не удалось получить настройки аккаунта из TikTok.",
  status_failed: "TikTok не отдал статус публикации.",
  status_error: "Не удалось получить статус публикации.",
  tiktok_not_configured: "Интеграция с TikTok ещё не настроена на сервере.",
};

// One line per reason publishGate can withhold the button — so a new reason
// added to the rules cannot silently render as an empty hint.
const BLOCKED_TEXT: Record<string, string> = {
  already_queued: "Этот ролик уже отправлен. Чтобы опубликовать другой, замените ссылку.",
  branded_content_blocked_by_audit:
    "Этому аккаунту TikTok пока разрешает только статус «Только я» — так рекламу по договору публиковать нельзя. Снимите отметку «Реклама по договору» либо дождитесь прохождения аудита TikTok.",
  no_account_options: "Публикация недоступна, пока TikTok не вернул настройки аккаунта. Переподключите аккаунт.",
  disclosure_incomplete: "Отметьте, что именно рекламирует ролик.",
  privacy_not_chosen: "Выберите, кто увидит ролик.",
  video_too_long: "Ролик длиннее, чем разрешено этому аккаунту — TikTok его отклонит. Обрежьте видео.",
};

/** Human text for a backend error code — see publisherRules for the rule. */
const errorText = (code: unknown, fallback?: string) =>
  fallback === undefined ? errorTextFor(ERROR_TEXT, code) : errorTextFor(ERROR_TEXT, code, fallback);

type Config = { configured: boolean; connected: boolean; scopes: string; redirectUri: string };
type Creator = {
  nickname?: string;
  username?: string;
  avatarUrl?: string;
  privacyOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxDurationSec?: number;
};

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Публично — всем",
  MUTUAL_FOLLOW_FRIENDS: "Друзья (взаимные подписки)",
  FOLLOWER_OF_CREATOR: "Подписчикам",
  SELF_ONLY: "Только я (черновик)",
};

export default function TikTokPublisherPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [disableComment, setDisableComment] = useState(false);
  const [disableDuet, setDisableDuet] = useState(false);
  const [disableStitch, setDisableStitch] = useState(false);

  // Commercial-content disclosure — required by TikTok's audit. The master
  // toggle must start OFF; enabling it reveals the two kinds, at least one
  // of which has to be picked before publishing is allowed.
  // AEVION's own footage is largely AI-generated, and TikTok requires such
  // videos to be labelled.
  const [isAigc, setIsAigc] = useState(false);

  // Cover frame. TikTok defaults to the first frame, which on most of our
  // renders is black — so the creator picks one from the preview instead.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [coverMs, setCoverMs] = useState<number | null>(null);
  // Measured from the preview once the browser has the metadata — used to
  // catch a clip that is longer than the account may post, before sending it.
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);

  const [discloseCommercial, setDiscloseCommercial] = useState(false);
  const [brandOrganic, setBrandOrganic] = useState(false); // «Your Brand»
  const [brandContent, setBrandContent] = useState(false); // «Branded Content»

  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // `spinning` is what drives the spinner — a "wait" state we have stopped
  // polling must not keep animating as if work were still happening.
  const [publishStatus, setPublishStatus] = useState<{
    kind: "wait" | "ok" | "err";
    text: string;
    spinning?: boolean;
  } | null>(null);
  // Posting is irreversible on a real profile, so the same URL cannot be sent
  // twice by accident: after a successful queue the button stays out until the
  // creator actually changes the link.
  const [queuedUrl, setQueuedUrl] = useState<string | null>(null);
  const cancelPolling = useRef<(() => void) | null>(null);

  // A tab closed mid-publish must not leave a timer polling forever.
  useEffect(() => () => cancelPolling.current?.(), []);

  // Surface OAuth callback result from the query string.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("error")) setErr(decodeURIComponent(q.get("error")!));
  }, []);

  const loadCreator = useCallback(async () => {
    try {
      const r = await fetch(`${API}/creator-info`, { credentials: "include" });
      if (r.status === 401) {
        // The TikTok session expired or was revoked. Say so and fall back to
        // the connect screen — silently returning here used to leave a
        // "connected" card with no creator, no privacy options, and a publish
        // button that could only ever fail.
        setCreator(null);
        setCfg((c) => (c ? { ...c, connected: false } : c));
        setErr("Сессия TikTok истекла — подключите аккаунт заново.");
        return;
      }
      const j = await r.json();
      if (!r.ok) {
        setErr(errorText(j.error, "не удалось получить настройки аккаунта"));
        return;
      }
      setCreator(j);
      // No default privacy level: TikTok's audit requires the creator to
      // choose visibility deliberately, not to inherit one we picked.
      setPrivacy("");
      if (j.commentDisabled) setDisableComment(true);
      if (j.duetDisabled) setDisableDuet(true);
      if (j.stitchDisabled) setDisableStitch(true);
    } catch (e: any) {
      setErr(e?.message || "creator_info_error");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/config`, { credentials: "include" });
        const j = (await r.json()) as Config;
        setCfg(j);
        if (j.connected) await loadCreator();
      } catch (e: any) {
        setErr(e?.message || "config_error");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCreator]);

  const disconnect = async () => {
    cancelPolling.current?.();
    await fetch(`${API}/logout`, { method: "POST", credentials: "include" });
    setCreator(null);
    setCfg((c) => (c ? { ...c, connected: false } : c));
    setPublishStatus(null);
    setPostMsg(null);
  };

  // Follow the post until TikTok says it is live or rejected. Without this the
  // creator only ever saw a publish_id and had to go check the app by hand.
  const pollPublishStatus = useCallback((publishId: string) => {
    cancelPolling.current?.();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    cancelPolling.current = () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };

    // A single blink of mobile network — or one 429 — must not end the watch
    // while the video is still publishing. Transient failures are retried at
    // the normal cadence and only give up after several in a row.
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;

    const retryOrGiveUp = (message: string) => {
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES || Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setPublishStatus({ kind: "err", text: `${message} Проверьте приложение TikTok.` });
        return;
      }
      setPublishStatus({ kind: "wait", text: `${message} Пробуем ещё раз…`, spinning: true });
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    const tick = async () => {
      if (stopped) return;
      try {
        const r = await fetch(`${API}/publish/status?publishId=${encodeURIComponent(publishId)}`, {
          credentials: "include",
        });
        const j = await r.json();
        if (stopped) return;
        if (!r.ok) {
          // 401 is final — the session is gone, retrying cannot fix it.
          if (r.status === 401) {
            setPublishStatus({
              kind: "err",
              text: "Сессия TikTok истекла. Проверьте приложение TikTok — публикация могла пройти.",
            });
            return;
          }
          retryOrGiveUp(errorText(j.error, `ошибка ${r.status}`));
          return;
        }
        consecutiveFailures = 0;
        const status: string = j.status || "";
        // SEND_TO_USER_INBOX is terminal too: the video is waiting in the
        // TikTok app for the creator to confirm. Polling past it would just
        // spin until the timeout.
        if (status === TERMINAL_OK || status === "SEND_TO_USER_INBOX") {
          setPublishStatus({ kind: "ok", text: STATUS_LABELS[status] });
          return;
        }
        if (status === TERMINAL_FAIL) {
          setPublishStatus({
            kind: "err",
            text: `${STATUS_LABELS[TERMINAL_FAIL]}${j.failReason ? `: ${j.failReason}` : ""}`,
          });
          return;
        }
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          // Give up watching, but say so plainly instead of spinning forever.
          setPublishStatus({
            kind: "wait",
            text: "TikTok всё ещё обрабатывает видео — это дольше обычного. Проверьте уведомления в приложении.",
          });
          return;
        }
        setPublishStatus({
          kind: "wait",
          text: STATUS_LABELS[status] || `Обработка: ${status || "…"}`,
          spinning: true,
        });
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } catch {
        if (!stopped) retryOrGiveUp("Связь прервалась.");
      }
    };

    setPublishStatus({ kind: "wait", text: "TikTok принял задание, идёт обработка…", spinning: true });
    timer = setTimeout(tick, POLL_INTERVAL_MS);
  }, []);

  const publish = async () => {
    setPostMsg(null);
    setPublishStatus(null);
    cancelPolling.current?.();
    const url = videoUrl.trim();
    if (!url) return setPostMsg({ kind: "err", text: "Укажите публичный URL видео (mp4)." });
    if (!/^https:\/\//i.test(url)) {
      return setPostMsg({
        kind: "err",
        text: "Ссылка должна начинаться с https:// и вести на файл, доступный TikTok без авторизации.",
      });
    }
    if (!privacy) return setPostMsg({ kind: "err", text: "Выберите, кто увидит ролик." });
    if (disclosureIncomplete) {
      return setPostMsg({
        kind: "err",
        text: "Отметьте, что именно рекламирует ролик: «Ваш бренд», «Реклама по договору» или оба варианта.",
      });
    }
    if (brandContent && privacy === "SELF_ONLY") {
      return setPostMsg({
        kind: "err",
        text: "Рекламу по договору нельзя публиковать со статусом «Только я».",
      });
    }
    setPosting(true);
    try {
      const r = await fetch(`${API}/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: url,
          title,
          privacyLevel: privacy,
          disableComment,
          disableDuet,
          disableStitch,
          brandOrganicToggle: brandOrganic,
          brandContentToggle: brandContent,
          isAigc,
          ...(coverMs != null ? { coverTimestampMs: coverMs } : {}),
        }),
      });
      const j = await r.json();
      if (r.status === 401) {
        setCreator(null);
        setCfg((c) => (c ? { ...c, connected: false } : c));
        setPostMsg({ kind: "err", text: "Сессия TikTok истекла — подключите аккаунт заново." });
      } else if (!r.ok) {
        // TikTok's own message (in `detail`) is more specific than our code,
        // so it wins when present.
        const d = j.detail;
        const detail = typeof d === "object" && d ? `${d.code || ""} ${d.message || ""}`.trim() : String(d || "");
        setPostMsg({ kind: "err", text: `Не удалось отправить: ${detail || errorText(j.error, "ошибка")}` });
      } else {
        setPostMsg({ kind: "ok", text: "Задание принято TikTok." });
        setQueuedUrl(url);
        pollPublishStatus(j.publishId);
      }
    } catch (e: any) {
      setPostMsg({ kind: "err", text: e?.message || "Сбой отправки" });
    } finally {
      setPosting(false);
    }
  };

  const connected = !!creator || !!cfg?.connected;
  const accountPrivacyOptions = creator?.privacyOptions || [];
  const privacyOptions = visiblePrivacyOptions(accountPrivacyOptions, brandContent);
  // One place decides whether publishing is allowed and, if not, why —
  // see publisherRules, where the reasons are ordered most-specific first.
  const gate = publishGate({
    accountPrivacyOptions,
    privacy,
    discloseCommercial,
    brandOrganic,
    brandContent,
    videoUrl: videoUrl.trim(),
    queuedUrl,
    videoDurationSec,
    maxDurationSec: creator?.maxDurationSec ?? null,
  });
  const canPublish = gate.canPublish;
  const blockedBecause = gate.canPublish ? null : gate.reason;
  const brandedContentBlockedByAudit = blockedBecause === "branded_content_blocked_by_audit";
  const disclosureIncomplete = discloseCommercial && !brandOrganic && !brandContent;

  // Ticking «Branded content» while «Только я» was selected must not leave a
  // combination TikTok will reject sitting in the form.
  useEffect(() => {
    if (brandContent && privacy === "SELF_ONLY") setPrivacy("");
  }, [brandContent, privacy]);

  // A cover timestamp belongs to one specific video. Swapping the link must
  // drop it, or a mark picked at 0:15 of the previous clip would silently
  // travel to a new one that may not even be that long.
  useEffect(() => {
    setCoverMs(null);
    // Same reasoning for the measured length: it belongs to the old clip and
    // would otherwise judge the new one until the browser re-reads metadata.
    setVideoDurationSec(null);
  }, [videoUrl]);

  // Turning the master switch off clears both kinds, so a hidden checkbox can
  // never travel with the request.
  useEffect(() => {
    if (!discloseCommercial) {
      setBrandOrganic(false);
      setBrandContent(false);
    }
  }, [discloseCommercial]);

  return (
    <main className="ttp">
      <style>{CSS}</style>
      <div className="ttp-wrap">
        <header className="ttp-head">
          <div className="ttp-logo">◆ AEVION</div>
          <h1>Публикация в TikTok</h1>
          <p className="ttp-sub">
            Загружайте ролики в свой аккаунт TikTok через официальный Content Posting API — без ручной заливки.
          </p>
        </header>

        {loading && <div className="ttp-card ttp-muted">Загрузка…</div>}

        {!loading && cfg && !cfg.configured && (
          <div className="ttp-card ttp-warn">
            <b>Интеграция ещё не настроена.</b>
            <p>
              Задайте в окружении бэкенда <code>TIKTOK_CLIENT_KEY</code>, <code>TIKTOK_CLIENT_SECRET</code> и{" "}
              <code>TIKTOK_REDIRECT_URI</code>, затем зарегистрируйте redirect URI в приложении TikTok.
            </p>
          </div>
        )}

        {err && (
          <div className="ttp-card ttp-err">
            <b>Ошибка:</b> {err}
          </div>
        )}

        {!loading && cfg?.configured && !connected && (
          <div className="ttp-card ttp-connect">
            <p>Чтобы публиковать, подключите свой аккаунт TikTok. Вы увидите официальный экран авторизации TikTok.</p>
            <a className="ttp-btn ttp-btn-tiktok" href={`${API}/auth/start`}>
              Подключить TikTok
            </a>
            <p className="ttp-fine">
              Запрашиваем доступ: <code>{cfg.scopes}</code>. Отозвать можно в TikTok → Настройки → Безопасность →
              Приложения.
            </p>
          </div>
        )}

        {!loading && connected && (
          <>
            {/* Creator identity — audit requirement: real nickname + avatar */}
            <div className="ttp-card ttp-creator">
              {creator?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="ttp-avatar" src={creator.avatarUrl} alt={creator?.nickname || "avatar"} />
              ) : (
                <div className="ttp-avatar ttp-avatar-ph">TT</div>
              )}
              <div className="ttp-creator-meta">
                <div className="ttp-creator-name">{creator?.nickname || "TikTok-аккаунт"}</div>
                {creator?.username && <div className="ttp-creator-user">@{creator.username}</div>}
                <div className="ttp-creator-note">Публикация пойдёт в этот аккаунт</div>
              </div>
              <button className="ttp-btn ttp-btn-ghost" onClick={disconnect}>
                Отключить
              </button>
            </div>

            <div className="ttp-grid">
              {/* Preview */}
              <div className="ttp-card">
                <label className="ttp-label">Видео (публичный URL, .mp4)</label>
                <input
                  className="ttp-input"
                  placeholder="https://.../AEVIA-Roots-firstgrey-9x16.mp4"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <div className="ttp-preview">
                  {videoUrl.trim() ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video
                      ref={videoRef}
                      src={videoUrl.trim()}
                      controls
                      playsInline
                      className="ttp-video"
                      onLoadedMetadata={(e) => {
                        const d = e.currentTarget.duration;
                        setVideoDurationSec(Number.isFinite(d) ? d : null);
                      }}
                      onError={() => setVideoDurationSec(null)}
                    />
                  ) : (
                    <div className="ttp-preview-ph">Предпросмотр появится после ввода URL</div>
                  )}
                </div>

                {videoUrl.trim() && (
                  <div className="ttp-cover">
                    <button
                      type="button"
                      className="ttp-btn ttp-btn-ghost"
                      onClick={() => {
                        const t = videoRef.current?.currentTime;
                        if (typeof t === "number" && Number.isFinite(t)) {
                          setCoverMs(Math.max(0, Math.round(t * 1000)));
                        }
                      }}
                    >
                      Сделать обложкой текущий кадр
                    </button>
                    <span className="ttp-cover-state">
                      {coverMs == null ? (
                        "обложка: первый кадр"
                      ) : (
                        <>
                          обложка: {formatTimecode(coverMs)}{" "}
                          <button type="button" className="ttp-linkbtn" onClick={() => setCoverMs(null)}>
                            сбросить
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                )}
                {creator?.maxDurationSec ? (
                  <p className={`ttp-fine${blockedBecause === "video_too_long" ? " ttp-fine-warn" : ""}`}>
                    Макс. длительность для этого аккаунта: {creator.maxDurationSec}s
                    {videoDurationSec != null && ` · у этого ролика ${Math.round(videoDurationSec)}s`}
                  </p>
                ) : null}
              </div>

              {/* Post settings */}
              <div className="ttp-card">
                <label className="ttp-label">Подпись</label>
                <textarea
                  className="ttp-input ttp-textarea"
                  maxLength={2200}
                  placeholder="Первый седой в 25… а зря. AEVIA Roots — ссылка в профиле."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <label className="ttp-label">Кто увидит</label>
                <select
                  className="ttp-input"
                  value={privacy}
                  disabled={!privacyOptions.length}
                  onChange={(e) => setPrivacy(e.target.value)}
                >
                  {privacyOptions.length ? (
                    <>
                      <option value="">— выберите —</option>
                      {privacyOptions.map((o) => (
                        <option key={o} value={o}>
                          {PRIVACY_LABELS[o] || o}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="">
                      {brandedContentBlockedByAudit
                        ? "нет статуса, совместимого с рекламой по договору"
                        : "TikTok не вернул доступные уровни"}
                    </option>
                  )}
                </select>
                {brandContent && !brandedContentBlockedByAudit && (
                  <p className="ttp-fine ttp-fine-tight">
                    «Только я» недоступно: рекламу по договору нельзя скрывать от всех.
                  </p>
                )}
                {brandedContentBlockedByAudit && (
                  <p className="ttp-fine ttp-fine-warn">
                    Пока приложение не прошло аудит TikTok, аккаунту доступен только статус «Только я».
                  </p>
                )}

                <div className="ttp-toggles">
                  <label className={`ttp-toggle ${creator?.commentDisabled ? "ttp-toggle-off" : ""}`}>
                    <input
                      type="checkbox"
                      checked={disableComment}
                      disabled={creator?.commentDisabled}
                      onChange={(e) => setDisableComment(e.target.checked)}
                    />
                    Выключить комментарии
                  </label>
                  <label className={`ttp-toggle ${creator?.duetDisabled ? "ttp-toggle-off" : ""}`}>
                    <input
                      type="checkbox"
                      checked={disableDuet}
                      disabled={creator?.duetDisabled}
                      onChange={(e) => setDisableDuet(e.target.checked)}
                    />
                    Выключить Duet
                  </label>
                  <label className={`ttp-toggle ${creator?.stitchDisabled ? "ttp-toggle-off" : ""}`}>
                    <input
                      type="checkbox"
                      checked={disableStitch}
                      disabled={creator?.stitchDisabled}
                      onChange={(e) => setDisableStitch(e.target.checked)}
                    />
                    Выключить Stitch
                  </label>
                  <label className="ttp-toggle">
                    <input type="checkbox" checked={isAigc} onChange={(e) => setIsAigc(e.target.checked)} />
                    <span>
                      Ролик создан с помощью ИИ
                      <span className="ttp-kind-note">TikTok пометит его как AI-generated</span>
                    </span>
                  </label>
                </div>

                {/* Commercial-content disclosure — required by TikTok's audit. */}
                <div className="ttp-disclose">
                  <label className="ttp-toggle ttp-disclose-main">
                    <input
                      type="checkbox"
                      checked={discloseCommercial}
                      onChange={(e) => setDiscloseCommercial(e.target.checked)}
                    />
                    Ролик рекламирует меня, бренд, товар или услугу
                  </label>

                  {discloseCommercial && (
                    <div className="ttp-disclose-kinds">
                      <label className="ttp-toggle">
                        <input
                          type="checkbox"
                          checked={brandOrganic}
                          onChange={(e) => setBrandOrganic(e.target.checked)}
                        />
                        <span>
                          Ваш бренд
                          <span className="ttp-kind-note">вы рекламируете себя или своё дело</span>
                        </span>
                      </label>
                      <label className="ttp-toggle">
                        <input
                          type="checkbox"
                          checked={brandContent}
                          onChange={(e) => setBrandContent(e.target.checked)}
                        />
                        <span>
                          Реклама по договору
                          <span className="ttp-kind-note">вы рекламируете чужой бренд за вознаграждение</span>
                        </span>
                      </label>

                      {disclosureIncomplete && (
                        <p className="ttp-fine ttp-fine-warn">Выберите хотя бы один вариант.</p>
                      )}
                      {(brandOrganic || brandContent) && (
                        <p className="ttp-fine ttp-fine-tight">
                          На ролике появится пометка: <b>{commercialLabel(brandOrganic, brandContent)}</b>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  className="ttp-btn ttp-btn-tiktok ttp-post"
                  onClick={publish}
                  disabled={posting || !canPublish}
                >
                  {posting ? "Отправка…" : "Опубликовать в TikTok"}
                </button>
                {blockedBecause && !posting && <p className="ttp-fine">{BLOCKED_TEXT[blockedBecause]}</p>}

                {postMsg && <div className={`ttp-msg ttp-msg-${postMsg.kind}`}>{postMsg.text}</div>}
                {publishStatus && (
                  <div className={`ttp-msg ttp-msg-${publishStatus.kind === "wait" ? "wait" : publishStatus.kind}`}>
                    {publishStatus.spinning && <span className="ttp-spin" aria-hidden="true" />}
                    {publishStatus.text}
                  </div>
                )}

                {/* The consent line depends on what was disclosed: branded
                    content adds TikTok's Branded Content Policy. */}
                <p className="ttp-fine ttp-disclosure">
                  Публикуя, вы соглашаетесь с{" "}
                  {brandContent && (
                    <>
                      <a href={BRANDED_CONTENT_POLICY_URL} target="_blank" rel="noreferrer">
                        Branded Content Policy
                      </a>{" "}
                      и{" "}
                    </>
                  )}
                  <a href={MUSIC_USAGE_URL} target="_blank" rel="noreferrer">
                    Music Usage Confirmation
                  </a>{" "}
                  TikTok. Контент должен соответствовать Community Guidelines TikTok. AEVION не аффилирован с TikTok.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const CSS = `
.ttp{--bg:#0b0d12;--card:#141821;--line:#232a37;--txt:#e8edf5;--mut:#8b97ab;--accent:#25f4ee;--accent2:#fe2c55;--amber:#f5b342;min-height:100vh;background:radial-gradient(1200px 600px at 50% -10%,#151b28,var(--bg));color:var(--txt);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
@media (prefers-color-scheme:light){.ttp{--bg:#f5f7fb;--card:#ffffff;--line:#e4e9f2;--txt:#141821;--mut:#5b6678;background:radial-gradient(1200px 600px at 50% -10%,#eaf0fb,var(--bg))}}
.ttp-wrap{max-width:820px;margin:0 auto;padding:48px 20px 80px}
.ttp-head{text-align:center;margin-bottom:28px}
.ttp-logo{font-weight:800;letter-spacing:.14em;color:var(--amber);font-size:13px;margin-bottom:10px}
.ttp-head h1{font-size:30px;font-weight:900;letter-spacing:-.02em;margin:0 0 8px}
.ttp-sub{color:var(--mut);max-width:520px;margin:0 auto;font-size:15px;line-height:1.6}
.ttp-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin-bottom:16px}
.ttp-muted{color:var(--mut)}
.ttp-warn{border-color:var(--amber)}
.ttp-warn code,.ttp-connect code,.ttp-disclosure code{background:rgba(245,179,66,.14);color:var(--amber);padding:1px 6px;border-radius:6px;font-size:12px}
.ttp-err{border-color:var(--accent2);color:#ffb3c2}
.ttp-connect{text-align:center}
.ttp-connect p{color:var(--mut);line-height:1.6}
.ttp-btn{display:inline-block;border:none;border-radius:12px;padding:12px 22px;font-weight:800;font-size:15px;cursor:pointer;text-decoration:none;transition:transform .12s,filter .12s}
.ttp-btn:hover{transform:translateY(-1px);filter:brightness(1.08)}
.ttp-btn:disabled{opacity:.55;cursor:default;transform:none}
.ttp-btn-tiktok{background:linear-gradient(92deg,var(--accent2),#ff5b7f);color:#fff;box-shadow:0 6px 20px rgba(254,44,85,.28)}
.ttp-btn-ghost{background:transparent;border:1px solid var(--line);color:var(--mut);padding:8px 14px;font-size:13px}
.ttp-fine{color:var(--mut);font-size:12px;line-height:1.5;margin-top:12px}
.ttp-creator{display:flex;align-items:center;gap:16px}
.ttp-avatar{width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--accent)}
.ttp-avatar-ph{display:flex;align-items:center;justify-content:center;background:#222;color:var(--mut);font-weight:800;font-size:13px}
.ttp-creator-meta{flex:1;min-width:0}
.ttp-creator-name{font-weight:800;font-size:17px}
.ttp-creator-user{color:var(--accent);font-size:13px}
.ttp-creator-note{color:var(--mut);font-size:12px;margin-top:2px}
.ttp-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:680px){.ttp-grid{grid-template-columns:1fr}}
.ttp-grid .ttp-card{margin-bottom:0}
.ttp-label{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:4px 0 6px}
.ttp-input{width:100%;background:var(--bg);border:1px solid var(--line);border-radius:10px;color:var(--txt);padding:10px 12px;font-size:14px;font-family:inherit;box-sizing:border-box;margin-bottom:14px}
.ttp-input:focus{outline:none;border-color:var(--accent)}
.ttp-textarea{min-height:84px;resize:vertical}
.ttp-preview{aspect-ratio:9/16;max-height:360px;background:#000;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid var(--line)}
.ttp-video{width:100%;height:100%;object-fit:contain}
.ttp-preview-ph{color:var(--mut);font-size:13px;padding:20px;text-align:center}
.ttp-cover{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
.ttp-cover-state{color:var(--mut);font-size:12px}
.ttp-linkbtn{background:none;border:none;padding:0;color:var(--accent);font:inherit;font-size:12px;cursor:pointer;text-decoration:underline}
.ttp-toggles{display:flex;flex-direction:column;gap:10px;margin:6px 0 16px}
.ttp-toggle{display:flex;align-items:center;gap:9px;font-size:14px;color:var(--txt);cursor:pointer}
.ttp-toggle-off{opacity:.5;cursor:not-allowed}
.ttp-toggle input{width:16px;height:16px;accent-color:var(--accent2)}
.ttp-post{width:100%;margin-top:4px}
.ttp-disclose{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 14px}
.ttp-disclose-main{font-weight:650;align-items:flex-start}
.ttp-disclose-kinds{display:flex;flex-direction:column;gap:10px;margin:12px 0 2px;padding-left:6px;border-left:2px solid var(--line)}
.ttp-disclose-kinds .ttp-toggle{align-items:flex-start}
.ttp-kind-note{display:block;color:var(--mut);font-size:12px;line-height:1.4;margin-top:1px}
.ttp-fine-tight{margin-top:6px}
.ttp-fine-warn{margin-top:6px;color:var(--amber)}
.ttp-msg{margin-top:12px;padding:10px 12px;border-radius:10px;font-size:13px;line-height:1.5}
.ttp-msg-ok{background:rgba(37,244,238,.12);color:var(--accent);border:1px solid rgba(37,244,238,.3)}
.ttp-msg-err{background:rgba(254,44,85,.12);color:#ff8fa3;border:1px solid rgba(254,44,85,.3)}
.ttp-msg-wait{background:rgba(245,179,66,.12);color:var(--amber);border:1px solid rgba(245,179,66,.3);display:flex;align-items:center;gap:9px}
.ttp-spin{width:13px;height:13px;flex:none;border-radius:50%;border:2px solid rgba(245,179,66,.3);border-top-color:var(--amber);animation:ttp-spin .8s linear infinite}
@keyframes ttp-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.ttp-spin{animation-duration:2.4s}}
.ttp-disclosure a{color:var(--accent)}
`;
