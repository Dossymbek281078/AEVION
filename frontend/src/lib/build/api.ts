"use client";

import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "./auth";

// ── Domain types ─────────────────────────────────────────────────────

export type BuildRole = "CLIENT" | "CONTRACTOR" | "WORKER" | "ADMIN";
export type ProjectStatus = "OPEN" | "IN_PROGRESS" | "DONE";
export type VacancyStatus = "OPEN" | "CLOSED";
export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type BuildProfile = {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  city: string | null;
  description: string | null;
  buildRole: BuildRole;
  createdAt: string;
  updatedAt: string;
};

export type BuildProject = {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: ProjectStatus;
  city: string | null;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  vacancyCount?: number;
};

export type BuildVacancy = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  salary: number;
  status: VacancyStatus;
  createdAt: string;
  applicationsCount?: number;
  projectTitle?: string;
  projectStatus?: ProjectStatus;
  clientId?: string;
};

export type BuildApplication = {
  id: string;
  vacancyId: string;
  userId: string;
  message: string | null;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  vacancyTitle?: string;
  salary?: number;
  projectId?: string;
  projectTitle?: string;
  email?: string;
  applicantName?: string;
  applicantCity?: string;
};

export type BuildMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
};

export type BuildInboxRow = {
  peerId: string;
  peerName: string | null;
  peerEmail: string | null;
  lastAt: string;
  lastContent: string;
  unread: number;
};

export type BuildFile = {
  id: string;
  projectId: string;
  url: string;
  name: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  uploaderId: string;
  createdAt: string;
};

// ── Envelope + transport ─────────────────────────────────────────────

type Envelope<T> = { success: true; data: T } | { success: false; error: string; [k: string]: unknown };

export class BuildApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public payload?: unknown,
  ) {
    super(code);
    this.name = "BuildApiError";
  }
}

async function call<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  init?: { auth?: boolean; signal?: AbortSignal },
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.auth !== false) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: init?.signal,
    cache: "no-store",
  });

  let parsed: Envelope<T> | null = null;
  try {
    parsed = (await res.json()) as Envelope<T>;
  } catch {
    throw new BuildApiError(res.status, `bad_response_${res.status}`);
  }

  if (!res.ok || !parsed || parsed.success === false) {
    const err = parsed && parsed.success === false ? parsed : null;
    throw new BuildApiError(res.status, err?.error || `http_${res.status}`, err);
  }

  return parsed.data;
}

// ── Endpoint helpers ─────────────────────────────────────────────────

export const buildApi = {
  health: () => call<{ service: string; status: string; timestamp: string }>(
    "GET",
    "/api/build/health",
    undefined,
    { auth: false },
  ),

  // Profile
  me: () => call<{ user: BuildAuthLike; profile: BuildProfile | null }>(
    "GET",
    "/api/build/users/me",
  ),
  upsertProfile: (input: {
    name: string;
    phone?: string | null;
    city?: string | null;
    description?: string | null;
    buildRole?: BuildRole;
  }) => call<BuildProfile>("POST", "/api/build/profiles", input),
  getProfile: (userId: string) =>
    call<BuildProfile & { email: string | null }>("GET", `/api/build/profiles/${encodeURIComponent(userId)}`, undefined, { auth: false }),

  // Projects
  listProjects: (q?: { status?: ProjectStatus; q?: string; mine?: boolean; limit?: number }) => {
    const params = new URLSearchParams();
    if (q?.status) params.set("status", q.status);
    if (q?.q) params.set("q", q.q);
    if (q?.mine) params.set("mine", "1");
    if (q?.limit) params.set("limit", String(q.limit));
    const qs = params.toString();
    return call<{ items: BuildProject[]; total: number }>(
      "GET",
      `/api/build/projects${qs ? "?" + qs : ""}`,
      undefined,
      { auth: !!q?.mine },
    );
  },
  createProject: (input: { title: string; description: string; budget?: number; city?: string | null }) =>
    call<BuildProject>("POST", "/api/build/projects", input),
  getProject: (id: string) =>
    call<{
      project: BuildProject;
      vacancies: BuildVacancy[];
      files: BuildFile[];
      client: { id: string; email: string; name: string; city: string | null; buildRole: BuildRole | null } | null;
    }>("GET", `/api/build/projects/${encodeURIComponent(id)}`, undefined, { auth: false }),
  updateProject: (id: string, patch: Partial<{ title: string; description: string; budget: number; status: ProjectStatus; city: string | null }>) =>
    call<BuildProject>("PATCH", `/api/build/projects/${encodeURIComponent(id)}`, patch),

  // Vacancies
  listVacancies: (q?: {
    status?: VacancyStatus;
    projectStatus?: ProjectStatus;
    q?: string;
    city?: string;
    minSalary?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (q?.status) params.set("status", q.status);
    if (q?.projectStatus) params.set("projectStatus", q.projectStatus);
    if (q?.q) params.set("q", q.q);
    if (q?.city) params.set("city", q.city);
    if (q?.minSalary != null) params.set("minSalary", String(q.minSalary));
    if (q?.limit) params.set("limit", String(q.limit));
    const qs = params.toString();
    return call<{ items: (BuildVacancy & { projectCity?: string | null })[]; total: number }>(
      "GET",
      `/api/build/vacancies${qs ? "?" + qs : ""}`,
      undefined,
      { auth: false },
    );
  },
  createVacancy: (input: { projectId: string; title: string; description: string; salary?: number }) =>
    call<BuildVacancy>("POST", "/api/build/vacancies", input),
  vacanciesByProject: (projectId: string) =>
    call<{ items: BuildVacancy[]; total: number }>(
      "GET",
      `/api/build/vacancies/by-project/${encodeURIComponent(projectId)}`,
      undefined,
      { auth: false },
    ),
  getVacancy: (id: string) =>
    call<BuildVacancy>("GET", `/api/build/vacancies/${encodeURIComponent(id)}`, undefined, { auth: false }),

  // Applications
  apply: (input: { vacancyId: string; message?: string }) =>
    call<BuildApplication>("POST", "/api/build/applications", input),
  myApplications: () => call<{ items: BuildApplication[]; total: number }>("GET", "/api/build/applications/my"),
  applicationsByVacancy: (vacancyId: string) =>
    call<{ items: BuildApplication[]; total: number }>(
      "GET",
      `/api/build/applications/by-vacancy/${encodeURIComponent(vacancyId)}`,
    ),
  updateApplication: (id: string, status: ApplicationStatus) =>
    call<BuildApplication>("PATCH", `/api/build/applications/${encodeURIComponent(id)}`, { status }),

  // Messages
  inbox: () => call<{ items: BuildInboxRow[]; total: number }>("GET", "/api/build/messages"),
  thread: (peerUserId: string) =>
    call<{ items: BuildMessage[]; total: number }>(
      "GET",
      `/api/build/messages/${encodeURIComponent(peerUserId)}`,
    ),
  send: (input: { receiverId: string; content: string }) =>
    call<BuildMessage>("POST", "/api/build/messages", input),

  // Notifications
  notifySummary: () =>
    call<{
      unreadMessages: number;
      pendingApplications: number;
      applicationUpdates: number;
      total: number;
    }>("GET", "/api/build/notifications/summary"),

  // Files
  uploadFile: (input: {
    projectId: string;
    url: string;
    name?: string;
    mimeType?: string;
    sizeBytes?: number;
  }) => call<BuildFile>("POST", "/api/build/files/upload", input),
};

// ── Auth helpers (use existing /api/auth/* — not part of /api/build) ─

export type BuildAuthLike = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
};

export async function buildLogin(email: string, password: string): Promise<{ token: string; user: BuildAuthLike }> {
  const res = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new BuildApiError(res.status, json?.error || "login_failed", json);
  return json;
}

export async function buildRegister(email: string, password: string, name: string): Promise<{ token: string; user: BuildAuthLike }> {
  const res = await fetch(apiUrl("/api/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new BuildApiError(res.status, json?.error || "register_failed", json);
  return json;
}
