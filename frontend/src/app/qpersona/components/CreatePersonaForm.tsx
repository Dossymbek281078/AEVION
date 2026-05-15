"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import SkillsInput from "./SkillsInput";

interface PersonaRecord {
  alias: string;
  display_name: string;
  bio?: string | null;
  avatar_prompt?: string | null;
  skills?: string[];
  links?: string[];
}

interface CreatePersonaFormProps {
  onCreated: (persona: PersonaRecord) => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0f0f1a",
  border: "1px solid #3b1f7a",
  borderRadius: "8px",
  padding: "10px 12px",
  color: "#e2e8f0",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#a78bfa",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

export default function CreatePersonaForm({ onCreated }: CreatePersonaFormProps) {
  const [alias, setAlias] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [linksRaw, setLinksRaw] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiBioLoading, setAiBioLoading] = useState(false);
  const [aiBioError, setAiBioError] = useState<string | null>(null);

  const aliasValid = /^[a-z0-9_-]{3,30}$/.test(alias);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const links = linksRaw.split("\n").map((l) => l.trim()).filter(Boolean);
      const res = await fetch(apiUrl("/api/qpersona/personas"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias, displayName, bio, avatarPrompt, skills, links }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onCreated(data.persona);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleAiBio() {
    if (!alias || !aliasValid) {
      setAiBioError("Create the persona first or ensure alias is valid.");
      return;
    }
    if (skills.length === 0 && !bio) {
      setAiBioError("Add skills or a bio draft first.");
      return;
    }
    setAiBioLoading(true);
    setAiBioError(null);
    try {
      // If persona doesn't exist yet, create a temporary stub check is skipped —
      // user must create first; but we allow AI generation by using a local call.
      const res = await fetch(apiUrl("/api/qcoreai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are a professional bio writer for digital personas. " +
                "Write a concise, engaging professional bio (2-4 sentences, max 300 characters) " +
                "based on the name, skills, and draft bio. Return ONLY the bio text.",
            },
            {
              role: "user",
              content: `Name: ${displayName || alias}\nSkills: ${skills.join(", ") || "not specified"}\nDraft: ${bio || "none"}`,
            },
          ],
          temperature: 0.7,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const generated = (data.reply ?? "").trim().slice(0, 500);
      if (generated) setBio(generated);
    } catch (e) {
      setAiBioError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBioLoading(false);
    }
  }

  return (
    <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Alias */}
        <div style={fieldStyle}>
          <label style={labelStyle}>
            Alias <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            placeholder="john-doe"
            required
            maxLength={30}
            style={{
              ...inputStyle,
              borderColor: alias && !aliasValid ? "#ef4444" : "#3b1f7a",
            }}
          />
          <span style={{ fontSize: "11px", color: alias && !aliasValid ? "#ef4444" : "#64748b" }}>
            3-30 chars, lowercase letters, digits, hyphens, underscores
          </span>
        </div>

        {/* Display Name */}
        <div style={fieldStyle}>
          <label style={labelStyle}>
            Display Name <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="John Doe"
            required
            maxLength={120}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Skills */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Skills</label>
        <SkillsInput value={skills} onChange={setSkills} />
      </div>

      {/* Bio */}
      <div style={fieldStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Bio</label>
          <button
            type="button"
            onClick={handleAiBio}
            disabled={aiBioLoading}
            style={{
              padding: "4px 12px",
              borderRadius: "8px",
              background: aiBioLoading ? "#1e1b4b" : "#4f46e5",
              border: "1px solid #6366f1",
              color: "#e0e7ff",
              fontSize: "12px",
              cursor: aiBioLoading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {aiBioLoading ? "Generating..." : "AI Generate Bio"}
          </button>
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Short professional bio..."
          rows={4}
          maxLength={2000}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        {aiBioError && (
          <span style={{ fontSize: "12px", color: "#f87171" }}>{aiBioError}</span>
        )}
      </div>

      {/* Avatar Prompt */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Avatar Seed (colors phrase)</label>
        <input
          value={avatarPrompt}
          onChange={(e) => setAvatarPrompt(e.target.value)}
          placeholder="deep ocean calm focused"
          maxLength={500}
          style={inputStyle}
        />
        <span style={{ fontSize: "11px", color: "#64748b" }}>
          Phrase that seeds the deterministic avatar color palette
        </span>
      </div>

      {/* Links */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Links (one per line)</label>
        <textarea
          value={linksRaw}
          onChange={(e) => setLinksRaw(e.target.value)}
          placeholder="github.com/johndoe&#10;linkedin.com/in/johndoe"
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {error && (
        <div style={{
          padding: "10px 14px",
          borderRadius: "8px",
          background: "#450a0a",
          border: "1px solid #7f1d1d",
          color: "#fca5a5",
          fontSize: "13px",
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !alias || !displayName || !aliasValid}
        style={{
          padding: "12px 24px",
          borderRadius: "10px",
          background: loading ? "#2d1054" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
          border: "none",
          color: "#fff",
          fontSize: "15px",
          fontWeight: 700,
          cursor: loading || !alias || !displayName || !aliasValid ? "not-allowed" : "pointer",
          opacity: loading || !alias || !displayName || !aliasValid ? 0.6 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {loading ? "Creating..." : "Create Persona"}
      </button>
    </form>
  );
}
