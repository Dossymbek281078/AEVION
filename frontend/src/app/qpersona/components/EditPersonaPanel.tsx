"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

interface Persona {
  id?: number;
  alias: string;
  display_name: string;
  bio?: string | null;
  avatar_prompt?: string | null;
  skills?: string[];
  links?: string[];
  created_at?: string;
}

interface Props {
  persona: Persona;
  onUpdated: (p: Persona) => void;
  onClose: () => void;
}

export default function EditPersonaPanel({ persona, onUpdated, onClose }: Props) {
  const [bio, setBio] = useState(persona.bio ?? "");
  const [avatarPrompt, setAvatarPrompt] = useState(persona.avatar_prompt ?? "");
  const [skillsText, setSkillsText] = useState((persona.skills ?? []).join(", "));
  const [linksText, setLinksText] = useState((persona.links ?? []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const body = {
        bio: bio.trim() || null,
        avatarPrompt: avatarPrompt.trim() || null,
        skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30),
        links: linksText.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20),
      };
      const r = await fetch(apiUrl(`/api/qpersona/personas/${persona.alias}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        setMsg("✓ Saved");
        onUpdated(j.persona);
      } else {
        setMsg(`✗ ${j.error ?? "save failed"}`);
      }
    } catch { setMsg("✗ network error"); }
    finally { setSaving(false); }
  };

  const regenerateBio = async () => {
    setAiBusy(true); setMsg(null);
    try {
      const r = await fetch(apiUrl(`/api/qpersona/personas/${persona.alias}/ai-bio`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        setBio(j.bio);
        setMsg(`✓ AI bio (${j.provider}/${j.model})`);
        if (j.persona) onUpdated(j.persona);
      } else {
        setMsg(`✗ ${j.error ?? "AI bio failed"}`);
      }
    } catch { setMsg("✗ network error"); }
    finally { setAiBusy(false); }
  };

  return (
    <form onSubmit={save} style={S.panel}>
      <div style={S.header}>
        <h3 style={S.title}>Edit @{persona.alias}</h3>
        <button type="button" onClick={onClose} style={S.closeBtn}>✕</button>
      </div>

      <label style={S.label}>
        <span style={S.labelText}>Bio</span>
        <div style={S.bioRow}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="A concise professional bio…"
            style={S.textarea}
          />
        </div>
        <button type="button" onClick={regenerateBio} disabled={aiBusy} style={S.aiBtn}>
          {aiBusy ? "…" : "✨ Regenerate with AI"}
        </button>
        <span style={S.hint}>{bio.length}/2000 chars</span>
      </label>

      <label style={S.label}>
        <span style={S.labelText}>Avatar prompt (text only — used by avatar generator)</span>
        <input
          value={avatarPrompt}
          onChange={(e) => setAvatarPrompt(e.target.value)}
          maxLength={500}
          placeholder="e.g.: cyberpunk portrait, neon, retro-future"
          style={S.input}
        />
      </label>

      <label style={S.label}>
        <span style={S.labelText}>Skills (comma-separated, up to 30)</span>
        <input
          value={skillsText}
          onChange={(e) => setSkillsText(e.target.value)}
          placeholder="rust, distributed systems, ML, …"
          style={S.input}
        />
      </label>

      <label style={S.label}>
        <span style={S.labelText}>Links (one per line, up to 20)</span>
        <textarea
          value={linksText}
          onChange={(e) => setLinksText(e.target.value)}
          rows={3}
          placeholder={"https://github.com/…\nhttps://twitter.com/…"}
          style={S.textarea}
        />
      </label>

      {msg && (
        <div style={{
          ...S.msg,
          background: msg.startsWith("✓") ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
          border: msg.startsWith("✓") ? "1px solid #34d399" : "1px solid #f87171",
          color: msg.startsWith("✓") ? "#6ee7b7" : "#fca5a5",
        }}>
          {msg}
        </div>
      )}

      <div style={S.btnRow}>
        <button type="button" onClick={onClose} style={S.cancelBtn}>Cancel</button>
        <button type="submit" disabled={saving} style={S.saveBtn}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

const S: Record<string, React.CSSProperties> = {
  panel: {
    background: "linear-gradient(135deg, #0d0720 0%, #050510 100%)",
    border: "1px solid #2d1054",
    borderRadius: 16,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: "#c4b5fd" },
  closeBtn: {
    background: "transparent", border: "1px solid #334155", color: "#64748b",
    borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 14,
  },
  label: { display: "flex", flexDirection: "column", gap: 6 },
  labelText: { fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 },
  input: {
    background: "#050510", border: "1px solid #2d1054",
    borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 14, outline: "none",
  },
  textarea: {
    background: "#050510", border: "1px solid #2d1054",
    borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 14, outline: "none",
    fontFamily: "inherit", resize: "vertical", width: "100%",
  },
  bioRow: { display: "flex", flexDirection: "column" },
  aiBtn: {
    alignSelf: "flex-start",
    background: "linear-gradient(135deg, #4f46e5, #7c3aed)", border: "none",
    color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
  hint: { fontSize: 11, color: "#64748b", fontFamily: "monospace", alignSelf: "flex-end" },
  msg: { padding: "8px 12px", borderRadius: 8, fontSize: 13 },
  btnRow: { display: "flex", gap: 10, justifyContent: "flex-end" },
  cancelBtn: {
    background: "transparent", border: "1px solid #334155", color: "#94a3b8",
    borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600,
  },
  saveBtn: {
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", color: "#fff",
    borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700,
  },
};
