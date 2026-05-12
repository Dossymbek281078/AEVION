"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type Stack = "next" | "express" | "static" | "react" | "python";
type ProjectStatus = "draft" | "building" | "live" | "error";

interface Project {
  id: string;
  name: string;
  description: string | null;
  stack: Stack;
  status: ProjectStatus;
  deployUrl: string | null;
  repoUrl: string | null;
  customDomain: string | null;
  envVars: Record<string, string>;
  collaborators: Array<{ userId: string; role: string }>;
  createdAt: string;
  updatedAt: string;
}

interface FileItem {
  id: string;
  path: string;
  content: string;
  language: string;
  updatedAt: string;
}

interface Deployment {
  id: string;
  status: string;
  deployUrl: string | null;
  triggeredAt: string;
  completedAt: string | null;
}

interface Template {
  id: string;
  name: string;
  description: string;
  stack: string;
}

const STACK_LABELS: Record<string, string> = {
  next: "Next.js", express: "Express", static: "Static", react: "React", python: "Python",
};

const STACK_COLORS: Record<string, string> = {
  next: "#0d9488", express: "#7c3aed", static: "#0369a1", react: "#0284c7", python: "#b45309",
};

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "#f1f5f9", fg: "#64748b" },
  building: { bg: "#fef3c7", fg: "#92400e" },
  live: { bg: "#d1fae5", fg: "#065f46" },
  error: { bg: "#fee2e2", fg: "#991b1b" },
};

const LANG_COLORS: Record<string, string> = {
  typescript: "#3b82f6", javascript: "#f59e0b", python: "#10b981",
  html: "#f97316", css: "#8b5cf6", json: "#64748b", markdown: "#94a3b8",
  plaintext: "#94a3b8",
};

// Subtle syntax background tints per language
const LANG_BG_TINTS: Record<string, string> = {
  typescript: "rgba(59,130,246,0.03)",
  javascript: "rgba(251,191,36,0.03)",
  css: "rgba(139,92,246,0.03)",
  html: "rgba(249,115,22,0.03)",
  python: "rgba(16,185,129,0.03)",
};

function Toast({ message, type, onClose }: { message: string; type: "success" | "error" | "info"; onClose: () => void }) {
  const bg = type === "success" ? "#d1fae5" : type === "error" ? "#fee2e2" : "#dbeafe";
  const fg = type === "success" ? "#065f46" : type === "error" ? "#991b1b" : "#1e40af";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, background: bg, color: fg,
      padding: "12px 18px", borderRadius: 10, fontWeight: 600, fontSize: 14,
      boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 200, maxWidth: 380,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: fg, fontWeight: 800 }}>x</button>
    </div>
  );
}

// Context menu for file rename/delete
function FileContextMenu({
  x, y, onRename, onDelete, onClose,
}: { x: number; y: number; onRename: () => void; onDelete: () => void; onClose: () => void }) {
  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return (
    <div
      style={{
        position: "fixed", left: x, top: y, background: "#fff", border: "1px solid #e2e8f0",
        borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 300, minWidth: 140, overflow: "hidden",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => { onRename(); onClose(); }}
        style={{ display: "block", width: "100%", padding: "9px 14px", border: "none", background: "none", textAlign: "left", fontSize: 13, cursor: "pointer", color: "#0f172a" }}
      >
        Rename
      </button>
      <button
        onClick={() => { onDelete(); onClose(); }}
        style={{ display: "block", width: "100%", padding: "9px 14px", border: "none", background: "none", textAlign: "left", fontSize: 13, cursor: "pointer", color: "#ef4444" }}
      >
        Delete
      </button>
    </div>
  );
}

export default function DevHubProjectPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // AI Chat state
  const [activeTab, setActiveTab] = useState<"chat" | "templates" | "env" | "deployments" | "settings">("chat");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<Array<{ path: string; language: string }>>([]);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);

  // Env vars
  const [envList, setEnvList] = useState<Array<{ key: string; value: string; set: boolean }>>([]);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");

  // Deployments
  const [deployments, setDeployments] = useState<Deployment[]>([]);

  // New file
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  // Build log panel (SSE)
  const [buildLog, setBuildLog] = useState<string[]>([]);
  const [buildDone, setBuildDone] = useState(false);
  const [buildLiveUrl, setBuildLiveUrl] = useState<string | null>(null);
  const [showBuildLog, setShowBuildLog] = useState(false);
  const buildLogRef = useRef<HTMLDivElement | null>(null);
  const currentDeployIdRef = useRef<string | null>(null);

  // File rename/delete context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileItem } | null>(null);
  const [renamingFile, setRenamingFile] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Settings state
  const [settingsName, setSettingsName] = useState("");
  const [settingsDesc, setSettingsDesc] = useState("");
  const [settingsDomain, setSettingsDomain] = useState("");
  const [settingsCollab, setSettingsCollab] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Line number gutter
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${id}`), { cache: "no-store" });
      if (!r.ok) throw new Error("Not found");
      const data = await r.json();
      setProject(data.project);
      setFiles(data.files || []);
      if (data.files?.length > 0 && !selectedFile) {
        const first = data.files[0];
        setSelectedFile(first);
        setEditorContent(first.content);
      }
    } catch {
      showToast("Failed to load project", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    fetch(apiUrl("/api/devhub/templates"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {});
  }, []);

  // Sync settings form from project
  useEffect(() => {
    if (project) {
      setSettingsName(project.name);
      setSettingsDesc(project.description ?? "");
      setSettingsDomain(project.customDomain ?? "");
    }
  }, [project]);

  // Auto-scroll build log
  useEffect(() => {
    if (buildLogRef.current) {
      buildLogRef.current.scrollTop = buildLogRef.current.scrollHeight;
    }
  }, [buildLog]);

  const loadFile = async (file: FileItem) => {
    if (selectedFile?.path !== file.path) {
      setSelectedFile(file);
      setEditorContent(file.content);
    }
  };

  const saveCurrentFile = useCallback(async (path: string, content: string, language: string) => {
    if (!project) return;
    setSaving(true);
    try {
      await fetch(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(path)}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, language }),
      });
      setFiles((fs) => fs.map((f) => f.path === path ? { ...f, content, updatedAt: new Date().toISOString() } : f));
    } catch {
      showToast("Save failed", "error");
    } finally {
      setSaving(false);
    }
  }, [project]);

  const handleEditorChange = (value: string) => {
    setEditorContent(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (selectedFile) {
        saveCurrentFile(selectedFile.path, value, selectedFile.language);
      }
    }, 1500);
  };

  const handleEditorBlur = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (selectedFile) {
      saveCurrentFile(selectedFile.path, editorContent, selectedFile.language);
    }
  };

  // Sync gutter scroll with textarea scroll
  const handleTextareaScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const createNewFile = async () => {
    if (!newFileName.trim() || !project) return;
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(newFileName.trim())}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "", language: "plaintext" }),
      });
      const data = await r.json();
      const newFile = data.file;
      setFiles((fs) => [...fs, newFile].sort((a, b) => a.path.localeCompare(b.path)));
      setSelectedFile(newFile);
      setEditorContent("");
      setShowNewFile(false);
      setNewFileName("");
    } catch {
      showToast("Failed to create file", "error");
    }
  };

  const deleteFile = async (path: string) => {
    if (!project) return;
    if (!confirm(`Delete ${path}?`)) return;
    try {
      await fetch(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(path)}`), { method: "DELETE" });
      const remaining = files.filter((f) => f.path !== path);
      setFiles(remaining);
      if (selectedFile?.path === path) {
        const next = remaining[0] ?? null;
        setSelectedFile(next);
        setEditorContent(next?.content ?? "");
      }
    } catch {
      showToast("Delete failed", "error");
    }
  };

  const renameFile = async (oldPath: string, newPath: string) => {
    if (!project || !newPath.trim() || oldPath === newPath.trim()) {
      setRenamingFile(null);
      return;
    }
    try {
      // Get current content
      const file = files.find((f) => f.path === oldPath);
      if (!file) return;
      // Create new file with new path
      await fetch(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(newPath.trim())}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: file.content, language: file.language }),
      });
      // Delete old file
      await fetch(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(oldPath)}`), { method: "DELETE" });
      // Update state
      setFiles((fs) => {
        const updated = fs.map((f) => f.path === oldPath ? { ...f, path: newPath.trim() } : f);
        return updated.sort((a, b) => a.path.localeCompare(b.path));
      });
      if (selectedFile?.path === oldPath) {
        setSelectedFile((sf) => sf ? { ...sf, path: newPath.trim() } : null);
      }
      showToast("File renamed", "success");
    } catch {
      showToast("Rename failed", "error");
    } finally {
      setRenamingFile(null);
    }
  };

  const generateCode = async () => {
    if (!aiPrompt.trim() || !project) return;
    setGenerating(true);
    setGeneratedFiles([]);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/generate`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, stack: project.stack }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Generation failed");
      const newGenerated = data.files || [];
      setGeneratedFiles(newGenerated.map((f: any) => ({ path: f.path, language: f.language })));
      // Reload files list
      const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
      const listData = await listR.json();
      setFiles(listData.files || []);
      showToast(`Generated ${newGenerated.length} file(s)`, "success");
      setAiPrompt("");
    } catch (e: any) {
      showToast(e.message || "Generation failed", "error");
    } finally {
      setGenerating(false);
    }
  };

  // Connect to SSE log stream for a given deploymentId
  const streamBuildLog = useCallback((projectId: string, deploymentId: string) => {
    setBuildLog([]);
    setBuildDone(false);
    setBuildLiveUrl(null);
    setShowBuildLog(true);
    currentDeployIdRef.current = deploymentId;

    const es = new EventSource(apiUrl(`/api/devhub/projects/${projectId}/deployments/${deploymentId}/log`));
    es.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload.done) {
          setBuildDone(true);
          setBuildLiveUrl(payload.deployUrl ?? null);
          es.close();
        } else if (payload.line) {
          setBuildLog((prev) => [...prev, payload.line]);
        }
      } catch {
        // ignore parse errors
      }
    };
    es.onerror = () => {
      es.close();
    };
  }, []);

  const deploy = async () => {
    if (!project) return;
    setDeploying(true);
    showToast("Building...", "info");
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/deploy`), { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Deploy failed");
      const deploymentId: string = data.deploymentId;
      // Start streaming build log
      streamBuildLog(project.id, deploymentId);
      // After simulation window, refresh project
      setTimeout(async () => {
        const projR = await fetch(apiUrl(`/api/devhub/projects/${project.id}`), { cache: "no-store" });
        const projData = await projR.json();
        setProject(projData.project);
        setDeploying(false);
        if (activeTab === "deployments") fetchDeployments();
      }, 4000);
    } catch (e: any) {
      showToast(e.message || "Deploy failed", "error");
      setDeploying(false);
    }
  };

  const fetchDeployments = useCallback(async () => {
    if (!project) return;
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/deployments`), { cache: "no-store" });
      const data = await r.json();
      setDeployments(data.deployments || []);
    } catch {}
  }, [project]);

  useEffect(() => {
    if (activeTab === "deployments" && project) fetchDeployments();
  }, [activeTab, fetchDeployments, project]);

  const fetchEnv = useCallback(async () => {
    if (!project) return;
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/env`), { cache: "no-store" });
      const data = await r.json();
      setEnvList(data.env || []);
    } catch {}
  }, [project]);

  useEffect(() => {
    if (activeTab === "env" && project) fetchEnv();
  }, [activeTab, fetchEnv, project]);

  const addEnvVar = async () => {
    if (!newEnvKey.trim() || !project) return;
    try {
      await fetch(apiUrl(`/api/devhub/projects/${project.id}/env`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newEnvKey, value: newEnvVal }),
      });
      setNewEnvKey(""); setNewEnvVal("");
      fetchEnv();
      showToast("Env var saved", "success");
    } catch { showToast("Failed to save", "error"); }
  };

  const removeEnvVar = async (key: string) => {
    if (!project) return;
    try {
      await fetch(apiUrl(`/api/devhub/projects/${project.id}/env/${encodeURIComponent(key)}`), { method: "DELETE" });
      fetchEnv();
    } catch {}
  };

  const applyTemplate = async (templateId: string) => {
    if (!project) return;
    setApplyingTemplate(templateId);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/apply-template`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
      const listData = await listR.json();
      setFiles(listData.files || []);
      showToast(`Template applied — ${(data.files || []).length} files`, "success");
    } catch (e: any) {
      showToast(e.message || "Failed", "error");
    } finally {
      setApplyingTemplate(null);
    }
  };

  const saveSettings = async () => {
    if (!project) return;
    setSavingSettings(true);
    try {
      await fetch(apiUrl(`/api/devhub/projects/${project.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settingsName,
          description: settingsDesc || null,
          customDomain: settingsDomain || null,
        }),
      });
      setProject((p) => p ? { ...p, name: settingsName, description: settingsDesc || null, customDomain: settingsDomain || null } : p);
      showToast("Settings saved", "success");
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const addCollaborator = async () => {
    if (!project || !settingsCollab.trim()) return;
    try {
      await fetch(apiUrl(`/api/devhub/projects/${project.id}/collaborators`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: settingsCollab.trim(), role: "editor" }),
      });
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/collaborators`), { cache: "no-store" });
      const data = await r.json();
      setProject((p) => p ? { ...p, collaborators: data.collaborators || [] } : p);
      setSettingsCollab("");
      showToast("Collaborator added", "success");
    } catch {
      showToast("Failed to add collaborator", "error");
    }
  };

  const removeCollaborator = async (collabUserId: string) => {
    if (!project) return;
    try {
      await fetch(apiUrl(`/api/devhub/projects/${project.id}/collaborators/${encodeURIComponent(collabUserId)}`), { method: "DELETE" });
      setProject((p) => p ? { ...p, collaborators: p.collaborators.filter((c) => c.userId !== collabUserId) } : p);
    } catch {
      showToast("Failed to remove collaborator", "error");
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
        <div style={{ color: "#94a3b8" }}>Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#64748b" }}>Project not found.</p>
          <Link href="/devhub" style={{ color: "#0d9488", fontWeight: 700 }}>Back to DevHub</Link>
        </div>
      </div>
    );
  }

  const stackColor = STACK_COLORS[project.stack] ?? "#64748b";
  const statusStyle = STATUS_STYLES[project.status] ?? STATUS_STYLES.draft;
  const editorLang = selectedFile?.language ?? "plaintext";
  const editorBgTint = LANG_BG_TINTS[editorLang] ?? "transparent";

  // Compute line count for gutter
  const lineCount = editorContent.split("\n").length;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(15,23,42,0.1)", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href="/devhub" style={{ color: "#0d9488", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Back</Link>
        <Wave1Nav />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>{project.name}</span>
          <span style={{ padding: "3px 10px", borderRadius: 6, background: stackColor + "20", color: stackColor, fontSize: 12, fontWeight: 700 }}>
            {STACK_LABELS[project.stack] ?? project.stack}
          </span>
          <span style={{ padding: "3px 10px", borderRadius: 6, background: statusStyle.bg, color: statusStyle.fg, fontSize: 12, fontWeight: 600 }}>
            {project.status}
          </span>
          {saving && <span style={{ fontSize: 12, color: "#94a3b8" }}>Saving...</span>}
          {project.deployUrl && (
            <a href={project.deployUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#0d9488", textDecoration: "none", fontWeight: 600 }}>
              View live
            </a>
          )}
          <button
            onClick={deploy}
            disabled={deploying}
            style={{
              padding: "8px 18px", background: deploying ? "#99f6e4" : "#0d9488",
              color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
              cursor: deploying ? "not-allowed" : "pointer",
            }}
          >
            {deploying ? "Deploying..." : "Deploy"}
          </button>
        </div>
      </div>

      {/* Build Log Panel */}
      {showBuildLog && (
        <div style={{
          background: "#0f172a", color: "#94a3b8", fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
          fontSize: 12, lineHeight: 1.6, padding: "12px 20px", borderBottom: "1px solid #1e293b",
          maxHeight: 160, overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Build Log</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {buildDone && (
                <span style={{ padding: "2px 10px", borderRadius: 6, background: "#d1fae5", color: "#065f46", fontSize: 12, fontWeight: 700 }}>
                  Live
                </span>
              )}
              <button
                onClick={() => setShowBuildLog(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 16, lineHeight: 1 }}
              >x</button>
            </div>
          </div>
          <div ref={buildLogRef} style={{ flex: 1, overflowY: "auto" }}>
            {buildLog.map((line, i) => (
              <div key={i} style={{ color: line.includes("passed") || line.includes("complete") ? "#4ade80" : "#94a3b8" }}>
                {line}
              </div>
            ))}
            {buildDone && buildLiveUrl && (
              <div style={{ color: "#4ade80", marginTop: 4 }}>
                Live at: <a href={buildLiveUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#34d399" }}>{buildLiveUrl}</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main IDE area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", height: showBuildLog ? "calc(100vh - 220px)" : "calc(100vh - 60px)" }}>
        {/* File tree — left sidebar */}
        <div style={{ width: 260, background: "#fff", borderRight: "1px solid rgba(15,23,42,0.1)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Files</span>
            <button
              onClick={() => setShowNewFile(true)}
              style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, width: 24, height: 24, cursor: "pointer", color: "#64748b", fontWeight: 700, fontSize: 16, lineHeight: 1 }}
              title="New file"
            >+</button>
          </div>

          {showNewFile && (
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9" }}>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="src/component.tsx"
                style={{ width: "100%", padding: "5px 8px", border: "1px solid #0d9488", borderRadius: 6, fontSize: 12, boxSizing: "border-box" }}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") createNewFile(); if (e.key === "Escape") { setShowNewFile(false); setNewFileName(""); } }}
              />
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                <button onClick={createNewFile} style={{ flex: 1, padding: "4px 0", background: "#0d9488", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Create</button>
                <button onClick={() => { setShowNewFile(false); setNewFileName(""); }} style={{ flex: 1, padding: "4px 0", background: "#f1f5f9", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto" }}>
            {files.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
                No files yet.<br />Use AI to generate code or create a file.
              </div>
            ) : (
              files.map((f) => {
                const langColor = LANG_COLORS[f.language] ?? "#94a3b8";
                const isSelected = selectedFile?.path === f.path;
                const isRenaming = renamingFile?.path === f.path;
                return (
                  <div
                    key={f.path}
                    onClick={() => !isRenaming && loadFile(f)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, file: f });
                    }}
                    style={{
                      display: "flex", alignItems: "center", padding: "7px 12px",
                      cursor: "pointer", background: isSelected ? "#f0fdfa" : "transparent",
                      borderLeft: isSelected ? `3px solid #0d9488` : "3px solid transparent",
                      gap: 8,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: langColor, flexShrink: 0 }} />
                    {isRenaming ? (
                      <input
                        type="text"
                        value={renameValue}
                        autoFocus
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => renameFile(f.path, renameValue)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameFile(f.path, renameValue);
                          if (e.key === "Escape") setRenamingFile(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ flex: 1, fontSize: 12, padding: "2px 4px", border: "1px solid #0d9488", borderRadius: 4, outline: "none" }}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: isSelected ? "#0f172a" : "#374151", flex: 1, wordBreak: "break-all", lineHeight: 1.3 }}>
                        {f.path}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteFile(f.path); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 14, padding: 2, flexShrink: 0 }}
                      title="Delete file"
                    >x</button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Editor + AI panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Editor — top 60% */}
          <div style={{ flex: "0 0 60%", display: "flex", flexDirection: "column", borderBottom: "1px solid rgba(15,23,42,0.1)" }}>
            {selectedFile ? (
              <>
                <div style={{ padding: "8px 16px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{selectedFile.path}</span>
                  <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: (LANG_COLORS[selectedFile.language] ?? "#94a3b8") + "20", color: LANG_COLORS[selectedFile.language] ?? "#94a3b8", fontWeight: 600 }}>
                    {selectedFile.language}
                  </span>
                </div>
                {/* Editor with line number gutter */}
                <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "#1e293b", position: "relative" }}>
                  {/* Line number gutter */}
                  <div
                    ref={gutterRef}
                    style={{
                      width: 44, background: "#16213a", color: "#475569", fontSize: 12,
                      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
                      lineHeight: 1.7, paddingTop: 16, paddingBottom: 16,
                      textAlign: "right", paddingRight: 8, userSelect: "none",
                      overflowY: "hidden", flexShrink: 0,
                    }}
                  >
                    {Array.from({ length: lineCount }, (_, i) => (
                      <div key={i + 1}>{i + 1}</div>
                    ))}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={editorContent}
                    onChange={(e) => handleEditorChange(e.target.value)}
                    onBlur={handleEditorBlur}
                    onScroll={handleTextareaScroll}
                    style={{
                      flex: 1, border: "none", outline: "none", resize: "none",
                      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
                      fontSize: 13, lineHeight: 1.7, padding: "16px 20px",
                      background: editorBgTint !== "transparent"
                        ? `linear-gradient(${editorBgTint}, ${editorBgTint}), #1e293b`
                        : "#1e293b",
                      color: "#e2e8f0", boxSizing: "border-box",
                      tabSize: 2,
                    }}
                    spellCheck={false}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const start = e.currentTarget.selectionStart;
                        const end = e.currentTarget.selectionEnd;
                        const val = editorContent;
                        const next = val.substring(0, start) + "  " + val.substring(end);
                        setEditorContent(next);
                        requestAnimationFrame(() => {
                          e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                        });
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#1e293b", color: "#64748b" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>Select a file or use AI to generate code</div>
                </div>
              </div>
            )}
          </div>

          {/* AI Panel — bottom 40% */}
          <div style={{ flex: "0 0 40%", display: "flex", flexDirection: "column", background: "#fff" }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9", gap: 0, overflowX: "auto" }}>
              {(["chat", "templates", "env", "deployments", "settings"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "10px 14px", border: "none", background: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                    color: activeTab === tab ? "#0d9488" : "#64748b",
                    borderBottom: activeTab === tab ? "2px solid #0d9488" : "2px solid transparent",
                  }}
                >
                  {tab === "chat" ? "AI Generate" : tab === "env" ? "Env Vars" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
              {/* AI Chat Tab */}
              {activeTab === "chat" && (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 12 }}>
                  {generatedFiles.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Generated files:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {generatedFiles.map((gf) => (
                          <button
                            key={gf.path}
                            onClick={() => {
                              const f = files.find((ff) => ff.path === gf.path);
                              if (f) loadFile(f);
                            }}
                            style={{ padding: "4px 10px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#0d9488", fontWeight: 600 }}
                          >
                            {gf.path}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ flex: 1 }} />
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={`Describe what you want to build...\nExample: "Create a REST API with user authentication and a products endpoint"`}
                    style={{
                      width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 10,
                      fontSize: 13, resize: "none", fontFamily: "inherit", boxSizing: "border-box", height: 90,
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generateCode(); }}
                  />
                  <button
                    onClick={generateCode}
                    disabled={generating || !aiPrompt.trim()}
                    style={{
                      width: "100%", padding: "10px 0", background: generating ? "#99f6e4" : "#0d9488",
                      color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14,
                      cursor: generating ? "not-allowed" : "pointer",
                    }}
                  >
                    {generating ? "Generating..." : "Generate Code (Ctrl+Enter)"}
                  </button>
                </div>
              )}

              {/* Templates Tab */}
              {activeTab === "templates" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {templates.map((t) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 10, gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{t.description}</div>
                      </div>
                      <button
                        onClick={() => applyTemplate(t.id)}
                        disabled={applyingTemplate === t.id}
                        style={{ padding: "6px 14px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 7, fontWeight: 600, fontSize: 12, cursor: "pointer", flexShrink: 0 }}
                      >
                        {applyingTemplate === t.id ? "Applying..." : "Apply"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Env Vars Tab */}
              {activeTab === "env" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {envList.map((e) => (
                    <div key={e.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f8fafc", borderRadius: 8 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1 }}>{e.key}</span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>***</span>
                      <button onClick={() => removeEnvVar(e.key)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14, fontWeight: 700 }}>x</button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="text"
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value)}
                      placeholder="KEY"
                      style={{ flex: 1, minWidth: 100, padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "monospace" }}
                    />
                    <input
                      type="text"
                      value={newEnvVal}
                      onChange={(e) => setNewEnvVal(e.target.value)}
                      placeholder="value"
                      style={{ flex: 2, minWidth: 150, padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13 }}
                    />
                    <button onClick={addEnvVar} style={{ padding: "7px 16px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, cursor: "pointer" }}>
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Deployments Tab */}
              {activeTab === "deployments" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {deployments.length === 0 ? (
                    <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 20 }}>No deployments yet</div>
                  ) : deployments.map((d) => {
                    const dStatusStyle = d.status === "live" ? { bg: "#d1fae5", fg: "#065f46" } : d.status === "failed" ? { bg: "#fee2e2", fg: "#991b1b" } : { bg: "#fef3c7", fg: "#92400e" };
                    return (
                      <div key={d.id} style={{ padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 5, background: dStatusStyle.bg, color: dStatusStyle.fg, fontSize: 12, fontWeight: 600 }}>{d.status}</span>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(d.triggeredAt).toLocaleString()}</span>
                        </div>
                        {d.deployUrl && (
                          <a href={d.deployUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#0d9488", display: "block", marginTop: 6 }}>{d.deployUrl}</a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === "settings" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Project Name</label>
                    <input
                      type="text"
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Description</label>
                    <input
                      type="text"
                      value={settingsDesc}
                      onChange={(e) => setSettingsDesc(e.target.value)}
                      placeholder="Short description..."
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Custom Domain</label>
                    <input
                      type="text"
                      value={settingsDomain}
                      onChange={(e) => setSettingsDomain(e.target.value)}
                      placeholder="myapp.example.com"
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                  <button
                    onClick={saveSettings}
                    disabled={savingSettings}
                    style={{ padding: "9px 18px", background: savingSettings ? "#99f6e4" : "#0d9488", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: savingSettings ? "not-allowed" : "pointer", alignSelf: "flex-start" }}
                  >
                    {savingSettings ? "Saving..." : "Save Settings"}
                  </button>

                  {/* Collaborators */}
                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Collaborators</div>
                    {(project.collaborators || []).map((c) => (
                      <div key={c.userId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f8fafc" }}>
                        <span style={{ flex: 1, fontSize: 13, fontFamily: "monospace", color: "#0f172a" }}>{c.userId}</span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "#f1f5f9", color: "#64748b" }}>{c.role}</span>
                        <button
                          onClick={() => removeCollaborator(c.userId)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14, fontWeight: 700 }}
                        >x</button>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <input
                        type="text"
                        value={settingsCollab}
                        onChange={(e) => setSettingsCollab(e.target.value)}
                        placeholder="user-id or email"
                        style={{ flex: 1, padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                        onKeyDown={(e) => { if (e.key === "Enter") addCollaborator(); }}
                      />
                      <button
                        onClick={addCollaborator}
                        style={{ padding: "7px 14px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* File context menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={() => {
            setRenamingFile(contextMenu.file);
            setRenameValue(contextMenu.file.path);
          }}
          onDelete={() => deleteFile(contextMenu.file.path)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
