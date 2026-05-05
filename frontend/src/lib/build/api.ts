"use client";

import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "./auth";

// ── Domain types ─────────────────────────────────────────────────────

export type BuildRole = "CLIENT" | "CONTRACTOR" | "WORKER" | "ADMIN";
export type ProjectStatus = "OPEN" | "IN_PROGRESS" | "DONE";
export type VacancyStatus = "OPEN" | "CLOSED" | "ARCHIVED";
export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type ShiftPreference = "DAY" | "NIGHT" | "FLEX" | "ANY";
export type AvailabilityType = "FULL_TIME" | "PART_TIME" | "PROJECT" | "SHIFT" | "REMOTE";

export type ResumeCertification = {
  name: string;
  issuer?: string;
  year?: number | null;
  credentialUrl?: string | null;
};
export type ResumePortfolioItem = { label: string; url: string };
export type ResumeAchievement = { title: string; description?: string; year?: number | null };

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
  // Resume fields
  title: string | null;
  summary: string | null;
  skills: string[];
  languages: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  availability: string | null;
  experienceYears: number;
  photoUrl: string | null;
  openToWork: boolean;
  verifiedAt: string | null;
  verifiedReason: string | null;
  // Resume v2 — construction-vertical
  certifications: ResumeCertification[];
  portfolio: ResumePortfolioItem[];
  achievements: ResumeAchievement[];
  driversLicense: string | null;
  shiftPreference: ShiftPreference | null;
  availabilityType: AvailabilityType | null;
  readyFromDate: string | null;
  preferredLocations: string[];
  toolsOwned: string[];
  medicalCheckValid: boolean;
  medicalCheckUntil: string | null;
  safetyTrainingValid: boolean;
  safetyTrainingUntil: string | null;
  introVideoUrl: string | null;
};

export type BuildExperience = {
  id: string;
  userId: string;
  title: string;
  company: string;
  city: string | null;
  fromDate: string | null;
  toDate: string | null;
  current: boolean;
  description: string | null;
  sortOrder: number;
  createdAt: string;
};

export type BuildEducation = {
  id: string;
  userId: string;
  institution: string;
  degree: string | null;
  field: string | null;
  fromYear: number | null;
  toYear: number | null;
  createdAt: string;
};

export type TalentRow = {
  userId: string;
  name: string;
  city: string | null;
  buildRole: BuildRole;
  title: string | null;
  summary: string | null;
  skills: string[];
  languages: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  availability: string | null;
  experienceYears: number;
  photoUrl: string | null;
  openToWork: boolean;
  verifiedAt: string | null;
  updatedAt: string;
  avgRating?: number;
  reviewCount?: number;
};

export type BuildResumeBundle = BuildProfile & {
  email: string | null;
  experiences: BuildExperience[];
  education: BuildEducation[];
  avgRating?: number;
  reviewCount?: number;
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
  boostUntil?: string | null;
  skills?: string[];
  city?: string | null;
  salaryCurrency?: string | null;
  questions?: string[];
  viewCount?: number;
  expiresAt?: string | null;
};

export type ApplicationAiScores = {
  overall?: number | null;
  perAnswer?: { question: string; answer: string; score: number; reasoning: string }[];
  redFlags?: string[];
  summary?: string;
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
  applicantHeadline?: string | null;
  applicantExperienceYears?: number;
  applicantSkills?: string[];
  matchScore?: number | null;
  matchedSkills?: string[];
  answers?: string[];
  answersJson?: string;
  aiScoresJson?: string | null;
  aiScoreOverall?: number | null;
  rejectReason?: string | null;
  vacancyStatus?: VacancyStatus;
  vacancyExpiresAt?: string | null;
  labelKey?: ApplicationLabel | null;
  sourceTag?: string | null;
  aiWhyMatch?: string | null;
  snoozedUntil?: string | null;
};

export type ApplicationLabel = "SHORTLIST" | "INTERVIEW" | "HOLD" | "TOP_PICK";

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

// ── Pricing types ────────────────────────────────────────────────────

export type PlanKey = "FREE" | "PRO" | "AGENCY" | "PPHIRE";
export type SubscriptionStatus = "ACTIVE" | "CANCELED" | "PENDING";

export type TierKey = "DEFAULT" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

// ── Reviews ──────────────────────────────────────────────────────────

export type ReviewDirection = "CLIENT_TO_WORKER" | "WORKER_TO_CLIENT";

export type BuildReview = {
  id: string;
  projectId: string;
  reviewerId: string;
  revieweeId: string;
  direction: ReviewDirection;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt?: string;
  reviewerName?: string | null;
  revieweeName?: string | null;
  projectTitle?: string | null;
};

export type ReviewEligibilityRow = {
  projectId: string;
  projectTitle: string | null;
  revieweeId: string;
  revieweeName: string | null;
  direction: ReviewDirection;
};

export type BuildPlan = {
  key: PlanKey;
  name: string;
  tagline: string | null;
  priceMonthly: number;
  currency: string;
  vacancySlots: number;          // -1 = unlimited
  talentSearchPerMonth: number;  // -1 = unlimited
  boostsPerMonth: number;
  hireFeeBps: number;            // basis points (1200 = 12.00%)
  features: string[];
  sortOrder: number;
};

export type TrialTaskStatus = "PROPOSED" | "ACCEPTED" | "SUBMITTED" | "APPROVED" | "REJECTED";

export type BuildTrialTask = {
  id: string;
  applicationId: string;
  vacancyId: string;
  recruiterId: string;
  candidateId: string;
  title: string;
  description: string;
  paymentAmount: number;
  paymentCurrency: string;
  status: TrialTaskStatus;
  submissionUrl: string | null;
  submissionNote: string | null;
  rejectReason: string | null;
  payoutOrderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BuildBookmark = {
  id: string;
  userId: string;
  kind: "VACANCY" | "CANDIDATE";
  targetId: string;
  note: string | null;
  createdAt: string;
};

export type HydratedBookmark = BuildBookmark & {
  target: Record<string, unknown> | null;
};

export type BuildOrderRow = {
  id: string;
  userId: string;
  kind: "SUB_START" | "BOOST" | "TALENT_DAY_PASS" | "HIRE_FEE";
  ref: string | null;
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "CANCELED" | "REFUNDED";
  metaJson: string;
  createdAt: string;
};

export type BuildSubscription = {
  id: string;
  userId: string;
  planKey: PlanKey;
  status: SubscriptionStatus;
  startedAt: string;
  endsAt: string | null;
  createdAt: string;
  planName?: string;
  priceMonthly?: number;
  currency?: string;
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
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
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
    title?: string | null;
    summary?: string | null;
    skills?: string[];
    languages?: string[];
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string | null;
    availability?: string | null;
    experienceYears?: number;
    photoUrl?: string | null;
    openToWork?: boolean;
    certifications?: ResumeCertification[];
    portfolio?: ResumePortfolioItem[];
    achievements?: ResumeAchievement[];
    driversLicense?: string | null;
    shiftPreference?: ShiftPreference | null;
    availabilityType?: AvailabilityType | null;
    readyFromDate?: string | null;
    preferredLocations?: string[];
    toolsOwned?: string[];
    medicalCheckValid?: boolean;
    medicalCheckUntil?: string | null;
    safetyTrainingValid?: boolean;
    safetyTrainingUntil?: string | null;
    introVideoUrl?: string | null;
  }) => call<BuildProfile>("POST", "/api/build/profiles", input),
  getProfile: (userId: string) =>
    call<BuildResumeBundle>("GET", `/api/build/profiles/${encodeURIComponent(userId)}`, undefined, { auth: false }),
  searchProfiles: (q?: {
    q?: string;
    skill?: string;
    city?: string;
    role?: BuildRole;
    minExp?: number;
    openToWork?: boolean;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (q?.q) params.set("q", q.q);
    if (q?.skill) params.set("skill", q.skill);
    if (q?.city) params.set("city", q.city);
    if (q?.role) params.set("role", q.role);
    if (q?.minExp != null) params.set("minExp", String(q.minExp));
    if (q?.openToWork) params.set("openToWork", "1");
    if (q?.limit) params.set("limit", String(q.limit));
    const qs = params.toString();
    return call<{ items: TalentRow[]; total: number }>(
      "GET",
      `/api/build/profiles/search${qs ? "?" + qs : ""}`,
    );
  },
  addExperience: (input: {
    title: string;
    company: string;
    city?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    current?: boolean;
    description?: string | null;
  }) => call<BuildExperience>("POST", "/api/build/experiences", input),
  deleteExperience: (id: string) =>
    call<{ id: string; deleted: boolean }>("DELETE", `/api/build/experiences/${encodeURIComponent(id)}`),
  updateExperience: (
    id: string,
    input: Partial<{
      title: string;
      company: string;
      city: string | null;
      fromDate: string | null;
      toDate: string | null;
      current: boolean;
      description: string | null;
    }>,
  ) => call<BuildExperience>("PATCH", `/api/build/experiences/${encodeURIComponent(id)}`, input),
  addEducation: (input: {
    institution: string;
    degree?: string | null;
    field?: string | null;
    fromYear?: number | null;
    toYear?: number | null;
  }) => call<BuildEducation>("POST", "/api/build/education", input),
  deleteEducation: (id: string) =>
    call<{ id: string; deleted: boolean }>("DELETE", `/api/build/education/${encodeURIComponent(id)}`),

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
  salaryStats: (skill?: string) =>
    call<{ skill: string | null; avg: number; median: number; min: number; max: number; count: number }>(
      "GET",
      `/api/build/stats/salary${skill ? `?skill=${encodeURIComponent(skill)}` : ""}`,
      undefined,
      { auth: false },
    ),
  inviteCandidate: (vacancyId: string, email: string) =>
    call<{ invited: boolean; email: string }>(
      "POST", `/api/build/vacancies/${encodeURIComponent(vacancyId)}/invite`, { email },
    ),
  popularSkills: () =>
    call<{ items: { skill: string; count: number }[] }>(
      "GET", "/api/build/vacancies/skills/popular", undefined, { auth: false },
    ),
  projectAnalytics: (id: string) =>
    call<{
      vacancies: { total: number; open: number; closed: number; totalViews: number };
      applications: { total: number; accepted: number; pending: number; rejected: number; conversionRate: number };
      reviews: { avgRating: number; count: number };
    }>("GET", `/api/build/projects/${encodeURIComponent(id)}/analytics`),
  updateProject: (id: string, patch: Partial<{ title: string; description: string; budget: number; status: ProjectStatus; city: string | null }>) =>
    call<BuildProject>("PATCH", `/api/build/projects/${encodeURIComponent(id)}`, patch),

  // Vacancies
  listVacancies: (q?: {
    status?: VacancyStatus;
    projectStatus?: ProjectStatus;
    q?: string;
    city?: string;
    minSalary?: number;
    maxSalary?: number;
    currency?: string;
    skill?: string;
    sort?: "recent" | "salary" | "popular";
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (q?.status) params.set("status", q.status);
    if (q?.projectStatus) params.set("projectStatus", q.projectStatus);
    if (q?.q) params.set("q", q.q);
    if (q?.city) params.set("city", q.city);
    if (q?.minSalary != null) params.set("minSalary", String(q.minSalary));
    if (q?.maxSalary != null) params.set("maxSalary", String(q.maxSalary));
    if (q?.currency) params.set("currency", q.currency);
    if (q?.skill) params.set("skill", q.skill);
    if (q?.sort) params.set("sort", q.sort);
    if (q?.limit) params.set("limit", String(q.limit));
    const qs = params.toString();
    return call<{ items: (BuildVacancy & { projectCity?: string | null })[]; total: number }>(
      "GET",
      `/api/build/vacancies${qs ? "?" + qs : ""}`,
      undefined,
      { auth: false },
    );
  },
  createVacancy: (input: {
    projectId: string;
    title: string;
    description: string;
    salary?: number;
    skills?: string[];
    city?: string | null;
    salaryCurrency?: string;
    questions?: string[];
  }) => call<BuildVacancy>("POST", "/api/build/vacancies", input),
  vacanciesByProject: (projectId: string) =>
    call<{ items: BuildVacancy[]; total: number }>(
      "GET",
      `/api/build/vacancies/by-project/${encodeURIComponent(projectId)}`,
      undefined,
      { auth: false },
    ),
  getVacancy: (id: string) =>
    call<BuildVacancy>("GET", `/api/build/vacancies/${encodeURIComponent(id)}`, undefined, { auth: false }),
  updateVacancy: (id: string, status: VacancyStatus) =>
    call<BuildVacancy>("PATCH", `/api/build/vacancies/${encodeURIComponent(id)}`, { status }),
  myVacanciesFunnel: () =>
    call<{
      items: {
        id: string;
        title: string;
        status: VacancyStatus;
        salary: number;
        salaryCurrency: string | null;
        viewCount: number | null;
        createdAt: string;
        expiresAt: string | null;
        projectId: string;
        projectTitle: string;
        appsTotal: number;
        appsPending: number;
        appsAccepted: number;
        appsRejected: number;
        oldestPendingAt: string | null;
        avgResponseSeconds: number | null;
      }[];
      total: number;
    }>("GET", "/api/build/vacancies/mine/funnel"),
  similarVacancies: (vacancyId: string) =>
    call<{
      items: (BuildVacancy & {
        overlapCount: number;
        overlapSkills: string[];
        projectCity?: string | null;
      })[];
      total: number;
    }>(
      "GET",
      `/api/build/vacancies/${encodeURIComponent(vacancyId)}/similar`,
      undefined,
      { auth: false },
    ),
  bulkCreateVacancies: (input: {
    projectId: string;
    rows: { title: string; description: string; salary?: number; city?: string; skills?: string | string[]; salaryCurrency?: string }[];
  }) =>
    call<{
      created: number;
      items: { id: string; title: string }[];
      errors: { index: number; error: string }[];
    }>("POST", "/api/build/vacancies/bulk", input),
  vacancyHistory: (id: string) =>
    call<{
      items: {
        id: string;
        editorId: string;
        editorName: string | null;
        createdAt: string;
        changes: Record<string, { before: unknown; after: unknown }>;
      }[];
      total: number;
    }>("GET", `/api/build/vacancies/${encodeURIComponent(id)}/history`),
  patchVacancy: (id: string, fields: Partial<{ status: VacancyStatus; title: string; description: string; salary: number }>) =>
    call<BuildVacancy>("PATCH", `/api/build/vacancies/${encodeURIComponent(id)}`, fields),
  listVacancyTemplates: () =>
    call<{
      items: {
        id: string;
        name: string;
        title: string;
        description: string;
        skills: string[];
        salary: number;
        salaryCurrency: string | null;
        city: string | null;
        questions: string[];
        createdAt: string;
      }[];
      total: number;
    }>("GET", "/api/build/vacancies/templates"),
  saveVacancyTemplate: (input: {
    name: string;
    title: string;
    description: string;
    skills?: string[];
    salary?: number;
    salaryCurrency?: string | null;
    city?: string | null;
    questions?: string[];
  }) =>
    call<{ id: string; name: string }>(
      "POST",
      "/api/build/vacancies/templates",
      input,
    ),
  deleteVacancyTemplate: (id: string) =>
    call<{ id: string }>(
      "DELETE",
      `/api/build/vacancies/templates/${encodeURIComponent(id)}`,
    ),
  deleteVacancy: (id: string) =>
    call<{ id: string }>(
      "DELETE",
      `/api/build/vacancies/${encodeURIComponent(id)}`,
    ),
  duplicateVacancy: (id: string, targetProjectId: string) =>
    call<BuildVacancy>(
      "POST",
      `/api/build/vacancies/${encodeURIComponent(id)}/duplicate`,
      { projectId: targetProjectId },
    ),
  republishVacancy: (id: string) =>
    call<BuildVacancy>(
      "POST",
      `/api/build/vacancies/${encodeURIComponent(id)}/republish`,
    ),
  vacancyTimeline: (id: string) =>
    call<{
      events: {
        kind:
          | "VACANCY_CREATED"
          | "BOOST_STARTED"
          | "BOOST_ENDED"
          | "APPLICATION_RECEIVED"
          | "APPLICATION_ACCEPTED"
          | "APPLICATION_REJECTED"
          | "HIRE_FEE";
        ts: string;
        title: string;
        meta?: Record<string, unknown>;
      }[];
      total: number;
    }>("GET", `/api/build/vacancies/${encodeURIComponent(id)}/timeline`),

  // Notification preferences
  getNotificationPrefs: () =>
    call<{
      jobAlerts: boolean;
      applicationEmail: boolean;
      weeklyDigest: boolean;
      marketing: boolean;
      updatedAt?: string;
    }>("GET", "/api/build/settings/notifications"),
  setNotificationPrefs: (input: Partial<{
    jobAlerts: boolean;
    applicationEmail: boolean;
    weeklyDigest: boolean;
    marketing: boolean;
  }>) =>
    call<{
      jobAlerts: boolean;
      applicationEmail: boolean;
      weeklyDigest: boolean;
      marketing: boolean;
      updatedAt: string;
    }>("PUT", "/api/build/settings/notifications", input),
  matchCandidates: (vacancyId: string) =>
    call<{
      items: (TalentRow & { matchScore: number; matchedSkills: string[] })[];
      total: number;
      requiredSkills: string[];
      note?: string;
    }>("GET", `/api/build/vacancies/${encodeURIComponent(vacancyId)}/match-candidates`),
  boostVacancy: (id: string, days = 7) =>
    call<{
      boost: { id: string; vacancyId: string; endsAt: string; source: "PLAN" | "PAID" };
      orderId: string | null;
      source: "PLAN" | "PAID";
    }>("POST", `/api/build/vacancies/${encodeURIComponent(id)}/boost`, { days }),

  // Applications
  apply: (input: {
    vacancyId: string;
    message?: string;
    answers?: string[];
    referredByUserId?: string;
    sourceTag?: string;
  }) => call<BuildApplication>("POST", "/api/build/applications", input),
  applyVacancy: (input: { vacancyId: string; message?: string; sourceTag?: string; referredByUserId?: string }) =>
    call<BuildApplication>("POST", "/api/build/applications", input),
  myApplications: () => call<{ items: BuildApplication[]; total: number }>("GET", "/api/build/applications/my"),
  applicationsByVacancy: (vacancyId: string) =>
    call<{ items: BuildApplication[]; total: number }>(
      "GET",
      `/api/build/applications/by-vacancy/${encodeURIComponent(vacancyId)}`,
    ),
  updateApplication: (id: string, status: ApplicationStatus, rejectReason?: string) =>
    call<BuildApplication & { hireOrder: BuildOrderRow | null }>(
      "PATCH",
      `/api/build/applications/${encodeURIComponent(id)}`,
      { status, ...(rejectReason ? { rejectReason } : {}) },
    ),
  snoozeApplication: (id: string, days: number) =>
    call<{ snoozedUntil: string | null }>(
      "POST",
      `/api/build/applications/${encodeURIComponent(id)}/snooze`,
      { days },
    ),
  flagApplication: (id: string, reason: string, note?: string) =>
    call<{ id: string }>(
      "POST",
      `/api/build/applications/${encodeURIComponent(id)}/flag`,
      { reason, ...(note ? { note } : {}) },
    ),
  adminListFlags: (status: "open" | "dismissed" | "actioned" = "open") =>
    call<{
      items: {
        id: string;
        applicationId: string;
        reporterUserId: string;
        reason: string;
        note: string | null;
        status: string;
        createdAt: string;
        resolvedAt: string | null;
        resolvedBy: string | null;
        reporterName: string | null;
        candidateId: string | null;
        candidateName: string | null;
        vacancyId: string | null;
        vacancyTitle: string | null;
      }[];
      total: number;
    }>("GET", `/api/build/admin/flags?status=${encodeURIComponent(status)}`),
  adminResolveFlag: (id: string, status: "dismissed" | "actioned") =>
    call<{ id: string; status: string }>(
      "PATCH",
      `/api/build/admin/flags/${encodeURIComponent(id)}`,
      { status },
    ),
  withdrawApplication: (id: string) =>
    call<BuildApplication>(
      "POST",
      `/api/build/applications/${encodeURIComponent(id)}/withdraw`,
    ),
  bulkUpdateApplicationStatus: (
    ids: string[],
    status: "ACCEPTED" | "REJECTED",
    rejectReason?: string,
  ) =>
    call<{ updated: number; skipped: string[]; status: string }>(
      "POST",
      "/api/build/applications/bulk-status",
      { ids, status, ...(rejectReason ? { rejectReason } : {}) },
    ),
  setApplicationLabel: (id: string, labelKey: ApplicationLabel | null) =>
    call<BuildApplication>(
      "PATCH",
      `/api/build/applications/${encodeURIComponent(id)}/label`,
      { labelKey },
    ),
  listBulkTemplates: () =>
    call<{
      items: { id: string; name: string; body: string; createdAt: string }[];
      total: number;
    }>("GET", "/api/build/bulk-templates"),
  saveBulkTemplate: (input: { name: string; body: string }) =>
    call<{ id: string; name: string; body: string; createdAt: string }>(
      "POST",
      "/api/build/bulk-templates",
      input,
    ),
  deleteBulkTemplate: (id: string) =>
    call<{ id: string }>(
      "DELETE",
      `/api/build/bulk-templates/${encodeURIComponent(id)}`,
    ),
  bulkMessageApplicants: (vacancyId: string, content: string, status: "PENDING" | "ACCEPTED" | "REJECTED" | "ALL" = "PENDING") =>
    call<{ sent: number; recipients: string[] }>(
      "POST",
      `/api/build/applications/bulk-message/${encodeURIComponent(vacancyId)}`,
      { content, status },
    ),
  applicationNotes: (id: string) =>
    call<{
      items: { id: string; applicationId: string; authorUserId: string; body: string; isPinned: boolean; createdAt: string }[];
      total: number;
    }>("GET", `/api/build/applications/${encodeURIComponent(id)}/notes`),
  addApplicationNote: (id: string, body: string) =>
    call<{ id: string; applicationId: string; authorUserId: string; body: string; isPinned: boolean; createdAt: string }>(
      "POST",
      `/api/build/applications/${encodeURIComponent(id)}/notes`,
      { body },
    ),
  pinApplicationNote: (id: string, noteId: string, isPinned: boolean) =>
    call<{ id: string; isPinned: boolean }>(
      "PATCH",
      `/api/build/applications/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`,
      { isPinned },
    ),
  deleteApplicationNote: (id: string, noteId: string) =>
    call<{ id: string }>(
      "DELETE",
      `/api/build/applications/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`,
    ),

  // Messages
  inbox: () => call<{ items: BuildInboxRow[]; total: number }>("GET", "/api/build/messages"),
  thread: (peerUserId: string) =>
    call<{ items: BuildMessage[]; total: number }>(
      "GET",
      `/api/build/messages/${encodeURIComponent(peerUserId)}`,
    ),
  send: (input: { receiverId: string; content: string }) =>
    call<BuildMessage>("POST", "/api/build/messages", input),

  // Bookmarks
  toggleBookmark: (input: { kind: "VACANCY" | "CANDIDATE"; targetId: string; note?: string | null }) =>
    call<{ saved: boolean; bookmark?: BuildBookmark; removed?: string }>(
      "POST",
      "/api/build/bookmarks",
      input,
    ),
  listBookmarks: (kind?: "VACANCY" | "CANDIDATE") => {
    const qs = kind ? `?kind=${kind}` : "";
    return call<{ items: HydratedBookmark[]; total: number }>(
      "GET",
      `/api/build/bookmarks${qs}`,
    );
  },

  // AI surfaces
  aiConsult: (messages: { role: "user" | "assistant"; content: string }[]) =>
    call<{
      reply: string;
      usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
    }>("POST", "/api/build/ai/consult", { messages }),
  aiParseResume: (input: { text: string } | { imageBase64: string; imageMediaType: string }) =>
    call<{
      parsed: Record<string, unknown>;
      usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
    }>("POST", "/api/build/ai/parse-resume", input),
  aiImproveText: (input: {
    text: string;
    kind?: "summary" | "vacancy_description" | "cover_note" | "experience" | "generic";
    locale?: string;
  }) =>
    call<{
      improved: string;
      usage: { input: number; output: number };
    }>("POST", "/api/build/ai/improve-text", input),
  aiInterviewPrep: (applicationId: string) =>
    call<{
      questions: { q: string; hint: string }[];
      skillOverlap: string[];
      missingSkills: string[];
      usage: { input: number; output: number };
    }>("POST", "/api/build/ai/interview-prep", { applicationId }),
  aiTranslateVacancy: (input: {
    title: string;
    description: string;
    targetLocales?: ("ru" | "en" | "kz")[];
  }) =>
    call<{
      translations: Record<string, { title: string; description: string }>;
      usage: { input: number; output: number };
    }>("POST", "/api/build/ai/translate-vacancy", input),
  aiShortlist: (vacancyId: string) =>
    call<{
      items: { applicationId: string; rank: number; reasoning: string }[];
      summary: string;
      total: number;
      usage: { input: number; output: number };
    }>("POST", "/api/build/ai/shortlist", { vacancyId }),
  aiCoverLetter: (input: { vacancyId: string; locale?: "ru" | "en" | "kz" }) =>
    call<{
      coverLetter: string;
      skillsOverlap: string[];
      usage: { input: number; output: number };
    }>("POST", "/api/build/ai/cover-letter", input),
  aiWhyMatch: (applicationId: string, force = false) =>
    call<{
      explanation: string;
      cached: boolean;
      skillsOverlap?: string[];
      skillsMissing?: string[];
      usage?: { input: number; output: number };
    }>("POST", "/api/build/ai/why-match", { applicationId, force }),
  loyaltyMe: () =>
    call<{
      hires: number;
      tier: {
        key: TierKey;
        label: string;
        hireFeeBps: number;
        hireFeePct: number;
        cashbackBps: number;
        cashbackPct: number;
        subDiscountBps: number;
        subDiscountPct: number;
        boostSlotsBonus: number;
        perks: string[];
      };
      next: {
        key: TierKey;
        label: string;
        minHires: number;
        hireFeeBps: number;
        hireFeePct: number;
        cashbackBps: number;
        subDiscountBps: number;
        hiresToNext: number;
        progressPct: number;
      } | null;
      // Backward-compat top-level fields (deprecated — read tier.* instead)
      hireFeeBps: number;
      hireFeePct: number;
      cashbackBps: number;
      cashbackPct: number;
      nextTierAt: number | null;
      nextTierBps: number | null;
      tiers: { key: TierKey; atHires: number; bps: number; label: string }[];
    }>("GET", "/api/build/loyalty/me"),
  // Reviews
  submitReview: (input: {
    projectId: string;
    revieweeId: string;
    rating: number;
    comment?: string | null;
  }) => call<BuildReview>("POST", "/api/build/reviews", input),
  createReview: (input: {
    projectId: string;
    revieweeId: string;
    rating: number;
    comment?: string | null;
  }) => call<BuildReview>("POST", "/api/build/reviews", input),
  reviewsByUser: (userId: string, limit = 50, offset = 0) =>
    call<{
      items: BuildReview[];
      total: number;
      avgRating: number;
      limit: number;
      offset: number;
    }>(
      "GET",
      `/api/build/reviews/by-user/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`,
      undefined,
      { auth: false },
    ),
  reviewsByProject: (projectId: string) =>
    call<{ items: BuildReview[]; total: number }>(
      "GET",
      `/api/build/reviews/by-project/${encodeURIComponent(projectId)}`,
      undefined,
      { auth: false },
    ),
  eligibleReviews: () =>
    call<{ items: ReviewEligibilityRow[]; total: number }>(
      "GET",
      "/api/build/reviews/eligible",
    ),
  loyaltyTiers: () =>
    call<{
      items: {
        key: TierKey;
        label: string;
        minHires: number;
        hireFeeBps: number;
        hireFeePct: number;
        cashbackBps: number;
        cashbackPct: number;
        subDiscountBps: number;
        subDiscountPct: number;
        boostSlotsBonus: number;
        perks: string[];
      }[];
    }>("GET", "/api/build/loyalty/tiers", undefined, { auth: false }),
  submitLead: (input: {
    email: string;
    city?: string;
    locale?: string;
    source?: string;
    referrer?: string;
    utmSource?: string;
    utmCampaign?: string;
  }) =>
    call<{ alreadyExists: boolean }>(
      "POST",
      "/api/build/leads",
      input,
      { auth: false },
    ),
  adminLeads: (q?: { q?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    if (q?.q) sp.set("q", q.q);
    if (q?.limit != null) sp.set("limit", String(q.limit));
    if (q?.offset != null) sp.set("offset", String(q.offset));
    const qs = sp.toString();
    return call<{
      items: {
        id: string;
        email: string;
        city: string | null;
        locale: string;
        source: string;
        referrer: string | null;
        utmSource: string | null;
        utmCampaign: string | null;
        createdAt: string;
      }[];
      total: number;
      limit: number;
      offset: number;
    }>("GET", `/api/build/admin/leads${qs ? `?${qs}` : ""}`);
  },
  claimCashback: (deviceId: string) =>
    call<{ claimedAev: number; claimedRows: number; deviceId?: string }>(
      "POST",
      "/api/build/loyalty/cashback/claim",
      { deviceId },
    ),
  referralLeaderboard: (limit = 20) =>
    call<{
      items: {
        userId: string;
        name: string | null;
        totalReferred: number;
        acceptedReferred: number;
      }[];
      limit: number;
    }>(
      "GET",
      `/api/build/referrals/leaderboard?limit=${limit}`,
      undefined,
      { auth: false },
    ),
  myReferrals: () =>
    call<{
      totalReferred: number;
      acceptedReferred: number;
      recent: {
        id: string;
        status: string;
        createdAt: string;
        vacancyTitle: string | null;
        applicantName: string | null;
      }[];
    }>("GET", "/api/build/referrals/me"),
  // Job alerts
  myAlert: () =>
    call<{ alert: { id: string; keywords: string; skills: string; city: string | null; active: boolean } | null }>(
      "GET", "/api/build/alerts/me",
    ),
  upsertAlert: (input: { keywords?: string; skills?: string; city?: string }) =>
    call<{ alert: { id: string; keywords: string; skills: string; city: string | null; active: boolean } }>(
      "POST", "/api/build/alerts", input,
    ),
  deleteAlert: () => call<{ unsubscribed: boolean }>("DELETE", "/api/build/alerts/me"),

  // Verification
  myVerification: () =>
    call<{ request: { id: string; status: string; note: string | null; adminNote: string | null } | null }>(
      "GET", "/api/build/verification/my",
    ),
  requestVerification: (note?: string) =>
    call<{ request: { id: string; status: string } }>("POST", "/api/build/verification/request", { note }),

  publicStats: () =>
    call<{ vacancies: number; candidates: number; projects: number }>(
      "GET",
      "/api/build/health",
      undefined,
      { auth: false },
    ),
  buildStats: () =>
    call<{
      vacancies: { open: number; total: number };
      candidates: number;
      projects: { total: number; open: number };
      applications: { total: number; accepted: number; acceptRate: number };
      trials: { total: number; approved: number };
      cashback: { totalAev: number; entries: number };
      timestamp: string;
    }>("GET", "/api/build/stats", undefined, { auth: false }),
  liveActivity: () =>
    call<{
      items: { kind: "VACANCY" | "APPLICATION" | "HIRE"; title: string; city: string | null; at: string }[];
      total: number;
    }>("GET", "/api/build/stats/activity", undefined, { auth: false }),
  buildStatsTimeseries: () =>
    call<{
      vacancies: { day: string; n: number }[];
      applications: { day: string; n: number }[];
      projects: { day: string; n: number }[];
    }>("GET", "/api/build/stats/timeseries", undefined, { auth: false }),
  exportAll: () =>
    call<{
      generatedAt: string;
      ownerUserId: string;
      counts: { projects: number; vacancies: number; applications: number; reviews: number };
      datasets: {
        projects: Record<string, unknown>[];
        vacancies: Record<string, unknown>[];
        applications: Record<string, unknown>[];
        reviews: Record<string, unknown>[];
      };
    }>("GET", "/api/build/stats/export/all"),
  featuredEmployers: () =>
    call<{
      items: {
        userId: string;
        name: string | null;
        title: string | null;
        city: string | null;
        photoUrl: string | null;
        verifiedAt: string | null;
        hires: number;
        openVacancies: number;
        avgRating: number;
        reviewCount: number;
      }[];
      total: number;
    }>("GET", "/api/build/stats/featured-employers", undefined, { auth: false }),
  rejectReasonsBreakdown: (days = 90) =>
    call<{
      days: number;
      total: number;
      buckets: {
        overqualified: number;
        "missing-skill": number;
        "salary-mismatch": number;
        location: number;
        timing: number;
        other: number;
        unspecified: number;
      };
    }>("GET", `/api/build/stats/reject-reasons?days=${encodeURIComponent(String(days))}`),
  recruiterSourceBreakdown: (opts: { days?: number; vacancyId?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.days != null) params.set("days", String(opts.days));
    if (opts.vacancyId) params.set("vacancyId", opts.vacancyId);
    const qs = params.toString();
    return call<{
      days: number;
      total: number;
      buckets: {
        organic: { count: number; details: { tag: string; count: number }[] };
        utm: { count: number; details: { tag: string; count: number }[] };
        ref: { count: number; details: { tag: string; count: number }[] };
        widget: { count: number; details: { tag: string; count: number }[] };
        other: { count: number; details: { tag: string; count: number }[] };
      };
    }>("GET", `/api/build/stats/sources${qs ? "?" + qs : ""}`);
  },
  adminListPartnerKeys: () =>
    call<{
      items: {
        id: string;
        label: string;
        scopesJson: string;
        ownerUserId: string | null;
        lastUsedAt: string | null;
        usageCount: number;
        revokedAt: string | null;
        createdAt: string;
      }[];
      total: number;
    }>("GET", "/api/build/admin/partner-keys"),
  adminCreatePartnerKey: (label: string) =>
    call<{
      id: string;
      label: string;
      plaintext: string;
      createdAt: string;
    }>("POST", "/api/build/admin/partner-keys", { label }),
  adminRevokePartnerKey: (id: string) =>
    call<{ id: string; revokedAt: string }>(
      "POST",
      `/api/build/admin/partner-keys/${encodeURIComponent(id)}/revoke`,
    ),
  adminStats: () =>
    call<{
      leads: { total: number; last7d: number };
      paidOrders: { count: number; totalAmount: number };
      cashback: { totalAev: number; claimedAev: number };
      users: { total: number };
    }>("GET", "/api/build/admin/stats"),
  loyaltyCashback: () =>
    call<{
      totalAev: number;
      entries: number;
      cashbackBps: number;
      ledger: {
        id: string;
        orderId: string;
        orderKind: string;
        orderAmount: number;
        orderCurrency: string;
        cashbackAev: number;
        createdAt: string;
      }[];
    }>("GET", "/api/build/loyalty/cashback"),

    // Trial tasks
  proposeTrialTask: (input: {
    applicationId: string;
    title: string;
    description: string;
    paymentAmount?: number;
    paymentCurrency?: string;
  }) => call<BuildTrialTask>("POST", "/api/build/trial-tasks", input),
  acceptTrialTask: (id: string) =>
    call<BuildTrialTask>("POST", `/api/build/trial-tasks/${encodeURIComponent(id)}/accept`),
  submitTrialTask: (id: string, input: { submissionUrl?: string | null; submissionNote?: string | null }) =>
    call<BuildTrialTask>("POST", `/api/build/trial-tasks/${encodeURIComponent(id)}/submit`, input),
  approveTrialTask: (id: string) =>
    call<{ trialTask: BuildTrialTask; payoutOrderId: string; payoutStatus: string }>(
      "POST",
      `/api/build/trial-tasks/${encodeURIComponent(id)}/approve`,
    ),
  rejectTrialTask: (id: string, reason?: string) =>
    call<BuildTrialTask>("POST", `/api/build/trial-tasks/${encodeURIComponent(id)}/reject`, { reason }),
  trialTasksByApplication: (applicationId: string) =>
    call<{ items: BuildTrialTask[]; total: number }>(
      "GET",
      `/api/build/trial-tasks/by-application/${encodeURIComponent(applicationId)}`,
    ),
  myTrialTasks: () =>
    call<{ items: (BuildTrialTask & { vacancyTitle?: string; projectTitle?: string })[]; total: number }>(
      "GET",
      "/api/build/trial-tasks/my",
    ),

  // Plan usage
  myUsage: () =>
    call<{
      plan: BuildPlan;
      usage: { userId: string; monthKey: string; talentSearches: number; boostsUsed: number };
      monthKey: string;
      activeVacancies: number;
      limits: {
        vacanciesRemaining: number;
        talentSearchesRemaining: number;
        boostsRemaining: number;
      };
    }>("GET", "/api/build/usage/me"),

  // Pricing
  listPlans: () =>
    call<{ items: BuildPlan[]; total: number }>("GET", "/api/build/plans", undefined, { auth: false }),
  mySubscription: () =>
    call<{ subscription: BuildSubscription | null }>("GET", "/api/build/subscriptions/me"),
  startSubscription: (planKey: PlanKey) =>
    call<{ subscription: BuildSubscription; order: { id: string; status: string; amount: number; currency: string } }>(
      "POST",
      "/api/build/subscriptions/start",
      { planKey },
    ),
  myOrders: () =>
    call<{ items: BuildOrderRow[]; total: number }>("GET", "/api/build/orders/me"),
  payOrder: (id: string) =>
    call<{ order: BuildOrderRow; alreadyPaid?: boolean }>(
      "POST",
      `/api/build/orders/${encodeURIComponent(id)}/pay`,
    ),

  // Notifications
  notifySummary: () =>
    call<{
      unreadMessages: number;
      pendingApplications: number;
      applicationUpdates: number;
      total: number;
    }>("GET", "/api/build/notifications/summary"),
  notificationsRead: (senderId: string) =>
    call<{ markedRead: number }>("POST", "/api/build/notifications/read", { senderId }),

  notifications: () =>
    call<{
      items: {
        id: string;
        kind: string;
        title: string;
        body: string;
        href: string;
        read: boolean;
        at: string;
      }[];
      total: number;
    }>("GET", "/api/build/notifications"),

  markNotificationsRead: () =>
    call<{ marked: boolean }>("POST", "/api/build/notifications/mark-read"),

  changePassword: (current: string, next: string) =>
    call<{ changed: boolean }>("PATCH", "/api/build/users/me/password", { current, next }),

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
