"use client";

import { useMemo, useState } from "react";

const palette = {
  gold:     "#d4af37",
  goldSoft: "#f5d27a",
  navy:     "#0b1736",
  navy2:    "#131f3d",
  ink:      "#e7ecf8",
  inkDim:   "#9aa3c0",
  danger:   "#ff7a7a",
  success:  "#7ad07a",
};

export interface CategoryOption {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

interface CapsuleFormProps {
  alias: string;
  categories: CategoryOption[];
  onCreate: (payload: {
    alias: string;
    title: string;
    content: string;
    category: string;
    unlock_at: string;
  }) => Promise<void>;
  busy: boolean;
}

// Tomorrow's date in YYYY-MM-DD.
function tomorrowISODate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function thirtyDaysISODate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function CapsuleForm({
  alias,
  categories,
  onCreate,
  busy,
}: CapsuleFormProps) {
  const minDate = useMemo(tomorrowISODate, []);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>(
    categories[0]?.id ?? "future_self",
  );
  const [unlockDate, setUnlockDate] = useState<string>(thirtyDaysISODate());
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canSubmit =
    alias.trim().length > 0 &&
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    unlockDate >= minDate &&
    !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!canSubmit) {
      setErr("Заполни все поля. Дата открытия — не раньше завтра.");
      return;
    }
    try {
      // Convert YYYY-MM-DD → ISO at start of day, local-time.
      const unlockISO = new Date(`${unlockDate}T00:00:00`).toISOString();
      await onCreate({
        alias,
        title: title.trim(),
        content: content.trim(),
        category,
        unlock_at: unlockISO,
      });
      setOk("Капсула запечатана. Откроется только в дату разблокировки.");
      setTitle("");
      setContent("");
    } catch (e: any) {
      setErr(e?.message || "Не удалось создать капсулу");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: palette.navy,
    color: palette.ink,
    border: `1px solid ${palette.gold}33`,
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: `linear-gradient(180deg, ${palette.navy}ee, ${palette.navy2}ee)`,
        border: `1px solid ${palette.gold}40`,
        borderRadius: 16,
        padding: 22,
        boxShadow: `0 0 50px -20px ${palette.gold}80`,
      }}
    >
      <h2
        style={{
          margin: 0,
          color: palette.goldSoft,
          fontSize: 20,
          fontWeight: 300,
          letterSpacing: "0.04em",
          marginBottom: 14,
        }}
      >
        ✦ Новая капсула
      </h2>
      <p style={{ color: palette.inkDim, fontSize: 12, marginTop: 0, marginBottom: 18 }}>
        Запечатай послание сегодняшнему себе — откроется только в указанную дату.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={labelStyle()}>Заголовок</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: «Себе через 5 лет»"
            maxLength={200}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle()}>Содержимое</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Что ты хочешь сохранить, передать, напомнить?"
            rows={6}
            maxLength={20000}
            style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
          />
          <div style={{ color: palette.inkDim, fontSize: 11, marginTop: 4 }}>
            {content.length} / 20000
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle()}>Категория</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={inputStyle}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle()}>Открыть</label>
            <input
              type="date"
              value={unlockDate}
              min={minDate}
              onChange={(e) => setUnlockDate(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[
            { label: "+30 дней", days: 30 },
            { label: "+1 год", days: 365 },
            { label: "+5 лет", days: 365 * 5 },
            { label: "+10 лет", days: 365 * 10 },
          ].map((q) => (
            <button
              type="button"
              key={q.label}
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + q.days);
                setUnlockDate(d.toISOString().slice(0, 10));
              }}
              style={{
                background: "transparent",
                border: `1px solid ${palette.gold}40`,
                color: palette.goldSoft,
                fontSize: 11,
                padding: "5px 10px",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {q.label}
            </button>
          ))}
        </div>

        {err && (
          <div
            style={{
              padding: "8px 12px",
              background: `${palette.danger}18`,
              border: `1px solid ${palette.danger}40`,
              borderRadius: 8,
              color: palette.danger,
              fontSize: 13,
            }}
          >
            {err}
          </div>
        )}
        {ok && (
          <div
            style={{
              padding: "8px 12px",
              background: `${palette.success}18`,
              border: `1px solid ${palette.success}40`,
              borderRadius: 8,
              color: palette.success,
              fontSize: 13,
            }}
          >
            {ok}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            background: canSubmit
              ? `linear-gradient(90deg, ${palette.gold}, ${palette.goldSoft})`
              : `${palette.gold}40`,
            border: "none",
            color: canSubmit ? palette.navy : palette.inkDim,
            padding: "12px 18px",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.05em",
            cursor: canSubmit ? "pointer" : "not-allowed",
            transition: "all 0.2s ease",
            fontFamily: "inherit",
          }}
        >
          {busy ? "Запечатываем…" : "✦ Запечатать капсулу"}
        </button>
      </div>
    </form>
  );
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    color: palette.inkDim,
    fontSize: 11,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    marginBottom: 6,
  };
}
