"use client";

import { useEffect, useState } from "react";
import { buildApi, BuildApiError } from "@/lib/build/api";

type State = "loading" | "unsupported" | "denied" | "off" | "on" | "no-keys";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushSubscribeButton() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        const { publicKey } = await buildApi.pushPublicKey();
        if (cancelled) return;
        if (!publicKey) {
          setState("no-keys");
          return;
        }
        setPublicKey(publicKey);
        const reg = await navigator.serviceWorker.register("/build-sw.js");
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setState(existing ? "on" : "off");
      } catch (e) {
        if (!cancelled) {
          setErr((e as Error).message);
          setState("off");
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const enable = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setState(perm === "denied" ? "denied" : "off");
          return;
        }
      }
      const reg = await navigator.serviceWorker.register("/build-sw.js");
      let sub = await reg.pushManager.getSubscription();
      if (!sub && publicKey) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        });
      }
      if (!sub) throw new Error("subscribe_failed");
      const json = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
      if (!json.keys?.p256dh || !json.keys?.auth) throw new Error("invalid_subscription");
      await buildApi.pushSubscribe({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setState("on");
    } catch (e) {
      const msg = e instanceof BuildApiError ? e.message : (e as Error).message;
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setErr(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/build-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await buildApi.pushUnsubscribe(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return <div className="text-xs text-slate-500">Проверка push…</div>;
  }
  if (state === "unsupported") {
    return <div className="text-xs text-slate-500">Браузер не поддерживает push.</div>;
  }
  if (state === "no-keys") {
    return <div className="text-xs text-slate-500">Push временно недоступен (VAPID не настроен).</div>;
  }
  if (state === "denied") {
    return (
      <div className="text-xs text-rose-300">
        Уведомления заблокированы в настройках браузера. Разрешите их в настройках сайта.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {state === "on" ? (
          <button
            onClick={disable}
            disabled={busy}
            className="rounded-md border border-white/10 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
          >
            🔕 Отключить push
          </button>
        ) : (
          <button
            onClick={enable}
            disabled={busy}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            🔔 Включить push
          </button>
        )}
        {state === "on" && (
          <button
            onClick={async () => {
              setBusy(true);
              try { await buildApi.pushTest(); } catch (e) { setErr((e as Error).message); }
              finally { setBusy(false); }
            }}
            disabled={busy}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            Тест
          </button>
        )}
      </div>
      {err && <p className="text-xs text-rose-300">{err}</p>}
    </div>
  );
}
