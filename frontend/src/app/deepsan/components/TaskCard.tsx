"use client";

export type Priority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  done: boolean;
  due_date: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface TaskCardProps {
  task: Task;
  onToggleDone: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
  onStartFocus?: (taskId: number) => void;
}

const PRIORITY_COLOR: Record<Priority, string> = {
  low: "#64748b",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const PRIORITY_BG: Record<Priority, string> = {
  low: "rgba(100,116,139,0.15)",
  medium: "rgba(245,158,11,0.15)",
  high: "rgba(249,115,22,0.15)",
  critical: "rgba(239,68,68,0.15)",
};

export default function TaskCard({ task, onToggleDone, onDelete, onStartFocus }: TaskCardProps) {
  return (
    <div
      style={{
        background: task.done ? "rgba(15,23,42,0.4)" : "rgba(15,23,42,0.75)",
        border: `1px solid ${task.done ? "rgba(148,163,184,0.08)" : "rgba(148,163,184,0.15)"}`,
        borderRadius: "10px",
        padding: "12px",
        marginBottom: "8px",
        opacity: task.done ? 0.6 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <button
          onClick={() => onToggleDone(task.id, !task.done)}
          style={{
            width: "18px",
            height: "18px",
            minWidth: "18px",
            borderRadius: "4px",
            border: `2px solid ${task.done ? "#22c55e" : "rgba(148,163,184,0.4)"}`,
            background: task.done ? "#22c55e" : "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            marginTop: "2px",
          }}
          title={task.done ? "Mark as todo" : "Mark as done"}
        >
          {task.done && (
            <span style={{ color: "#fff", fontSize: "11px", lineHeight: 1 }}>✓</span>
          )}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: task.done ? "#64748b" : "#e2e8f0",
              textDecoration: task.done ? "line-through" : "none",
              wordBreak: "break-word",
            }}
          >
            {task.title}
          </div>
          {task.description && (
            <div
              style={{
                fontSize: "11px",
                color: "#64748b",
                marginTop: "3px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {task.description}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: PRIORITY_COLOR[task.priority],
                background: PRIORITY_BG[task.priority],
                borderRadius: "4px",
                padding: "1px 6px",
              }}
            >
              {task.priority}
            </span>
            {task.due_date && (
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                due {task.due_date}
              </span>
            )}
            {task.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "10px",
                  color: "#94a3b8",
                  background: "rgba(148,163,184,0.1)",
                  borderRadius: "4px",
                  padding: "1px 5px",
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px", marginTop: "8px", justifyContent: "flex-end" }}>
        {onStartFocus && !task.done && (
          <button
            onClick={() => onStartFocus(task.id)}
            style={{
              fontSize: "10px",
              color: "#f97316",
              background: "rgba(249,115,22,0.12)",
              border: "1px solid rgba(249,115,22,0.25)",
              borderRadius: "6px",
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            Focus
          </button>
        )}
        <button
          onClick={() => onDelete(task.id)}
          style={{
            fontSize: "10px",
            color: "#ef4444",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "6px",
            padding: "3px 8px",
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
