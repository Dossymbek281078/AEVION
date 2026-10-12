/**
 * События первого экрана: что человек делает ДО того, как уйти.
 *
 * 🔴 ПОВОД (разрез byLastStep, 12.10.2026, 14 дней): 187 сессий открыли /devhub
 * и остановились на «открыл страницу», наших 34 — то есть 153 живых человека
 * не сделали НИ ОДНОГО шага. Что именно они делали — читали, кликали поле,
 * уходили через 5 секунд — по событиям сказать было нечем: между «открыл» и
 * «нажал Построить» событий не было вовсе. Чинить первый экран вслепую нельзя.
 *
 * Четыре дешёвых события, все feature_use с source "devhub" — разрезы
 * byFeature и byLastStep подхватывают их без правки сервера:
 *   textarea_focus      — тронул поле описания (раз за сессию);
 *   example_chip_click  — нажал пример (раз за сессию);
 *   scroll_25/50/100    — глубина прокрутки (каждая ступень раз за сессию);
 *   time_5s/15s/60s     — сколько пробыл, ведро по уходу (раз за сессию).
 *
 * «Раз за сессию» — ключ в sessionStorage: иначе повторный фокус или дрожание
 * прокрутки раздуло бы числа, а разрезы считают по сессиям и так.
 */
import { track } from "@/lib/track";

const ИСТОЧНИК = "devhub";
const ПРЕФИКС_КЛЮЧА = "aevion_devhub_fs_";

/** Отправить шаг первого экрана один раз за сессию. Возвращает true, если отправил. */
export function shagPervogoEkrana(feature: string): boolean {
  const ключ = ПРЕФИКС_КЛЮЧА + feature;
  try {
    if (sessionStorage.getItem(ключ)) return false;
    sessionStorage.setItem(ключ, "1");
  } catch {
    // Хранилище закрыто (приватный режим) — шлём всё равно: лучше лишнее
    // событие от редкого браузера, чем слепота по всем.
  }
  track({ type: "feature_use", source: ИСТОЧНИК, meta: { feature } });
  return true;
}

/** Пороги глубины, которые ПЕРЕСЕЧЕНЫ при данной доле прокрутки (0..1). */
export function porogiGlubiny(доля: number): Array<25 | 50 | 100> {
  if (!Number.isFinite(доля)) return [];
  const out: Array<25 | 50 | 100> = [];
  if (доля >= 0.25) out.push(25);
  if (доля >= 0.5) out.push(50);
  if (доля >= 0.999) out.push(100);
  return out;
}

/** Ведро времени на странице: 5 / 15 / 60 секунд; меньше 5 — null (не считаем). */
export function vedroVremeni(мс: number): 5 | 15 | 60 | null {
  if (!Number.isFinite(мс) || мс < 5_000) return null;
  if (мс < 15_000) return 5;
  if (мс < 60_000) return 15;
  return 60;
}

/**
 * Подписка на прокрутку и уход. Возвращает функцию отписки.
 * Вызывать из useEffect страницы /devhub.
 */
export function podklyuchitSobytiyaPervogoEkrana(): () => void {
  if (typeof window === "undefined") return () => {};
  const старт = Date.now();
  const onScroll = () => {
    const высота = document.documentElement.scrollHeight - window.innerHeight;
    // Страница короче окна — прокрутки нет, и 100 % нечестно: не шлём.
    if (высота <= 0) return;
    for (const п of porogiGlubiny(window.scrollY / высота)) shagPervogoEkrana("scroll_" + п);
  };
  const onLeave = () => {
    const в = vedroVremeni(Date.now() - старт);
    if (в !== null) shagPervogoEkrana("time_" + в + "s");
  };
  const onVisibility = () => { if (document.visibilityState === "hidden") onLeave(); };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pagehide", onLeave);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("pagehide", onLeave);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
