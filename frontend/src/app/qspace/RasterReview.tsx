"use client";

/**
 * QSpace — экран проверки распознанного растрового плана.
 *
 * Зачем отдельный экран. Распознавание по пикселям даёт ПРЕДПОЛОЖЕНИЕ:
 * часть стен находится, часть — нет, а размерные линии иногда выглядят как
 * стены. Строить 3D молча по такому результату нельзя — ошибка распознавания
 * стала бы тихо неверной моделью, а это худший класс дефектов.
 *
 * Поэтому: картинка человека и найденные линии поверх неё. Лишнее снимается
 * кликом, чувствительность крутится ползунком, масштаб называет человек. И
 * только после «Построить модель» результат уходит в 3D.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findWallSegments, type RasterSegment } from "./raster";
import type { Plan, Wall } from "./planModel";
import { WALL_HEIGHT } from "./planModel";

interface Props {
  /** объект-URL загруженной картинки */
  imageUrl: string;
  onCancel: () => void;
  onAccept: (plan: Plan) => void;
}

const MAX_SIDE = 1400;

export default function RasterReview({ imageUrl, onCancel, onAccept }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [threshold, setThreshold] = useState(128);
  const [minLenPct, setMinLenPct] = useState(8);
  const [segments, setSegments] = useState<RasterSegment[]>([]);
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [extentM, setExtentM] = useState("10");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(true);

  // --- загрузка картинки и распознавание -----------------------------------
  const recognise = useCallback((img: HTMLImageElement, th: number, minPct: number) => {
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const ctx = off.getContext("2d");
    if (!ctx) {
      setWarnings(["Браузер не дал холст для разбора картинки."]);
      setBusy(false);
      return;
    }
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    const r = findWallSegments(data, w, h, {
      darkThreshold: th,
      minLenFrac: minPct / 100,
    });
    setSegments(r.segments);
    setDropped(new Set());
    setWarnings(r.warnings);
    setSize({ w, h });
    setBusy(false);
  }, []);

  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      imgRef.current = img;
      recognise(img, threshold, minLenPct);
    };
    img.onerror = () => {
      if (!alive) return;
      setWarnings(["Не удалось открыть картинку — возможно, формат не поддержан браузером."]);
      setBusy(false);
    };
    img.src = imageUrl;
    return () => { alive = false; };
    // порог меняется отдельной кнопкой, чтобы не пересчитывать на каждый пиксель
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const reRecognise = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    setBusy(true);
    // отложенно, чтобы браузер успел показать «считаю»
    setTimeout(() => recognise(img, threshold, minLenPct), 0);
  }, [recognise, threshold, minLenPct]);

  // --- отрисовка предпросмотра ---------------------------------------------
  useEffect(() => {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img || size.w === 0) return;
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, size.w, size.h);
    // притушить картинку, чтобы линии читались
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(0, 0, size.w, size.h);

    segments.forEach((s, i) => {
      const off = dropped.has(i);
      ctx.strokeStyle = off ? "rgba(180,60,60,0.45)" : "#2f5e2a";
      ctx.lineWidth = off ? 2 : Math.max(3, Math.min(10, s.weight));
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    });
  }, [segments, dropped, size]);

  // --- снятие лишней линии кликом ------------------------------------------
  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * c.width;
    const y = ((e.clientY - rect.top) / rect.height) * c.height;

    let best = -1;
    let bestD = 14;
    segments.forEach((s, i) => {
      const d = distToSegment(x, y, s);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best < 0) return;
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(best)) next.delete(best);
      else next.add(best);
      return next;
    });
  }, [segments]);

  const kept = useMemo(
    () => segments.filter((_, i) => !dropped.has(i)),
    [segments, dropped],
  );

  const accept = useCallback(() => {
    const extent = Number(extentM);
    if (!(extent > 0.5) || !(extent < 500)) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of kept) {
      minX = Math.min(minX, s.x1, s.x2); minY = Math.min(minY, s.y1, s.y2);
      maxX = Math.max(maxX, s.x1, s.x2); maxY = Math.max(maxY, s.y1, s.y2);
    }
    const extentPx = Math.max(maxX - minX, maxY - minY);
    if (!(extentPx > 0)) return;
    const mPerPx = extent / extentPx;

    const walls: Wall[] = [];
    for (const s of kept) {
      const w: Wall = {
        x1: (s.x1 - minX) * mPerPx,
        // ось Y картинки идёт вниз, плана — вверх: переворачиваем, иначе
        // модель окажется зеркальной, и это не бросится в глаза
        y1: (maxY - s.y1) * mPerPx,
        x2: (s.x2 - minX) * mPerPx,
        y2: (maxY - s.y2) * mPerPx,
        thickness: Math.max(0.08, Math.min(0.4, s.weight * mPerPx)),
        height: WALL_HEIGHT,
      };
      if (Math.hypot(w.x2 - w.x1, w.y2 - w.y1) < 0.05) continue;
      walls.push(w);
    }
    if (walls.length === 0) return;
    onAccept({ name: "Импорт картинки (проверено вами)", walls, openings: [], source: "dxf" });
  }, [kept, extentM, onAccept]);

  const S = styles;

  return (
    <section style={S.wrap} aria-label="Проверка распознанного плана">
      <h2 style={S.h2}>Проверьте распознанное — и поправьте</h2>
      <p style={S.note}>
        Зелёным показано то, что QSpace счёл стенами. Это{" "}
        <strong>предположение по картинке</strong>, а не чертёж: нажмите на
        лишнюю линию, чтобы её убрать (станет красной — в модель не попадёт).
        Если стен нашлось мало, поднимите чувствительность.
      </p>

      {warnings.length > 0 && (
        <ul style={S.warnings}>
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      <div style={S.controls}>
        <label style={S.ctl}>
          Чувствительность
          <input
            type="range" min={60} max={220} step={4}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
          <span style={S.num}>{threshold}</span>
        </label>
        <label style={S.ctl}>
          Мин. длина стены, % от стороны
          <input
            type="range" min={2} max={30} step={1}
            value={minLenPct}
            onChange={(e) => setMinLenPct(Number(e.target.value))}
          />
          <span style={S.num}>{minLenPct}%</span>
        </label>
        <button type="button" style={S.btn} onClick={reRecognise} disabled={busy}>
          {busy ? "Считаю…" : "Распознать заново"}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onClick={onCanvasClick}
        style={S.canvas}
        aria-label="Картинка плана с найденными стенами. Нажмите на линию, чтобы убрать её."
      />

      <div style={S.footerRow}>
        <span style={S.count}>
          Стен в модели: <strong>{kept.length}</strong>
          {dropped.size > 0 ? ` · убрано вами: ${dropped.size}` : ""}
        </span>
        <label style={S.ctl}>
          Длина большей стороны плана, м
          <input
            type="number" min={0.5} max={500} step={0.1}
            value={extentM}
            onChange={(e) => setExtentM(e.target.value)}
            style={S.numInput}
          />
        </label>
        <button type="button" style={S.primary} onClick={accept} disabled={kept.length === 0}>
          Построить модель
        </button>
        <button type="button" style={S.btn} onClick={onCancel}>Отмена</button>
      </div>
    </section>
  );
}

function distToSegment(px: number, py: number, s: RasterSegment): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - s.x1, py - s.y1);
  let t = ((px - s.x1) * dx + (py - s.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    border: "1px solid #e2ddd2", borderRadius: 10, padding: "12px 14px 16px",
    background: "#fff", margin: "12px 0",
  },
  h2: { fontSize: 18, margin: "0 0 6px" },
  note: { fontSize: 14, lineHeight: 1.5, color: "#4a453d", margin: "0 0 10px", maxWidth: 820 },
  warnings: {
    fontSize: 13.5, color: "#7a5a1f", background: "#fbf3df",
    border: "1px solid #ecdbb2", borderRadius: 8, padding: "8px 12px 8px 28px", margin: "8px 0",
  },
  controls: { display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", margin: "8px 0" },
  ctl: { display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#4a453d" },
  num: { minWidth: 42, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  numInput: { width: 90, padding: "5px 8px", border: "1px solid #c9c4bb", borderRadius: 6, fontSize: 14 },
  canvas: {
    display: "block", width: "100%", maxWidth: "100%", height: "auto",
    border: "1px solid #e2ddd2", borderRadius: 8, cursor: "crosshair", background: "#fafafa",
  },
  footerRow: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 10 },
  count: { fontSize: 14 },
  btn: {
    padding: "7px 12px", background: "#fff", border: "1px solid #c9c4bb",
    borderRadius: 8, cursor: "pointer", fontSize: 14, color: "#1f1d1a",
  },
  primary: {
    padding: "8px 14px", background: "#2f5e2a", color: "#fff",
    border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14,
  },
};
