"use client";

import { useEffect, useRef, useState } from "react";

interface FocusTimerProps {
  activeFocusId: number | null;
  onStart: (durationMin: number, taskId: number | null) => Promise<number | null>;
  onComplete: (sessionId: number, actualMin: number) => Promise<void>;
  taskId: number | null;
}

const LS_KEY = "deepsan_focus_min";

function getStoredMin(): number {
  try {
    const v = parseInt(localStorage.getItem(LS_KEY) ?? "25", 10);
    return Number.isInteger(v) && v >= 1 && v <= 180 ? v : 25;
  } catch {
    return 25;
  }
}

export default function FocusTimer({ activeFocusId, onStart, onComplete, taskId }: FocusTimerProps) {
  const [durationMin, setDurationMin] = useState<number>(25);
  const [sessionId, setSessionId] = useState<number | null>(activeFocusId);
  const [secLeft, setSecLeft] = useState<number>(0);
  const [running, setRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const d = getStoredMin();
    setDurationMin(d);
    setSecLeft(d * 60);
  }, []);

  useEffect(() => {
    setSessionId(activeFocusId);
    if (activeFocusId !== null) {
      setRunning(true);
    }
  }, [activeFocusId]);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setSecLeft((s) => {
          if (s <= 1) {
            setRunning(false);
            return 0;
          }
          return s - 1;
        });
        setElapsedSec((e) => e + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [running]);

  async function handleStart() {
    const totalSec = durationMin * 60;
    setSecLeft(totalSec);
    setElapsedSec(0);
    const id = await onStart(durationMin, taskId);
    if (id !== null) setSessionId(id);
    setRunning(true);
  }

  async function handleComplete() {
    setRunning(false);
    const actualMin = Math.ceil(elapsedSec / 60);
    if (sessionId !== null) {
      await onComplete(sessionId, actualMin);
      setSessionId(null);
    }
    setSecLeft(durationMin * 60);
    setElapsedSec(0);
  }

  function handlePause() {
    setRunning((r) => !r);
  }

  function handleDurationChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10);
    if (Number.isInteger(v) && v >= 1 && v <= 180) {
      setDurationMin(v);
      if (!running) setSecLeft(v * 60);
      try { localStorage.setItem(LS_KEY, String(v)); } catch { /* ignore */ }
    }
  }

  const totalSec = durationMin * 60;
  const pct = totalSec > 0 ? Math.min(100, Math.round((elapsedSec / totalSec) * 100)) : 0;
  const mm = String(Math.floor(secLeft / 60)).padStart(2, "0");
  const ss = String(secLeft % 60).padStart(2, "0");
  const isFinished = secLeft === 0 && elapsedSec > 0;

  return (
    <div
      style={{
        background: "rgba(15,23,42,0.75)",
        border: "1px solid rgba(249,115,22,0.2)",
        borderRadius: "16px",
        padding: "20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <h2 style={{ color: "#fed7aa", fontSize: "15px", fontWeight: 700, margin: 0 }}>
          Focus Timer
        </h2>
        {!running && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label style={{ fontSize: "11px", color: "#94a3b8" }}>min:</label>
            <input
              type="number"
              value={durationMin}
              onChange={handleDurationChange}
              min={1}
              max={180}
              style={{
                width: "52px",
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: "6px",
                padding: "3px 6px",
                color: "#e2e8f0",
                fontSize: "12px",
                outline: "none",
                textAlign: "center",
              }}
            />
          </div>
        )}
      </div>

      <div
        style={{
          fontFamily: "monospace",
          fontSize: "48px",
          fontWeight: 700,
          color: isFinished ? "#22c55e" : running ? "#f97316" : "#e2e8f0",
          letterSpacing: "0.04em",
          textAlign: "center",
          margin: "8px 0",
        }}
      >
        {mm}:{ss}
      </div>

      <div
        style={{
          height: "6px",
          background: "rgba(148,163,184,0.1)",
          borderRadius: "3px",
          overflow: "hidden",
          margin: "12px 0",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "linear-gradient(90deg, #f97316, #fbbf24)",
            borderRadius: "3px",
            transition: "width 0.5s",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
        {isFinished ? (
          <button
            onClick={handleComplete}
            style={{
              padding: "10px 24px",
              background: "#22c55e",
              border: "none",
              borderRadius: "10px",
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Complete session
          </button>
        ) : running ? (
          <>
            <button
              onClick={handlePause}
              style={{
                padding: "10px 20px",
                background: "rgba(245,158,11,0.2)",
                border: "1px solid rgba(245,158,11,0.4)",
                borderRadius: "10px",
                color: "#fbbf24",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Pause
            </button>
            <button
              onClick={handleComplete}
              style={{
                padding: "10px 20px",
                background: "rgba(34,197,94,0.15)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: "10px",
                color: "#22c55e",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Finish early
            </button>
          </>
        ) : (
          <button
            onClick={handleStart}
            style={{
              padding: "10px 32px",
              background: "#f97316",
              border: "none",
              borderRadius: "10px",
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Start Focus
          </button>
        )}
      </div>

      {elapsedSec > 0 && !running && !isFinished && (
        <div style={{ fontSize: "11px", color: "#94a3b8", textAlign: "center", marginTop: "8px" }}>
          Paused at {mm}:{ss}
        </div>
      )}
      {sessionId !== null && (
        <div style={{ fontSize: "10px", color: "#475569", textAlign: "center", marginTop: "6px" }}>
          session #{sessionId}
        </div>
      )}
    </div>
  );
}
