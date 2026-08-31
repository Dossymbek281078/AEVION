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

import { useCallback, useEffect, useState } from "react";

const API = "/api-backend/api/tiktok";

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

  // Раскрытие коммерческого контента. Два независимых признака, а не выбор из
  // двух: ролик может продвигать и свой бренд, и партнёра одновременно.
  const [brandOrganic, setBrandOrganic] = useState(false);
  const [brandedContent, setBrandedContent] = useState(false);
  const [isAigc, setIsAigc] = useState(false);

  // Куда отправлять. Черновик — умолчание: он ничего не публикует без второго
  // осознанного действия человека уже внутри TikTok. Выбор ОБЯЗАН быть явным на
  // экране: сервер тоже считает черновик умолчанием, и если страница молчит,
  // кнопка «Опубликовать» тихо кладёт в черновики, а показанные настройки
  // приватности не отправляются вовсе.
  const [target, setTarget] = useState<"draft" | "direct">("draft");

  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Surface OAuth callback result from the query string.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("error")) setErr(decodeURIComponent(q.get("error")!));
  }, []);

  const loadCreator = useCallback(async () => {
    try {
      const r = await fetch(`${API}/creator-info`, { credentials: "include" });
      if (r.status === 401) return; // not connected
      const j = await r.json();
      if (!r.ok) {
        setErr(typeof j.detail === "object" ? JSON.stringify(j.detail) : j.error || "creator_info_failed");
        return;
      }
      setCreator(j);
      const opts: string[] = j.privacyOptions || [];
      // Default to the safest available option (SELF_ONLY when present).
      setPrivacy(opts.includes("SELF_ONLY") ? "SELF_ONLY" : opts[0] || "");
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
    // Ответ сервера ОБЯЗАТЕЛЬНО проверяем. Без этого экран показывал
    // «не подключено» даже когда отвязать не удалось: человек считал
    // аккаунт TikTok отключённым, а он оставался привязанным — и мог
    // получить публикацию, которой не ждал.
    setErr(null);
    try {
      const r = await fetch(`${API}/logout`, { method: "POST", credentials: "include" });
      if (!r.ok) {
        setErr(`Отключить не удалось (${r.status}). Аккаунт TikTok всё ещё привязан.`);
        return;
      }
      setCreator(null);
      setCfg((c) => (c ? { ...c, connected: false } : c));
    } catch {
      setErr("Не удалось связаться с сервером — аккаунт TikTok всё ещё привязан.");
    }
  };

  // Опрос состояния публикации. TikTok отвечает не сразу: ролик сначала
  // скачивается, потом обрабатывается.
  const trackStatus = (publishId?: string) => {
    if (!publishId) return;
    let left = 10; // ~50 секунд. Дальше молчим, а не опрашиваем вечно.
    const tick = async () => {
      left -= 1;
      try {
        const r = await fetch(`${API}/publish/status?publishId=${encodeURIComponent(publishId)}`, {
          credentials: "include",
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "status_failed");

        if (j.status === "PUBLISH_COMPLETE" || j.status === "SEND_TO_USER_INBOX") {
          const where =
            j.status === "SEND_TO_USER_INBOX"
              ? "Готово: ролик в ваших черновиках TikTok — откройте приложение, чтобы дописать и опубликовать."
              : "Готово: ролик опубликован.";
          return setPostMsg({ kind: "ok", text: where });
        }
        if (j.status === "FAILED") {
          // Причину показываем как есть: без неё «не получилось» не даёт
          // человеку ни одного следующего шага.
          return setPostMsg({
            kind: "err",
            text: `TikTok отклонил: ${j.failReason || "причина не названа"}`,
          });
        }
        if (left <= 0) {
          // Честно говорим, что перестали спрашивать, а не выдаём молчание за
          // успех.
          return setPostMsg({
            kind: "ok",
            text: `Отправлено, TikTok ещё обрабатывает (${j.status || "в работе"}). Проверьте приложение через минуту.`,
          });
        }
        setPostMsg({ kind: "ok", text: `Отправлено. Состояние: ${j.status || "в работе"}…` });
        window.setTimeout(tick, 5000);
      } catch {
        // Сбой опроса не означает, что публикация не удалась — так и пишем.
        setPostMsg({
          kind: "ok",
          text: "Отправлено, но узнать состояние не удалось. Проверьте приложение TikTok.",
        });
      }
    };
    window.setTimeout(tick, 3000);
  };

  const publish = async () => {
    setPostMsg(null);
    if (!videoUrl.trim()) return setPostMsg({ kind: "err", text: "Укажите публичный URL видео (mp4)." });
    if (target === "direct" && !privacy)
      return setPostMsg({ kind: "err", text: "Выберите уровень приватности." });
    // Не понижаем приватность молча: автор выбрал «только я», и опубликовать
    // вместо этого на всех — значит выложить то, на что он не соглашался.
    // Поэтому называем оба несовместимых выбора и оставляем решение ему.
    if (target === "direct" && brandedContent && privacy === "SELF_ONLY") {
      return setPostMsg({
        kind: "err",
        text: "Рекламный контент нельзя публиковать с уровнем «Только я». Выберите открытую аудиторию или снимите отметку о рекламном контенте.",
      });
    }
    setPosting(true);
    try {
      const r = await fetch(`${API}/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: videoUrl.trim(),
          title,
          privacyLevel: privacy,
          disableComment,
          disableDuet,
          disableStitch,
          brandOrganic,
          brandedContent,
          isAigc,
          target,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        const d = j.detail;
        const detail = typeof d === "object" ? `${d.code || ""} ${d.message || ""}`.trim() : String(d || j.error || "");
        setPostMsg({ kind: "err", text: `Не удалось отправить: ${detail || "ошибка"}` });
      } else {
        setPostMsg({ kind: "ok", text: "Отправлено в TikTok. Узнаём состояние…" });
        // Каталог обещает отслеживание статуса, а страница до 19.08 печатала
        // publish_id и советовала «посмотрите уведомления». Ручка при этом
        // существовала и просто никем не звалась.
        trackStatus(j.publishId);
      }
    } catch (e: any) {
      setPostMsg({ kind: "err", text: e?.message || "Сбой отправки" });
    } finally {
      setPosting(false);
    }
  };

  const connected = !!creator || !!cfg?.connected;

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
                    <video src={videoUrl.trim()} controls playsInline className="ttp-video" />
                  ) : (
                    <div className="ttp-preview-ph">Предпросмотр появится после ввода URL</div>
                  )}
                </div>
                {creator?.maxDurationSec ? (
                  <p className="ttp-fine">Макс. длительность для этого аккаунта: {creator.maxDurationSec}s</p>
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
                  disabled={target === "draft"}
                  onChange={(e) => setPrivacy(e.target.value)}
                >
                  {(creator?.privacyOptions || []).map((o) => (
                    <option key={o} value={o}>
                      {PRIVACY_LABELS[o] || o}
                    </option>
                  ))}
                </select>

                <div className="ttp-toggles">
                  <label className={`ttp-toggle ${creator?.commentDisabled ? "ttp-toggle-off" : ""}`}>
                    <input
                      type="checkbox"
                      checked={disableComment}
                      disabled={target === "draft" || creator?.commentDisabled}
                      onChange={(e) => setDisableComment(e.target.checked)}
                    />
                    Выключить комментарии
                  </label>
                  <label className={`ttp-toggle ${creator?.duetDisabled ? "ttp-toggle-off" : ""}`}>
                    <input
                      type="checkbox"
                      checked={disableDuet}
                      disabled={target === "draft" || creator?.duetDisabled}
                      onChange={(e) => setDisableDuet(e.target.checked)}
                    />
                    Выключить Duet
                  </label>
                  <label className={`ttp-toggle ${creator?.stitchDisabled ? "ttp-toggle-off" : ""}`}>
                    <input
                      type="checkbox"
                      checked={disableStitch}
                      disabled={target === "draft" || creator?.stitchDisabled}
                      onChange={(e) => setDisableStitch(e.target.checked)}
                    />
                    Выключить Stitch
                  </label>
                </div>

                <div className="ttp-disclose">
                  <p className="ttp-disclose-title">Куда отправить</p>
                  <label className="ttp-toggle">
                    <input
                      type="radio"
                      name="ttp-target"
                      checked={target === "draft"}
                      onChange={() => setTarget("draft")}
                    />
                    В черновики — доработать и опубликовать в самом TikTok
                  </label>
                  <label className="ttp-toggle">
                    <input
                      type="radio"
                      name="ttp-target"
                      checked={target === "direct"}
                      onChange={() => setTarget("direct")}
                    />
                    Опубликовать сразу
                  </label>
                  {target === "draft" && (
                    <p className="ttp-fine ttp-disclose-label">
                      Подпись, приватность и раскрытие для черновика задаются в
                      самом TikTok — отсюда они не отправляются, поэтому ниже
                      неактивны.
                    </p>
                  )}
                </div>

                <div className="ttp-disclose" data-inactive={target === "draft" ? "1" : undefined}>
                  <p className="ttp-disclose-title">Это коммерческий контент?</p>
                  <label className="ttp-toggle">
                    <input
                      type="checkbox"
                      checked={brandOrganic}
                      disabled={target === "draft"}
                      onChange={(e) => setBrandOrganic(e.target.checked)}
                    />
                    Продвигает мой собственный бренд или товар
                  </label>
                  <label className="ttp-toggle">
                    <input
                      type="checkbox"
                      checked={brandedContent}
                      disabled={target === "draft"}
                      onChange={(e) => setBrandedContent(e.target.checked)}
                    />
                    Рекламирует другой бренд — платное партнёрство
                  </label>
                  <label className="ttp-toggle">
                    <input
                      type="checkbox"
                      checked={isAigc}
                      disabled={target === "draft"}
                      onChange={(e) => setIsAigc(e.target.checked)}
                    />
                    Создан или изменён с помощью ИИ
                  </label>

                  {(brandOrganic || brandedContent) && (
                    <p className="ttp-fine ttp-disclose-label">
                      В TikTok ролик будет помечен:{" "}
                      <strong>
                        {brandedContent ? "Paid partnership" : "Promotional content"}
                      </strong>
                      .
                    </p>
                  )}

                  {brandedContent && privacy === "SELF_ONLY" && (
                    <p className="ttp-msg ttp-msg-err">
                      Рекламный контент нельзя публиковать с уровнем «Только я».
                      Выберите открытую аудиторию или снимите отметку.
                    </p>
                  )}
                </div>

                <button className="ttp-btn ttp-btn-tiktok ttp-post" onClick={publish} disabled={posting}>
                  {posting
                    ? "Отправка…"
                    : target === "draft"
                      ? "Отправить в черновики TikTok"
                      : "Опубликовать в TikTok"}
                </button>

                {postMsg && <div className={`ttp-msg ttp-msg-${postMsg.kind}`}>{postMsg.text}</div>}

                <p className="ttp-fine ttp-disclosure">
                  Публикуя, вы соглашаетесь с{" "}
                  <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer">
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
.ttp-toggles{display:flex;flex-direction:column;gap:10px;margin:6px 0 16px}
.ttp-toggle{display:flex;align-items:center;gap:9px;font-size:14px;color:var(--txt);cursor:pointer}
.ttp-toggle-off{opacity:.5;cursor:not-allowed}
.ttp-toggle input{width:16px;height:16px;accent-color:var(--accent2)}
.ttp-post{width:100%;margin-top:4px}
.ttp-msg{margin-top:12px;padding:10px 12px;border-radius:10px;font-size:13px;line-height:1.5}
.ttp-msg-ok{background:rgba(37,244,238,.12);color:var(--accent);border:1px solid rgba(37,244,238,.3)}
.ttp-msg-err{background:rgba(254,44,85,.12);color:#ff8fa3;border:1px solid rgba(254,44,85,.3)}
.ttp-disclosure a{color:var(--accent)}
.ttp-disclose{border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:14px 0;display:flex;flex-direction:column;gap:10px}
.ttp-disclose-title{margin:0;font-weight:600;font-size:14px}
.ttp-disclose-label{margin:0}
.ttp-disclose[data-inactive="1"]{opacity:.5}
`;
