"use client";

import { useState, useEffect, useCallback } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  userId: string;
  content: string;
  mediaUrl: string | null;
  type: string;
  likesCount: number;
  commentsCount: number;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
}

interface Story {
  id: string;
  userId: string;
  content: string;
  mediaUrl: string | null;
  viewCount: number;
  expiresAt: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token =
    localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getAuthSub(): string | null {
  if (typeof window === "undefined") return null;
  const token =
    localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function avatarLetters(userId: string): string {
  return userId.slice(0, 2).toUpperCase();
}

function avatarColor(userId: string): string {
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
  const idx = userId.charCodeAt(0) % colors.length;
  return colors[idx];
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserId,
  onLike,
  onDelete,
}: {
  post: Post;
  currentUserId: string | null;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isOwner = currentUserId === post.userId;
  const bg = avatarColor(post.userId);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 20,
        marginBottom: 14,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: bg,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {avatarLetters(post.userId)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>
            {post.userId.slice(0, 8)}...
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{relativeTime(post.createdAt)}</div>
        </div>
        {isOwner && (
          <button
            onClick={() => onDelete(post.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#ef4444",
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            Delete
          </button>
        )}
      </div>

      {/* Content */}
      <p style={{ margin: "0 0 14px", fontSize: 15, color: "#334155", lineHeight: 1.6 }}>
        {post.content}
      </p>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {post.tags.map((tag) => (
            <span
              key={tag}
              style={{
                background: "#eff6ff",
                color: "#2563eb",
                borderRadius: 20,
                padding: "2px 10px",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#64748b" }}>
        <button
          onClick={() => onLike(post.id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#ef4444",
            fontWeight: 600,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: 0,
          }}
        >
          <span style={{ fontSize: 16 }}>♥</span> {post.likesCount}
        </button>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 16 }}>💬</span> {post.commentsCount}
        </span>
      </div>
    </div>
  );
}

// ─── Create Post Form ─────────────────────────────────────────────────────────

function CreatePostForm({ onCreated }: { onCreated: (post: Post) => void }) {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setError("");
    try {
      const resp = await fetch(apiUrl("/api/qsocial/posts"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({
          content: content.trim(),
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({})) as { error?: string };
        setError(j.error ?? "Failed to post");
        return;
      }
      const { post } = await resp.json() as { post: Post };
      onCreated(post);
      setContent("");
      setTags("");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 20,
        marginBottom: 20,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        maxLength={2000}
        rows={3}
        style={{
          width: "100%",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 14,
          resize: "vertical",
          outline: "none",
          fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      />
      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (comma-separated)"
          style={{
            flex: 1,
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
            outline: "none",
            minWidth: 120,
          }}
        />
        <button
          type="submit"
          disabled={busy || !content.trim()}
          style={{
            background: busy ? "#c7d2fe" : "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 20px",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            fontSize: 14,
          }}
        >
          {busy ? "Posting..." : "Post"}
        </button>
      </div>
      {error && <p style={{ color: "#ef4444", margin: "8px 0 0", fontSize: 13 }}>{error}</p>}
    </form>
  );
}

// ─── Trending Widget ──────────────────────────────────────────────────────────

function TrendingWidget({ posts }: { posts: Post[] }) {
  const tags: Record<string, number> = {};
  for (const p of posts) {
    for (const t of p.tags) {
      tags[t] = (tags[t] ?? 0) + 1;
    }
  }
  const sorted = Object.entries(tags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 20,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 14 }}>
        Trending Tags
      </div>
      {sorted.length === 0 && (
        <p style={{ fontSize: 13, color: "#94a3b8" }}>No trending tags yet</p>
      )}
      {sorted.map(([tag, count]) => (
        <div
          key={tag}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "6px 0",
            borderBottom: "1px solid #f1f5f9",
            fontSize: 13,
          }}
        >
          <span style={{ color: "#6366f1", fontWeight: 500 }}>#{tag}</span>
          <span style={{ color: "#94a3b8" }}>{count} posts</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FeedTab = "global" | "mine" | "dm";

type DMConversation = { userId: string; lastMessage: { fromId: string; content: string; createdAt: string }; unreadCount: number };
type DMMessage = { id: string; fromId: string; toId: string; content: string; read: boolean; createdAt: string };

export default function QSocialPage() {
  const [tab, setTab] = useState<FeedTab>("global");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const currentUserId = getAuthSub();

  // Stories state
  const [stories, setStories] = useState<Story[]>([]);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [createStoryOpen, setCreateStoryOpen] = useState(false);
  const [newStoryContent, setNewStoryContent] = useState("");

  // Notifications
  const [notifications, setNotifications] = useState<{ id: string; type: string; message: string; read: boolean; createdAt: string }[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Stats
  const [stats, setStats] = useState<{ posts: { total: number; public: number }; likes: number } | null>(null);

  // DM
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [activeDmUserId, setActiveDmUserId] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const totalUnreadDm = conversations.reduce((s, c) => s + c.unreadCount, 0);

  async function fetchConversations() {
    if (!currentUserId) return;
    try {
      const r = await fetch(apiUrl("/api/qsocial/me/dms"), { headers: bearerHeader() });
      if (r.ok) { const d = await r.json(); setConversations(d.conversations ?? []); }
    } catch { /* ignore */ }
  }

  async function fetchDmThread(userId: string) {
    try {
      const r = await fetch(apiUrl(`/api/qsocial/dm/${encodeURIComponent(userId)}`), { headers: bearerHeader() });
      if (r.ok) { const d = await r.json(); setDmMessages(d.messages ?? []); }
      // Mark as read
      fetch(apiUrl(`/api/qsocial/dm/${encodeURIComponent(userId)}/read`), { method: "PATCH", headers: bearerHeader() }).catch(() => {});
    } catch { /* ignore */ }
  }

  async function sendDm() {
    if (!activeDmUserId || !dmInput.trim() || dmSending) return;
    setDmSending(true);
    try {
      const r = await fetch(apiUrl(`/api/qsocial/dm/${encodeURIComponent(activeDmUserId)}`), {
        method: "POST", headers: { ...bearerHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ content: dmInput.trim() }),
      });
      if (r.ok) { setDmInput(""); await fetchDmThread(activeDmUserId); await fetchConversations(); }
    } finally { setDmSending(false); }
  }

  useEffect(() => {
    // Fetch notifications and stats
    if (currentUserId) {
      fetch(apiUrl("/api/qsocial/me/notifications"), { headers: bearerHeader() })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.notifications) setNotifications(d.notifications); })
        .catch(() => {});
    }
    fetch(apiUrl("/api/qsocial/stats"))
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setStats(d); })
      .catch(() => {});
  }, [currentUserId]);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url =
        tab === "mine" && currentUserId
          ? apiUrl("/api/qsocial/me/feed")
          : apiUrl("/api/qsocial/feed");
      const resp = await fetch(url, { headers: bearerHeader() });
      if (!resp.ok) throw new Error("Failed to load feed");
      const data = await resp.json() as { posts: Post[] };
      setPosts(data.posts ?? []);
    } catch {
      setError("Could not load feed");
    } finally {
      setLoading(false);
    }
  }, [tab, currentUserId]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    if (tab === "dm" && currentUserId) fetchConversations();
  }, [tab, currentUserId]);

  useEffect(() => {
    if (activeDmUserId) fetchDmThread(activeDmUserId);
  }, [activeDmUserId]);

  // Fetch stories on mount
  useEffect(() => {
    fetch(apiUrl("/api/qsocial/stories?limit=20"), { headers: bearerHeader() })
      .then((r) => r.json())
      .then((d) => { if (d.stories) setStories(d.stories); })
      .catch(() => {});
  }, []);

  async function handleCreateStory() {
    if (!newStoryContent.trim()) return;
    try {
      const resp = await fetch(apiUrl("/api/qsocial/stories"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ content: newStoryContent.trim() }),
      });
      if (resp.ok) {
        const d = await resp.json() as { story: Story };
        setStories((prev) => [d.story, ...prev]);
        setNewStoryContent("");
        setCreateStoryOpen(false);
      }
    } catch {
      // ignore
    }
  }

  async function handleLike(postId: string) {
    if (!currentUserId) return;
    try {
      const resp = await fetch(apiUrl(`/api/qsocial/posts/${postId}/like`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
      });
      if (!resp.ok) return;
      const { liked, likesCount } = await resp.json() as { liked: boolean; likesCount: number };
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likesCount, liked } : p)),
      );
    } catch {
      // ignore
    }
  }

  async function handleDelete(postId: string) {
    try {
      await fetch(apiUrl(`/api/qsocial/posts/${postId}`), {
        method: "DELETE",
        headers: bearerHeader(),
      });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      // ignore
    }
  }

  function handleCreated(post: Post) {
    setPosts((prev) => [post, ...prev]);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    background: active ? "#6366f1" : "#f1f5f9",
    color: active ? "#fff" : "#64748b",
    transition: "all 0.15s",
  });

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: 24,
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          {/* Feed column */}
          <div>
            {/* Header with stats + notifications */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>QSocial</h1>
                {stats && (
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {stats.posts.public} постов · {stats.likes} лайков
                  </div>
                )}
              </div>
              {currentUserId && (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowNotifs(!showNotifs)}
                    style={{ background: "transparent", border: "1px solid #e2e8f0", borderRadius: 10, padding: "7px 12px", cursor: "pointer", fontSize: 18, position: "relative" }}
                  >
                    🔔
                    {unreadCount > 0 && (
                      <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {showNotifs && (
                    <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 8, width: 300, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", zIndex: 100, maxHeight: 360, overflowY: "auto" }}>
                      <div style={{ padding: "12px 16px", fontWeight: 700, fontSize: 13, borderBottom: "1px solid #f1f5f9" }}>Уведомления</div>
                      {notifications.length === 0 ? (
                        <div style={{ padding: "20px 16px", fontSize: 13, color: "#94a3b8", textAlign: "center" }}>Нет уведомлений</div>
                      ) : notifications.slice(0, 10).map((n) => (
                        <div key={n.id} style={{ padding: "10px 16px", borderBottom: "1px solid #f8fafc", fontSize: 13, color: n.read ? "#94a3b8" : "#0f172a", background: n.read ? "#fff" : "#f0fdf4" }}>
                          {n.message}
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{new Date(n.createdAt).toLocaleTimeString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tab switcher */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button style={tabStyle(tab === "global")} onClick={() => setTab("global")}>
                🌐 Global Feed
              </button>
              {currentUserId && (
                <button style={tabStyle(tab === "mine")} onClick={() => setTab("mine")}>
                  👤 My Feed
                </button>
              )}
              {currentUserId && (
                <button style={tabStyle(tab === "dm")} onClick={() => setTab("dm")} title="Messages">
                  💬 Messages{totalUnreadDm > 0 && <span style={{ marginLeft: 6, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: "50%", padding: "1px 5px" }}>{totalUnreadDm}</span>}
                </button>
              )}
            </div>

            {/* Stories row */}
            <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 0 12px", marginBottom: 16, scrollbarWidth: "none" }}>
              <div style={{ flexShrink: 0, width: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
                onClick={() => setCreateStoryOpen(true)}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #0d9488, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#fff" }}>+</div>
                <span style={{ fontSize: 11, color: "#64748b", textAlign: "center" }}>История</span>
              </div>
              {stories.map((s) => (
                <div key={s.id} style={{ flexShrink: 0, width: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}
                  onClick={() => {
                    setViewingStory(s);
                    fetch(apiUrl(`/api/qsocial/stories/${s.id}/view`), { method: "POST", headers: bearerHeader() }).catch(() => {});
                  }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #f59e0b, #ef4444)", border: "3px solid #0d9488", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, overflow: "hidden" }}>
                    {s.mediaUrl ? <img src={s.mediaUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : "📸"}
                  </div>
                  <span style={{ fontSize: 11, color: "#475569", textAlign: "center", maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.userId?.slice(0, 8) || "User"}
                  </span>
                </div>
              ))}
            </div>

            {/* Story viewer modal */}
            {viewingStory && (
              <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={() => setViewingStory(null)}>
                <div style={{ background: "#1e293b", borderRadius: 16, padding: 24, maxWidth: 360, width: "90%", color: "#fff" }}
                  onClick={(e) => e.stopPropagation()}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>{viewingStory.userId?.slice(0, 8)} &bull; история</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>{viewingStory.content}</div>
                  {viewingStory.mediaUrl && <img src={viewingStory.mediaUrl} alt="" style={{ width: "100%", borderRadius: 8, marginTop: 12 }} />}
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 12 }}>👁 {viewingStory.viewCount} просмотров</div>
                  <button onClick={() => setViewingStory(null)} style={{ marginTop: 12, padding: "6px 16px", borderRadius: 8, background: "#475569", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}>Закрыть</button>
                </div>
              </div>
            )}

            {/* Create story form */}
            {createStoryOpen && (
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 10 }}>Создать историю</div>
                <textarea value={newStoryContent} onChange={(e) => setNewStoryContent(e.target.value)} placeholder="Что хотите рассказать? (исчезнет через 24ч)" rows={3}
                  style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={handleCreateStory} disabled={!newStoryContent.trim()} style={{ padding: "7px 16px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Опубликовать</button>
                  <button onClick={() => { setCreateStoryOpen(false); setNewStoryContent(""); }} style={{ padding: "7px 16px", background: "#f1f5f9", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Отмена</button>
                </div>
              </div>
            )}

            {/* DM tab */}
            {tab === "dm" && (
              <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, height: 480 }}>
                {/* Conversation list */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflowY: "auto" }}>
                  <div style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13, borderBottom: "1px solid #f1f5f9" }}>Диалоги</div>
                  {conversations.length === 0 && (
                    <div style={{ padding: "20px 14px", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>Нет сообщений</div>
                  )}
                  {conversations.map((c) => (
                    <div
                      key={c.userId}
                      onClick={() => setActiveDmUserId(c.userId)}
                      style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f8fafc", background: activeDmUserId === c.userId ? "#f0fdf4" : "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{c.userId.slice(0, 8)}…</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{c.lastMessage?.content?.slice(0, 30)}</div>
                      </div>
                      {c.unreadCount > 0 && <span style={{ background: "#6366f1", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: "50%", padding: "1px 5px" }}>{c.unreadCount}</span>}
                    </div>
                  ))}
                </div>

                {/* Chat window */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, display: "flex", flexDirection: "column" }}>
                  {!activeDmUserId ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Выберите диалог</div>
                  ) : (
                    <>
                      <div style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13, borderBottom: "1px solid #f1f5f9" }}>
                        {activeDmUserId.slice(0, 8)}…
                      </div>
                      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                        {dmMessages.map((m) => (
                          <div key={m.id} style={{ display: "flex", justifyContent: m.fromId === currentUserId ? "flex-end" : "flex-start" }}>
                            <div style={{ maxWidth: "70%", background: m.fromId === currentUserId ? "#6366f1" : "#f1f5f9", color: m.fromId === currentUserId ? "#fff" : "#0f172a", padding: "8px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.4 }}>
                              {m.content}
                            </div>
                          </div>
                        ))}
                        {dmMessages.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>Напишите первое сообщение</div>}
                      </div>
                      <div style={{ padding: "10px 14px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 8 }}>
                        <input
                          value={dmInput}
                          onChange={(e) => setDmInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDm(); } }}
                          placeholder="Напишите сообщение..."
                          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                        />
                        <button onClick={sendDm} disabled={dmSending || !dmInput.trim()} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: dmSending ? 0.6 : 1 }}>
                          {dmSending ? "…" : "→"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Create post (hide in DM mode) */}
            {tab !== "dm" && currentUserId && <CreatePostForm onCreated={handleCreated} />}

            {/* Posts (hide in DM mode) */}
            {tab !== "dm" && loading && (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>Loading feed...</p>
            )}
            {tab !== "dm" && error && (
              <p style={{ color: "#ef4444", textAlign: "center", padding: 20 }}>{error}</p>
            )}
            {tab !== "dm" && !loading && !error && posts.length === 0 && (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 40,
                  textAlign: "center",
                  color: "#94a3b8",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>No posts yet</div>
                <div style={{ fontSize: 14 }}>Be the first to share something!</div>
              </div>
            )}
            {tab !== "dm" && posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                onLike={handleLike}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Sidebar */}
          <div>
            <TrendingWidget posts={posts} />
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: 20,
                marginTop: 16,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 12 }}>
                About QSocial
              </div>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                QSocial is the community hub of AEVION. Share ideas, follow creators, and stay
                connected with the ecosystem.
              </p>
            </div>
          </div>
        </div>
      </ProductPageShell>
    </>
  );
}
