"use client";

import { useState } from "react";
import type { Priority } from "./TaskCard";

interface AddTaskFormProps {
  onAdd: (payload: {
    title: string;
    description?: string;
    priority: Priority;
    dueDate?: string;
    tags?: string[];
  }) => void;
  busy: boolean;
}

const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];

const PRIORITY_ACTIVE: Record<Priority, string> = {
  low: "#64748b",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

export default function AddTaskForm({ onAdd, busy }: AddTaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [open, setOpen] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setTags("");
    setOpen(false);
  }

  return (
    <div style={{ marginBottom: "16px" }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            width: "100%",
            padding: "10px",
            background: "rgba(249,115,22,0.1)",
            border: "1px dashed rgba(249,115,22,0.4)",
            borderRadius: "10px",
            color: "#f97316",
            fontSize: "13px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Add task
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "rgba(15,23,42,0.8)",
            border: "1px solid rgba(249,115,22,0.3)",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <div style={{ marginBottom: "10px" }}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title *"
              autoFocus
              required
              style={{
                width: "100%",
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: "8px",
                padding: "8px 12px",
                color: "#e2e8f0",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              style={{
                width: "100%",
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: "8px",
                padding: "8px 12px",
                color: "#e2e8f0",
                fontSize: "12px",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                style={{
                  padding: "4px 12px",
                  borderRadius: "20px",
                  border: `1px solid ${priority === p ? PRIORITY_ACTIVE[p] : "rgba(148,163,184,0.2)"}`,
                  background:
                    priority === p ? `${PRIORITY_ACTIVE[p]}22` : "transparent",
                  color: priority === p ? PRIORITY_ACTIVE[p] : "#94a3b8",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{
                flex: 1,
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: "8px",
                padding: "6px 10px",
                color: "#e2e8f0",
                fontSize: "12px",
                outline: "none",
              }}
            />
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tags, comma, separated"
              style={{
                flex: 2,
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: "8px",
                padding: "6px 10px",
                color: "#e2e8f0",
                fontSize: "12px",
                outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="submit"
              disabled={busy || !title.trim()}
              style={{
                padding: "8px 20px",
                background: "#f97316",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: busy || !title.trim() ? "not-allowed" : "pointer",
                opacity: busy || !title.trim() ? 0.5 : 1,
              }}
            >
              {busy ? "Adding…" : "Add task"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                padding: "8px 14px",
                background: "transparent",
                border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: "8px",
                color: "#94a3b8",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
