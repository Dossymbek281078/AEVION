"use client";

import { CSSProperties, useState } from "react";

type Mood = "hopeful" | "peaceful" | "joyful" | "reflective" | "uplifting";

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(58,42,20,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
  padding: 20,
  overflow: "auto",
};

const modalStyle: CSSProperties = {
  background: "#fffaf2",
  borderRadius: 20,
  padding: 28,
  maxWidth: 560,
  width: "100%",
  maxHeight: "90vh",
  overflow: "auto",
  boxShadow: "0 25px 60px rgba(58,42,20,0.4)",
  border: "1px solid #f0d4a0",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
};

const titleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#3a2a14",
  margin: 0,
};

const closeStyle: CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 24,
  color: "#8a7250",
  cursor: "pointer",
  padding: 4,
  lineHeight: 1,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 1.1,
  color: "#8a7250",
  marginBottom: 6,
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #e5d4b8",
  background: "#fff",
  fontSize: 14,
  color: "#3a2a14",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 140,
  resize: "vertical",
  lineHeight: 1.5,
};

const submitBtnStyle: CSSProperties = {
  background: "linear-gradient(135deg, #d97f3a, #c75a1f)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 20px",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(199,90,31,0.25)",
};

const submitBtnDisabledStyle: CSSProperties = {
  ...submitBtnStyle,
  opacity: 0.6,
  cursor: "not-allowed",
};

const errStyle: CSSProperties = {
  background: "#ffe0d6",
  border: "1px solid #f5b89e",
  color: "#9c3a16",
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 13,
};

const okStyle: CSSProperties = {
  background: "#e5f5e0",
  border: "1px solid #b6dfa6",
  color: "#3d6b27",
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 13,
};

const fieldStyle: CSSProperties = { marginBottom: 14 };

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    artistAlias: string;
    language: string;
    mood: Mood;
    lyrics: string;
    audioUrl: string;
  }) => Promise<{ ok: boolean; message?: string }>;
};

const LANG_OPTIONS = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "kk", label: "Қазақша" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
  { value: "ar", label: "العربية" },
  { value: "pt", label: "Português" },
];

const MOOD_OPTIONS: { value: Mood; label: string }[] = [
  { value: "hopeful", label: "Надежда 🌅" },
  { value: "peaceful", label: "Покой 🕊️" },
  { value: "joyful", label: "Радость 💃" },
  { value: "reflective", label: "Размышление 🌙" },
  { value: "uplifting", label: "Подъём 🔥" },
];

export default function SubmitTrackModal({ open, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [artistAlias, setArtistAlias] = useState("");
  const [language, setLanguage] = useState("ru");
  const [mood, setMood] = useState<Mood>("hopeful");
  const [lyrics, setLyrics] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setTitle("");
    setArtistAlias("");
    setLanguage("ru");
    setMood("hopeful");
    setLyrics("");
    setAudioUrl("");
    setErr(null);
    setOk(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!title.trim() || !artistAlias.trim() || !lyrics.trim()) {
      setErr("Заполните название, псевдоним и текст.");
      return;
    }
    setSubmitting(true);
    const result = await onSubmit({
      title: title.trim(),
      artistAlias: artistAlias.trim(),
      language,
      mood,
      lyrics: lyrics.trim(),
      audioUrl: audioUrl.trim(),
    });
    setSubmitting(false);
    if (result.ok) {
      setOk("Трек принят и опубликован. Спасибо!");
      reset();
      setTimeout(() => {
        setOk(null);
        onClose();
      }, 1500);
    } else {
      setErr(result.message ?? "Ошибка отправки");
    }
  }

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Подать свой трек</h2>
          <button type="button" style={closeStyle} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="voe-title">
              Название трека
            </label>
            <input
              id="voe-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              style={inputStyle}
              placeholder="Например: Утро над миром"
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="voe-alias">
              Псевдоним автора
            </label>
            <input
              id="voe-alias"
              type="text"
              value={artistAlias}
              onChange={(e) => setArtistAlias(e.target.value)}
              maxLength={60}
              style={inputStyle}
              placeholder="Псевдоним, не email"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle} htmlFor="voe-lang">
                Язык
              </label>
              <select
                id="voe-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={inputStyle}
              >
                {LANG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="voe-mood">
                Настроение
              </label>
              <select
                id="voe-mood"
                value={mood}
                onChange={(e) => setMood(e.target.value as Mood)}
                style={inputStyle}
              >
                {MOOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="voe-lyrics">
              Текст песни
            </label>
            <textarea
              id="voe-lyrics"
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              maxLength={10000}
              style={textareaStyle}
              placeholder="Короткий, позитивный текст вашей песни…"
            />
            <div style={{ fontSize: 11, color: "#a89479", marginTop: 4 }}>
              {lyrics.length} / 10000
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="voe-audio">
              Ссылка на аудио (необязательно)
            </label>
            <input
              id="voe-audio"
              type="url"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              maxLength={500}
              style={inputStyle}
              placeholder="https://…"
            />
          </div>
          {err && <div style={{ ...errStyle, marginBottom: 12 }}>{err}</div>}
          {ok && <div style={{ ...okStyle, marginBottom: 12 }}>{ok}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid #e5d4b8",
                borderRadius: 10,
                padding: "12px 20px",
                fontSize: 14,
                color: "#5b4a2e",
                cursor: "pointer",
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={submitting ? submitBtnDisabledStyle : submitBtnStyle}
            >
              {submitting ? "Отправка…" : "Опубликовать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
