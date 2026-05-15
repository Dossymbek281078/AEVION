"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

interface Props {
  alias: string;
  addiction: "alcohol" | "smoking" | "other";
  streakDays: number;
  totalRelapses: number;
  startedAt: string;
  onRelapse: () => void;
}

const ADDICTION_LABEL: Record<Props["addiction"], string> = {
  alcohol: "алкоголя",
  smoking: "курения",
  other: "зависимости",
};

export default function StreakCounter({
  alias,
  addiction,
  streakDays,
  totalRelapses,
  startedAt,
  onRelapse,
}: Props) {
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRelapse() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        apiUrl(`/api/psyapp-deps/users/${encodeURIComponent(alias)}/relapse`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() || null }),
        },
      );
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setError(d.error || "Не получилось. Попробуй ещё раз.");
        setLoading(false);
        return;
      }
      setConfirmStep(0);
      setReason("");
      onRelapse();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Сеть недоступна");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.topRow}>
        <span style={styles.aliasChip}>{alias}</span>
        <span style={styles.addictionChip}>без {ADDICTION_LABEL[addiction]}</span>
      </div>

      <div style={styles.bigNumber}>{streakDays}</div>
      <div style={styles.bigUnit}>
        {dayWord(streakDays)} подряд
      </div>

      <div style={styles.metaRow}>
        <span style={styles.metaItem}>
          С {new Date(startedAt).toLocaleDateString("ru-RU")}
        </span>
        {totalRelapses > 0 ? (
          <span style={styles.metaItem}>
            Перезапусков: {totalRelapses} — это часть пути.
          </span>
        ) : (
          <span style={styles.metaItem}>Без перезапусков. Уверенно.</span>
        )}
      </div>

      {confirmStep === 0 ? (
        <button
          type="button"
          onClick={() => setConfirmStep(1)}
          style={styles.relapseBtnSubtle}
        >
          Я сорвался
        </button>
      ) : confirmStep === 1 ? (
        <div style={styles.confirmBox}>
          <p style={styles.confirmText}>
            Срыв — не провал. Но обнулим счётчик, чтобы быть честным с собой?
          </p>
          <div style={styles.confirmRow}>
            <button
              type="button"
              onClick={() => setConfirmStep(0)}
              style={styles.cancelBtn}
            >
              Нет, я продолжаю
            </button>
            <button
              type="button"
              onClick={() => setConfirmStep(2)}
              style={styles.confirmBtn}
            >
              Да, обнулить
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.confirmBox}>
          <p style={styles.confirmText}>
            Последнее подтверждение. Что стало триггером? (необязательно)
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            placeholder="Например: стресс на работе, встреча с друзьями…"
            style={styles.reasonInput}
            rows={2}
          />
          {error ? <div style={styles.error}>{error}</div> : null}
          <div style={styles.confirmRow}>
            <button
              type="button"
              onClick={() => {
                setConfirmStep(0);
                setReason("");
                setError(null);
              }}
              style={styles.cancelBtn}
              disabled={loading}
            >
              Передумал
            </button>
            <button
              type="button"
              onClick={handleRelapse}
              style={{ ...styles.confirmBtn, opacity: loading ? 0.6 : 1 }}
              disabled={loading}
            >
              {loading ? "Обнуляю…" : "Подтвердить и начать заново"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function dayWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "linear-gradient(135deg, #1a1510 0%, #1f2a20 100%)",
    border: "1px solid #3f6f4f",
    borderRadius: 16,
    padding: 28,
    textAlign: "center",
  },
  topRow: {
    display: "flex",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  aliasChip: {
    background: "#0f0c08",
    border: "1px solid #3a342c",
    borderRadius: 20,
    color: "#d6c7a8",
    fontSize: 11,
    fontWeight: 600,
    padding: "4px 12px",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
  },
  addictionChip: {
    background: "rgba(63,111,79,0.15)",
    border: "1px solid #3f6f4f",
    borderRadius: 20,
    color: "#9bd4a8",
    fontSize: 11,
    fontWeight: 600,
    padding: "4px 12px",
  },
  bigNumber: {
    color: "#f5ebd7",
    fontSize: "clamp(72px, 12vw, 128px)",
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
    margin: "8px 0 4px 0",
  },
  bigUnit: {
    color: "#9bd4a8",
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "lowercase",
  },
  metaRow: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    margin: "20px 0",
    flexWrap: "wrap",
  },
  metaItem: {
    color: "#9b8b6e",
    fontSize: 12,
  },
  relapseBtnSubtle: {
    background: "transparent",
    color: "#9b8b6e",
    border: "1px solid #3a342c",
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 13,
    cursor: "pointer",
    marginTop: 8,
  },
  confirmBox: {
    marginTop: 16,
    padding: 16,
    background: "#0f0c08",
    border: "1px solid #5a2f2f",
    borderRadius: 10,
    textAlign: "left",
  },
  confirmText: {
    margin: "0 0 12px 0",
    color: "#f5ebd7",
    fontSize: 14,
    lineHeight: 1.5,
  },
  confirmRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  cancelBtn: {
    flex: 1,
    minWidth: 120,
    background: "#2a241c",
    color: "#f5ebd7",
    border: "1px solid #3a342c",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  confirmBtn: {
    flex: 1,
    minWidth: 120,
    background: "#7a3f3f",
    color: "#f5ebd7",
    border: "none",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  reasonInput: {
    width: "100%",
    boxSizing: "border-box",
    background: "#1a1510",
    border: "1px solid #3a342c",
    borderRadius: 8,
    padding: "8px 12px",
    color: "#f5ebd7",
    fontSize: 13,
    fontFamily: "inherit",
    resize: "vertical",
    marginBottom: 8,
    outline: "none",
  },
  error: {
    background: "#3a1f1f",
    color: "#f5b5b5",
    border: "1px solid #5a2f2f",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    marginBottom: 8,
  },
};
