"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl, fetchWithRedeployRetry } from "@/lib/apiBase";
import { fixDoubledScheme } from "@/lib/urls";
import { diffLines } from "@/lib/lineDiff";
import { shouldOfferDbHint, shouldOfferDeployHint, shouldOfferManifestHint } from "@/lib/devhubHints";
import { buildReactPreviewSrcdoc, isClientPreviewStack } from "@/lib/reactPreview";
import { indexCapabilities, isCapabilityBlocked, capabilityHint, type CapabilityIndex } from "@/lib/devhubCapabilities";
import { assetSnippet, appendSnippet, type AssetKind } from "@/lib/devhubAssetSnippet";
import { newFilePathError, renamePathError, normalizeFilePath } from "@/lib/devhubFilePaths";

/**
 * A write whose result the UI is about to act on.
 *
 * Several handlers here did `await fetch(...)` and then updated the screen
 * whatever came back — the same defect as the editor's autosave. On the
 * collaborator path it meant an owner who pressed × saw the person disappear
 * from the list while their edit access was still live on the server.
 */
async function writeOrThrow(input: string, init?: RequestInit): Promise<Response> {
  const r = await fetch(input, init);
  if (!r.ok) throw new Error(`сервер ответил ${r.status}`);
  return r;
}

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

function timeAgo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

// Visual Edit — bridges clicks inside the sandboxed preview iframe back to
// the parent via postMessage. Runs isolated (sandbox="allow-scripts", no
// allow-same-origin) so it can't reach parent DOM/cookies even though it's
// rendering the project's own HTML/CSS/JS.
const VISUAL_EDIT_OVERLAY_SCRIPT = `
(function(){
  var hovered = null;
  function withVid(el){ while (el && !(el.getAttribute && el.getAttribute('data-vid'))) el = el.parentElement; return el; }
  function onOver(e){
    var el = withVid(e.target);
    if (hovered && hovered !== el) hovered.style.outline = '';
    hovered = el;
    if (hovered) { hovered.style.outline = '2px solid #0d9488'; hovered.style.outlineOffset = '1px'; }
  }
  function onOut(){ if (hovered) { hovered.style.outline = ''; hovered = null; } }
  function brief(el){ return { vid: el.getAttribute('data-vid'), tagName: el.tagName }; }
  function select(el){
    var cs = getComputedStyle(el);
    // Ancestor chain (nearest first) and tagged direct children let the IDE
    // render a breadcrumb for retargeting nested markup without re-clicking.
    var ancestors = [];
    for (var p = el.parentElement; p && ancestors.length < 6; p = p.parentElement) {
      if (p.getAttribute && p.getAttribute('data-vid')) ancestors.push(brief(p));
    }
    var children = [];
    for (var i = 0; i < el.children.length && children.length < 8; i++) {
      if (el.children[i].getAttribute('data-vid')) children.push(brief(el.children[i]));
    }
    parent.postMessage({
      source: 'devhub-visual-edit', vid: el.getAttribute('data-vid'), tagName: el.tagName, text: el.textContent || '',
      styles: { color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight, textAlign: cs.textAlign },
      src: el.getAttribute('src') || '',
      ancestors: ancestors, children: children
    }, '*');
  }
  function onClick(e){
    var el = withVid(e.target);
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    select(el);
  }
  window.addEventListener('message', function(e){
    var d = e.data;
    if (!d) return;
    // Live style preview: the IDE pushes { vid, styles } and we paint the
    // element in place, so the user sees the change before committing it.
    if (d.source === 'devhub-visual-edit-apply') {
      var el = document.querySelector('[data-vid="' + d.vid + '"]');
      if (!el) return;
      for (var k in (d.styles || {})) el.style[k] = d.styles[k];
    }
    // Breadcrumb retarget: the IDE asks to select a specific vid (an ancestor
    // or child of the current selection) — reply with the full select payload.
    if (d.source === 'devhub-visual-edit-select') {
      var target = document.querySelector('[data-vid="' + d.vid + '"]');
      if (target) select(target);
    }
  });
  document.addEventListener('mouseover', onOver, true);
  document.addEventListener('mouseout', onOut, true);
  document.addEventListener('click', onClick, true);
})();
`;

// Overlay for the client-side React preview: the DOM appears only after the
// module graph loads and React renders, so data-vid tagging happens on a
// MutationObserver tick (re-tagging untagged nodes) instead of at parse time.
// Message contract is identical to the static overlay.
const REACT_PREVIEW_OVERLAY_SCRIPT = `
(function(){
  var counter = 0;
  var SKIP = { SCRIPT: 1, STYLE: 1 };
  function tag(){
    var all = document.body ? document.body.querySelectorAll('*') : [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!SKIP[el.tagName] && !el.hasAttribute('data-vid')) el.setAttribute('data-vid', String(counter++));
    }
  }
  var pending = false;
  new MutationObserver(function(){
    if (pending) return;
    pending = true;
    setTimeout(function(){ pending = false; tag(); }, 120);
  }).observe(document.documentElement, { childList: true, subtree: true });
  tag();
  var hovered = null;
  function withVid(el){ while (el && !(el.getAttribute && el.getAttribute('data-vid'))) el = el.parentElement; return el; }
  function brief(el){ return { vid: el.getAttribute('data-vid'), tagName: el.tagName }; }
  function select(el){
    var cs = getComputedStyle(el);
    var ancestors = [];
    for (var p = el.parentElement; p && ancestors.length < 6; p = p.parentElement) {
      if (p.getAttribute && p.getAttribute('data-vid')) ancestors.push(brief(p));
    }
    var children = [];
    for (var i = 0; i < el.children.length && children.length < 8; i++) {
      if (el.children[i].getAttribute('data-vid')) children.push(brief(el.children[i]));
    }
    parent.postMessage({
      source: 'devhub-visual-edit', vid: el.getAttribute('data-vid'), tagName: el.tagName, text: el.textContent || '',
      styles: { color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight, textAlign: cs.textAlign },
      src: el.getAttribute('src') || '',
      proxied: true,
      ancestors: ancestors, children: children
    }, '*');
  }
  document.addEventListener('mouseover', function(e){
    var el = withVid(e.target);
    if (hovered && hovered !== el) hovered.style.outline = '';
    hovered = el;
    if (hovered) { hovered.style.outline = '2px solid #0d9488'; hovered.style.outlineOffset = '1px'; }
  }, true);
  document.addEventListener('mouseout', function(){ if (hovered) { hovered.style.outline = ''; hovered = null; } }, true);
  document.addEventListener('click', function(e){
    var el = withVid(e.target);
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    select(el);
  }, true);
  window.addEventListener('message', function(e){
    var d = e.data;
    if (d && d.source === 'devhub-visual-edit-select') {
      var target = document.querySelector('[data-vid="' + d.vid + '"]');
      if (target) select(target);
    }
  });
})();
`;

/** Parses the project's HTML entry file, tags every element with a stable
 * `data-vid` (document order), inlines any local <link>/<script src> that
 * match another project file (so the iframe renders with no live server),
 * and appends the click/hover bridge. Returns the PRISTINE (non-inlined)
 * annotated doc separately — that's what gets edited and saved back, so
 * inlining stays a display-only concern and never leaks into the source file. */
function buildVisualEditDocs(htmlPath: string, filesList: FileItem[]): { sourceDoc: Document; srcdoc: string } | null {
  const htmlFile = filesList.find((f) => f.path === htmlPath);
  if (!htmlFile) return null;
  const sourceDoc = new DOMParser().parseFromString(htmlFile.content, "text/html");
  if (!sourceDoc.body) return null;

  // IDs are scoped to <body> only — <html>/<head>/<title>/etc are never
  // visually clickable, so they must never be a valid save target either
  // (setting .textContent on <html> would wipe the entire document).
  let counter = 0;
  const SKIP = new Set(["SCRIPT", "STYLE", "BODY"]);
  const walker = sourceDoc.createTreeWalker(sourceDoc.body, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;
  do {
    const el = node as Element;
    if (!SKIP.has(el.tagName)) el.setAttribute("data-vid", String(counter++));
  } while ((node = walker.nextNode()));

  const displayDoc = sourceDoc.cloneNode(true) as Document;
  displayDoc.querySelectorAll('link[rel="stylesheet"][href]').forEach((link) => {
    const href = link.getAttribute("href") || "";
    const match = filesList.find((f) => f.path === href || f.path === href.replace(/^\.?\//, ""));
    if (match) {
      const style = displayDoc.createElement("style");
      style.textContent = match.content;
      link.replaceWith(style);
    }
  });
  displayDoc.querySelectorAll("script[src]").forEach((script) => {
    const src = script.getAttribute("src") || "";
    const match = filesList.find((f) => f.path === src || f.path === src.replace(/^\.?\//, ""));
    if (match) {
      const inline = displayDoc.createElement("script");
      inline.textContent = match.content;
      script.replaceWith(inline);
    }
  });
  const overlay = displayDoc.createElement("script");
  overlay.textContent = VISUAL_EDIT_OVERLAY_SCRIPT;
  displayDoc.body?.appendChild(overlay);

  return { sourceDoc, srcdoc: "<!DOCTYPE html>\n" + displayDoc.documentElement.outerHTML };
}

type VisualStyles = { color: string; fontSize: string; fontWeight: string; textAlign: string };

const VISUAL_STYLE_TO_CSS: Record<keyof VisualStyles, string> = {
  color: "color", fontSize: "font-size", fontWeight: "font-weight", textAlign: "text-align",
};

/** getComputedStyle reports colors as rgb(a); <input type="color"> only accepts #rrggbb. */
function cssColorToHex(css: string): string {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return css.startsWith("#") ? css : "#000000";
  const hex = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

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

const MONACO_LANG_MAP: Record<string, string> = {
  typescript: "typescript", javascript: "javascript", python: "python",
  html: "html", css: "css", json: "json", markdown: "markdown",
  yaml: "yaml", bash: "shell", plaintext: "plaintext",
};

function CodeEditor({ value, onChange, language }: { value: string; onChange: (v: string) => void; language: string }) {
  return (
    <MonacoEditor
      height={520}
      language={MONACO_LANG_MAP[language] ?? "plaintext"}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      theme="vs"
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        wordWrap: "on",
        overviewRulerLanes: 0,
        overviewRulerBorder: false,
        renderLineHighlight: "line",
        contextmenu: true,
        folding: true,
        glyphMargin: false,
        lineDecorationsWidth: 0,
      }}
    />
  );
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error" | "info" | "warning"; onClose: () => void }) {
  const bg = type === "success" ? "#d1fae5" : type === "error" ? "#fee2e2" : type === "warning" ? "#fef3c7" : "#dbeafe";
  const fg = type === "success" ? "#065f46" : type === "error" ? "#991b1b" : type === "warning" ? "#92400e" : "#1e40af";
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
  const menuRef = useRef<HTMLDivElement>(null);
  // The close-on-outside-click listener used to fire for clicks INSIDE the
  // menu too: mousedown closed it, the menu unmounted, and the click never
  // reached the button — so Rename and Delete did nothing at all. The React
  // onMouseDown/stopPropagation that was meant to prevent this does not run
  // before a native listener on document. Ask the DOM directly instead.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed", left: x, top: y, background: "#fff", border: "1px solid #e2e8f0",
        borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 300, minWidth: 140, overflow: "hidden",
      }}
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

export default function DevHubProjectPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = params instanceof Promise ? use(params) : params;
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);

  // AI Chat state
  const [activeTab, setActiveTab] = useState<"chat" | "visual" | "templates" | "env" | "deployments" | "github" | "media" | "agent" | "settings">("chat");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  // Live phase of the current generation (SSE) — honest states only, each
  // corresponds to something the backend is actually doing right now.
  const [genStage, setGenStage] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  // AI-change history (checkpoints) — undo one step, or jump to any past point
  type Checkpoint = { id: string; label: string; createdAt: string; paths: string[] };
  const [showHistory, setShowHistory] = useState(false);
  const [checkpointHistory, setCheckpointHistory] = useState<Checkpoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Idea planner (plan_project) state
  type ProjectPlan = {
    ok: boolean; aiGenerated: boolean; summary: string; targetUsers: string; stack: string;
    mvpFeatures: string[]; laterFeatures: string[]; milestones: Array<{ title: string; prompt: string }>; firstPrompt: string;
  };
  const [showPlanner, setShowPlanner] = useState(false);
  const [planIdea, setPlanIdea] = useState("");
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<ProjectPlan | null>(null);

  // Visual Edit — Static-stack only (renders client-side, no live dev server needed)
  const [visualEditHtmlPath, setVisualEditHtmlPath] = useState<string | null>(null);
  const [visualEditSrcdoc, setVisualEditSrcdoc] = useState<string | null>(null);
  const [reactPreviewSrcdoc, setReactPreviewSrcdoc] = useState<string | null>(null);
  const [reactPreviewError, setReactPreviewError] = useState<string | null>(null);
  const [visualEditSelected, setVisualEditSelected] = useState<{
    vid: string; tagName: string; text: string; src?: string;
    ancestors?: Array<{ vid: string; tagName: string }>;
    children?: Array<{ vid: string; tagName: string }>;
  } | null>(null);
  const [visualEditImgPrompt, setVisualEditImgPrompt] = useState("");
  const [visualEditImgBusy, setVisualEditImgBusy] = useState(false);
  const [visualEditText, setVisualEditText] = useState("");
  const [visualEditSaving, setVisualEditSaving] = useState(false);
  // Computed styles of the selected element (prefills the controls) vs. the
  // overrides the user actually touched — only the overrides get written back,
  // so saving never bakes browser-default styles into the HTML as inline noise.
  const [visualEditStyleBase, setVisualEditStyleBase] = useState<VisualStyles | null>(null);
  const [visualEditStyleEdits, setVisualEditStyleEdits] = useState<Partial<VisualStyles>>({});
  const [visualEditAiPrompt, setVisualEditAiPrompt] = useState("");
  const [visualEditAiBusy, setVisualEditAiBusy] = useState(false);
  const visualEditSourceDocRef = useRef<Document | null>(null);
  const visualEditIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Agent workflow state
  type AgentStep = { type: "code" | "image" | "tts" | "sfx" | "music"; prompt?: string; text?: string; voice?: string; size?: string; durationSeconds?: number; lengthSeconds?: number; saveAs?: string; stack?: string };
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([
    { type: "code", prompt: "Landing page for an AI startup with hero, headline, CTA", saveAs: "pages/index.tsx" },
    { type: "image", prompt: "AI startup hero — futuristic, vivid colors, abstract", saveAs: "public/hero.url.txt" },
    { type: "tts", text: "Welcome to our AI platform", voice: "Rachel", saveAs: "public/welcome.mp3.b64" },
  ]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentResults, setAgentResults] = useState<Array<{ step: number; type: string; ok: boolean; output?: any; error?: string; savedAs?: string }>>([]);
  const [agentSummary, setAgentSummary] = useState<{ totalSteps: number; successCount: number; failureCount: number } | null>(null);
  const [agentStreaming, setAgentStreaming] = useState(true);
  const [agentLiveStep, setAgentLiveStep] = useState<number | null>(null);
  const [agentTemplates, setAgentTemplates] = useState<Array<{ id: string; name: string; description: string; steps: AgentStep[] }>>([]);
  const [generatedFiles, setGeneratedFiles] = useState<Array<{ path: string; language: string }>>([]);
  type ChatFileChange = { path: string; language: string; isNew: boolean; added: number; removed: number; diff: string | null };
  type ChatMsg =
    | { role: "user"; text: string; at: string }
    | { role: "assistant"; at: string; checkpointId?: string; files: ChatFileChange[]; note?: string }
    // Idea hook: the project clearly stores data but has no schema yet —
    // one click designs it (POST /database/design) without retyping context.
    | { role: "hint"; kind: "design_db" | "deploy" | "manifest" | "provision_db"; description: string; at: string };
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [aiImage, setAiImage] = useState<{ dataBase64: string; mediaType: string; name: string } | null>(null);
  const aiImageInputRef = useRef<HTMLInputElement | null>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);

  // Env vars
  const [envList, setEnvList] = useState<Array<{ key: string; value: string; set: boolean }>>([]);
  // "Could not load" is not the same fact as "there are none". Both lists used
  // to swallow their error and render empty, so a failed read looked like an
  // empty project — someone could conclude DATABASE_URL was never set.
  const [envLoadError, setEnvLoadError] = useState<string | null>(null);
  const [deploymentsLoadError, setDeploymentsLoadError] = useState<string | null>(null);
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
  const [mediaTab, setMediaTab] = useState<"video" | "3d" | "tts" | "image" | "sfx" | "music" | "clone" | "stt" | "drive" | "email" | "templates" | "builder" | "payment" | "sms" | "whatsapp" | "translate" | "bulk">("video");

  // Video generation state (Replicate)
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoModel, setVideoModel] = useState("google/veo-3-fast");
  // Catalogue comes from the server so the picker cannot drift from what the
  // backend can actually run — the hard-coded list had gone two model
  // generations stale.
  const [videoModels, setVideoModels] = useState<Array<{ id: string; label: string; provider: string; audio: boolean; note: string; default?: boolean }>>([]);
  const [threeDModels, setThreeDModels] = useState<Array<{ id: string; label: string; provider: string; note: string; default?: boolean }>>([]);
  const [threeDModel, setThreeDModel] = useState("firtoz/trellis");
  const [threeDImageUrl, setThreeDImageUrl] = useState("");
  const [threeDLoading, setThreeDLoading] = useState(false);
  const [threeDStatus, setThreeDStatus] = useState<string | null>(null);
  const [threeDUrl, setThreeDUrl] = useState<string | null>(null);
  const [threeDError, setThreeDError] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState("5");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoPredictionId, setVideoPredictionId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);

  // Domain provision state
  const [domainStatus, setDomainStatus] = useState<{ customDomain?: string; url?: string } | null>(null);

  // DeepL bulk translate state (N files × M langs)
  const BULK_LANG_OPTIONS = [
    { code: "RU", name: "Русский" }, { code: "EN", name: "English" }, { code: "KK", name: "Қазақша" },
    { code: "DE", name: "Deutsch" }, { code: "FR", name: "Français" }, { code: "ES", name: "Español" },
    { code: "PT", name: "Português" }, { code: "IT", name: "Italiano" }, { code: "PL", name: "Polski" },
    { code: "TR", name: "Türkçe" }, { code: "JA", name: "日本語" }, { code: "ZH", name: "中文" },
  ];
  const BULK_PRESETS = [
    { label: "🌍 Wide reach", codes: ["RU", "EN", "KK", "DE", "FR", "ES"] },
    { label: "📰 Blog", codes: ["RU", "EN", "KK"] },
    { label: "📚 Docs", codes: ["RU", "EN", "KK", "DE", "JA", "ZH"] },
    { label: "🇰🇿 KZ trio", codes: ["RU", "EN", "KK"] },
  ];
  const [bulkPaths, setBulkPaths] = useState<string[]>([]);
  const [bulkLangs, setBulkLangs] = useState<string[]>(() => {
    try {
      const saved = typeof window !== "undefined" && localStorage.getItem("devhub-bulk-lang-preset");
      if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) return parsed; }
    } catch { /* ignore */ }
    return ["RU", "EN"];
  });
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<Array<{ path: string; targetLang: string; ok: boolean; outputPath?: string; error?: string }>>([]);
  const [bulkSummary, setBulkSummary] = useState<{ total: number; successCount: number; failureCount: number } | null>(null);

  // Email template builder state
  const [tplBuilderName, setTplBuilderName] = useState("");
  const [tplBuilderSubject, setTplBuilderSubject] = useState("");
  const [tplBuilderHtml, setTplBuilderHtml] = useState("<h1>Hello {{params.name}}</h1>\n<p>Welcome to AEVION.</p>");
  const [tplBuilderSender, setTplBuilderSender] = useState("");
  const [tplBuilderLoading, setTplBuilderLoading] = useState(false);
  const [tplBuilderMsg, setTplBuilderMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ZIP import state
  const [zipImporting, setZipImporting] = useState(false);
  const [zipOverwrite, setZipOverwrite] = useState(false);
  const [zipResult, setZipResult] = useState<{ ok: boolean; text: string } | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);

  // DeepL translate state
  const [trText, setTrText] = useState("");
  const [trTarget, setTrTarget] = useState("RU");
  const [trSource, setTrSource] = useState("");
  const [trLoading, setTrLoading] = useState(false);
  const [trResult, setTrResult] = useState<{ text: string; detectedSource: string } | null>(null);
  const [trError, setTrError] = useState<string | null>(null);
  // File translate
  const [trFilePath, setTrFilePath] = useState("");
  const [trFileLang, setTrFileLang] = useState("RU");
  const [trFileLoading, setTrFileLoading] = useState(false);
  const [trFileMsg, setTrFileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Brevo email templates state
  const [emailTemplates, setEmailTemplates] = useState<Array<{ id: number; name: string; subject: string; isActive: boolean }>>([]);
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false);
  const [emailTemplatesError, setEmailTemplatesError] = useState<string | null>(null);
  const [tplSendTo, setTplSendTo] = useState("");
  const [tplSendParams, setTplSendParams] = useState("");
  const [tplSendingId, setTplSendingId] = useState<number | null>(null);
  const [tplSendMsg, setTplSendMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // TTS voice preview state
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  // SMS state
  const [smsRecipient, setSmsRecipient] = useState("");
  const [smsContent, setSmsContent] = useState("");
  const [smsSender, setSmsSender] = useState("AEVION");
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsMsg, setSmsMsg] = useState<{ ok: boolean; text: string; degraded?: boolean } | null>(null);

  // WhatsApp state
  const [waContact, setWaContact] = useState("");
  const [waTemplateId, setWaTemplateId] = useState("");
  const [waParams, setWaParams] = useState("");
  const [waLoading, setWaLoading] = useState(false);
  const [waMsg, setWaMsg] = useState<{ ok: boolean; text: string; degraded?: boolean } | null>(null);

  // Cloudflare Images upload state (per-DALL-E-result)
  const [cfImgUploading, setCfImgUploading] = useState(false);
  const [cfImgPermanentUrl, setCfImgPermanentUrl] = useState<string | null>(null);

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

  // Voice clone state
  const [voiceCloneName, setVoiceCloneName] = useState("");
  const [voiceCloneDesc, setVoiceCloneDesc] = useState("");
  const [voiceCloneFile, setVoiceCloneFile] = useState<File | null>(null);
  const [voiceCloneLoading, setVoiceCloneLoading] = useState(false);
  const [voiceCloneMsg, setVoiceCloneMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [voicePreviewText, setVoicePreviewText] = useState("AEVION voice preview — your custom voice is ready");
  const [voicePreviewOk, setVoicePreviewOk] = useState(false);

  // STT state
  const [sttFile, setSttFile] = useState<File | null>(null);
  const [sttLanguage, setSttLanguage] = useState("");
  const [sttLoading, setSttLoading] = useState(false);
  const [sttResult, setSttResult] = useState<{ text: string; language: string | null; confidence: number | null } | null>(null);
  const [sttError, setSttError] = useState<string | null>(null);

  // Drive state
  const [driveQuery, setDriveQuery] = useState("");
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; mimeType: string }>>([]);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveImporting, setDriveImporting] = useState<string | null>(null);

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
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string; degraded?: boolean } | null>(null);

  // Payment link state (Stripe one-off link OR Gumroad product checkout).
  // Gumroad is the only live processor — Stripe/Paddle blocked by KYC.
  const [payProvider, setPayProvider] = useState<"stripe" | "gumroad">("gumroad");
  const [payPermalink, setPayPermalink] = useState("");
  const [payName, setPayName] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("usd");
  const [payDesc, setPayDesc] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payResult, setPayResult] = useState<{ url: string } | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Vercel deploy state
  const [vercelDeploying, setVercelDeploying] = useState(false);

  // Which server-side integrations are actually configured — so a deploy
  // button says "needs VERCEL_API_TOKEN" instead of firing a doomed request.
  const [caps, setCaps] = useState<CapabilityIndex | null>(null);

  // Settings state
  const [settingsName, setSettingsName] = useState("");
  const [settingsDesc, setSettingsDesc] = useState("");
  const [settingsDomain, setSettingsDomain] = useState("");
  const [settingsCollab, setSettingsCollab] = useState("");
  const [collabRole, setCollabRole] = useState<"editor" | "viewer">("editor");
  const [savingSettings, setSavingSettings] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" | "warning" = "success") => {
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

  useEffect(() => {
    if (activeTab !== "media") return;
    if (videoModels.length === 0) {
      fetch(apiUrl("/api/devhub/media/video/models"), { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          setVideoModels(d.models || []);
          const def = (d.models || []).find((m: { default?: boolean }) => m.default);
          if (def) setVideoModel(def.id);
        })
        .catch(() => {});
    }
    if (threeDModels.length === 0) {
      fetch(apiUrl("/api/devhub/media/3d/models"), { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setThreeDModels(d.models || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    // Failure stays silent on purpose: caps === null means "fail open", the
    // buttons behave exactly as they did before this feature existed.
    fetch(apiUrl("/api/devhub/studio/capabilities"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCaps(indexCapabilities(d.capabilities)))
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

  // A save is only a save if the server said so. This used to await the fetch
  // and update local state whatever came back: a 404 (project deleted in
  // another tab, or no edit rights) let the editor keep autosaving into the
  // void for an hour, showing nothing, and the work was gone on refresh.
  // A toast disappears — an unsaved file does not — so the failure also stays
  // on screen next to the file name until a save succeeds.
  const saveCurrentFile = useCallback(async (path: string, content: string, language: string) => {
    if (!project) return;
    setSaving(true);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(path)}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, language }),
      });
      if (!r.ok) {
        const reason = r.status === 404
          ? "проект не найден или нет прав на правку"
          : `сервер ответил ${r.status}`;
        setSaveError(`${path} НЕ сохранён — ${reason}`);
        showToast(`Не сохранено: ${reason}`, "error");
        return;
      }
      setSaveError(null);
      setFiles((fs) => fs.map((f) => f.path === path ? { ...f, content, updatedAt: new Date().toISOString() } : f));
    } catch {
      setSaveError(`${path} НЕ сохранён — нет связи с сервером`);
      showToast("Не сохранено — нет связи с сервером", "error");
    } finally {
      setSaving(false);
    }
  }, [project]);

  /** Save the editor's current text to the user's disk. The escape hatch for a
   *  refused save: at that point the only copy of their work is this tab. */
  const downloadEditorBuffer = () => {
    if (!selectedFile) return;
    const blob = new Blob([editorContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile.path.split("/").pop() || "file.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast(`Копия ${a.download} скачана`, "success");
  };

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

  const createNewFile = async () => {
    if (!newFileName.trim() || !project) return;
    // The endpoint is an upsert and we send content:"" — so an existing path
    // here does not create a file, it empties one. Refuse instead.
    const pathError = newFilePathError(newFileName, files.map((f) => f.path));
    if (pathError) {
      showToast(pathError, "error");
      return;
    }
    const path = normalizeFilePath(newFileName);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(path)}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "", language: "plaintext" }),
      });
      const data = await r.json().catch(() => null);
      const newFile = data?.file;
      if (!r.ok || !newFile?.path) {
        showToast(`Не удалось создать файл — сервер ответил ${r.status}`, "error");
        return;
      }
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
      await writeOrThrow(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(path)}`), { method: "DELETE" });
      const remaining = files.filter((f) => f.path !== path);
      setFiles(remaining);
      if (selectedFile?.path === path) {
        const next = remaining[0] ?? null;
        setSelectedFile(next);
        setEditorContent(next?.content ?? "");
      }
    } catch (e: any) {
      // The file is still there; the tree must keep showing it.
      showToast(`Файл НЕ удалён — ${e?.message || "нет связи"}`, "error");
    }
  };

  // Rename is copy-then-delete. Two ways that used to lose the file: renaming
  // onto an existing path overwrote that file (upsert), and the delete ran
  // even when the copy had failed — leaving nothing at either path.
  const renameFile = async (oldPath: string, newPath: string) => {
    if (!project || !newPath.trim() || normalizeFilePath(oldPath) === normalizeFilePath(newPath)) {
      setRenamingFile(null);
      return;
    }
    const pathError = renamePathError(oldPath, newPath, files.map((f) => f.path));
    if (pathError) {
      showToast(pathError, "error");
      setRenamingFile(null);
      return;
    }
    const target = normalizeFilePath(newPath);
    try {
      const file = files.find((f) => f.path === oldPath);
      if (!file) return;
      // Copy to the new path first — only delete the original once it landed.
      const putR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(target)}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: file.content, language: file.language }),
      });
      if (!putR.ok) {
        showToast(`Переименование отменено — копия не создалась (${putR.status}); файл на месте`, "error");
        return;
      }
      const delR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(oldPath)}`), { method: "DELETE" });
      if (!delR.ok) {
        // The copy exists, the original does too. Showing only the new path
        // would hide a duplicate that then gets exported, pushed and deployed.
        const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
        const listData = await listR.json().catch(() => null);
        if (listData?.files) setFiles(listData.files);
        showToast(`Копия создана как ${target}, но старый файл не удалился (${delR.status}) — оба на месте`, "warning");
        return;
      }
      setFiles((fs) => {
        const updated = fs.map((f) => f.path === oldPath ? { ...f, path: target } : f);
        return updated.sort((a, b) => a.path.localeCompare(b.path));
      });
      if (selectedFile?.path === oldPath) {
        setSelectedFile((sf) => sf ? { ...sf, path: target } : null);
      }
      showToast("File renamed", "success");
    } catch {
      showToast("Rename failed", "error");
    } finally {
      setRenamingFile(null);
    }
  };

  // Prompt-first handoff from /devhub: the landing stored the idea under
  // devhub_autoprompt_<id>; pick it up once and run the first generation
  // automatically so "describe -> built" needs zero extra clicks.
  const autoPromptFiredRef = useRef(false);
  useEffect(() => {
    if (!project || generating || autoPromptFiredRef.current) return;
    let pending: string | null = null;
    try { pending = localStorage.getItem(`devhub_autoprompt_${project.id}`); } catch { /* private mode */ }
    if (!pending) return;
    autoPromptFiredRef.current = true;
    try { localStorage.removeItem(`devhub_autoprompt_${project.id}`); } catch { /* ignore */ }
    setActiveTab("chat");
    setAiPrompt(pending);
    generateCode(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Chat history persists per project so an iteration survives a reload.
  useEffect(() => {
    if (!project) return;
    try {
      const raw = localStorage.getItem(`devhub_chat_${project.id}`);
      if (raw) setChatHistory(JSON.parse(raw));
    } catch { /* corrupt cache — start fresh */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);
  useEffect(() => {
    if (!project || chatHistory.length === 0) return;
    try { localStorage.setItem(`devhub_chat_${project.id}`, JSON.stringify(chatHistory.slice(-40))); } catch { /* quota */ }
    chatLogRef.current?.scrollTo({ top: chatLogRef.current.scrollHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory]);

  const generateCode = async (promptOverride?: string) => {
    const userText = (promptOverride ?? aiPrompt).trim();
    if (!userText || !project) return;
    setGenerating(true);
    setGeneratedFiles([]);
    const sentImage = aiImage;
    setAiImage(null);
    setChatHistory((h) => [...h, { role: "user", text: (sentImage ? "🖼 " : "") + userText, at: new Date().toISOString() }]);
    try {
      const generateBody = JSON.stringify({
        prompt: userText, stack: project.stack,
        // Prior turns give follow-ups their referent ("make the button blue").
        history: chatHistory
          .filter((m) => m.role !== "hint") // hints are UI affordances, not dialog
          .slice(-8)
          .map((m) =>
            m.role === "user"
              ? { role: "user", text: m.text }
              : { role: "assistant", text: m.files.length ? `Changed files: ${m.files.map((fc) => fc.path).join(", ")}` : (m.note || "No changes") }
          ),
        ...(sentImage ? { imageBase64: sentImage.dataBase64, imageMediaType: sentImage.mediaType } : {}),
      });
      // Stream-first: live phase events instead of a silent multi-minute
      // spinner. Falls back to the plain endpoint when the stream isn't
      // available (older pod mid-deploy) — same payload either way.
      let data: any = null;
      try {
        const streamR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/generate/stream`), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: generateBody,
        });
        if (streamR.ok && streamR.body && (streamR.headers.get("content-type") || "").includes("text/event-stream")) {
          const reader = streamR.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";
            for (const e of events) {
              if (!e.startsWith("data: ")) continue;
              const evt = JSON.parse(e.slice(6));
              if (evt.type === "status") setGenStage(evt.stage);
              else if (evt.type === "result") data = evt;
              else if (evt.type === "error") throw new Error(evt.error);
            }
          }
        }
      } catch (streamErr) {
        if (streamErr instanceof Error && data === null && streamErr.message && !/fetch|network/i.test(streamErr.message)) throw streamErr;
        data = null; // network-level stream failure — fall through to plain POST
      }
      if (data === null) {
        const r = await fetchWithRedeployRetry(
          apiUrl(`/api/devhub/projects/${project.id}/generate`),
          { method: "POST", headers: { "Content-Type": "application/json" }, body: generateBody },
          { onRetry: () => showToast("Backend is redeploying — retrying in 20s…", "info") }
        );
        data = await r.json();
        if (!r.ok) throw new Error(data.error || "Generation failed");
      }
      const newGenerated = data.files || [];
      setGeneratedFiles(newGenerated.map((f: any) => ({ path: f.path, language: f.language })));
      // Diffs are computed against the files as they were BEFORE this
      // generation (still in state here — the list reload happens below).
      const changes = newGenerated.map((gf: { path: string; language?: string; content: string }) => {
        const before = files.find((ff) => ff.path === gf.path)?.content ?? "";
        const d = diffLines(before, gf.content ?? "");
        return { path: gf.path, language: gf.language || "text", isNew: before === "", added: d.added, removed: d.removed, diff: d.text };
      });
      let note: string | undefined;
      if (data.continued) {
        note = "Reply hit the length cap — the missing files were fetched in a follow-up call";
      }
      if (data.aiGenerated === false) {
        note = "No AI provider configured — placeholder inserted instead of real code";
        showToast("No AI provider configured — inserted a placeholder file instead of real code", "error");
      } else if (Array.isArray(data.syntaxErrors) && data.syntaxErrors.length > 0) {
        const paths = data.syntaxErrors.map((s: { path: string }) => s.path).join(", ");
        note = `Syntax check failed: ${paths}`;
        showToast(`Generated ${newGenerated.length} file(s), but ${paths} failed a syntax check — review before deploying`, "warning");
      } else {
        showToast(`Generated ${newGenerated.length} file(s)`, "success");
      }
      setChatHistory((h) => [...h, { role: "assistant", at: new Date().toISOString(), checkpointId: data.checkpointId, files: changes, note }]);
      // Data-shaped idea + no schema yet → offer to design the database with
      // the context already in hand (rules live in lib/devhubHints — tested).
      setChatHistory((h) => {
        const offerDb = shouldOfferDbHint({
          userText,
          projectDescription: project.description,
          filePaths: files.map((f) => f.path),
          historyHasHint: h.some((m) => m.role === "hint" && (m as any).kind === "design_db"),
        });
        if (offerDb) return [...h, { role: "hint", kind: "design_db", description: userText, at: new Date().toISOString() }];
        const offerDeploy = shouldOfferDeployHint({
          stack: project.stack,
          deployUrl: project.deployUrl,
          historyHasDeployHint: h.some((m) => m.role === "hint" && (m as any).kind === "deploy"),
        });
        if (offerDeploy) return [...h, { role: "hint", kind: "deploy", description: userText, at: new Date().toISOString() }];
        const offerManifest = shouldOfferManifestHint({
          stack: project.stack,
          filePaths: [...files.map((f) => f.path), ...newGenerated.map((f: { path: string }) => f.path)],
          historyHasManifestHint: h.some((m) => m.role === "hint" && (m as any).kind === "manifest"),
        });
        if (offerManifest) return [...h, { role: "hint", kind: "manifest", description: userText, at: new Date().toISOString() }];
        return h;
      });
      // Reload files list
      const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
      const listData = await listR.json();
      setFiles(listData.files || []);
      setAiPrompt("");
    } catch (e: any) {
      setChatHistory((h) => [...h, { role: "assistant", at: new Date().toISOString(), files: [], note: e.message || "Generation failed" }]);
      showToast(e.message || "Generation failed", "error");
    } finally {
      setGenerating(false);
      setGenStage(null);
    }
  };

  // Shared by undoLastGeneration and restoreToCheckpoint: reload the file
  // list and, if the currently-open file was among the reverted paths,
  // reload its content too (or close it, if the revert deleted it).
  const reloadAfterRevert = async (revertedFiles: string[]) => {
    if (!project) return;
    const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
    const listData = await listR.json();
    setFiles(listData.files || []);
    if (selectedFile && revertedFiles.includes(selectedFile.path)) {
      const stillExists = (listData.files || []).some((f: FileItem) => f.path === selectedFile.path);
      if (stillExists) {
        const fr = await fetch(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(selectedFile.path)}`), { cache: "no-store" });
        const fd = await fr.json();
        if (fd.file) setEditorContent(fd.file.content);
      } else {
        setSelectedFile(null);
        setEditorContent("");
      }
    }
  };

  const loadCheckpointHistory = async () => {
    if (!project) return;
    setLoadingHistory(true);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/checkpoints`), { cache: "no-store" });
      const data = await r.json();
      setCheckpointHistory(data.checkpoints || []);
    } catch {
      // leave whatever history was already loaded — a stale list beats a blank one here
    } finally {
      setLoadingHistory(false);
    }
  };

  const undoLastGeneration = async () => {
    if (!project) return;
    setUndoing(true);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/generate/undo`), { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Undo failed");
      if (data.ok === false) {
        showToast(data.message || "No AI change to undo", "info");
        return;
      }
      await reloadAfterRevert(Array.isArray(data.revertedFiles) ? data.revertedFiles : []);
      if (showHistory) loadCheckpointHistory();
      showToast(`Reverted: ${data.label || "last AI change"}`, "success");
    } catch (e: any) {
      showToast(e.message || "Undo failed", "error");
    } finally {
      setUndoing(false);
    }
  };

  const restoreToCheckpoint = async (checkpointId: string) => {
    if (!project) return;
    setRestoringId(checkpointId);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/checkpoints/${checkpointId}/restore`), { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Restore failed");
      if (data.ok === false) {
        showToast(data.message || "That checkpoint is no longer available", "info");
        loadCheckpointHistory();
        return;
      }
      await reloadAfterRevert(Array.isArray(data.revertedFiles) ? data.revertedFiles : []);
      loadCheckpointHistory();
      showToast(`Restored to: ${data.restoredToLabel} (${data.stepsApplied} step${data.stepsApplied === 1 ? "" : "s"} back)`, "success");
    } catch (e: any) {
      showToast(e.message || "Restore failed", "error");
    } finally {
      setRestoringId(null);
    }
  };

  const planProject = async () => {
    if (!planIdea.trim()) return;
    setPlanning(true);
    setPlan(null);
    try {
      const r = await fetch(apiUrl("/api/devhub/plan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: planIdea, ...(project ? { projectId: project.id } : {}) }),
      });
      const data = await r.json();
      if (!r.ok || data.ok === false) throw new Error(data.error || "Planning failed");
      setPlan(data);
      if (data.aiGenerated === false) {
        showToast("No AI provider configured — showing a generic outline instead of a tailored plan", "warning");
      }
    } catch (e: any) {
      showToast(e.message || "Planning failed", "error");
    } finally {
      setPlanning(false);
    }
  };

  // Rebuild the Visual Edit preview whenever the tab is opened or files change
  // (e.g. after a save) — Static stack only, needs an HTML entry file.
  useEffect(() => {
    if (activeTab !== "visual" || !project || project.stack !== "static") return;
    const htmlFile = files.find((f) => f.path === "index.html") || files.find((f) => f.path.toLowerCase().endsWith(".html"));
    if (!htmlFile) {
      visualEditSourceDocRef.current = null;
      setVisualEditHtmlPath(null);
      setVisualEditSrcdoc(null);
      return;
    }
    const built = buildVisualEditDocs(htmlFile.path, files);
    visualEditSourceDocRef.current = built?.sourceDoc ?? null;
    setVisualEditHtmlPath(htmlFile.path);
    setVisualEditSrcdoc(built?.srcdoc ?? null);
    setVisualEditSelected(null);
  }, [activeTab, project, files]);

  // Client-side live preview for React SPA projects — transform in the parent,
  // module graph via import map, no deploy needed (see lib/reactPreview.ts).
  useEffect(() => {
    if (activeTab !== "visual" || !project || !isClientPreviewStack(project.stack)) return;
    let cancelled = false;
    setReactPreviewError(null);
    buildReactPreviewSrcdoc(
      files.map((f) => ({ path: f.path, content: f.content })),
      REACT_PREVIEW_OVERLAY_SCRIPT
    ).then((r) => {
      if (cancelled) return;
      if ("error" in r) { setReactPreviewSrcdoc(null); setReactPreviewError(r.error); }
      else { setReactPreviewSrcdoc(r.srcdoc); }
      setVisualEditSelected(null);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, project?.stack, files]);

  // Bridge for clicks inside the sandboxed preview iframe (see VISUAL_EDIT_OVERLAY_SCRIPT)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || data.source !== "devhub-visual-edit") return;
      setVisualEditSelected({ vid: data.vid, tagName: data.tagName, text: data.text, src: data.src, ancestors: data.ancestors, children: data.children });
      setVisualEditText(data.text);
      setVisualEditStyleBase(data.styles || null);
      setVisualEditStyleEdits({});
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Retarget the selection to an ancestor/child via the overlay, which replies
  // with the full select payload (text, styles, fresh ancestor/child chains).
  const retargetVisualSelection = (vid: string) => {
    visualEditIframeRef.current?.contentWindow?.postMessage({ source: "devhub-visual-edit-select", vid }, "*");
  };

  // Record a style override and paint it live in the preview iframe.
  const setVisualStyle = (key: keyof VisualStyles, value: string) => {
    if (!visualEditSelected) return;
    setVisualEditStyleEdits((prev) => ({ ...prev, [key]: value }));
    visualEditIframeRef.current?.contentWindow?.postMessage(
      { source: "devhub-visual-edit-apply", vid: visualEditSelected.vid, styles: { [key]: value } },
      "*"
    );
  };

  const saveVisualEdit = async () => {
    if (!project || !visualEditSelected || !visualEditHtmlPath || !visualEditSourceDocRef.current) return;
    setVisualEditSaving(true);
    try {
      const doc = visualEditSourceDocRef.current;
      const el = doc.querySelector(`[data-vid="${visualEditSelected.vid}"]`);
      if (!el) throw new Error("Element no longer in the preview — it was rebuilt, click it again");
      if (visualEditSelected.tagName !== "IMG") el.textContent = visualEditText;
      for (const [key, value] of Object.entries(visualEditStyleEdits)) {
        (el as HTMLElement).style.setProperty(VISUAL_STYLE_TO_CSS[key as keyof VisualStyles], value);
      }
      // Serialize from a clone so a failed save leaves the working doc (and its
      // data-vid anchors) intact for the next attempt.
      const clean = doc.cloneNode(true) as Document;
      clean.querySelectorAll("[data-vid]").forEach((n) => n.removeAttribute("data-vid"));
      const finalHtml = "<!DOCTYPE html>\n" + clean.documentElement.outerHTML;
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(visualEditHtmlPath)}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: finalHtml }),
      });
      if (!r.ok) throw new Error("Save failed");
      const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
      const listData = await listR.json();
      setFiles(listData.files || []);
      showToast(`Saved — updated ${visualEditHtmlPath}`, "success");
    } catch (e: any) {
      showToast(e.message || "Save failed", "error");
    } finally {
      setVisualEditSaving(false);
    }
  };

  // Generate an image for the selected <img> and save it as its src in one
  // step (generation is the slow, costly part — a separate Save step would
  // just add a way to lose the result).
  const generateVisualImage = async () => {
    if (!project || !visualEditSelected || !visualEditHtmlPath || !visualEditSourceDocRef.current || !visualEditImgPrompt.trim()) return;
    setVisualEditImgBusy(true);
    try {
      const r = await fetchWithRedeployRetry(apiUrl(`/api/devhub/media/image`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: visualEditImgPrompt.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Image generation failed");
      const doc = visualEditSourceDocRef.current;
      const el = doc.querySelector(`[data-vid="${visualEditSelected.vid}"]`);
      if (!el) throw new Error("Element no longer in the preview — it was rebuilt, click it again");
      el.setAttribute("src", data.url);
      if (!el.getAttribute("alt")) el.setAttribute("alt", visualEditImgPrompt.trim().slice(0, 120));
      const clean = doc.cloneNode(true) as Document;
      clean.querySelectorAll("[data-vid]").forEach((n) => n.removeAttribute("data-vid"));
      const finalHtml = "<!DOCTYPE html>\n" + clean.documentElement.outerHTML;
      const putR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/file?path=${encodeURIComponent(visualEditHtmlPath)}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: finalHtml }),
      });
      if (!putR.ok) throw new Error("Generated, but saving the page failed");
      setVisualEditImgPrompt("");
      const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
      const listData = await listR.json();
      setFiles(listData.files || []);
      showToast(
        String(data.url).startsWith("data:")
          ? "Image generated and saved (embedded inline — the page carries the image data itself)"
          : "Image generated and saved",
        "success"
      );
    } catch (e: any) {
      showToast(e.message || "Image generation failed", "error");
    } finally {
      setVisualEditImgBusy(false);
    }
  };

  const [designingDb, setDesigningDb] = useState(false);
  const [provisioningDb, setProvisioningDb] = useState(false);
  const [dbUsage, setDbUsage] = useState<{ provisioned: boolean; tables?: number; megabytes?: number; connectionLimit?: number; error?: string } | null>(null);
  // One-click follow-through on the design_db hint: runs /database/design with
  // the idea already in hand, renders the result as a normal assistant card
  // (diffs, checkpoint — undo works), and retires the hint.
  const designDbFromHint = async (description: string) => {
    if (!project || designingDb) return;
    setDesigningDb(true);
    try {
      const r = await fetchWithRedeployRetry(
        apiUrl(`/api/devhub/projects/${project.id}/database/design`),
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description }) },
        { onRetry: () => showToast("Backend is redeploying — retrying in 20s…", "info") }
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Database design failed");
      const changes = (data.files || []).map((gf: { path: string; language?: string; content: string }) => {
        const before = files.find((ff) => ff.path === gf.path)?.content ?? "";
        const d = diffLines(before, gf.content ?? "");
        return { path: gf.path, language: gf.language || "text", isNew: before === "", added: d.added, removed: d.removed, diff: d.text };
      });
      setChatHistory((h) => [
        ...h.filter((m) => m.role !== "hint"),
        { role: "assistant", at: new Date().toISOString(), checkpointId: data.checkpointId, files: changes, note: data.aiGenerated === false ? "No AI provider configured — placeholder schema" : data.note },
      ]);
      const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
      const listData = await listR.json();
      setFiles(listData.files || []);
      showToast("Database designed — db/schema.sql + client are in the file tree", "success");
      // Schema on disk is only half the job; offer to create the real database
      // right here when the server can (capability "database" is live).
      if (data.canProvision) {
        setChatHistory((h) => [...h, { role: "hint", kind: "provision_db", description, at: new Date().toISOString() }]);
      }
    } catch (e: any) {
      showToast(e.message || "Database design failed", "error");
    } finally {
      setDesigningDb(false);
    }
  };

  // Create the project's real database: schema + login role on the projects
  // instance, schema.sql applied, DATABASE_URL saved into this project's env.
  // Append a generated asset to the open file instead of replacing it.
  //
  // The media buttons used to call setEditorContent(url) and save — which
  // overwrites the entire file with a single line. Open App.jsx, generate a
  // video, press the button, and the app is gone. Appending keeps the work and
  // still puts the asset where the code can reach it. With no file open there
  // is nothing to append to, so the URL goes to the clipboard and we say so —
  // silently doing nothing would look like the button was broken.
  const appendAssetToFile = (url: string, kind: AssetKind) => {
    if (!selectedFile) {
      navigator.clipboard?.writeText(url).catch(() => {});
      showToast("Нет открытого файла — ссылка скопирована в буфер", "info");
      return;
    }
    const next = appendSnippet(editorContent, assetSnippet(selectedFile.path, url, kind));
    setEditorContent(next);
    saveCurrentFile(selectedFile.path, next, selectedFile.language);
    showToast(`Добавлено в ${selectedFile.path}`, "success");
  };

  const provisionDatabase = async () => {
    if (!project || provisioningDb) return;
    if (isCapabilityBlocked(caps, "database")) {
      showToast(capabilityHint(caps, "database", "Database provisioning"), "warning");
      return;
    }
    setProvisioningDb(true);
    try {
      const r = await fetchWithRedeployRetry(
        apiUrl(`/api/devhub/projects/${project.id}/database/provision`),
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
        { onRetry: () => showToast("Backend is redeploying — retrying in 20s…", "info") }
      );
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || "Provisioning failed");
      setChatHistory((h) => [
        ...h.filter((m) => !(m.role === "hint" && m.kind === "provision_db")),
        {
          role: "assistant",
          at: new Date().toISOString(),
          files: [],
          note: data.appliedSchemaSql
            ? `Database ready — schema ${data.schema} created, tables from db/schema.sql applied, DATABASE_URL saved to Env Vars.`
            : `Database ready — schema ${data.schema} created. No db/schema.sql yet, so no tables were made.`,
        },
      ]);
      // Refresh the project so the Env Vars tab shows DATABASE_URL.
      const pr = await fetch(apiUrl(`/api/devhub/projects/${project.id}`), { cache: "no-store" });
      const pd = await pr.json();
      setProject(pd.project);
      showToast(data.appliedSchemaSql ? "Database created and schema applied" : "Database created", "success");
    } catch (e: any) {
      showToast(e.message || "Provisioning failed", "error");
    } finally {
      setProvisioningDb(false);
    }
  };

  // AI edit for the visually-selected element — reuses the same /generate
  // pipeline as the IDE button (checkpoints, undo, syntax check, self-correct
  // all apply), just with the prompt anchored to what the user clicked.
  const aiEditVisual = async () => {
    if (!project || !visualEditSelected || !visualEditAiPrompt.trim()) return;
    if (!visualEditHtmlPath && project.stack === "static") return;
    setVisualEditAiBusy(true);
    try {
      const sel = visualEditSelected;
      // Static mode pins the edit to the page's HTML file. Proxy mode (deployed
      // Next/React/etc.) can't map a rendered element to one source file, so
      // the model gets the element context and picks the file itself.
      const prompt = visualEditHtmlPath
        ? `In ${visualEditHtmlPath}, the user visually selected a <${sel.tagName.toLowerCase()}> element` +
          (sel.text.trim() ? ` whose current text is: "${sel.text.trim().slice(0, 200)}"` : "") +
          `. Apply this change to that element (and its related styles if needed), keeping the rest of the page intact: ${visualEditAiPrompt.trim()}`
        : `On the deployed preview of this project, the user visually selected a <${sel.tagName.toLowerCase()}> element` +
          (sel.text.trim() ? ` whose rendered text is: "${sel.text.trim().slice(0, 200)}"` : "") +
          `. Find the source file(s) that produce this element and apply this change there, keeping everything else intact: ${visualEditAiPrompt.trim()}`;
      const r = await fetchWithRedeployRetry(apiUrl(`/api/devhub/projects/${project.id}/generate`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, stack: project.stack, ...(visualEditHtmlPath ? { targetFiles: [visualEditHtmlPath] } : {}) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "AI edit failed");
      if (data.aiGenerated === false) {
        showToast("No AI provider configured — the page was not changed with real AI output", "error");
      } else if (Array.isArray(data.syntaxErrors) && data.syntaxErrors.length > 0) {
        showToast("AI edit applied, but the result failed a syntax check — review before deploying", "warning");
      } else {
        showToast(
          visualEditHtmlPath
            ? "AI edit applied — preview refreshed (↩ Undo below if it's wrong)"
            : "AI edit applied to the source files — redeploy to see it in this preview (↩ Undo below if it's wrong)",
          "success"
        );
      }
      setVisualEditAiPrompt("");
      // Refreshing the file list retriggers the preview rebuild effect.
      const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
      const listData = await listR.json();
      setFiles(listData.files || []);
    } catch (e: any) {
      showToast(e.message || "AI edit failed", "error");
    } finally {
      setVisualEditAiBusy(false);
    }
  };

  // Pull the linked repo's default branch INTO the project (two-way sync).
  const [repoPulling, setRepoPulling] = useState(false);
  const syncFromGithub = async () => {
    if (!project || repoPulling) return;
    setRepoPulling(true);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/github/sync`), { method: "POST" });
      const data = await r.json();
      if (!r.ok || data.ok === false) throw new Error(data.error || data.message || "Sync failed");
      showToast(data.message || "Synced", (data.updated?.length || data.created?.length) ? "success" : "info");
      const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
      const listData = await listR.json();
      setFiles(listData.files || []);
    } catch (e: any) {
      showToast(e.message || "Sync failed", "error");
    } finally {
      setRepoPulling(false);
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
    if (isCapabilityBlocked(caps, "railway")) {
      showToast(capabilityHint(caps, "railway", "Railway deploy"), "warning");
      return;
    }
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
      if (!r.ok) throw new Error(`сервер ответил ${r.status}`);
      const data = await r.json();
      setDeployments(data.deployments || []);
      setDeploymentsLoadError(null);
    } catch (e: any) {
      setDeploymentsLoadError(e?.message || "нет связи с сервером");
    }
  }, [project]);

  useEffect(() => {
    if (activeTab === "deployments" && project) fetchDeployments();
  }, [activeTab, fetchDeployments, project]);

  const fetchEnv = useCallback(async () => {
    if (!project) return;
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/env`), { cache: "no-store" });
      if (!r.ok) throw new Error(`сервер ответил ${r.status}`);
      const data = await r.json();
      setEnvList(data.env || []);
      setEnvLoadError(null);
    } catch (e: any) {
      setEnvLoadError(e?.message || "нет связи с сервером");
    }
  }, [project]);

  useEffect(() => {
    if (activeTab === "env" && project) fetchEnv();
  }, [activeTab, fetchEnv, project]);

  const addEnvVar = async () => {
    if (!newEnvKey.trim() || !project) return;
    try {
      await writeOrThrow(apiUrl(`/api/devhub/projects/${project.id}/env`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newEnvKey, value: newEnvVal }),
      });
      setNewEnvKey(""); setNewEnvVal("");
      fetchEnv();
      showToast("Env var saved", "success");
    } catch (e: any) { showToast(`Переменная НЕ сохранена — ${e?.message || "нет связи"}`, "error"); }
  };

  const removeEnvVar = async (key: string) => {
    if (!project) return;
    try {
      await writeOrThrow(apiUrl(`/api/devhub/projects/${project.id}/env/${encodeURIComponent(key)}`), { method: "DELETE" });
      fetchEnv();
    } catch (e: any) {
      // The list is re-read either way: a variable that is still on the server
      // must reappear rather than look deleted.
      fetchEnv();
      showToast(`Переменная НЕ удалена — ${e?.message || "нет связи"}`, "error");
    }
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
      await writeOrThrow(apiUrl(`/api/devhub/projects/${project.id}`), {
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
    } catch (e: any) {
      showToast(`Настройки НЕ сохранены — ${e?.message || "нет связи"}`, "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const addCollaborator = async () => {
    if (!project || !settingsCollab.trim()) return;
    try {
      const resp = await fetch(apiUrl(`/api/devhub/projects/${project.id}/collaborators`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: settingsCollab.trim(), role: collabRole }),
      });
      if (resp.status === 403) {
        showToast("Studio Pro required — upgrade to add collaborators", "error");
        return;
      }
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !Array.isArray(data?.collaborators)) {
        // Two lies in one line before this: a green "added" toast, and
        // `data.collaborators || []` wiping everyone already on the project
        // off the screen because a failed response carries no list.
        showToast(`Соавтор НЕ добавлен — сервер ответил ${resp.status}`, "error");
        return;
      }
      setProject((p) => p ? { ...p, collaborators: data.collaborators } : p);
      setSettingsCollab("");
      showToast(`Collaborator added (${collabRole})`, "success");
    } catch {
      showToast("Failed to add collaborator", "error");
    }
  };

  const removeCollaborator = async (collabUserId: string) => {
    if (!project) return;
    try {
      await writeOrThrow(apiUrl(`/api/devhub/projects/${project.id}/collaborators/${encodeURIComponent(collabUserId)}`), { method: "DELETE" });
      setProject((p) => p ? { ...p, collaborators: p.collaborators.filter((c) => c.userId !== collabUserId) } : p);
      showToast("Доступ отозван", "success");
    } catch (e: any) {
      // Leave them in the list. Access is still live, and a list that hides
      // that is worse than the error.
      showToast(`Доступ НЕ отозван — ${e?.message || "нет связи"}`, "error");
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
      if (d.ok && d.degraded) {
        // Some files never reached the repo. Saying "pushed" here is how an
        // incomplete repo passed for a complete one — and it is the repo a
        // deploy would build from.
        setGithubMsg(`⚠ Отправлено ${d.pushedFiles} из ${d.pushedFiles + (d.failedFiles?.length ?? 0)} файлов. ${d.degradedReason}`);
        showToast("Часть файлов не попала в репозиторий", "warning");
        setProject((p) => p ? { ...p, repoUrl: d.repoUrl } : p);
        await fetchGithubStatus();
        await fetchGithubBranches();
      } else if (d.ok) {
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

  // ── Cloudflare Pages deploy ──────────────────────────────────────────────────
  const [pagesDeploying, setPagesDeploying] = useState(false);
  const [pagesResult, setPagesResult] = useState<{ liveUrl: string; domain: string | null; pagesUrl: string } | null>(null);

  const deployToPages = async () => {
    if (!project) return;
    if (isCapabilityBlocked(caps, "pages")) {
      showToast(capabilityHint(caps, "pages", "Cloudflare Pages deploy"), "warning");
      return;
    }
    setPagesDeploying(true);
    setPagesResult(null);
    showToast("Deploying to Cloudflare Pages...", "info");
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/deploy/pages`), { method: "POST" });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Pages deploy failed");
      setPagesResult({ liveUrl: d.liveUrl, domain: d.domain, pagesUrl: d.pagesUrl });
      showToast(d.domain ? `Live: https://${d.domain}` : `Live: ${d.pagesUrl}`, "success");
      setTimeout(async () => {
        const pr = await fetch(apiUrl(`/api/devhub/projects/${project.id}`), { cache: "no-store" });
        const pd = await pr.json();
        setProject(pd.project);
        fetchDeployments();
      }, 5000);
    } catch (e: any) {
      showToast(e?.message || "Cloudflare Pages deploy failed", "error");
    } finally {
      setPagesDeploying(false);
    }
  };

  // ── Vercel deploy ────────────────────────────────────────────────────────────

  const deployToVercel = async () => {
    if (!project) return;
    if (isCapabilityBlocked(caps, "vercel")) {
      showToast(capabilityHint(caps, "vercel", "Vercel deploy"), "warning");
      return;
    }
    setVercelDeploying(true);
    showToast("Deploying to Vercel...", "info");
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/deploy/vercel`), { method: "POST" });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        throw new Error(d.error || "Vercel deploy failed");
      }
      showToast(`Vercel: ${d.deployUrl}`, "success");
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
      } else if (d.degraded) {
        setEmailMsg({ ok: true, degraded: true, text: `Sent to ${emailTo}, but Brevo didn't confirm a messageId — ${d.degradedReason || "delivery not confirmed"}` });
        setEmailTo(""); setEmailSubject(""); setEmailBody("");
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

  // ── Gumroad checkout helper (the only live processor) ────────────────────────
  // Price is fixed in the Gumroad product; we just build its public checkout URL.

  const createGumroadCheckout = async () => {
    if (!payPermalink.trim()) return;
    setPayLoading(true);
    setPayError(null);
    setPayResult(null);
    try {
      const r = await fetch(apiUrl("/api/devhub/media/gumroad-checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permalink: payPermalink.trim() }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setPayError(d.error || "Failed to create Gumroad checkout");
      } else {
        setPayResult({ url: d.url });
      }
    } catch (e: any) {
      setPayError(e?.message || "Failed to create Gumroad checkout");
    } finally {
      setPayLoading(false);
    }
  };

  // ── DALL-E image helper ──────────────────────────────────────────────────────

  const generateImage = async () => {
    if (!imgPrompt.trim()) return;
    if (isCapabilityBlocked(caps, "image")) {
      setImgError(capabilityHint(caps, "image", "Image generation"));
      return;
    }
    setImgLoading(true);
    setImgError(null);
    setImgResult(null);
    setCfImgPermanentUrl(null);
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
    if (isCapabilityBlocked(caps, "audio_music")) {
      setMusicError(capabilityHint(caps, "audio_music", "Music generation"));
      return;
    }
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
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/domain/setup`), { method: "POST" });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setDomainSetupMsg({ ok: false, text: d.error || "Setup failed" });
      } else {
        setDomainSetupMsg({ ok: true, text: `✓ ${d.domain} → ${d.url}` });
        setProject((p) => p ? { ...p, customDomain: d.domain } : p);
      }
    } catch (e: any) {
      setDomainSetupMsg({ ok: false, text: e?.message || "Setup failed" });
    } finally {
      setDomainSetupLoading(false);
    }
  };

  // ── Agent workflow ───────────────────────────────────────────────────────────

  const loadAgentTemplates = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/devhub/agent/templates"), { cache: "no-store" });
      const d = await r.json();
      setAgentTemplates(d.templates || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (activeTab === "agent" && agentTemplates.length === 0) loadAgentTemplates();
  }, [activeTab, agentTemplates.length, loadAgentTemplates]);

  const applyAgentTemplate = (tplId: string) => {
    const tpl = agentTemplates.find((t) => t.id === tplId);
    if (!tpl) return;
    setAgentSteps(tpl.steps.map((s) => ({ ...s })));
    setAgentResults([]);
    setAgentSummary(null);
    setAgentLiveStep(null);
  };

  const runAgentWorkflow = async () => {
    if (!project || agentRunning || agentSteps.length === 0) return;
    setAgentRunning(true);
    setAgentResults([]);
    setAgentSummary(null);
    setAgentLiveStep(null);

    if (agentStreaming) {
      // SSE streaming version
      try {
        const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/agent/workflow/stream`), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ steps: agentSteps }),
        });
        if (!r.ok || !r.body) throw new Error(`stream failed (${r.status})`);
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const accumulated: typeof agentResults = [];
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const e of events) {
            if (!e.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(e.slice(6));
              if (evt.type === "step-start") {
                setAgentLiveStep(evt.index);
              } else if (evt.type === "step-done") {
                const step = agentSteps[evt.index];
                accumulated.push({
                  step: evt.index, type: step?.type || "unknown",
                  ok: !!evt.ok, output: evt.output, error: evt.error, savedAs: evt.savedAs,
                });
                setAgentResults([...accumulated]);
              } else if (evt.type === "complete") {
                setAgentSummary({
                  totalSteps: evt.totalSteps, successCount: evt.successCount, failureCount: evt.failureCount,
                });
                showToast(`Agent: ${evt.successCount}/${evt.totalSteps} steps ok`, evt.failureCount === 0 ? "success" : "error");
              }
            } catch { /* tolerate bad events */ }
          }
        }
        const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
        const listData = await listR.json();
        setFiles(listData.files || []);
      } catch (e: any) {
        showToast(e?.message || "Stream failed", "error");
      } finally {
        setAgentRunning(false);
        setAgentLiveStep(null);
      }
      return;
    }

    // Non-streaming fallback (whole response at end)
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/agent/workflow`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: agentSteps }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Workflow failed");
      setAgentResults(d.results || []);
      setAgentSummary({ totalSteps: d.totalSteps, successCount: d.successCount, failureCount: d.failureCount });
      const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
      const listData = await listR.json();
      setFiles(listData.files || []);
      showToast(`Agent: ${d.successCount}/${d.totalSteps} steps ok`, d.successCount === d.totalSteps ? "success" : "error");
    } catch (e: any) {
      showToast(e?.message || "Workflow failed", "error");
    } finally {
      setAgentRunning(false);
    }
  };

  // ── Brevo SMS ────────────────────────────────────────────────────────────────

  const sendSms = async () => {
    if (!smsRecipient.trim() || !smsContent.trim()) return;
    setSmsLoading(true);
    setSmsMsg(null);
    try {
      const r = await fetch(apiUrl("/api/devhub/media/sms"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: smsRecipient.trim(),
          content: smsContent,
          sender: smsSender.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setSmsMsg({ ok: false, text: d.error || "Send failed" });
      } else if (d.degraded) {
        setSmsMsg({ ok: true, degraded: true, text: `Brevo accepted the SMS, but didn't confirm a messageId — ${d.degradedReason || "delivery not confirmed"}` });
        setSmsRecipient(""); setSmsContent("");
      } else {
        setSmsMsg({ ok: true, text: `SMS sent (${d.smsCount} segment${d.smsCount === 1 ? "" : "s"}, ref ${d.reference})` });
        setSmsRecipient(""); setSmsContent("");
      }
    } catch (e: any) {
      setSmsMsg({ ok: false, text: e?.message || "Send failed" });
    } finally {
      setSmsLoading(false);
    }
  };

  // ── Brevo WhatsApp ───────────────────────────────────────────────────────────

  const sendWhatsApp = async () => {
    if (!waContact.trim() || !waTemplateId.trim()) return;
    setWaLoading(true);
    setWaMsg(null);
    try {
      let params: any = undefined;
      if (waParams.trim()) {
        try { params = JSON.parse(waParams); } catch {
          setWaMsg({ ok: false, text: "params must be valid JSON object" });
          setWaLoading(false);
          return;
        }
      }
      const r = await fetch(apiUrl("/api/devhub/media/whatsapp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactNumber: waContact.trim(),
          templateId: isNaN(Number(waTemplateId)) ? waTemplateId.trim() : Number(waTemplateId),
          params,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setWaMsg({ ok: false, text: d.error || "Send failed" });
      } else if (d.degraded) {
        setWaMsg({ ok: true, degraded: true, text: `Brevo accepted the WhatsApp message, but didn't confirm a messageId — ${d.degradedReason || "delivery not confirmed"}` });
        setWaContact(""); setWaTemplateId(""); setWaParams("");
      } else {
        setWaMsg({ ok: true, text: `WhatsApp sent (msg ${d.messageId})` });
        setWaContact(""); setWaTemplateId(""); setWaParams("");
      }
    } catch (e: any) {
      setWaMsg({ ok: false, text: e?.message || "Send failed" });
    } finally {
      setWaLoading(false);
    }
  };

  // ── DeepL translate ──────────────────────────────────────────────────────────

  const translateText = async () => {
    if (!trText.trim() || !trTarget.trim()) return;
    setTrLoading(true);
    setTrError(null);
    setTrResult(null);
    try {
      const r = await fetch(apiUrl("/api/devhub/media/translate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trText,
          targetLang: trTarget,
          ...(trSource.trim() ? { sourceLang: trSource.trim() } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setTrError(d.error || "Translation failed");
      } else {
        setTrResult({ text: d.text, detectedSource: d.detectedSource });
      }
    } catch (e: any) {
      setTrError(e?.message || "Translation failed");
    } finally {
      setTrLoading(false);
    }
  };

  const translateProjectFile = async () => {
    if (!project || !trFilePath.trim() || !trFileLang.trim()) return;
    setTrFileLoading(true);
    setTrFileMsg(null);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files/translate`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: trFilePath.trim(), targetLang: trFileLang.trim() }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setTrFileMsg({ ok: false, text: d.error || "Translation failed" });
      } else {
        setTrFileMsg({ ok: true, text: `Translated to ${d.path} (${d.bytes} bytes)` });
        // Reload file tree
        const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
        const listData = await listR.json();
        setFiles(listData.files || []);
      }
    } catch (e: any) {
      setTrFileMsg({ ok: false, text: e?.message || "Translation failed" });
    } finally {
      setTrFileLoading(false);
    }
  };

  // ── Brevo email templates ────────────────────────────────────────────────────

  const loadEmailTemplates = useCallback(async () => {
    setEmailTemplatesLoading(true);
    setEmailTemplatesError(null);
    try {
      const r = await fetch(apiUrl("/api/devhub/media/email-templates?limit=50"), { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setEmailTemplatesError(d.error || "Failed to load templates");
        setEmailTemplates([]);
      } else {
        setEmailTemplates(d.templates || []);
      }
    } catch (e: any) {
      setEmailTemplatesError(e?.message || "Failed to load templates");
    } finally {
      setEmailTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "media" && mediaTab === "templates" && emailTemplates.length === 0 && !emailTemplatesError) {
      loadEmailTemplates();
    }
  }, [activeTab, mediaTab, emailTemplates.length, emailTemplatesError, loadEmailTemplates]);

  const sendByTemplate = async (templateId: number) => {
    if (!tplSendTo.trim()) {
      setTplSendMsg({ ok: false, text: "Recipient email required" });
      return;
    }
    setTplSendingId(templateId);
    setTplSendMsg(null);
    try {
      let params: any = undefined;
      if (tplSendParams.trim()) {
        try { params = JSON.parse(tplSendParams); } catch {
          setTplSendMsg({ ok: false, text: "params must be valid JSON" });
          setTplSendingId(null);
          return;
        }
      }
      const r = await fetch(apiUrl("/api/devhub/media/email-template-send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, to: tplSendTo.trim(), params }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setTplSendMsg({ ok: false, text: d.error || "Send failed" });
      } else {
        setTplSendMsg({ ok: true, text: `Sent template #${templateId} (msg ${d.messageId})` });
      }
    } catch (e: any) {
      setTplSendMsg({ ok: false, text: e?.message || "Send failed" });
    } finally {
      setTplSendingId(null);
    }
  };

  // ── DeepL bulk translate ─────────────────────────────────────────────────────

  const runBulkTranslate = async () => {
    if (!project) return;
    if (bulkPaths.length === 0) {
      showToast("Select at least one file", "error");
      return;
    }
    if (bulkLangs.length === 0) {
      showToast("Select at least one target language", "error");
      return;
    }
    if (bulkPaths.length * bulkLangs.length > 50) {
      showToast("Max 50 translations per batch (files × langs)", "error");
      return;
    }
    setBulkLoading(true);
    setBulkResults([]);
    setBulkSummary(null);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files/translate-bulk`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: bulkPaths, targetLangs: bulkLangs }),
      });
      const d = await r.json();
      if (!r.ok) {
        showToast(d.error || "Bulk translate failed", "error");
        return;
      }
      setBulkResults(d.results || []);
      setBulkSummary({ total: d.total, successCount: d.successCount, failureCount: d.failureCount });
      if (d.successCount > 0) {
        showToast(`Translated ${d.successCount} / ${d.total}`, "success");
        await fetchProject();
      } else {
        showToast(`All ${d.total} translations failed`, "error");
      }
    } catch (e: any) {
      showToast(e?.message || "Bulk translate failed", "error");
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleBulkPath = (path: string) => {
    setBulkPaths((prev) => prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]);
  };
  const applyBulkLangPreset = (codes: string[]) => {
    setBulkLangs(codes);
    try { localStorage.setItem("devhub-bulk-lang-preset", JSON.stringify(codes)); } catch { /* ignore */ }
  };
  const toggleBulkLang = (lang: string) => {
    setBulkLangs((prev) => {
      const next = prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang];
      try { localStorage.setItem("devhub-bulk-lang-preset", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // ── Brevo template builder (create new SMTP template) ────────────────────────

  const createEmailTemplate = async () => {
    if (!tplBuilderName.trim() || !tplBuilderSubject.trim() || !tplBuilderHtml.trim()) {
      setTplBuilderMsg({ ok: false, text: "Name, subject and HTML body are all required" });
      return;
    }
    setTplBuilderLoading(true);
    setTplBuilderMsg(null);
    try {
      const body: Record<string, unknown> = {
        name: tplBuilderName.trim(),
        subject: tplBuilderSubject.trim(),
        htmlContent: tplBuilderHtml,
      };
      if (tplBuilderSender.trim()) body.senderEmail = tplBuilderSender.trim();
      const r = await fetch(apiUrl("/api/devhub/media/email-template-create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setTplBuilderMsg({ ok: false, text: d.error || "Template create failed" });
        return;
      }
      setTplBuilderMsg({ ok: true, text: `Created template #${d.id} — "${d.name}"` });
      // Refresh templates list if user already opened it
      if (emailTemplates.length > 0) await loadEmailTemplates();
    } catch (e: any) {
      setTplBuilderMsg({ ok: false, text: e?.message || "Template create failed" });
    } finally {
      setTplBuilderLoading(false);
    }
  };

  // ── ZIP import (symmetric to /export) ────────────────────────────────────────

  const importZipFile = async (file: File) => {
    if (!project) return;
    if (file.size > 50 * 1024 * 1024) {
      setZipResult({ ok: false, text: "ZIP too large (max 50 MB)" });
      return;
    }
    setZipImporting(true);
    setZipResult(null);
    try {
      const buf = await file.arrayBuffer();
      // Convert to base64 without blowing the stack on large files
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
      }
      const base64Zip = btoa(binary);
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/import-zip`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Zip, overwrite: zipOverwrite }),
      });
      const d = await r.json();
      if (!r.ok) {
        setZipResult({ ok: false, text: d.error || "Import failed" });
        return;
      }
      setZipResult({
        ok: true,
        text: `Imported ${d.importedCount} file(s), skipped ${d.skippedCount}`,
      });
      showToast(`Imported ${d.importedCount} file(s) from ${file.name}`, "success");
      await fetchProject();
    } catch (e: any) {
      setZipResult({ ok: false, text: e?.message || "Import failed" });
    } finally {
      setZipImporting(false);
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  };

  const onZipInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) importZipFile(f);
  };

  const [fileTreeDragOver, setFileTreeDragOver] = useState(false);
  const fileTreeDragDepth = useRef(0);

  const isZipFile = (f: File) => {
    if (!f) return false;
    const t = (f.type || "").toLowerCase();
    if (t === "application/zip" || t === "application/x-zip-compressed") return true;
    return /\.zip$/i.test(f.name);
  };

  const onFileTreeDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    fileTreeDragDepth.current += 1;
    setFileTreeDragOver(true);
  };
  const onFileTreeDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onFileTreeDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    fileTreeDragDepth.current = Math.max(0, fileTreeDragDepth.current - 1);
    if (fileTreeDragDepth.current === 0) setFileTreeDragOver(false);
  };
  const onFileTreeDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    fileTreeDragDepth.current = 0;
    setFileTreeDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!isZipFile(f)) {
      setZipResult({ ok: false, text: `"${f.name}" is not a .zip` });
      return;
    }
    importZipFile(f);
  };

  // ── TTS Voice preview ────────────────────────────────────────────────────────

  const previewVoice = async (voice: string) => {
    if (previewingVoice) return;
    setPreviewingVoice(voice);
    try {
      const r = await fetch(apiUrl("/api/devhub/media/tts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello! This is what I sound like.", voice }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || `Preview error ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e: any) {
      showToast(e?.message || "Preview failed", "error");
    } finally {
      setTimeout(() => setPreviewingVoice(null), 2500);
    }
  };

  // ── Cloudflare Images upload (call from DALL-E result) ───────────────────────

  const uploadImageToCloudflare = async (sourceUrl: string) => {
    setCfImgUploading(true);
    setCfImgPermanentUrl(null);
    try {
      const r = await fetch(apiUrl("/api/devhub/media/upload-image"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        showToast(d.error || "Cloudflare upload failed", "error");
      } else {
        setCfImgPermanentUrl(d.url);
        showToast("Image uploaded to permanent CDN", "success");
      }
    } catch (e: any) {
      showToast(e?.message || "Upload failed", "error");
    } finally {
      setCfImgUploading(false);
    }
  };

  const addAgentStep = (type: AgentStep["type"]) => {
    setAgentSteps((s) => [...s, type === "code" ? { type, prompt: "", stack: project?.stack || "next" }
      : type === "image" ? { type, prompt: "" }
      : type === "tts" ? { type, text: "", voice: "Rachel" }
      : type === "music" ? { type, prompt: "", lengthSeconds: 30 }
      : { type, text: "", durationSeconds: 3 }]);
  };

  const updateAgentStep = (i: number, patch: Partial<AgentStep>) => {
    setAgentSteps((s) => s.map((st, idx) => idx === i ? { ...st, ...patch } : st));
  };

  const removeAgentStep = (i: number) => {
    setAgentSteps((s) => s.filter((_, idx) => idx !== i));
  };

  // ── Voice clone (file upload) ────────────────────────────────────────────────

  const fileToBase64 = async (file: File): Promise<string> => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
    }
    return btoa(binary);
  };

  const previewClonedVoice = async () => {
    if (!voiceCloneFile) {
      setVoiceCloneMsg({ ok: false, text: "Pick an audio sample first" });
      return;
    }
    setVoicePreviewLoading(true);
    setVoiceCloneMsg(null);
    setVoicePreviewOk(false);
    if (voicePreviewUrl) { URL.revokeObjectURL(voicePreviewUrl); setVoicePreviewUrl(null); }
    try {
      const base64 = await fileToBase64(voiceCloneFile);
      const r = await fetch(apiUrl("/api/devhub/media/voice-clone/preview"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sampleBase64: base64,
          mimeType: voiceCloneFile.type || "audio/mpeg",
          previewText: voicePreviewText.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setVoiceCloneMsg({ ok: false, text: d.error || "Preview failed" });
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setVoicePreviewUrl(url);
      setVoicePreviewOk(true);
      setVoiceCloneMsg({ ok: true, text: "Preview ready — listen below, then Save if you like it" });
    } catch (e: any) {
      setVoiceCloneMsg({ ok: false, text: e?.message || "Preview failed" });
    } finally {
      setVoicePreviewLoading(false);
    }
  };

  const cloneVoice = async () => {
    if (!voiceCloneName.trim() || !voiceCloneFile) return;
    if (!voicePreviewOk) {
      setVoiceCloneMsg({ ok: false, text: "Preview first — click 🎧 Preview, listen, then Save" });
      return;
    }
    setVoiceCloneLoading(true);
    setVoiceCloneMsg(null);
    try {
      const base64 = await fileToBase64(voiceCloneFile);
      const r = await fetch(apiUrl("/api/devhub/media/voice-clone"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: voiceCloneName.trim(),
          description: voiceCloneDesc.trim() || undefined,
          sampleBase64: base64,
          mimeType: voiceCloneFile.type || "audio/mpeg",
          confirm: true,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setVoiceCloneMsg({ ok: false, text: d.error || "Clone failed" });
      } else {
        setVoiceCloneMsg({ ok: true, text: `Voice cloned: ${d.voiceId}${d.requiresVerification ? " (verification required)" : ""}` });
        setVoiceCloneName(""); setVoiceCloneDesc(""); setVoiceCloneFile(null);
        setVoicePreviewOk(false);
        if (voicePreviewUrl) { URL.revokeObjectURL(voicePreviewUrl); setVoicePreviewUrl(null); }
      }
    } catch (e: any) {
      setVoiceCloneMsg({ ok: false, text: e?.message || "Clone failed" });
    } finally {
      setVoiceCloneLoading(false);
    }
  };

  // ── STT ──────────────────────────────────────────────────────────────────────

  const transcribeAudio = async () => {
    if (!sttFile) return;
    setSttLoading(true);
    setSttError(null);
    setSttResult(null);
    try {
      const buf = await sttFile.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const r = await fetch(apiUrl("/api/devhub/media/stt"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType: sttFile.type || "audio/mpeg",
          language: sttLanguage.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setSttError(d.error || "STT failed");
      } else {
        setSttResult({ text: d.text, language: d.language, confidence: d.confidence });
      }
    } catch (e: any) {
      setSttError(e?.message || "STT failed");
    } finally {
      setSttLoading(false);
    }
  };

  // ── Google Drive ─────────────────────────────────────────────────────────────

  const searchDrive = async () => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const r = await fetch(apiUrl("/api/devhub/media/drive-search"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: driveQuery.trim(), limit: 20 }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setDriveError(d.error || "Drive search failed");
        setDriveFiles([]);
      } else {
        setDriveFiles(d.files || []);
      }
    } catch (e: any) {
      setDriveError(e?.message || "Drive search failed");
    } finally {
      setDriveLoading(false);
    }
  };

  const importDriveFile = async (fileId: string, name: string) => {
    if (!project) return;
    setDriveImporting(fileId);
    try {
      const r = await fetch(apiUrl(`/api/devhub/projects/${project.id}/drive/import`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        showToast(d.error || "Import failed", "error");
      } else {
        showToast(`Imported ${d.path} (${d.bytes} bytes)`, "success");
        const listR = await fetch(apiUrl(`/api/devhub/projects/${project.id}/files`), { cache: "no-store" });
        const listData = await listR.json();
        setFiles(listData.files || []);
      }
    } catch (e: any) {
      showToast(e?.message || "Import failed", "error");
    } finally {
      setDriveImporting(null);
    }
  };

  // ── ElevenLabs TTS helper ────────────────────────────────────────────────────

  const generateTts = async () => {
    if (!mediaTtsText.trim()) return;
    if (isCapabilityBlocked(caps, "audio_tts")) {
      setMediaTtsError(capabilityHint(caps, "audio_tts", "Voice (TTS)"));
      return;
    }
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
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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
          {saveError && (
            <span
              title={saveError}
              style={{ fontSize: 12, fontWeight: 700, color: "#991b1b", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 6, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 8, maxWidth: 480 }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>⚠ {saveError}</span>
              {/* The text only exists in this browser tab now. Telling someone
                  their work is unsaved without a way to keep it just makes the
                  loss visible — this gets it onto their disk in one click. */}
              <button
                onClick={downloadEditorBuffer}
                title="Скачать то, что сейчас в редакторе — до того, как вкладка закроется"
                style={{ background: "#991b1b", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, padding: "3px 8px", cursor: "pointer", flexShrink: 0 }}
              >
                ⬇ Скачать копию
              </button>
            </span>
          )}
          {project.deployUrl && (
            <a href={fixDoubledScheme(project.deployUrl)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#0d9488", textDecoration: "none", fontWeight: 600 }}>
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
            title={capabilityHint(caps, "railway", "Deploy to Railway")}
            style={{
              padding: "8px 18px", background: deploying ? "#99f6e4" : "#0d9488",
              color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
              cursor: deploying ? "not-allowed" : "pointer",
              opacity: isCapabilityBlocked(caps, "railway") ? 0.45 : 1,
            }}
          >
            {deploying ? "Deploying..." : "Deploy"}
          </button>
          <button
            onClick={deployToVercel}
            disabled={vercelDeploying}
            title={capabilityHint(caps, "vercel", "Deploy to Vercel")}
            style={{
              padding: "8px 14px", background: vercelDeploying ? "#e2e8f0" : "#000",
              color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
              cursor: vercelDeploying ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
              // Dimmed, not disabled: clicking still explains what is missing.
              opacity: isCapabilityBlocked(caps, "vercel") ? 0.45 : 1,
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
        <div
          onDragEnter={onFileTreeDragEnter}
          onDragOver={onFileTreeDragOver}
          onDragLeave={onFileTreeDragLeave}
          onDrop={onFileTreeDrop}
          style={{ width: 260, background: "#fff", borderRight: "1px solid rgba(15,23,42,0.1)", display: "flex", flexDirection: "column", flexShrink: 0, position: "relative" }}>
          {fileTreeDragOver && (
            <div style={{
              position: "absolute", inset: 6, zIndex: 5, pointerEvents: "none",
              border: "2px dashed #0d9488", borderRadius: 10,
              background: "rgba(13,148,136,0.08)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 6, color: "#0d9488", fontWeight: 700, fontSize: 13, textAlign: "center", padding: 14,
            }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>📦</span>
              <span>Drop ZIP to import</span>
              <span style={{ fontSize: 10, color: "#475569", fontWeight: 500 }}>
                {zipOverwrite ? "Overwrites existing files" : "Skips existing files"}
              </span>
            </div>
          )}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Files</span>
            <div style={{ display: "flex", gap: 4 }}>
              <input ref={zipInputRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" style={{ display: "none" }} onChange={onZipInputChange} />
              <button
                onClick={() => zipInputRef.current?.click()}
                disabled={zipImporting || !project}
                style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, height: 24, padding: "0 6px", cursor: zipImporting ? "wait" : "pointer", color: "#64748b", fontSize: 11, fontWeight: 700 }}
                title="Import ZIP (symmetric to export)"
              >{zipImporting ? "..." : "📦"}</button>
              <button
                onClick={() => { if (project) window.open(apiUrl(`/api/devhub/projects/${project.id}/export`), "_blank"); }}
                disabled={!project || files.length === 0}
                style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, height: 24, padding: "0 6px", cursor: "pointer", color: "#64748b", fontSize: 11, fontWeight: 700 }}
                title="Download the whole project as a ZIP — the code is yours"
              >⬇</button>
              <button
                onClick={() => setShowNewFile(true)}
                style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, width: 24, height: 24, cursor: "pointer", color: "#64748b", fontWeight: 700, fontSize: 16, lineHeight: 1 }}
                title="New file"
              >+</button>
            </div>
          </div>
          {zipResult && (
            <div style={{
              padding: "6px 12px", fontSize: 11, lineHeight: 1.4,
              background: zipResult.ok ? "#d1fae5" : "#fee2e2",
              color: zipResult.ok ? "#065f46" : "#991b1b",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6,
            }}>
              <span>{zipResult.text}</span>
              <button onClick={() => setZipResult(null)}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700, fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          )}
          <label style={{ padding: "4px 14px 6px", fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={zipOverwrite} onChange={(e) => setZipOverwrite(e.target.checked)} style={{ width: 11, height: 11 }} />
            ZIP overwrite existing
          </label>

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
            {activeTab === "visual" ? (
              project?.stack !== "static" ? (
                isClientPreviewStack(project?.stack) && reactPreviewSrcdoc ? (
                  <iframe
                    ref={visualEditIframeRef}
                    srcDoc={reactPreviewSrcdoc}
                    sandbox="allow-scripts"
                    style={{ flex: 1, width: "100%", border: "none", background: "#fff" }}
                    title="Visual Edit preview"
                  />
                ) : isClientPreviewStack(project?.stack) && (!reactPreviewError || !project?.deployUrl) ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#1e293b", color: "#94a3b8", textAlign: "center", padding: 24 }}>
                    <div style={{ maxWidth: 460 }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>⚛️</div>
                      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                        {reactPreviewError ?? "Building the live preview…"}
                      </div>
                    </div>
                  </div>
                ) : project?.deployUrl ? (
                  // Deployed non-static stacks render through the backend
                  // preview proxy, which injects the same overlay contract.
                  <iframe
                    ref={visualEditIframeRef}
                    src={apiUrl(`/api/devhub/projects/${project.id}/preview-proxy`)}
                    sandbox="allow-scripts"
                    style={{ flex: 1, width: "100%", border: "none", background: "#fff" }}
                    title="Visual Edit preview"
                  />
                ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#1e293b", color: "#94a3b8", textAlign: "center", padding: 24 }}>
                  <div style={{ maxWidth: 420 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🖱️</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#e2e8f0" }}>Deploy this project to use Visual Edit</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                      This project uses <b>{project?.stack}</b>, which needs a built page to render. Deploy it once —
                      the deployed page then loads here and you can click elements and describe changes for AI to apply
                      to the source.
                    </div>
                  </div>
                </div>
                )
              ) : !visualEditSrcdoc ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#1e293b", color: "#94a3b8" }}>
                  <div style={{ fontSize: 15 }}>No index.html found — create one to use Visual Edit.</div>
                </div>
              ) : (
                <iframe
                  ref={visualEditIframeRef}
                  srcDoc={visualEditSrcdoc}
                  sandbox="allow-scripts"
                  style={{ flex: 1, width: "100%", border: "none", background: "#fff" }}
                  title="Visual Edit preview"
                />
              )
            ) : selectedFile ? (
              <>
                <div style={{ padding: "8px 16px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{selectedFile.path}</span>
                  <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, background: (LANG_COLORS[selectedFile.language] ?? "#94a3b8") + "20", color: LANG_COLORS[selectedFile.language] ?? "#94a3b8", fontWeight: 600 }}>
                    {selectedFile.language}
                  </span>
                </div>
                {/* Monaco Editor (VS Code engine) */}
                <div style={{ flex: 1, overflow: "hidden" }}>
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
              {(["chat", "visual", "agent", "templates", "github", "media", "env", "deployments", "settings"] as const).map((tab) => (
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
                  {tab === "chat" ? "AI Generate"
                  : tab === "visual" ? "🖱️ Visual Edit"
                  : tab === "env" ? "Env Vars"
                  : tab === "github" ? "GitHub"
                  : tab === "media" ? "Media"
                  : tab === "agent" ? "🤖 Agent"
                  : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
              {/* AI Chat Tab */}
              {activeTab === "chat" && (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 12 }}>
                  {chatHistory.length > 0 && (
                    <div ref={chatLogRef} style={{ flex: "0 1 auto", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, maxHeight: "45%", paddingRight: 4 }}>
                      {chatHistory.map((msg, mi) =>
                        msg.role === "user" ? (
                          <div key={mi} style={{ alignSelf: "flex-end", maxWidth: "85%", background: "#0d9488", color: "#fff", borderRadius: "12px 12px 2px 12px", padding: "8px 12px", fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                            {msg.text}
                          </div>
                        ) : msg.role === "hint" ? (
                          msg.kind === "provision_db" ? (
                            <div key={mi} style={{ alignSelf: "flex-start", maxWidth: "95%", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
                              <div style={{ color: "#3730a3", marginBottom: 8, lineHeight: 1.45 }}>
                                🗃 Schema is on disk — create the real database now? You get your own Postgres schema, a login role only you can use, the tables from <span style={{ fontFamily: "monospace" }}>db/schema.sql</span>, and <span style={{ fontFamily: "monospace" }}>DATABASE_URL</span> in Env Vars.
                              </div>
                              <button
                                onClick={provisionDatabase}
                                disabled={provisioningDb}
                                title={capabilityHint(caps, "database", "Create the database")}
                                style={{ padding: "7px 14px", background: provisioningDb ? "#a5b4fc" : "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: provisioningDb ? "not-allowed" : "pointer", opacity: isCapabilityBlocked(caps, "database") ? 0.45 : 1 }}
                              >
                                {provisioningDb ? "Создаю базу…" : "Создать базу данных"}
                              </button>
                            </div>
                          ) : msg.kind === "manifest" ? (
                            <div key={mi} style={{ alignSelf: "flex-start", maxWidth: "95%", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
                              <div style={{ color: "#92400e", marginBottom: 8, lineHeight: 1.45 }}>
                                📦 This project has no <span style={{ fontFamily: "monospace" }}>package.json</span> — the live preview works, but an export can&apos;t be installed or run. Generate one from what the code actually imports?
                              </div>
                              <button
                                onClick={() => {
                                  setChatHistory((h) => h.filter((m) => !(m.role === "hint" && m.kind === "manifest")));
                                  // Fills the prompt rather than firing: same
                                  // "you see it before it runs" rule as plan milestones.
                                  setAiPrompt("Add a package.json listing the exact dependencies these files import, with scripts to run the app, plus the entry HTML if it is missing.");
                                }}
                                style={{ padding: "7px 14px", background: "#d97706", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                              >
                                Собрать package.json
                              </button>
                            </div>
                          ) : msg.kind === "deploy" ? (
                            <div key={mi} style={{ alignSelf: "flex-start", maxWidth: "95%", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
                              <div style={{ color: "#0f766e", marginBottom: 8, lineHeight: 1.45 }}>
                                🚀 Ready to go live? One click deploys this to Cloudflare with your own <span style={{ fontFamily: "monospace" }}>*.aevion.build</span> URL — marked live only after the page actually serves.
                              </div>
                              <button
                                onClick={() => { setChatHistory((h) => h.filter((m) => !(m.role === "hint" && m.kind === "deploy"))); deployToPages(); setActiveTab("deployments"); }}
                                style={{ padding: "7px 14px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                              >
                                Задеплоить
                              </button>
                            </div>
                          ) : (
                          <div key={mi} style={{ alignSelf: "flex-start", maxWidth: "95%", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
                            <div style={{ color: "#4c1d95", marginBottom: 8, lineHeight: 1.45 }}>
                              🗄 Looks like this app stores data. Want a database designed for it — schema + typed client, wired to DATABASE_URL?
                            </div>
                            <button
                              onClick={() => designDbFromHint(msg.description)}
                              disabled={designingDb}
                              style={{ padding: "7px 14px", background: designingDb ? "#c4b5fd" : "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: designingDb ? "not-allowed" : "pointer" }}
                            >
                              {designingDb ? "Designing…" : "Спроектировать базу данных"}
                            </button>
                          </div>
                          )
                        ) : (
                          <div key={mi} style={{ alignSelf: "flex-start", maxWidth: "95%", width: "95%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px 12px 12px 2px", padding: "10px 12px", fontSize: 13 }}>
                            {msg.files.length === 0 ? (
                              <div style={{ color: "#991b1b" }}>{msg.note || "No changes"}</div>
                            ) : (
                              <>
                                {msg.note && <div style={{ color: "#92400e", fontSize: 12, marginBottom: 6 }}>⚠ {msg.note}</div>}
                                {msg.files.map((fc) => (
                                  <div key={fc.path} style={{ marginBottom: 6 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                      <button
                                        onClick={() => { const f = files.find((ff) => ff.path === fc.path); if (f) loadFile(f); }}
                                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: "#0d9488" }}
                                      >
                                        {fc.path}
                                      </button>
                                      {fc.isNew && <span style={{ fontSize: 10, fontWeight: 800, color: "#065f46", background: "#d1fae5", borderRadius: 4, padding: "1px 6px" }}>NEW</span>}
                                      <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>+{fc.added}</span>
                                      <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>−{fc.removed}</span>
                                    </div>
                                    {fc.diff && (
                                      <details style={{ marginTop: 3 }}>
                                        <summary style={{ fontSize: 11, color: "#64748b", cursor: "pointer" }}>diff</summary>
                                        <pre style={{ margin: "4px 0 0", padding: 8, background: "#0f172a", borderRadius: 6, fontSize: 11, lineHeight: 1.45, overflowX: "auto", maxHeight: 220 }}>
                                          {fc.diff.split("\n").map((ln, li) => (
                                            <div key={li} style={{ color: ln.startsWith("+") ? "#4ade80" : ln.startsWith("-") ? "#f87171" : "#64748b" }}>{ln}</div>
                                          ))}
                                        </pre>
                                      </details>
                                    )}
                                  </div>
                                ))}
                                {msg.checkpointId && (
                                  <button
                                    onClick={() => restoreToCheckpoint(msg.checkpointId!)}
                                    disabled={restoringId !== null}
                                    style={{ marginTop: 4, padding: "4px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#475569", cursor: "pointer" }}
                                  >
                                    ↩ Revert to before this
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
                  {/* Idea planner — plan_project */}
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px" }}>
                    <button
                      onClick={() => setShowPlanner((s) => !s)}
                      style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#0f172a", padding: 0 }}
                    >
                      {showPlanner ? "▾" : "▸"} Have a rough idea? Plan it first
                    </button>
                    {showPlanner && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        <textarea
                          value={planIdea}
                          onChange={(e) => setPlanIdea(e.target.value)}
                          placeholder={`Describe the idea in your own words...\nExample: "a marketplace where local bakers can sell to neighbors"`}
                          style={{
                            width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8,
                            fontSize: 13, resize: "none", fontFamily: "inherit", boxSizing: "border-box", height: 60,
                          }}
                        />
                        <button
                          onClick={planProject}
                          disabled={planning || !planIdea.trim()}
                          style={{
                            width: "100%", padding: "8px 0", background: planning ? "#e2e8f0" : "#0f172a",
                            color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                            cursor: planning ? "not-allowed" : "pointer",
                          }}
                        >
                          {planning ? "Planning..." : "Plan my idea"}
                        </button>
                        {plan && (
                          <div style={{ background: "#f8fafc", borderRadius: 8, padding: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{plan.summary}</div>
                            {plan.targetUsers && (
                              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>👥 {plan.targetUsers}</div>
                            )}
                            {plan.mvpFeatures.length > 0 && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#0d9488", marginTop: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>MVP first</div>
                                <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12, color: "#334155" }}>
                                  {plan.mvpFeatures.map((f) => <li key={f}>{f}</li>)}
                                </ul>
                              </>
                            )}
                            {plan.laterFeatures.length > 0 && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginTop: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>Later — deferred on purpose</div>
                                <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12, color: "#94a3b8" }}>
                                  {plan.laterFeatures.map((f) => <li key={f}>{f}</li>)}
                                </ul>
                              </>
                            )}
                            {plan.milestones.length > 0 && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginTop: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>Build order</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                                  {plan.milestones.map((m, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                      <span style={{ fontSize: 12, color: "#334155" }}>{i + 1}. {m.title}</span>
                                      <button
                                        onClick={() => { setAiPrompt(m.prompt); setShowPlanner(false); }}
                                        style={{ padding: "3px 10px", background: "#fff", border: "1px solid #0d9488", color: "#0d9488", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer", flexShrink: 0 }}
                                      >
                                        Use prompt
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      ref={aiImageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 5 * 1024 * 1024) { showToast("Image too large (max 5MB)", "error"); return; }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const url = String(reader.result || "");
                          const b64 = url.split(",")[1] || "";
                          setAiImage({ dataBase64: b64, mediaType: f.type || "image/png", name: f.name });
                        };
                        reader.readAsDataURL(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={() => aiImageInputRef.current?.click()}
                      title="Attach a screenshot or design — AI will recreate it as code"
                      style={{ padding: "6px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, cursor: "pointer", color: "#475569", fontWeight: 600 }}
                    >
                      📎 Screenshot
                    </button>
                    {aiImage && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, fontSize: 12, color: "#0f766e" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`data:${aiImage.mediaType};base64,${aiImage.dataBase64}`} alt="" style={{ width: 26, height: 26, objectFit: "cover", borderRadius: 4 }} />
                        {aiImage.name.slice(0, 22)}
                        <button onClick={() => setAiImage(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#0f766e", fontWeight: 800, padding: 0 }}>×</button>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => generateCode()}
                    disabled={generating || !aiPrompt.trim()}
                    style={{
                      width: "100%", padding: "10px 0", background: generating ? "#99f6e4" : "#0d9488",
                      color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14,
                      cursor: generating ? "not-allowed" : "pointer",
                    }}
                  >
                    {generating ? "Generating..." : "Generate Code (Ctrl+Enter)"}
                  </button>
                  {generating && genStage && (
                    <div style={{ fontSize: 12, color: "#0f766e", textAlign: "center" }}>
                      {genStage === "calling_model" ? "⚙ Вызываю модель…"
                        : genStage === "continuation" ? "✍ Ответ обрезался — дописываю недостающие файлы…"
                        : genStage === "syntax_check" ? "🔍 Проверяю синтаксис…"
                        : genStage === "self_correcting" ? "🔧 Правлю синтаксические ошибки…"
                        : genStage === "saving" ? "💾 Сохраняю файлы…"
                        : genStage}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={undoLastGeneration}
                      disabled={undoing}
                      title="Reverts the files touched by the most recent AI generation"
                      style={{
                        flex: 1, padding: "8px 0", background: "#fff", border: "1px solid #e2e8f0",
                        color: "#64748b", borderRadius: 10, fontWeight: 600, fontSize: 12,
                        cursor: undoing ? "not-allowed" : "pointer",
                      }}
                    >
                      {undoing ? "Undoing..." : "↩ Undo last AI change"}
                    </button>
                    <button
                      onClick={() => { const next = !showHistory; setShowHistory(next); if (next) loadCheckpointHistory(); }}
                      title="See every past AI change and jump straight to one of them"
                      style={{
                        padding: "8px 12px", background: "#fff", border: "1px solid #e2e8f0",
                        color: "#64748b", borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: "pointer",
                      }}
                    >
                      {showHistory ? "▾" : "▸"} History
                    </button>
                  </div>
                  {showHistory && (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", maxHeight: 220, overflow: "auto" }}>
                      {loadingHistory ? (
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>Loading...</div>
                      ) : checkpointHistory.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>No AI changes yet for this project.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {checkpointHistory.map((cp, i) => (
                            <div key={cp.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "4px 0", borderBottom: i < checkpointHistory.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cp.label}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>{timeAgo(cp.createdAt)} · {cp.paths.length} file{cp.paths.length === 1 ? "" : "s"}</div>
                              </div>
                              <button
                                onClick={() => restoreToCheckpoint(cp.id)}
                                disabled={restoringId !== null}
                                style={{
                                  padding: "4px 10px", background: "#fff", border: "1px solid #0d9488", color: "#0d9488",
                                  borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: restoringId !== null ? "not-allowed" : "pointer", flexShrink: 0,
                                }}
                              >
                                {restoringId === cp.id ? "Restoring..." : i === 0 ? "Revert" : "Revert to here"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Visual Edit Tab */}
              {activeTab === "visual" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {project?.stack !== "static" && project?.stack !== "react" && !project?.deployUrl ? (
                    <div style={{ fontSize: 13, color: "#64748b" }}>
                      Deploy this project once to use Visual Edit — the deployed page renders above, and clicked
                      elements become context for AI edits to the source.
                    </div>
                  ) : !visualEditSelected ? (
                    <div style={{ fontSize: 13, color: "#64748b" }}>
                      Click any text element in the preview above to select and edit it in place.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: "#0f172a" }}>Selected:</span>
                        {[...(visualEditSelected.ancestors || [])].reverse().map((a) => (
                          <span key={a.vid} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <button
                              onClick={() => retargetVisualSelection(a.vid)}
                              title="Select this parent element"
                              style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline dotted" }}
                            >
                              {"<" + a.tagName.toLowerCase() + ">"}
                            </button>
                            <span style={{ color: "#cbd5e1" }}>›</span>
                          </span>
                        ))}
                        <span style={{ fontFamily: "monospace", color: "#0d9488", fontWeight: 700 }}>{"<" + visualEditSelected.tagName.toLowerCase() + ">"}</span>
                        {(visualEditSelected.children || []).length > 0 && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ color: "#cbd5e1" }}>›</span>
                            {(visualEditSelected.children || []).map((c) => (
                              <button
                                key={c.vid}
                                onClick={() => retargetVisualSelection(c.vid)}
                                title="Select this child element"
                                style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, padding: "1px 5px", cursor: "pointer" }}
                              >
                                {"<" + c.tagName.toLowerCase() + ">"}
                              </button>
                            ))}
                          </span>
                        )}
                      </div>
                      {project?.stack !== "static" ? (
                        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                          Proxied preview of the deployed page — direct text/style editing needs source mapping, so
                          describe the change below and AI will apply it to the right source file.
                        </div>
                      ) : visualEditSelected.tagName === "IMG" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {visualEditSelected.src ? (
                            <div style={{ fontSize: 12, color: "#64748b", wordBreak: "break-all" }}>
                              Current image: {visualEditSelected.src.startsWith("data:")
                                ? "embedded inline image"
                                : visualEditSelected.src.slice(0, 120) + (visualEditSelected.src.length > 120 ? "…" : "")}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "#64748b" }}>This image has no source yet.</div>
                          )}
                          <textarea
                            value={visualEditImgPrompt}
                            onChange={(e) => setVisualEditImgPrompt(e.target.value)}
                            placeholder='Describe the image to generate, e.g. "minimal teal rocket logo on white"'
                            style={{ width: "100%", minHeight: 60, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }}
                          />
                          <button
                            onClick={generateVisualImage}
                            disabled={visualEditImgBusy || !visualEditImgPrompt.trim()}
                            style={{
                              padding: "9px 0", background: visualEditImgBusy || !visualEditImgPrompt.trim() ? "#99f6e4" : "#0d9488",
                              color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                              cursor: visualEditImgBusy || !visualEditImgPrompt.trim() ? "not-allowed" : "pointer",
                            }}
                          >
                            {visualEditImgBusy ? "Generating..." : "🎨 Generate & replace image"}
                          </button>
                        </div>
                      ) : (
                      <textarea
                        value={visualEditText}
                        onChange={(e) => setVisualEditText(e.target.value)}
                        style={{ width: "100%", minHeight: 90, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }}
                      />
                      )}
                      {project?.stack === "static" && visualEditSelected.tagName !== "IMG" && visualEditStyleBase && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <input
                            type="color"
                            value={cssColorToHex(visualEditStyleEdits.color ?? visualEditStyleBase.color)}
                            onChange={(e) => setVisualStyle("color", e.target.value)}
                            title="Text color"
                            style={{ width: 34, height: 30, padding: 2, border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", background: "#fff" }}
                          />
                          <input
                            type="number"
                            min={8}
                            max={120}
                            value={parseInt(visualEditStyleEdits.fontSize ?? visualEditStyleBase.fontSize, 10) || 16}
                            onChange={(e) => setVisualStyle("fontSize", `${e.target.value}px`)}
                            title="Font size (px)"
                            style={{ width: 62, height: 30, padding: "0 6px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
                          />
                          <button
                            onClick={() => setVisualStyle("fontWeight", parseInt(visualEditStyleEdits.fontWeight ?? visualEditStyleBase.fontWeight, 10) >= 600 ? "400" : "700")}
                            title="Bold"
                            style={{
                              width: 30, height: 30, border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 14, cursor: "pointer",
                              fontWeight: 800,
                              background: parseInt(visualEditStyleEdits.fontWeight ?? visualEditStyleBase.fontWeight, 10) >= 600 ? "#ccfbf1" : "#fff",
                              color: "#0f172a",
                            }}
                          >
                            B
                          </button>
                          {(["left", "center", "right"] as const).map((align) => (
                            <button
                              key={align}
                              onClick={() => setVisualStyle("textAlign", align)}
                              title={`Align ${align}`}
                              style={{
                                width: 30, height: 30, border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, cursor: "pointer",
                                background: (visualEditStyleEdits.textAlign ?? visualEditStyleBase.textAlign) === align ? "#ccfbf1" : "#fff",
                                color: "#0f172a",
                              }}
                            >
                              {align === "left" ? "⇤" : align === "center" ? "☰" : "⇥"}
                            </button>
                          ))}
                        </div>
                      )}
                      {project?.stack === "static" && visualEditSelected.tagName !== "IMG" && (
                      <button
                        onClick={saveVisualEdit}
                        disabled={visualEditSaving}
                        style={{
                          padding: "9px 0", background: visualEditSaving ? "#99f6e4" : "#0d9488",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: visualEditSaving ? "not-allowed" : "pointer",
                        }}
                      >
                        {visualEditSaving ? "Saving..." : "Save"}
                      </button>
                      )}
                      <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>✨ Describe a change for this element</div>
                        <textarea
                          value={visualEditAiPrompt}
                          onChange={(e) => setVisualEditAiPrompt(e.target.value)}
                          placeholder='e.g. "make this a teal gradient button that links to /pricing"'
                          style={{ width: "100%", minHeight: 60, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }}
                        />
                        <button
                          onClick={aiEditVisual}
                          disabled={visualEditAiBusy || !visualEditAiPrompt.trim()}
                          style={{
                            padding: "9px 0", background: visualEditAiBusy || !visualEditAiPrompt.trim() ? "#c7d2fe" : "#4f46e5",
                            color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                            cursor: visualEditAiBusy || !visualEditAiPrompt.trim() ? "not-allowed" : "pointer",
                          }}
                        >
                          {visualEditAiBusy ? "Applying AI edit..." : "AI Edit"}
                        </button>
                      </div>
                    </>
                  )}
                  {(project?.stack === "static" || project?.stack === "react" || !!project?.deployUrl) && (
                    <button
                      onClick={undoLastGeneration}
                      disabled={undoing}
                      title="Revert the most recent AI change (same undo as the AI Generate tab)"
                      style={{
                        padding: "7px 0", background: "#fff", color: undoing ? "#94a3b8" : "#475569",
                        border: "1px solid #e2e8f0", borderRadius: 8, fontWeight: 600, fontSize: 12,
                        cursor: undoing ? "not-allowed" : "pointer",
                      }}
                    >
                      {undoing ? "Undoing..." : "↩ Undo last AI change"}
                    </button>
                  )}
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
                  {envLoadError && (
                    <div style={{ background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", borderRadius: 7, padding: "8px 12px", fontSize: 12.5, marginBottom: 8 }}>
                      ⚠ Список переменных не загрузился ({envLoadError}) — пусто здесь значит «неизвестно», а не «переменных нет».
                    </div>
                  )}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* Cloudflare Pages — primary deploy */}
                  <div style={{ padding: "16px", border: "2px solid #f97316", borderRadius: 12, background: "#fff7ed" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 18 }}>☁️</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#9a3412" }}>Cloudflare Pages</div>
                        <div style={{ fontSize: 11, color: "#c2410c" }}>Free · Auto-SSL · Global CDN · aevion.build domain included</div>
                      </div>
                    </div>

                    {/* Live URL display */}
                    {(pagesResult || project?.customDomain || project?.deployUrl?.includes("pages.dev")) && (
                      <div style={{ marginBottom: 10, padding: "8px 12px", background: "#d1fae5", borderRadius: 8 }}>
                        {project?.customDomain && (
                          <div style={{ marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: "#065f46", fontWeight: 700 }}>🌐 Domain: </span>
                            <a href={`https://${project.customDomain}`} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 12, color: "#065f46", fontWeight: 700, wordBreak: "break-all" }}>
                              https://{project.customDomain}
                            </a>
                          </div>
                        )}
                        {(pagesResult?.pagesUrl || project?.deployUrl?.includes("pages.dev")) && (
                          <div>
                            <span style={{ fontSize: 11, color: "#047857" }}>pages.dev: </span>
                            <a href={pagesResult?.pagesUrl ?? project?.deployUrl ?? ""} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 11, color: "#047857", wordBreak: "break-all" }}>
                              {pagesResult?.pagesUrl ?? project?.deployUrl}
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={deployToPages}
                      disabled={pagesDeploying}
                      style={{
                        width: "100%", padding: "10px", borderRadius: 8, border: "none",
                        background: pagesDeploying ? "#fed7aa" : "#f97316",
                        color: "#fff", fontWeight: 800, fontSize: 14,
                        cursor: pagesDeploying ? "not-allowed" : "pointer",
                      }}
                    >
                      {pagesDeploying ? "⏳ Deploying..." : project?.deployUrl?.includes("pages.dev") ? "🔄 Redeploy to Cloudflare Pages" : "🚀 Deploy to Cloudflare Pages + get aevion.build domain"}
                    </button>
                    <div style={{ fontSize: 10, color: "#9a3412", marginTop: 6 }}>
                      Requires <code style={{ background: "#fed7aa", padding: "1px 3px", borderRadius: 2 }}>CLOUDFLARE_ACCOUNT_ID</code> + <code style={{ background: "#fed7aa", padding: "1px 3px", borderRadius: 2 }}>CLOUDFLARE_API_TOKEN</code> in Railway.
                      Add <code style={{ background: "#fed7aa", padding: "1px 3px", borderRadius: 2 }}>CLOUDFLARE_ZONE_ID</code> for aevion.build domain.
                    </div>
                  </div>

                  {/* Vercel deploy — secondary */}
                  <div style={{ padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>▲ Vercel</div>
                      <span style={{ fontSize: 10, color: "#64748b" }}>Next.js / React</span>
                    </div>
                    {project?.deployUrl && !project.deployUrl.includes("pages.dev") && (
                      <a href={project.deployUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: "#0d9488", display: "block", marginBottom: 6, wordBreak: "break-all" }}>
                        {project.deployUrl}
                      </a>
                    )}
                    <button
                      onClick={deployToVercel}
                      disabled={vercelDeploying}
                      style={{
                        padding: "7px 16px", background: vercelDeploying ? "#e2e8f0" : "#0f172a",
                        color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 12,
                        cursor: vercelDeploying ? "not-allowed" : "pointer",
                      }}
                    >
                      {vercelDeploying ? "Deploying..." : "Deploy to Vercel"}
                    </button>
                  </div>

                  {/* Deploy history */}
                  {deploymentsLoadError && (
                    <div style={{ background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", borderRadius: 7, padding: "8px 12px", fontSize: 12.5, marginBottom: 8 }}>
                      ⚠ История деплоев не загрузилась ({deploymentsLoadError}) — пусто здесь значит «неизвестно», а не «деплоев не было».
                    </div>
                  )}
                  {deployments.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>HISTORY</div>
                      {deployments.map((d) => {
                        const dStatusStyle = d.status === "live" ? { bg: "#d1fae5", fg: "#065f46" } : d.status === "failed" ? { bg: "#fee2e2", fg: "#991b1b" } : { bg: "#fef3c7", fg: "#92400e" };
                        return (
                          <div key={d.id} style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ padding: "2px 7px", borderRadius: 5, background: dStatusStyle.bg, color: dStatusStyle.fg, fontSize: 11, fontWeight: 600 }}>{d.status}</span>
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(d.triggeredAt).toLocaleString()}</span>
                            </div>
                            {d.deployUrl && (
                              <a href={d.deployUrl} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 11, color: "#0d9488", display: "block", marginTop: 4, wordBreak: "break-all" }}>
                                {d.deployUrl}
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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

                  {project?.repoUrl && (
                    <button
                      onClick={syncFromGithub}
                      disabled={repoPulling}
                      title="Pull the repo's current default-branch files into this project (a checkpoint is taken first — undo restores the pre-sync state)"
                      style={{
                        padding: "9px 0", background: "#fff", border: "1px solid #0d9488", color: "#0d9488",
                        borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: repoPulling ? "not-allowed" : "pointer",
                      }}
                    >
                      {repoPulling ? "Pulling…" : "⟳ Pull from repo"}
                    </button>
                  )}

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
                    {(["video", "3d", "tts", "image", "sfx", "music", "clone", "stt", "drive", "translate", "bulk", "email", "templates", "builder", "sms", "whatsapp", "payment"] as const).map((sub) => (
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
                        {sub === "video" ? "Video AI"
                        : sub === "tts" ? "TTS"
                        : sub === "image" ? "DALL-E"
                        : sub === "sfx" ? "SFX"
                        : sub === "music" ? "Music"
                        : sub === "clone" ? "Clone"
                        : sub === "stt" ? "STT"
                        : sub === "drive" ? "Drive"
                        : sub === "translate" ? "DeepL"
                        : sub === "bulk" ? "Bulk i18n"
                        : sub === "email" ? "Email"
                        : sub === "templates" ? "Templates"
                        : sub === "builder" ? "Tpl Builder"
                        : sub === "sms" ? "SMS"
                        : sub === "whatsapp" ? "WhatsApp"
                        : "Pay"}
                      </button>
                    ))}
                  </div>

                  {/* Video AI (Replicate) */}
                  {mediaTab === "video" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>AI Model</label>
                        <select
                          value={videoModel}
                          onChange={(e) => setVideoModel(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13 }}
                        >
                          {(videoModels.length ? videoModels : [{ id: videoModel, label: videoModel, provider: "", audio: false, note: "" }]).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}{m.audio ? " · со звуком" : ""}
                            </option>
                          ))}
                        </select>
                        {videoModels.find((m) => m.id === videoModel)?.note && (
                          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4, lineHeight: 1.4 }}>
                            {videoModels.find((m) => m.id === videoModel)!.note}
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Prompt</label>
                        <textarea
                          value={videoPrompt}
                          onChange={(e) => setVideoPrompt(e.target.value)}
                          placeholder="A futuristic city skyline at sunset, cinematic, 4K..."
                          rows={3}
                          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Duration (sec)</label>
                          <select value={videoDuration} onChange={(e) => setVideoDuration(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13 }}>
                            <option value="3">3s</option>
                            <option value="5">5s</option>
                            <option value="8">8s</option>
                            <option value="10">10s</option>
                          </select>
                        </div>
                        <button
                          onClick={async () => {
                            if (!videoPrompt.trim()) { setVideoError("Enter a prompt first"); return; }
                            if (isCapabilityBlocked(caps, "video")) {
                              setVideoError(capabilityHint(caps, "video", "Video generation"));
                              return;
                            }
                            setVideoLoading(true); setVideoError(null); setVideoUrl(null); setVideoPredictionId(null); setVideoStatus("starting");
                            try {
                              const r = await fetch(apiUrl("/api/devhub/media/video"), {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ prompt: videoPrompt, model: videoModel, duration: Number(videoDuration) }),
                              });
                              const d = await r.json();
                              if (!d.ok) { setVideoError(d.error || "Video generation failed"); setVideoLoading(false); return; }
                              setVideoPredictionId(d.predictionId);
                              setVideoStatus("generating...");
                              // Poll for completion
                              const pollFn = async (id: string, attempts = 0) => {
                                if (attempts > 120) { setVideoError("Timeout after 2 min"); setVideoLoading(false); return; }
                                const sr = await fetch(apiUrl(`/api/devhub/media/video/status/${id}`));
                                const sd = await sr.json();
                                setVideoStatus(sd.status);
                                if (sd.status === "succeeded" && sd.videoUrl) {
                                  setVideoUrl(sd.videoUrl); setVideoLoading(false);
                                } else if (sd.status === "failed") {
                                  setVideoError(sd.error || "Generation failed"); setVideoLoading(false);
                                } else {
                                  setTimeout(() => pollFn(id, attempts + 1), 3000);
                                }
                              };
                              setTimeout(() => pollFn(d.predictionId), 4000);
                            } catch (e: any) { setVideoError(e.message || "Failed"); setVideoLoading(false); }
                          }}
                          disabled={videoLoading || !videoPrompt.trim()}
                          title={capabilityHint(caps, "video", "Generate video")}
                          style={{ padding: "8px 20px", background: videoLoading ? "#94a3b8" : "#0d9488", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: videoLoading ? "default" : "pointer", whiteSpace: "nowrap", opacity: isCapabilityBlocked(caps, "video") ? 0.45 : 1 }}
                        >
                          {videoLoading ? `${videoStatus || "generating..."}` : "Generate Video"}
                        </button>
                      </div>
                      {videoError && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 7, fontSize: 13 }}>{videoError}</div>}
                      {videoUrl && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <video src={videoUrl} controls style={{ width: "100%", borderRadius: 8, border: "1px solid #e2e8f0", maxHeight: 360 }} />
                          <div style={{ display: "flex", gap: 8 }}>
                            <a href={videoUrl} download target="_blank" rel="noreferrer" style={{ flex: 1, padding: "8px 0", background: "#0d9488", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer", textAlign: "center", textDecoration: "none" }}>Download</a>
                            <button onClick={() => appendAssetToFile(videoUrl, "video")} title="Appends a <video> tag to the file open in the editor" style={{ flex: 1, padding: "8px 0", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Insert into file</button>
                          </div>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "#94a3b8", padding: "6px 10px", background: "#f8fafc", borderRadius: 6 }}>
                        Powered by Replicate API. Requires REPLICATE_API_TOKEN in Railway. Generation takes 30–120s.
                      </div>
                    </div>
                  )}

                  {/* TTS */}
                  {/* 3D assets — image → textured GLB */}
                  {mediaTab === "3d" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
                        Готовая 3D-модель в формате GLB — открывается в three.js, Unity и Blender.
                        Нужна картинка предмета: сгенерируйте её во вкладке Image и вставьте ссылку сюда.
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Модель</label>
                        <select
                          value={threeDModel}
                          onChange={(e) => setThreeDModel(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13 }}
                        >
                          {(threeDModels.length ? threeDModels : [{ id: threeDModel, label: threeDModel, provider: "", note: "" }]).map((m) => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </select>
                        {threeDModels.find((m) => m.id === threeDModel)?.note && (
                          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4, lineHeight: 1.4 }}>
                            {threeDModels.find((m) => m.id === threeDModel)!.note}
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Ссылка на картинку</label>
                        <input
                          value={threeDImageUrl}
                          onChange={(e) => setThreeDImageUrl(e.target.value)}
                          placeholder="https://... (png или jpg с одним предметом)"
                          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!threeDImageUrl.trim()) { setThreeDError("Вставьте ссылку на картинку"); return; }
                          if (isCapabilityBlocked(caps, "video")) { setThreeDError(capabilityHint(caps, "video", "3D-генерация")); return; }
                          setThreeDLoading(true); setThreeDError(null); setThreeDUrl(null); setThreeDStatus("starting");
                          try {
                            const r = await fetch(apiUrl("/api/devhub/media/3d"), {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ imageUrl: threeDImageUrl.trim(), model: threeDModel }),
                            });
                            const d = await r.json();
                            if (!r.ok || !d.ok) {
                              // 402 means the provider has no balance — say that, not "failed".
                              setThreeDError(d.topUpUrl ? `${d.error} → ${d.topUpUrl}` : (d.error || "3D generation failed"));
                              setThreeDLoading(false);
                              return;
                            }
                            setThreeDStatus("generating…");
                            const poll = async (id: string, attempts = 0) => {
                              if (attempts > 100) { setThreeDError("Таймаут — попробуйте ещё раз"); setThreeDLoading(false); return; }
                              const sr = await fetch(apiUrl(`/api/devhub/media/video/status/${id}`));
                              const sd = await sr.json();
                              setThreeDStatus(sd.status);
                              if (sd.status === "succeeded") {
                                const url = sd.videoUrl || sd.output?.model_file || (Array.isArray(sd.output) ? sd.output[0] : sd.output);
                                if (typeof url === "string") { setThreeDUrl(url); } else { setThreeDError("Модель готова, но ссылка не распознана"); }
                                setThreeDLoading(false);
                              } else if (sd.status === "failed") {
                                setThreeDError(sd.error || "Генерация не удалась"); setThreeDLoading(false);
                              } else {
                                setTimeout(() => poll(id, attempts + 1), 3000);
                              }
                            };
                            setTimeout(() => poll(d.predictionId), 4000);
                          } catch (e: any) { setThreeDError(e.message || "Не удалось"); setThreeDLoading(false); }
                        }}
                        disabled={threeDLoading || !threeDImageUrl.trim()}
                        title={capabilityHint(caps, "video", "Сгенерировать 3D")}
                        style={{ padding: "8px 20px", background: threeDLoading ? "#94a3b8" : "#0d9488", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: threeDLoading ? "default" : "pointer", opacity: isCapabilityBlocked(caps, "video") ? 0.45 : 1 }}
                      >
                        {threeDLoading ? (threeDStatus || "generating…") : "Сделать 3D-модель"}
                      </button>
                      {threeDError && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 7, fontSize: 13, wordBreak: "break-word" }}>{threeDError}</div>}
                      {threeDUrl && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "8px 12px", borderRadius: 7, fontSize: 13 }}>
                            GLB готов — скачайте или вставьте ссылку в открытый файл проекта.
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <a href={threeDUrl} download target="_blank" rel="noreferrer" style={{ flex: 1, padding: "8px 0", background: "#0d9488", color: "#fff", borderRadius: 7, fontWeight: 700, fontSize: 13, textAlign: "center", textDecoration: "none" }}>Скачать GLB</a>
                            <button
                              onClick={() => appendAssetToFile(threeDUrl, "model")}
                              title="Дописывает ссылку на модель в файл, открытый в редакторе"
                              style={{ flex: 1, padding: "8px 0", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                            >Вставить в файл</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {mediaTab === "tts" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Voice</label>
                        <div style={{ display: "flex", gap: 6 }}>
                          <select
                            value={mediaTtsVoice}
                            onChange={(e) => setMediaTtsVoice(e.target.value)}
                            style={{ flex: 1, padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13 }}
                          >
                            {["Rachel", "Adam", "Antoni", "Arnold", "Bella", "Domi", "Elli", "Josh", "Sam"].map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => previewVoice(mediaTtsVoice)}
                            disabled={!!previewingVoice}
                            title="Preview voice with a short sample"
                            style={{
                              padding: "7px 12px", background: previewingVoice === mediaTtsVoice ? "#a5b4fc" : "#7c3aed",
                              color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700,
                              cursor: previewingVoice ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            {previewingVoice === mediaTtsVoice ? "🔊" : "▶ Preview"}
                          </button>
                        </div>
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
                          <img src={cfImgPermanentUrl || imgResult.url} alt="generated" style={{ width: "100%", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                          {imgResult.revisedPrompt && (
                            <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
                              Revised prompt: {imgResult.revisedPrompt}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <a href={cfImgPermanentUrl || imgResult.url} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 13, color: "#0d9488", fontWeight: 600 }}>
                              Open full size →
                            </a>
                            {!cfImgPermanentUrl && (
                              <button
                                onClick={() => uploadImageToCloudflare(imgResult.url)}
                                disabled={cfImgUploading}
                                title="OpenAI's image URL expires in ~1 hour. Upload to Cloudflare Images for a permanent CDN URL."
                                style={{
                                  padding: "4px 10px", background: "#f59e0b", color: "#fff",
                                  border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer",
                                }}
                              >
                                {cfImgUploading ? "Uploading..." : "→ Permanent CDN URL"}
                              </button>
                            )}
                            <button
                              onClick={() => appendAssetToFile(cfImgPermanentUrl || imgResult.url, "image")}
                              title="Appends an <img> tag to the file open in the editor"
                              style={{ padding: "4px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                            >
                              Insert into file
                            </button>
                            {cfImgPermanentUrl && (
                              <span style={{ fontSize: 11, color: "#065f46", fontWeight: 700 }}>
                                ✓ Permanent CDN
                              </span>
                            )}
                          </div>
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
                          background: !emailMsg.ok ? "#fee2e2" : emailMsg.degraded ? "#fef3c7" : "#d1fae5",
                          color: !emailMsg.ok ? "#991b1b" : emailMsg.degraded ? "#92400e" : "#065f46",
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
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["gumroad", "stripe"] as const).map((prov) => (
                          <button
                            key={prov}
                            onClick={() => { setPayProvider(prov); setPayResult(null); setPayError(null); }}
                            style={{
                              flex: 1, padding: "6px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
                              border: payProvider === prov ? "1px solid #635bff" : "1px solid #e2e8f0",
                              background: payProvider === prov ? "#eef2ff" : "#fff",
                              color: payProvider === prov ? "#4338ca" : "#64748b",
                            }}
                          >
                            {prov === "gumroad" ? "Gumroad ✓ live" : "Stripe (KYC blocked)"}
                          </button>
                        ))}
                      </div>
                      {payProvider === "gumroad" ? (
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Gumroad product permalink</label>
                          <input
                            type="text"
                            value={payPermalink}
                            onChange={(e) => setPayPermalink(e.target.value)}
                            placeholder="my-product  (or full app.gumroad.com/l/... URL)"
                            style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                          />
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Price is set in the Gumroad product itself — create it in your Gumroad dashboard, paste its permalink here.</div>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
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
                      {(() => {
                        const disabled = payLoading || (payProvider === "gumroad" ? !payPermalink.trim() : (!payName.trim() || !payAmount.trim()));
                        return (
                          <button
                            onClick={payProvider === "gumroad" ? createGumroadCheckout : createPaymentLink}
                            disabled={disabled}
                            style={{
                              padding: "9px 18px", background: payLoading ? "#a5b4fc" : "#635bff",
                              color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                              cursor: disabled ? "not-allowed" : "pointer",
                            }}
                          >
                            {payLoading ? "Creating..." : payProvider === "gumroad" ? "Get Gumroad Checkout Link" : "Create Payment Link"}
                          </button>
                        );
                      })()}
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        {payProvider === "gumroad"
                          ? <>Gumroad is the only live processor (Stripe/Paddle blocked by KYC). Link is a public product page — no server key needed. Sales arrive via <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>/api/gumroad/webhook</code>.</>
                          : <>⚠️ Stripe is KYC-blocked — links won't collect real payments. Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>STRIPE_SECRET_KEY</code>.</>}
                      </div>
                    </div>
                  )}

                  {/* DeepL Translate */}
                  {mediaTab === "translate" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Translate text</div>
                      <div>
                        <textarea value={trText} onChange={(e) => setTrText(e.target.value)} placeholder="Text to translate..."
                          rows={4}
                          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Source (auto if empty)</label>
                          <select value={trSource} onChange={(e) => setTrSource(e.target.value)}
                            style={{ width: "100%", padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12 }}>
                            <option value="">Auto-detect</option>
                            {["EN", "RU", "DE", "FR", "ES", "IT", "JA", "KO", "ZH", "PT", "TR", "UK"].map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Target</label>
                          <select value={trTarget} onChange={(e) => setTrTarget(e.target.value)}
                            style={{ width: "100%", padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12 }}>
                            {["EN", "RU", "DE", "FR", "ES", "IT", "JA", "KO", "ZH", "PT", "TR", "UK"].map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      {trError && (
                        <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 7, fontSize: 13 }}>
                          {trError}
                        </div>
                      )}
                      {trResult && (
                        <div style={{ padding: "10px 12px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 7, display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ fontSize: 11, color: "#0d9488", fontWeight: 700 }}>
                            {trResult.detectedSource} → {trTarget}
                          </div>
                          <div style={{ fontSize: 13, color: "#0f172a", whiteSpace: "pre-wrap" }}>{trResult.text}</div>
                          <button onClick={() => navigator.clipboard.writeText(trResult.text)}
                            style={{ alignSelf: "flex-start", padding: "4px 10px", background: "#0d9488", color: "#fff",
                              border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Copy</button>
                        </div>
                      )}
                      <button
                        onClick={translateText}
                        disabled={trLoading || !trText.trim()}
                        style={{
                          padding: "9px 18px", background: trLoading ? "#a5b4fc" : "#0066ff",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: (trLoading || !trText.trim()) ? "not-allowed" : "pointer",
                        }}
                      >
                        {trLoading ? "Translating..." : "Translate"}
                      </button>

                      {/* File translate */}
                      <div style={{ paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Translate project file</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <select value={trFilePath} onChange={(e) => setTrFilePath(e.target.value)}
                            style={{ flex: 2, minWidth: 160, padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontFamily: "monospace" }}>
                            <option value="">— select file —</option>
                            {files.map((f) => <option key={f.path} value={f.path}>{f.path}</option>)}
                          </select>
                          <select value={trFileLang} onChange={(e) => setTrFileLang(e.target.value)}
                            style={{ flex: 1, minWidth: 80, padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12 }}>
                            {["RU", "EN", "DE", "FR", "ES", "IT", "JA", "ZH", "UK", "TR"].map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <button
                            onClick={translateProjectFile}
                            disabled={trFileLoading || !trFilePath.trim()}
                            style={{ padding: "7px 14px", background: trFileLoading ? "#a5b4fc" : "#0066ff",
                              color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700,
                              cursor: (trFileLoading || !trFilePath.trim()) ? "not-allowed" : "pointer" }}>
                            {trFileLoading ? "..." : "Translate file"}
                          </button>
                        </div>
                        {trFileMsg && (
                          <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 7, fontSize: 12,
                            background: trFileMsg.ok ? "#d1fae5" : "#fee2e2",
                            color: trFileMsg.ok ? "#065f46" : "#991b1b" }}>
                            {trFileMsg.text}
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>DEEPL_API_KEY</code> (use :fx suffix for Free tier)
                      </div>
                    </div>
                  )}

                  {/* DeepL Bulk translate — N files × M langs */}
                  {mediaTab === "bulk" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Bulk i18n — translate many files into many languages
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Files ({bulkPaths.length} selected)</label>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" onClick={() => setBulkPaths(files.map((f) => f.path))}
                              style={{ padding: "3px 8px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                              All
                            </button>
                            <button type="button" onClick={() => setBulkPaths([])}
                              style={{ padding: "3px 8px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                              None
                            </button>
                          </div>
                        </div>
                        <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 0", background: "#fff" }}>
                          {files.length === 0 ? (
                            <div style={{ padding: 12, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>No files in project</div>
                          ) : (
                            files.map((f) => (
                              <label key={f.path} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
                                <input type="checkbox" checked={bulkPaths.includes(f.path)} onChange={() => toggleBulkPath(f.path)} />
                                <span style={{ color: "#0f172a" }}>{f.path}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                            Target languages ({bulkLangs.length} selected)
                          </label>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {BULK_PRESETS.map((preset) => {
                              const active = preset.codes.length === bulkLangs.length && preset.codes.every((c) => bulkLangs.includes(c));
                              return (
                                <button key={preset.label} type="button" onClick={() => applyBulkLangPreset(preset.codes)}
                                  style={{
                                    padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer",
                                    border: "1px solid " + (active ? "#0d9488" : "#e2e8f0"),
                                    background: active ? "#0d9488" : "#f8fafc",
                                    color: active ? "#fff" : "#64748b", borderRadius: 5, whiteSpace: "nowrap",
                                  }}>
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {BULK_LANG_OPTIONS.map((opt) => {
                            const on = bulkLangs.includes(opt.code);
                            return (
                              <button key={opt.code} type="button" onClick={() => toggleBulkLang(opt.code)}
                                style={{
                                  padding: "5px 10px", border: "1px solid " + (on ? "#0d9488" : "#e2e8f0"),
                                  background: on ? "#0d9488" : "#fff", color: on ? "#fff" : "#475569",
                                  borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                }}>
                                {opt.code} · {opt.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        Will produce <b>{bulkPaths.length * bulkLangs.length}</b> translations (limit 50/batch).
                        Output files are saved next to originals with lang suffix: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>README.ru.md</code>.
                      </div>

                      <button onClick={runBulkTranslate}
                        disabled={bulkLoading || bulkPaths.length === 0 || bulkLangs.length === 0 || bulkPaths.length * bulkLangs.length > 50}
                        style={{
                          padding: "10px 18px", background: bulkLoading ? "#a5b4fc" : "#0066ff",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: bulkLoading ? "not-allowed" : "pointer",
                        }}>
                        {bulkLoading ? "Translating..." : `Translate ${bulkPaths.length} × ${bulkLangs.length}`}
                      </button>

                      {bulkSummary && (
                        <div style={{
                          padding: "10px 12px", borderRadius: 7,
                          background: bulkSummary.failureCount === 0 ? "#d1fae5" : "#fef3c7",
                          color: bulkSummary.failureCount === 0 ? "#065f46" : "#92400e",
                          fontSize: 12, fontWeight: 600,
                        }}>
                          {bulkSummary.successCount} of {bulkSummary.total} translations OK
                          {bulkSummary.failureCount > 0 && ` · ${bulkSummary.failureCount} failed`}
                        </div>
                      )}

                      {bulkResults.length > 0 && (
                        <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 7 }}>
                          {bulkResults.map((r, idx) => (
                            <div key={idx} style={{
                              padding: "5px 10px", fontSize: 11, fontFamily: "monospace",
                              borderBottom: idx < bulkResults.length - 1 ? "1px solid #f1f5f9" : "none",
                              color: r.ok ? "#065f46" : "#991b1b",
                              display: "flex", justifyContent: "space-between", gap: 8,
                            }}>
                              <span>{r.ok ? "✓" : "✗"} {r.path} → {r.targetLang}</span>
                              <span style={{ color: "#64748b" }}>{r.outputPath || r.error}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>DEEPL_API_KEY</code>
                      </div>
                    </div>
                  )}

                  {/* Brevo Email Templates */}
                  {mediaTab === "templates" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Brevo SMTP templates</div>
                        <button onClick={loadEmailTemplates}
                          style={{ padding: "4px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Refresh
                        </button>
                      </div>
                      {emailTemplatesError && (
                        <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 7, fontSize: 13 }}>
                          {emailTemplatesError}
                        </div>
                      )}
                      {emailTemplatesLoading ? (
                        <div style={{ color: "#94a3b8", fontSize: 12 }}>Loading templates...</div>
                      ) : emailTemplates.length === 0 && !emailTemplatesError ? (
                        <div style={{ color: "#94a3b8", fontSize: 12 }}>No templates found</div>
                      ) : (
                        <>
                          {/* Send config */}
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <input type="email" value={tplSendTo} onChange={(e) => setTplSendTo(e.target.value)} placeholder="recipient@example.com"
                              style={{ flex: 2, minWidth: 160, padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, boxSizing: "border-box" }} />
                            <input value={tplSendParams} onChange={(e) => setTplSendParams(e.target.value)} placeholder='Params JSON {"name":"Alice"}'
                              style={{ flex: 3, minWidth: 200, padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontFamily: "monospace", boxSizing: "border-box" }} />
                          </div>
                          {tplSendMsg && (
                            <div style={{ padding: "8px 12px", borderRadius: 7, fontSize: 12,
                              background: tplSendMsg.ok ? "#d1fae5" : "#fee2e2",
                              color: tplSendMsg.ok ? "#065f46" : "#991b1b" }}>
                              {tplSendMsg.text}
                            </div>
                          )}
                          {/* Templates list */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                            {emailTemplates.map((t) => (
                              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#f8fafc", borderRadius: 7 }}>
                                <span style={{ width: 36, height: 36, borderRadius: 6, background: t.isActive ? "#d1fae5" : "#f1f5f9",
                                  color: t.isActive ? "#065f46" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 12, fontWeight: 700 }}>#{t.id}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                                  <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</div>
                                </div>
                                <button
                                  onClick={() => sendByTemplate(t.id)}
                                  disabled={tplSendingId === t.id || !tplSendTo.trim()}
                                  style={{ padding: "5px 10px",
                                    background: tplSendingId === t.id ? "#fde68a" : (!tplSendTo.trim() ? "#e2e8f0" : "#0d9488"),
                                    color: !tplSendTo.trim() ? "#94a3b8" : "#fff",
                                    border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700,
                                    cursor: (tplSendingId === t.id || !tplSendTo.trim()) ? "not-allowed" : "pointer" }}>
                                  {tplSendingId === t.id ? "..." : "Send"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Manage templates at <a href="https://my.brevo.com/templates" target="_blank" rel="noopener noreferrer" style={{ color: "#0d9488" }}>my.brevo.com/templates</a>. Set `params` with template variables.
                      </div>
                    </div>
                  )}

                  {/* Brevo Template Builder — create new SMTP template */}
                  {mediaTab === "builder" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Create new email template
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Template name</label>
                        <input value={tplBuilderName} onChange={(e) => setTplBuilderName(e.target.value)} placeholder="welcome-v1"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Subject</label>
                        <input value={tplBuilderSubject} onChange={(e) => setTplBuilderSubject(e.target.value)} placeholder="Welcome to AEVION, {{params.name}}!"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Sender email (optional — falls back to BREVO_SENDER_EMAIL env)</label>
                        <input value={tplBuilderSender} onChange={(e) => setTplBuilderSender(e.target.value)} placeholder="noreply@aevion.io"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>HTML body</label>
                        <textarea value={tplBuilderHtml} onChange={(e) => setTplBuilderHtml(e.target.value)} rows={10}
                          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }} />
                        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                          Variables: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>{`{{params.name}}`}</code>, <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>{`{{contact.EMAIL}}`}</code>
                        </div>
                      </div>
                      {tplBuilderHtml.trim() && (
                        <details style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 10px" }}>
                          <summary style={{ fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>HTML preview</summary>
                          <div style={{ marginTop: 8, padding: 10, background: "#fff", border: "1px solid #f1f5f9", borderRadius: 6, fontSize: 13 }}
                            dangerouslySetInnerHTML={{ __html: tplBuilderHtml }} />
                        </details>
                      )}
                      {tplBuilderMsg && (
                        <div style={{
                          padding: "8px 12px", borderRadius: 7, fontSize: 12,
                          background: tplBuilderMsg.ok ? "#d1fae5" : "#fee2e2",
                          color: tplBuilderMsg.ok ? "#065f46" : "#991b1b",
                        }}>
                          {tplBuilderMsg.text}
                        </div>
                      )}
                      <button onClick={createEmailTemplate}
                        disabled={tplBuilderLoading || !tplBuilderName.trim() || !tplBuilderSubject.trim() || !tplBuilderHtml.trim()}
                        style={{
                          padding: "10px 18px", background: tplBuilderLoading ? "#a5b4fc" : "#0066ff",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: tplBuilderLoading ? "not-allowed" : "pointer",
                        }}>
                        {tplBuilderLoading ? "Creating..." : "Create template"}
                      </button>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>BREVO_API_KEY</code>, <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>BREVO_SENDER_EMAIL</code>
                      </div>
                    </div>
                  )}

                  {/* Brevo SMS */}
                  {mediaTab === "sms" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Recipient (E.164, e.g. +14155552671)</label>
                        <input value={smsRecipient} onChange={(e) => setSmsRecipient(e.target.value)} placeholder="+14155552671"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Sender (alphanumeric, max 11 chars)</label>
                        <input value={smsSender} onChange={(e) => setSmsSender(e.target.value)} placeholder="AEVION"
                          maxLength={11}
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                          Content ({smsContent.length}/612 chars, ~{Math.ceil(smsContent.length / 160)} segments)
                        </label>
                        <textarea value={smsContent} onChange={(e) => setSmsContent(e.target.value)} placeholder="Your verification code is 1234"
                          rows={4} maxLength={612}
                          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                      </div>
                      {smsMsg && (
                        <div style={{ padding: "8px 12px", borderRadius: 7, fontSize: 13,
                          background: !smsMsg.ok ? "#fee2e2" : smsMsg.degraded ? "#fef3c7" : "#d1fae5",
                          color: !smsMsg.ok ? "#991b1b" : smsMsg.degraded ? "#92400e" : "#065f46" }}>
                          {smsMsg.text}
                        </div>
                      )}
                      <button
                        onClick={sendSms}
                        disabled={smsLoading || !smsRecipient.trim() || !smsContent.trim()}
                        style={{
                          padding: "9px 18px", background: smsLoading ? "#fcd34d" : "#f59e0b",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: (smsLoading || !smsRecipient.trim() || !smsContent.trim()) ? "not-allowed" : "pointer",
                        }}
                      >
                        {smsLoading ? "Sending..." : "Send SMS"}
                      </button>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>BREVO_API_KEY</code> + <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>BREVO_SMS_SENDER</code>
                      </div>
                    </div>
                  )}

                  {/* Brevo WhatsApp */}
                  {mediaTab === "whatsapp" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Contact Number (E.164)</label>
                        <input value={waContact} onChange={(e) => setWaContact(e.target.value)} placeholder="+14155552671"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Template ID (approved WABA template)</label>
                        <input value={waTemplateId} onChange={(e) => setWaTemplateId(e.target.value)} placeholder="42"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Template Params (JSON, optional)</label>
                        <textarea value={waParams} onChange={(e) => setWaParams(e.target.value)} placeholder='{"name": "Alice", "code": "1234"}'
                          rows={3}
                          style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }} />
                      </div>
                      {waMsg && (
                        <div style={{ padding: "8px 12px", borderRadius: 7, fontSize: 13,
                          background: !waMsg.ok ? "#fee2e2" : waMsg.degraded ? "#fef3c7" : "#d1fae5",
                          color: !waMsg.ok ? "#991b1b" : waMsg.degraded ? "#92400e" : "#065f46" }}>
                          {waMsg.text}
                        </div>
                      )}
                      <button
                        onClick={sendWhatsApp}
                        disabled={waLoading || !waContact.trim() || !waTemplateId.trim()}
                        style={{
                          padding: "9px 18px", background: waLoading ? "#86efac" : "#25D366",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: (waLoading || !waContact.trim() || !waTemplateId.trim()) ? "not-allowed" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>💬</span>
                        {waLoading ? "Sending..." : "Send WhatsApp"}
                      </button>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>BREVO_API_KEY</code> + <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>BREVO_WHATSAPP_SENDER_ID</code>. Template must be pre-approved by WhatsApp.
                      </div>
                    </div>
                  )}

                  {/* Voice Clone */}
                  {mediaTab === "clone" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Voice Name</label>
                        <input value={voiceCloneName} onChange={(e) => setVoiceCloneName(e.target.value)} placeholder="My Custom Voice"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Description (optional)</label>
                        <input value={voiceCloneDesc} onChange={(e) => setVoiceCloneDesc(e.target.value)} placeholder="Male, calm, narrative"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Audio sample (MP3/WAV, 30 sec+)</label>
                        <input type="file" accept="audio/*" onChange={(e) => setVoiceCloneFile(e.target.files?.[0] || null)}
                          style={{ width: "100%", fontSize: 12 }} />
                        {voiceCloneFile && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{voiceCloneFile.name} ({Math.round(voiceCloneFile.size / 1024)} KB)</div>}
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Preview text</label>
                        <input value={voicePreviewText} onChange={(e) => setVoicePreviewText(e.target.value)}
                          placeholder="AEVION voice preview — your custom voice is ready"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                      </div>
                      {voiceCloneMsg && (
                        <div style={{ padding: "8px 12px", borderRadius: 7, fontSize: 13,
                          background: voiceCloneMsg.ok ? "#d1fae5" : "#fee2e2",
                          color: voiceCloneMsg.ok ? "#065f46" : "#991b1b" }}>
                          {voiceCloneMsg.text}
                        </div>
                      )}
                      {voicePreviewUrl && (
                        <div style={{ padding: "8px 12px", background: "#eef2ff", borderRadius: 7, display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ fontSize: 11, color: "#4338ca", fontWeight: 700 }}>Listen before saving — temp voice already deleted from your account</div>
                          <audio controls src={voicePreviewUrl} style={{ width: "100%" }} />
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={previewClonedVoice}
                          disabled={voicePreviewLoading || !voiceCloneFile}
                          style={{
                            padding: "9px 18px", background: voicePreviewLoading ? "#a5b4fc" : "#6366f1",
                            color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                            cursor: (voicePreviewLoading || !voiceCloneFile) ? "not-allowed" : "pointer",
                          }}
                        >
                          {voicePreviewLoading ? "Previewing..." : "🎧 Preview voice (no commit)"}
                        </button>
                        <button
                          onClick={cloneVoice}
                          disabled={voiceCloneLoading || !voiceCloneName.trim() || !voiceCloneFile || !voicePreviewOk}
                          title={!voicePreviewOk ? "Preview the voice first, then Save" : "Save permanent voice to ElevenLabs account"}
                          style={{
                            padding: "9px 18px", background: voiceCloneLoading ? "#c4b5fd" : (voicePreviewOk ? "#7c3aed" : "#cbd5e1"),
                            color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                            cursor: (voiceCloneLoading || !voiceCloneName.trim() || !voiceCloneFile || !voicePreviewOk) ? "not-allowed" : "pointer",
                          }}
                        >
                          {voiceCloneLoading ? "Saving..." : "✓ Save voice to account"}
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Preview clones temporarily, renders TTS sample, then deletes the temp voice — no slot is consumed.
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>ELEVENLABS_API_KEY</code>. Premium tier required.
                      </div>
                    </div>
                  )}

                  {/* Speech-to-Text */}
                  {mediaTab === "stt" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Audio file</label>
                        <input type="file" accept="audio/*" onChange={(e) => setSttFile(e.target.files?.[0] || null)}
                          style={{ width: "100%", fontSize: 12 }} />
                        {sttFile && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{sttFile.name} ({Math.round(sttFile.size / 1024)} KB)</div>}
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Language hint (optional, e.g. en, ru)</label>
                        <input value={sttLanguage} onChange={(e) => setSttLanguage(e.target.value)} placeholder="auto-detect if empty"
                          style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                      </div>
                      {sttError && (
                        <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 7, fontSize: 13 }}>
                          {sttError}
                        </div>
                      )}
                      {sttResult && (
                        <div style={{ padding: "10px 12px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 7, display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ fontSize: 11, color: "#0d9488", fontWeight: 700 }}>
                            {sttResult.language && `${sttResult.language} · `}{sttResult.confidence != null && `${Math.round(sttResult.confidence * 100)}% confidence`}
                          </div>
                          <div style={{ fontSize: 13, color: "#0f172a", whiteSpace: "pre-wrap" }}>{sttResult.text}</div>
                          <button onClick={() => navigator.clipboard.writeText(sttResult.text)}
                            style={{ alignSelf: "flex-start", padding: "4px 10px", background: "#0d9488", color: "#fff",
                              border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Copy text</button>
                        </div>
                      )}
                      <button
                        onClick={transcribeAudio}
                        disabled={sttLoading || !sttFile}
                        style={{
                          padding: "9px 18px", background: sttLoading ? "#a5b4fc" : "#6366f1",
                          color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: (sttLoading || !sttFile) ? "not-allowed" : "pointer",
                        }}
                      >
                        {sttLoading ? "Transcribing..." : "Transcribe"}
                      </button>
                    </div>
                  )}

                  {/* Google Drive */}
                  {mediaTab === "drive" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={driveQuery} onChange={(e) => setDriveQuery(e.target.value)} placeholder="Search Drive..."
                          onKeyDown={(e) => { if (e.key === "Enter") searchDrive(); }}
                          style={{ flex: 1, padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }} />
                        <button onClick={searchDrive} disabled={driveLoading}
                          style={{ padding: "7px 16px", background: driveLoading ? "#a5b4fc" : "#4285f4",
                            color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                          {driveLoading ? "..." : "Search"}
                        </button>
                      </div>
                      {driveError && (
                        <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 7, fontSize: 13 }}>
                          {driveError}
                        </div>
                      )}
                      {driveFiles.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                          {driveFiles.map((f) => (
                            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#f8fafc", borderRadius: 7 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>{f.mimeType.replace(/^application\/(vnd\.)?google-apps\./, "google ")}</div>
                              </div>
                              <button
                                onClick={() => importDriveFile(f.id, f.name)}
                                disabled={driveImporting === f.id}
                                style={{ padding: "4px 10px", background: "#4285f4", color: "#fff",
                                  border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                {driveImporting === f.id ? "..." : "Import"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                        Server env: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>GOOGLE_DRIVE_ACCESS_TOKEN</code> (OAuth Bearer)
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Agent Workflow Tab */}
              {activeTab === "agent" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ padding: "10px 12px", background: "linear-gradient(90deg, #ecfeff 0%, #f0fdfa 100%)", borderRadius: 10, border: "1px solid #99f6e4" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>🤖 Multi-step Agent</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Orchestrate code + image + voice in one workflow. One prompt → full app with hero image and voiceover.
                    </div>
                  </div>

                  {/* Templates picker */}
                  {agentTemplates.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Quick start templates</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {agentTemplates.map((tpl) => (
                          <button
                            key={tpl.id}
                            onClick={() => applyAgentTemplate(tpl.id)}
                            disabled={agentRunning}
                            title={tpl.description}
                            style={{
                              padding: "6px 12px", background: "#fff", border: "1px solid #99f6e4",
                              borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#0d9488", cursor: "pointer",
                              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                            }}
                          >
                            <span>{tpl.name}</span>
                            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}>{tpl.steps.length} steps</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Streaming toggle */}
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={agentStreaming}
                      onChange={(e) => setAgentStreaming(e.target.checked)}
                      disabled={agentRunning}
                    />
                    Stream progress live (SSE) — see each step finish as it happens
                  </label>

                  {/* Step list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {agentSteps.map((step, i) => (
                      <div key={i} style={{
                        padding: "10px 12px",
                        border: `1px solid ${agentLiveStep === i ? "#f59e0b" : "#e2e8f0"}`,
                        borderRadius: 8,
                        background: agentLiveStep === i ? "#fffbeb" : "#fff",
                        boxShadow: agentLiveStep === i ? "0 0 0 3px rgba(245, 158, 11, 0.15)" : "none",
                        transition: "all 200ms",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{
                            width: 20, height: 20, borderRadius: 4,
                            background: agentLiveStep === i ? "#f59e0b" : "#0d9488",
                            color: "#fff", fontSize: 11, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {agentLiveStep === i ? <span style={{ animation: "spin 1s linear infinite" }}>↻</span> : (i + 1)}
                          </span>
                          <select value={step.type} onChange={(e) => updateAgentStep(i, { type: e.target.value as AgentStep["type"] })}
                            style={{ padding: "4px 8px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 12, fontWeight: 700 }}>
                            <option value="code">Code</option>
                            <option value="image">Image (DALL-E)</option>
                            <option value="tts">Voice (TTS)</option>
                            <option value="sfx">SFX</option>
                            <option value="music">Music</option>
                          </select>
                          <input value={step.saveAs || ""} onChange={(e) => updateAgentStep(i, { saveAs: e.target.value })}
                            placeholder="saveAs (path)"
                            style={{ flex: 1, padding: "4px 8px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, fontFamily: "monospace" }} />
                          <button onClick={() => removeAgentStep(i)}
                            style={{ padding: "4px 8px", background: "none", border: "1px solid #fca5a5", borderRadius: 5, fontSize: 11, color: "#ef4444", cursor: "pointer" }}>
                            ×
                          </button>
                        </div>
                        {(step.type === "code" || step.type === "image" || step.type === "music") ? (
                          <input value={step.prompt || ""} onChange={(e) => updateAgentStep(i, { prompt: e.target.value })}
                            placeholder={step.type === "code" ? "Describe what to build..." : step.type === "image" ? "Describe the image..." : "Describe the music (genre, mood, instruments)..."}
                            style={{ width: "100%", padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, boxSizing: "border-box" }} />
                        ) : (
                          <input value={step.text || ""} onChange={(e) => updateAgentStep(i, { text: e.target.value })}
                            placeholder={step.type === "tts" ? "Text to speak..." : "Sound effect description..."}
                            style={{ width: "100%", padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, boxSizing: "border-box" }} />
                        )}
                        {step.type === "music" && (
                          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                            <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Length (s):</label>
                            <input type="number" min={10} max={300} value={step.lengthSeconds ?? 30}
                              onChange={(e) => updateAgentStep(i, { lengthSeconds: Math.max(10, Math.min(300, Number(e.target.value) || 30)) })}
                              style={{ width: 70, padding: "3px 6px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11 }} />
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>10–300</span>
                          </div>
                        )}
                        {/* Step result indicator */}
                        {agentResults[i] && (
                          <div style={{ marginTop: 6, fontSize: 11, color: agentResults[i].ok ? "#065f46" : "#991b1b", fontWeight: 600 }}>
                            {agentResults[i].ok ? "✓" : "✗"} {agentResults[i].ok ? (agentResults[i].savedAs || "ok") : agentResults[i].error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(["code", "image", "tts", "sfx", "music"] as const).map((t) => (
                      <button key={t} onClick={() => addAgentStep(t)}
                        style={{ padding: "4px 10px", background: "#f1f5f9", border: "1px dashed #94a3b8",
                          borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#64748b", cursor: "pointer" }}>
                        + {t === "code" ? "Code" : t === "image" ? "Image" : t === "tts" ? "Voice" : t === "sfx" ? "SFX" : "Music"}
                      </button>
                    ))}
                  </div>

                  {agentSummary && (
                    <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: agentSummary.failureCount === 0 ? "#d1fae5" : "#fef3c7",
                      color: agentSummary.failureCount === 0 ? "#065f46" : "#92400e" }}>
                      Workflow complete: {agentSummary.successCount}/{agentSummary.totalSteps} steps successful, {agentSummary.failureCount} failed
                    </div>
                  )}

                  <button
                    onClick={runAgentWorkflow}
                    disabled={agentRunning || agentSteps.length === 0}
                    style={{
                      padding: "11px 18px",
                      background: agentRunning ? "linear-gradient(90deg, #c4b5fd 0%, #fcd34d 100%)" : "linear-gradient(90deg, #7c3aed 0%, #f59e0b 100%)",
                      color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14,
                      cursor: (agentRunning || agentSteps.length === 0) ? "not-allowed" : "pointer",
                    }}
                  >
                    {agentRunning ? "Running workflow..." : `🤖 Run ${agentSteps.length}-step Workflow`}
                  </button>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === "settings" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Database state — the numbers are measured on the instance,
                      not estimated, so limits can be discussed honestly. */}
                  {dbUsage && (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", background: "#f8fafc" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>База данных</div>
                      {dbUsage.provisioned ? (
                        <div style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.6 }}>
                          {dbUsage.error ? (
                            <span style={{ color: "#991b1b" }}>Не удалось измерить: {dbUsage.error}</span>
                          ) : (
                            <>
                              Таблиц: <b>{dbUsage.tables ?? 0}</b> · занято <b>{dbUsage.megabytes ?? 0} МБ</b> ·
                              одновременных подключений: <b>до {dbUsage.connectionLimit ?? 5}</b>
                              <div style={{ color: "#64748b", marginTop: 4 }}>
                                Строка подключения лежит в Env Vars как <span style={{ fontFamily: "monospace" }}>DATABASE_URL</span>.
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
                          База ещё не создана. Опишите её в чате — после генерации схемы появится кнопка «Создать базу данных».
                        </div>
                      )}
                    </div>
                  )}
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

                  {/* Collaborators — Studio Pro */}
                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Collaborators</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>Studio Pro</span>
                    </div>
                    {(project.collaborators || []).length === 0 && (
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>No collaborators yet. Add by email or user ID.</div>
                    )}
                    {(project.collaborators || []).map((c) => (
                      <div key={c.userId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f8fafc" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#0369a1", flexShrink: 0 }}>
                          {c.userId.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ flex: 1, fontSize: 12, fontFamily: "monospace", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.userId}>{c.userId}</span>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: c.role === "editor" ? "#d1fae5" : "#f1f5f9", color: c.role === "editor" ? "#065f46" : "#64748b", fontWeight: 600, flexShrink: 0 }}>{c.role}</span>
                        <button
                          onClick={() => removeCollaborator(c.userId)}
                          title="Remove collaborator"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14, fontWeight: 700, padding: "0 2px", flexShrink: 0 }}
                        >×</button>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                      <input
                        type="text"
                        value={settingsCollab}
                        onChange={(e) => setSettingsCollab(e.target.value)}
                        placeholder="email or user-id"
                        style={{ flex: "1 1 140px", minWidth: 0, padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, boxSizing: "border-box" }}
                        onKeyDown={(e) => { if (e.key === "Enter") addCollaborator(); }}
                      />
                      <select
                        value={collabRole}
                        onChange={(e) => setCollabRole(e.target.value as "editor" | "viewer")}
                        style={{ padding: "7px 8px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, background: "#fff", cursor: "pointer", flexShrink: 0 }}
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={addCollaborator}
                        style={{ padding: "7px 14px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: "pointer", flexShrink: 0 }}
                      >
                        Invite
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                      Editors can write files · Viewers are read-only · Studio Pro required
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
