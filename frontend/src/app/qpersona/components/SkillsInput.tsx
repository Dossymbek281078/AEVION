"use client";

import { useState, type KeyboardEvent } from "react";

interface SkillsInputProps {
  value: string[];
  onChange: (skills: string[]) => void;
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "2px 10px",
  borderRadius: "9999px",
  background: "#4c1d95",
  border: "1px solid #7c3aed",
  color: "#c4b5fd",
  fontSize: "13px",
  fontWeight: 500,
};

const removeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#a78bfa",
  cursor: "pointer",
  padding: "0 0 0 2px",
  fontSize: "14px",
  lineHeight: 1,
};

export default function SkillsInput({ value, onChange }: SkillsInputProps) {
  const [input, setInput] = useState("");

  function addSkill(raw: string) {
    const skill = raw.trim();
    if (!skill || value.includes(skill) || value.length >= 30) return;
    onChange([...value, skill]);
    setInput("");
  }

  function removeSkill(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeSkill(value.length - 1);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          padding: "8px",
          background: "#0f0f1a",
          border: "1px solid #3b1f7a",
          borderRadius: "8px",
          minHeight: "44px",
          cursor: "text",
        }}
        onClick={() => document.getElementById("skills-input-field")?.focus()}
      >
        {value.map((skill, i) => (
          <span key={i} style={chipStyle}>
            {skill}
            <button type="button" style={removeBtn} onClick={() => removeSkill(i)} aria-label={`Remove ${skill}`}>
              x
            </button>
          </span>
        ))}
        <input
          id="skills-input-field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => addSkill(input)}
          placeholder={value.length === 0 ? "TypeScript, React, Node.js — Enter to add" : ""}
          style={{
            flex: 1,
            minWidth: "120px",
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#e2e8f0",
            fontSize: "13px",
          }}
        />
      </div>
      <div style={{ fontSize: "11px", color: "#64748b" }}>
        {value.length} / 30 skills — Press Enter or comma to add
      </div>
    </div>
  );
}
