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

// ─── Monaco-lite syntax highlighting editor ────────────────────────────────────
function CodeEditor({ value, onChange, language }: { value: string; onChange: (v: string) => void; language: string }) {
  const HIGHLIGHTS: Record<string, RegExp> = {
    typescript: /\b(const|let|var|function|return|import|export|type|interface|async|await|class|extends|implements|new|this|null|undefined|true|false|void|string|number|boolean|any)\b/g,
    javascript: /\b(const|let|var|function|return|import|export|async|await|class|new|this|null|undefined|true|false)\b/g,
    css: /([a-z-]+)(?=\s*:)/g,
    html: /<\/?[a-z][a-z0-9]*\b[^>]*>/gi,
    python: /\b(def|class|import|from|return|if|elif|else|for|while|with|as|try|except|finally|lambda|yield|pass|break|continue|and|or|not|in|is|None|True|False)\b/g,
  };

  const highlighted = (text: string): string => {
    let result = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Apply keyword highlighting (purple/bold)
    const kwRe = HIGHLIGHTS[language];
    if (kwRe) {
      result = result.replace(kwRe, (match) =>
        `<span style="color:#7c3aed;font-weight:600">${match}</span>`
      );
    }

    // String literals (green)
    result = result.replace(
      /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
      (m) => `<span style="color:#059669">${m}</span>`
    );

    // Single-line comments (gray italic)
    result = result.replace(
      /(\/\/[^\n]*)/g,
      (m) => `<span style="color:#94a3b8;font-style:italic">${m}</span>`
    );

    // Python / shell comments
    result = result.replace(
      /(#[^\n]*)/g,
      (m) => `<span style="color:#94a3b8;font-style:italic">${m}</span>`
    );

    return result;
  };

  return (
    <div style={{ position: "relative", fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: 13, lineHeight: 1.7, background: "#fafafa", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
      <pre
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          margin: 0,
          padding: "16px 20px",
          pointerEvents: "none",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "#0f172a",
          background: "transparent",
          zIndex: 1,
          overflow: "hidden",
        }}
        dangerouslySetInnerHTML={{ __html: highlighted(value) + " " }}
      />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          minHeight: 400,
          padding: "16px 20px",
          background: "rgba(0,0,0,0)",
          color: "transparent",
          caretColor: "#0f172a",
          border: "none",
          outline: "none",
          resize: "vertical",
          fontFamily: "inherit",
          fontSize: "inherit",
          lineHeight: "inherit",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          boxSizing: "border-box",
        }}
        spellCheck={false}
      />
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<"chat" | "templates" | "env" | "deployments" | "github" | "media" | "settings">("chat");
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

  // GitHub state
  const [githubStatus, setGithubStatus] = useState<{ exists: boolean; stars?: number; openIssues?: number; lastPush?: string } | null>(null);
  const [githubBranches, setGithubBranches] = useState<Array<{ name: string; sha: string }>>([]);
  const [githubPushing, setGithubPushing] = useState(false);
  const [githubSyncing, setGithubSyncing] = useState(false);
  const [githubMsg, setGithubMsg] = useState<string | null>(null);

  // ElevenLabs / Media state
  const [mediaTab, setMediaTab] = useState<"tts" | "image" | "sfx" | "music" | "email" | "payment">("tts");

  // DALL-E image state
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgSize, setImgSize] = useState("1024x1024");
  const [imgQuality, setImgQuality] = useState<"standard" | "hd">("standard");
  const [imgStyle, setImgStyle] = useState<"vivid" | "natural">("vivid");
  const [imgLoading, setImgLoading] = useState(false);
  const [imgResult, setImgResult] = useState<{ url: string; revisedPrompt?: string | null } | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);

  // SFX state
  const [sfxText, setSfxText] = useState("");
  const [sfxDuration, setSfxDuration] = useState("3");
  const [sfxLoading, setSfxLoading] = useState(false);
  const [sfxUrl, setSfxUrl] = useState<string | null>(null);
  const [sfxError, setSfxError] = useState<string | null>(null);

  // Music state
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicLengthSec, setMusicLengthSec] = useState("30");
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicError, setMusicError] = useState<string | null>(null);

  // Domain auto-setup state
  const [domainSetupLoading, setDomainSetupLoading] = useState(false);
  const [domainSetupMsg, setDomainSetupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mediaTtsText, setMediaTtsText] = useState("");
  const [mediaTtsVoice, setMediaTtsVoice] = useState("Rachel");
  const [mediaTtsLoading, setMediaTtsLoading] = useState(false);
  const [mediaTtsUrl, setMediaTtsUrl] = useState<string | null>(null);
  const [mediaTtsError, setMediaTtsError] = useState<string | null>(null);

  // Brevo email state
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Stripe payment link state
  const [payName, setPayName] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("usd");
  const [payDesc, setPayDesc] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payResult, setPayResult] = useState<{ url: string } | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Vercel deploy state
  const [vercelDeploying, setVercelDeploying] = useState(false);

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

  // ── GitHub helpers ──────────────────────────────────────────────────────────

  const fetchGithubStatus = useCallback(async () => {
    if (!project) return;
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/github/status`), { cache: "no-store" });
      const d = await r.json();
      setGithubStatus(d);
    } catch { setGithubStatus(null); }
  }, [project]);

  const fetchGithubBranches = useCallback(async () => {
    if (!project) return;
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/github/branches`), { cache: "no-store" });
      const d = await r.json();
      setGithubBranches(d.branches || []);
    } catch { setGithubBranches([]); }
  }, [project]);

  useEffect(() => {
    if (activeTab === "github" && project) {
      fetchGithubStatus();
      fetchGithubBranches();
    }
  }, [activeTab, fetchGithubStatus, fetchGithubBranches, project]);

  const pushToGithub = async () => {
    if (!project) return;
    setGithubPushing(true);
    setGithubMsg(null);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/github/push`), { method: "POST" });
      const d = await r.json();
      if (d.ok) {
        setGithubMsg(`Pushed ${d.pushedFiles} files to GitHub: ${d.repoUrl}`);
        setProject((p) => p ? { ...p, repoUrl: d.repoUrl } : p);
        await fetchGithubStatus();
        await fetchGithubBranches();
      } else {
        setGithubMsg(d.message || "Push failed");
      }
    } catch (e: any) {
      setGithubMsg(e?.message || "Push failed");
    } finally {
      setGithubPushing(false);
    }
  };

  const syncGithub = async () => {
    if (!project) return;
    setGithubSyncing(true);
    setGithubMsg(null);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/github/sync`), { method: "POST" });
      const d = await r.json();
      if (d.ok) {
        setGithubMsg(`Synced. Default branch: ${d.defaultBranch} · Last push: ${d.lastPush ? new Date(d.lastPush).toLocaleDateString() : "—"}`);
        await fetchGithubStatus();
        await fetchGithubBranches();
      } else {
        setGithubMsg(d.message || "Sync failed");
      }
    } catch (e: any) {
      setGithubMsg(e?.message || "Sync failed");
    } finally {
      setGithubSyncing(false);
    }
  };

  // ── Vercel deploy ────────────────────────────────────────────────────────────

  const deployToVercel = async () => {
    if (!project) return;
    setVercelDeploying(true);
    showToast("Deploying to Vercel...", "info");
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/deploy/vercel`), { method: "POST" });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        throw new Error(d.error || "Vercel deploy failed");
      }
      showToast(`Vercel: ${d.deployUrl}`, "success");
      // Refresh project after 6s
      setTimeout(async () => {
        const pr = await fetch(apiUrl(`/api/devhub/projects/${project.id}`), { cache: "no-store" });
        const pd = await pr.json();
        setProject(pd.project);
      }, 6000);
    } catch (e: any) {
      showToast(e?.message || "Vercel deploy failed", "error");
    } finally {
      setVercelDeploying(false);
    }
  };

  // ── Brevo email helper ───────────────────────────────────────────────────────

  const sendEmail = async () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return;
    setEmailLoading(true);
    setEmailMsg(null);
    try {
      const r = await fetch(apiUrl("/api/devhub/media/email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo.trim(), subject: emailSubject.trim(), htmlBody: emailBody }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setEmailMsg({ ok: false, text: d.error || "Send failed" });
      } else {
        setEmailMsg({ ok: true, text: `Email sent to ${emailTo}` });
        setEmailTo(""); setEmailSubject(""); setEmailBody("");
      }
    } catch (e: any) {
      setEmailMsg({ ok: false, text: e?.message || "Send failed" });
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Stripe payment link helper ───────────────────────────────────────────────

  const createPaymentLink = async () => {
    if (!payName.trim() || !payAmount.trim()) return;
    const amtUnits = parseFloat(payAmount);
    if (!Number.isFinite(amtUnits) || amtUnits <= 0) {
      setPayError("Invalid amount");
      return;
    }
    setPayLoading(true);
    setPayError(null);
    setPayResult(null);
    try {
      const r = await fetch(apiUrl("/api/devhub/media/payment-link"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payName.trim(),
          amountCents: Math.round(amtUnits * 100),
          currency: payCurrency,
          description: payDesc.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setPayError(d.error || "Failed to create payment link");
      } else {
        setPayResult({ url: d.url });
      }
    } catch (e: any) {
      setPayError(e?.message || "Failed to create payment link");
    } finally {
      setPayLoading(false);
    }
  };

  // ── DALL-E image helper ──────────────────────────────────────────────────────

  const generateImage = async () => {
    if (!imgPrompt.trim()) return;
    setImgLoading(true);
    setImgError(null);
    setImgResult(null);
    try {
      const r = await fetch(apiUrl("/api/devhub/media/image"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imgPrompt.trim(), size: imgSize, quality: imgQuality, style: imgStyle }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setImgError(d.error || "Image generation failed");
      } else {
        setImgResult({ url: d.url, revisedPrompt: d.revisedPrompt });
      }
    } catch (e: any) {
      setImgError(e?.message || "Image generation failed");
    } finally {
      setImgLoading(false);
    }
  };

  // ── ElevenLabs SFX helper ────────────────────────────────────────────────────

  const generateSfx = async () => {
    if (!sfxText.trim()) return;
    setSfxLoading(true);
    setSfxError(null);
    setSfxUrl(null);
    try {
      const dur = parseFloat(sfxDuration);
      const r = await fetch(apiUrl("/api/devhub/media/sfx"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sfxText.trim(),
          ...(Number.isFinite(dur) && dur > 0 ? { durationSeconds: dur } : {}),
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || `SFX error ${r.status}`);
      }
      const blob = await r.blob();
      setSfxUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setSfxError(e?.message || "SFX generation failed");
    } finally {
      setSfxLoading(false);
    }
  };

  // ── ElevenLabs Music helper ──────────────────────────────────────────────────

  const generateMusic = async () => {
    if (!musicPrompt.trim()) return;
    setMusicLoading(true);
    setMusicError(null);
    setMusicUrl(null);
    try {
      const sec = parseFloat(musicLengthSec);
      const r = await fetch(apiUrl("/api/devhub/media/music"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: musicPrompt.trim(),
          ...(Number.isFinite(sec) && sec > 0 ? { musicLengthMs: Math.round(sec * 1000) } : {}),
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || `Music error ${r.status}`);
      }
      const blob = await r.blob();
      setMusicUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setMusicError(e?.message || "Music compose failed");
    } finally {
      setMusicLoading(false);
    }
  };

  // ── Cloudflare domain auto-setup ─────────────────────────────────────────────

  const autoSetupDomain = async () => {
    if (!project) return;
    setDomainSetupLoading(true);
    setDomainSetupMsg(null);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/domain/auto-setup`), { method: "POST" });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        const fallback = d?.manualInstruction ? `${d.error}. ${d.manualInstruction}` : (d.error || "Setup failed");
        setDomainSetupMsg({ ok: false, text: fallback });
      } else {
        setDomainSetupMsg({ ok: true, text: `DNS ${d.action}: ${d.domain} → ${d.cname}` });
      }
    } catch (e: any) {
      setDomainSetupMsg({ ok: false, text: e?.message || "Setup failed" });
    } finally {
      setDomainSetupLoading(false);
    }
  };

  // ── ElevenLabs TTS helper ────────────────────────────────────────────────────

  const generateTts = async () => {
    if (!mediaTtsText.trim()) return;
    setMediaTtsLoading(true);
    setMediaTtsError(null);
    setMediaTtsUrl(null);
    try {
      const r = await fetch(apiUrl("/api/devhub/media/tts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: mediaTtsText, voice: mediaTtsVoice }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || `TTS error ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setMediaTtsUrl(url);
    } catch (e: any) {
      setMediaTtsError(e?.message || "TTS failed");
    } finally {
      setMediaTtsLoading(false);
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
            onClick={() => setActiveTab("github")}
            title={project.repoUrl ? `GitHub: ${project.repoUrl}` : "Push to GitHub"}
            style={{
              padding: "8px 14px", background: project.repoUrl ? "#f0fdf4" : "#f8fafc",
              color: project.repoUrl ? "#166534" : "#374151",
              border: `1px solid ${project.repoUrl ? "#bbf7d0" : "#e2e8f0"}`,
              borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            {project.repoUrl ? "GitHub ✓" : "GitHub"}
          </button>
          <button
            onClick={deploy}
            disabled={deploying}
            title="Deploy to Railway"
            style={{
              padding: "8px 18px", background: deploying ? "#99f6e4" : "#0d9488",
              color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
              cursor: deploying ? "not-allowed" : "pointer",
            }}
          >
            {deploying ? "Deploying..." : "Deploy"}
          </button>
          <button
            onClick={deployToVercel}
            disabled={vercelDeploying}
            title="Deploy to Vercel"
            style={{
              padding: "8px 14px", background: vercelDeploying ? "#e2e8f0" : "#000",
              color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
              cursor: vercelDeploying ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 76 65" fill="currentColor"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z"/></svg>
            {vercelDeploying ? "..." : "Vercel"}
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
                {/* Monaco-lite editor with syntax highlighting */}
                <div style={{ flex: 1, overflow: "auto", padding: "0 4px 4px" }}>
                  <CodeEditor
                    value={editorContent}
                    onChange={(v) => handleEditorChange(v)}
                    language={editorLang}
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
              {(["chat", "templates", "github", "media", "env", "deployments", "settings"] as const).map((tab) => (
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
                  {tab === "chat" ? "AI Generate" : tab === "env" ? "Env Vars" : tab === "github" ? "GitHub" : tab === "media" ? "ElevenLabs" : tab.charAt(0).toUpperCase() + tab.slice(1)}
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

              {/* GitHub Tab */}
              {activeTab === "github" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Repo status */}
                  <div style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 8 }}>
                      GitHub Repository
                    </div>
                    {project?.repoUrl ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <a href={project.repoUrl} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 13, color: "#0d9488", fontWeight: 600, wordBreak: "break-all" }}>
                          {project.repoUrl}
                        </a>
                        {githubStatus?.exists && (
                          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#64748b" }}>
                            <span>★ {githubStatus.stars ?? 0}</span>
                            <span>Issues: {githubStatus.openIssues ?? 0}</span>
                            {githubStatus.lastPush && <span>Last push: {new Date(githubStatus.lastPush).toLocaleDateString()}</span>}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "#94a3b8" }}>No repository linked yet. Push to create one.</div>
                    )}
                  </div>

                  {/* Branches */}
                  {githubBranches.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Branches</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {githubBranches.map((b) => (
                          <span key={b.name} style={{
                            padding: "3px 10px", borderRadius: 6, background: "#f0fdfa",
                            border: "1px solid #99f6e4", fontSize: 12, color: "#0d9488", fontFamily: "monospace",
                          }}>
                            {b.name} <span style={{ color: "#94a3b8" }}>#{b.sha}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message */}
                  {githubMsg && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 8, fontSize: 13,
                      background: githubMsg.includes("failed") || githubMsg.includes("error") ? "#fee2e2" : "#d1fae5",
                      color: githubMsg.includes("failed") || githubMsg.includes("error") ? "#991b1b" : "#065f46",
                      wordBreak: "break-all",
                    }}>
                      {githubMsg}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={pushToGithub}
                      disabled={githubPushing}
                      style={{
                        padding: "9px 18px", background: githubPushing ? "#99f6e4" : "#0f172a",
                        color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                        cursor: githubPushing ? "not-allowed" : "pointer",
                      }}
                    >
                      {githubPushing ? "Pushing..." : project?.repoUrl ? "Push (update repo)" : "Push to GitHub (create repo)"}
                    </button>
                    {project?.repoUrl && (
                      <button
                        onClick={syncGithub}
                        disabled={githubSyncing}
                        style={{
                          padding: "9px 18px", background: "#fff", color: "#0f172a",
                          border: "1px solid #e2e8f0", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: githubSyncing ? "not-allowed" : "pointer",
                        }}
                      >
                        {githubSyncing ? "Syncing..." : "Sync branches"}
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                    Set <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>GITHUB_TOKEN</code> env var on the server to enable GitHub integration.
                    Token needs <em>repo</em> scope.
                  </div>
                </div>
              )}

              {/* ElevenLabs / Media Tab */}
              {activeTab === "media" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Sub-tabs */}
                  <div style={{ display: "flex", gap: 4, padding: 4, background: "#f1f5f9", borderRadius: 8, flexWrap: "wrap" }}>
                    {(["tts", "image", "sfx", "music", "email", "payment"] as const).map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setMediaTab(sub)}
                        style={{
                          flex: "1 1 auto", padding: "6px 8px", border: "none",
                          background: mediaTab === sub ? "#fff" : "transparent",
                          color: mediaTab === sub ? "#0d9488" : "#64748b",
                          borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          whiteSpace: "nowrap",
                          boxShadow: mediaTab === sub ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                        }}
                      >
                        {sub === "tts" ? "TTS" : sub === "image" ? "DALL-E" : sub === "sfx" ? "SFX" : sub === "music" ? "Music" : sub === "email" ? "Email" : "Pay"}
                      </button>
                    ))}
                  </div>

                  {/* TTS */}
                  {mediaTab === "tts" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Voice</label>
                        <select
                          value={mediaTtsVoice}
                          onChange={(e) => setMediaTtsVoice(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13 }}
                        >
                          {["Rachel", "Adam", "Antoni", "Arnold", "Bella", "Domi", "Elli", "Josh", "Sam"].map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Text</label>
                        <textarea
                          value={mediaTtsText}
                          onChange={(e) => setMediaTtsText(e.target.value)}
                          placeholder="Enter text to convert to speech..."
                          rows={4}
                          style={{
                            width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0",
                            borderRadius: 7, fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
                          }}
                        />
                      </div>
                      {mediaTtsError && (
                        <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 7, fontSize: 13 }}>
                          {mediaTtsError}
                        </div>
                      )}
                      {mediaTtsUrl && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <audio controls src={mediaTtsUrl} style={{ width: "100%" }} />
                          <a href={mediaTtsUrl} download="tts-output.mp3" style={{ fontSize: 13, color: "#0d9488", fontWeight: 600 }}>
                            Download MP3
                          </a>
                        </div>
                      )}
                      <button
                        onClick={generateTts}
                        disabled={mediaTtsLoading || !mediaTtsText.trim()}
                        style={{
                          padding: "9px 18px", background: mediaTtsLoading ? "#99f6e4" : "#7c3aed",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: (mediaTtsLoading || !mediaTtsText.trim()) ? "not-allowed" : "pointer",
                        }}
                      >
                        {mediaTtsLoading ? "Generating..." : "Generate Speech"}
                      </button>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>ELEVENLABS_API_KEY</code>
                      </div>
                    </div>
                  )}

                  {/* DALL-E 3 Image */}
                  {mediaTab === "image" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Prompt</label>
                        <textarea
                          value={imgPrompt}
                          onChange={(e) => setImgPrompt(e.target.value)}
                          placeholder="A serene mountain landscape at golden hour, photorealistic..."
                          rows={3}
                          style={{
                            width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0",
                            borderRadius: 7, fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ flex: 2, minWidth: 140 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Size</label>
                          <select value={imgSize} onChange={(e) => setImgSize(e.target.value)}
                            style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13 }}>
                            <option value="1024x1024">Square (1024)</option>
                            <option value="1792x1024">Landscape (1792×1024)</option>
                            <option value="1024x1792">Portrait (1024×1792)</option>
                          </select>
                        </div>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Quality</label>
                          <select value={imgQuality} onChange={(e) => setImgQuality(e.target.value as "standard" | "hd")}
                            style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13 }}>
                            <option value="standard">Standard</option>
                            <option value="hd">HD</option>
                          </select>
                        </div>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Style</label>
                          <select value={imgStyle} onChange={(e) => setImgStyle(e.target.value as "vivid" | "natural")}
                            style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13 }}>
                            <option value="vivid">Vivid</option>
                            <option value="natural">Natural</option>
                          </select>
                        </div>
                      </div>
                      {imgError && (
                        <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 7, fontSize: 13 }}>
                          {imgError}
                        </div>
                      )}
                      {imgResult && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imgResult.url} alt="generated" style={{ width: "100%", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                          {imgResult.revisedPrompt && (
                            <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
                              Revised prompt: {imgResult.revisedPrompt}
                            </div>
                          )}
                          <a href={imgResult.url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 13, color: "#0d9488", fontWeight: 600 }}>
                            Open full size →
                          </a>
                        </div>
                      )}
                      <button
                        onClick={generateImage}
                        disabled={imgLoading || !imgPrompt.trim()}
                        style={{
                          padding: "9px 18px", background: imgLoading ? "#a5b4fc" : "#10a37f",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: (imgLoading || !imgPrompt.trim()) ? "not-allowed" : "pointer",
                        }}
                      >
                        {imgLoading ? "Generating..." : "Generate Image"}
                      </button>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>OPENAI_API_KEY</code>. Powered by DALL-E 3.
                      </div>
                    </div>
                  )}

                  {/* ElevenLabs SFX */}
                  {mediaTab === "sfx" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>SFX Description</label>
                        <textarea
                          value={sfxText}
                          onChange={(e) => setSfxText(e.target.value)}
                          placeholder="Heavy rain on a metal roof with distant thunder"
                          rows={3}
                          style={{
                            width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0",
                            borderRadius: 7, fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Duration (seconds, 0.5–22)</label>
                        <input
                          type="number"
                          min="0.5" max="22" step="0.5"
                          value={sfxDuration}
                          onChange={(e) => setSfxDuration(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                        />
                      </div>
                      {sfxError && (
                        <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 7, fontSize: 13 }}>
                          {sfxError}
                        </div>
                      )}
                      {sfxUrl && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <audio controls src={sfxUrl} style={{ width: "100%" }} />
                          <a href={sfxUrl} download="sfx.mp3" style={{ fontSize: 13, color: "#0d9488", fontWeight: 600 }}>Download MP3</a>
                        </div>
                      )}
                      <button
                        onClick={generateSfx}
                        disabled={sfxLoading || !sfxText.trim()}
                        style={{
                          padding: "9px 18px", background: sfxLoading ? "#fcd34d" : "#f59e0b",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: (sfxLoading || !sfxText.trim()) ? "not-allowed" : "pointer",
                        }}
                      >
                        {sfxLoading ? "Generating..." : "Generate SFX"}
                      </button>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>ELEVENLABS_API_KEY</code>
                      </div>
                    </div>
                  )}

                  {/* ElevenLabs Music */}
                  {mediaTab === "music" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Music Prompt</label>
                        <textarea
                          value={musicPrompt}
                          onChange={(e) => setMusicPrompt(e.target.value)}
                          placeholder="Lo-fi hip-hop, mellow piano, soft beats, 80 BPM..."
                          rows={3}
                          style={{
                            width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0",
                            borderRadius: 7, fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Length (seconds, 10–300)</label>
                        <input
                          type="number"
                          min="10" max="300" step="5"
                          value={musicLengthSec}
                          onChange={(e) => setMusicLengthSec(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                        />
                      </div>
                      {musicError && (
                        <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 7, fontSize: 13 }}>
                          {musicError}
                        </div>
                      )}
                      {musicUrl && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <audio controls src={musicUrl} style={{ width: "100%" }} />
                          <a href={musicUrl} download="music.mp3" style={{ fontSize: 13, color: "#0d9488", fontWeight: 600 }}>Download MP3</a>
                        </div>
                      )}
                      <button
                        onClick={generateMusic}
                        disabled={musicLoading || !musicPrompt.trim()}
                        style={{
                          padding: "9px 18px", background: musicLoading ? "#c4b5fd" : "#8b5cf6",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: (musicLoading || !musicPrompt.trim()) ? "not-allowed" : "pointer",
                        }}
                      >
                        {musicLoading ? "Composing..." : "Compose Music"}
                      </button>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>ELEVENLABS_API_KEY</code>. Max 5 min.
                      </div>
                    </div>
                  )}

                  {/* Brevo Email */}
                  {mediaTab === "email" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>To</label>
                        <input
                          type="email"
                          value={emailTo}
                          onChange={(e) => setEmailTo(e.target.value)}
                          placeholder="recipient@example.com"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Subject</label>
                        <input
                          type="text"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          placeholder="Welcome to our app"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Body (HTML)</label>
                        <textarea
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          placeholder="<h1>Hi!</h1><p>Thanks for signing up.</p>"
                          rows={6}
                          style={{
                            width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0",
                            borderRadius: 7, fontSize: 12, resize: "vertical", fontFamily: "monospace", boxSizing: "border-box",
                          }}
                        />
                      </div>
                      {emailMsg && (
                        <div style={{
                          padding: "8px 12px", borderRadius: 7, fontSize: 13,
                          background: emailMsg.ok ? "#d1fae5" : "#fee2e2",
                          color: emailMsg.ok ? "#065f46" : "#991b1b",
                        }}>
                          {emailMsg.text}
                        </div>
                      )}
                      <button
                        onClick={sendEmail}
                        disabled={emailLoading || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()}
                        style={{
                          padding: "9px 18px", background: emailLoading ? "#99f6e4" : "#0d9488",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: (emailLoading || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) ? "not-allowed" : "pointer",
                        }}
                      >
                        {emailLoading ? "Sending..." : "Send Email"}
                      </button>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>BREVO_API_KEY</code> + <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>BREVO_DEFAULT_SENDER</code>
                      </div>
                    </div>
                  )}

                  {/* Stripe Payment Link */}
                  {mediaTab === "payment" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Product Name</label>
                        <input
                          type="text"
                          value={payName}
                          onChange={(e) => setPayName(e.target.value)}
                          placeholder="Pro subscription"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ flex: 2 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="9.99"
                            style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Currency</label>
                          <select
                            value={payCurrency}
                            onChange={(e) => setPayCurrency(e.target.value)}
                            style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13 }}
                          >
                            {["usd", "eur", "kzt", "rub", "gbp"].map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Description (optional)</label>
                        <input
                          type="text"
                          value={payDesc}
                          onChange={(e) => setPayDesc(e.target.value)}
                          placeholder="Monthly access to all features"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                        />
                      </div>
                      {payError && (
                        <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 7, fontSize: 13 }}>
                          {payError}
                        </div>
                      )}
                      {payResult && (
                        <div style={{ padding: "10px 12px", background: "#d1fae5", borderRadius: 7, display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#065f46" }}>Payment link created</div>
                          <a href={payResult.url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, color: "#0d9488", wordBreak: "break-all" }}>
                            {payResult.url}
                          </a>
                          <button
                            onClick={() => navigator.clipboard.writeText(payResult.url)}
                            style={{
                              padding: "5px 10px", background: "#0d9488", color: "#fff",
                              border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start",
                            }}
                          >
                            Copy link
                          </button>
                        </div>
                      )}
                      <button
                        onClick={createPaymentLink}
                        disabled={payLoading || !payName.trim() || !payAmount.trim()}
                        style={{
                          padding: "9px 18px", background: payLoading ? "#a5b4fc" : "#635bff",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: (payLoading || !payName.trim() || !payAmount.trim()) ? "not-allowed" : "pointer",
                        }}
                      >
                        {payLoading ? "Creating..." : "Create Payment Link"}
                      </button>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>STRIPE_SECRET_KEY</code>. Min amount 50 cents (or equivalent).
                      </div>
                    </div>
                  )}
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
                    {project?.customDomain && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        <button
                          onClick={autoSetupDomain}
                          disabled={domainSetupLoading}
                          style={{
                            alignSelf: "flex-start", padding: "6px 12px",
                            background: domainSetupLoading ? "#fde68a" : "#f59e0b",
                            color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 12,
                            cursor: domainSetupLoading ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", gap: 6,
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M14.97 16.95L10 13.87V7h2v5.76l4.03 2.49-1.06 1.7zM12 3a9 9 0 109 9 9 9 0 00-9-9z"/></svg>
                          {domainSetupLoading ? "Configuring..." : "Auto-setup DNS (Cloudflare)"}
                        </button>
                        {domainSetupMsg && (
                          <div style={{
                            padding: "6px 10px", borderRadius: 6, fontSize: 12,
                            background: domainSetupMsg.ok ? "#d1fae5" : "#fee2e2",
                            color: domainSetupMsg.ok ? "#065f46" : "#991b1b",
                            wordBreak: "break-word",
                          }}>
                            {domainSetupMsg.text}
                          </div>
                        )}
                      </div>
                    )}
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
