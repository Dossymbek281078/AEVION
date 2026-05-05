"use client";

import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "./auth";

// ── Domain types ─────────────────────────────────────────────────────

export type BuildRole = "CLIENT" | "CONTRACTOR" | "WORKER" | "ADMIN";

export type AiVacancyDraft = {
  title: string;
  description: string;
  skills: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  questions?: string[];
  tasks?: string[];
  requirements?: string[];
};

export type BuildStory = {
  id: string;
  userId: string;
  text: string;
  content?: string;
  mediaUrl: string | null;
  likeCount: number;
  likedByMe: boolean;
  authorName: string | null;
  userName?: string | null;
  authorRole: string | null;
  userRole?: string | null;
  userPhoto?: string | null;
  userTier?: string | null;
  userCity?: string | null;
  userSpecialty?: string | null;
  mediaType?: string | null;
  createdAt: string;
  expiresAt?: string | null;
};

export type PaymentEventStatus = "DUE" | "PAID" | "OVERDUE" | "CANCELLED" | "CANCELED" | "PENDING";

export type BuildPaymentEvent = {
  id: string;
  projectId: string | null;
  projectTitle: string | null;
  payerId: string | null;
  payeeId: string | null;
  amount: number;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  status: PaymentEventStatus;
  note: string | null;
  createdAt: string;
  applicationId?: string | null;
  vacancyTitle?: string | null;
  payerName?: string | null;
  payeeName?: string | null;
  clientId?: string | null;
  workerId?: string | null;
};

export type LeaderboardRow = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  photoUrl?: string | null;
  score: number;
  tier: string;
  kind: "employer" | "worker";
  rating?: number;
  projectCount?: number;
  hireCount?: number;
  completedProjects?: number;
  averageRating?: number;
  avgRating?: number;
  reviewCount?: number;
  totalEarned?: number;
  hires?: number;
  tierKey?: string;
  tierLabel?: string;
  trialsApproved?: number;
  jobsDone?: number;
  workerScore?: number;
  title?: string | null;
  city?: string | null;
  specialty?: string | null;
};
export type ProjectStatus = "OPEN" | "IN_PROGRESS" | "DONE";
export type VacancyStatus = "OPEN" | "CLOSED";
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
  iin?: string | null;
  bin?: string | null;
  bankAccount?: string | null;
  taxId?: string | null;
  tier?: string | null;
  referralCode?: string | null;
  loyaltyPoints?: number;
  buildScore?: number;
  locale?: "ru" | "en" | "kz" | null;
  timezone?: string | null;
  notifyOnNewApplicant?: boolean;
  notifyOnApplicationUpdate?: boolean;
  notifyOnMessage?: boolean;
  notifyOnShiftReminder?: boolean;
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
    iin?: string | null;
    bin?: string | null;
    bankAccount?: string | null;
    taxId?: string | null;
    locale?: "ru" | "en" | "kz" | null;
    timezone?: string | null;
    notifyOnNewApplicant?: boolean;
    notifyOnApplicationUpdate?: boolean;
    notifyOnMessage?: boolean;
    notifyOnShiftReminder?: boolean;
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
  updateProject: (id: string, patch: Partial<{ title: string; description: string; budget: number; status: ProjectStatus; city: string | null }>) =>
    call<BuildProject>("PATCH", `/api/build/projects/${encodeURIComponent(id)}`, patch),

  // Vacancies
  listVacancies: (q?: {
    status?: VacancyStatus;
    projectStatus?: ProjectStatus;
    q?: string;
    city?: string;
    minSalary?: number;
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
  patchVacancy: (id: string, fields: Partial<{ status: VacancyStatus; title: string; description: string; salary: number }>) =>
    call<BuildVacancy>("PATCH", `/api/build/vacancies/${encodeURIComponent(id)}`, fields),
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
  }) => call<BuildApplication>("POST", "/api/build/applications", input),
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

  // Team requests
  applyToTeam: (id: string, roleIndex: number, message?: string) =>
    call<{ id: string; status: string }>("POST", `/api/build/team-requests/${id}/apply`, { roleIndex, message }),
  teamRequests: (q?: { vacancyId?: string; status?: string; limit?: number }) =>
    call<{ items: Array<{ id: string; title: string; description: string; rolesJson: string; city: string | null; clientName: string | null; applicantCount: number; createdAt: string }>; total: number }>("GET", `/api/build/team-requests${q ? `?${new URLSearchParams(Object.fromEntries(Object.entries(q).filter(([,v])=>v!=null)) as Record<string,string>)}` : ""}`),
  teamRequest: (id: string) =>
    call<{ id: string; title: string; description: string; roles: Array<{ specialty: string; count: number; salary: number | null }>; city: string | null; clientName: string | null; applications: Array<{ id: string; userId: string; roleIndex: number; message: string | null; status: string; applicantName: string | null }>; createdAt: string }>("GET", `/api/build/team-requests/${id}`),
  createTeamRequest: (input: { title: string; description: string; roles: Array<{ specialty: string; count: number; salary?: number | null }>; city?: string; startDate?: string }) =>
    call<{ id: string; title: string; status: string }>("POST", "/api/build/team-requests", input),

  // Available workers & shifts
  availableWorkers: (q?: { skill?: string; city?: string; specialty?: string; limit?: number; offset?: number }) =>
    call<{ items: unknown[]; total: number; asOf?: string }>("GET", `/api/build/workers/available${q ? `?${new URLSearchParams(Object.fromEntries(Object.entries(q).filter(([,v])=>v!=null)) as Record<string,string>)}` : ""}`),
  setAvailability: (available: boolean, hours?: number) =>
    call<{ updated: boolean; availableNow?: boolean; availableUntil?: string | null }>("PATCH", "/api/build/workers/availability", { available, hours }),
  myAvailability: () =>
    call<{ available: boolean; availableNow?: boolean; skills: string[]; city: string | null; availableUntil?: string | null }>("GET", "/api/build/workers/my-availability"),
  myShifts: () =>
    call<{ items: Array<{ id: string; applicationId: string; workerId: string; clientId: string; shiftDate: string; startTime: string | null; endTime: string | null; status: string; checkInAt: string | null; checkOutAt: string | null; workerName: string | null; clientName: string | null }>; total: number }>("GET", "/api/build/shifts/me"),
  shiftCheckin: (shiftId: string, lat?: number, lng?: number) =>
    call<{ checkedIn: boolean }>("POST", `/api/build/shifts/${shiftId}/checkin`, { lat, lng }),
  shiftCheckout: (shiftId: string, lat?: number, lng?: number) =>
    call<{ checkedOut: boolean }>("POST", `/api/build/shifts/${shiftId}/checkout`, { lat, lng }),

  // Stories
  storiesFeed: (q?: { limit?: number }) =>
    call<{ items: BuildStory[] }>("GET", `/api/build/stories${q?.limit ? `?limit=${q.limit}` : ""}`),
  createStory: (input: { text?: string; content?: string; mediaUrl?: string | null; mediaType?: string | null }) =>
    call<BuildStory>("POST", "/api/build/stories", input),
  toggleStoryLike: (storyId: string) =>
    call<{ liked: boolean; likes: number; likeCount: number }>("POST", `/api/build/stories/${storyId}/like`, {}),

  // Communities
  communities: () =>
    call<{ items: Array<{ id: string; slug: string; name: string; specialty: string; description: string | null; memberCount: number; lastMessageAt: string | null }> }>("GET", "/api/build/communities"),
  community: (id: string) =>
    call<{ community: { id: string; slug: string; name: string; specialty: string; description: string | null; memberCount: number; joined?: boolean }; messages: Array<{ id: string; userId: string; content: string; createdAt: string; authorName: string | null; authorPhoto: string | null; buildRole: string | null }> }>("GET", `/api/build/communities/${id}`),
  joinCommunity: (id: string) =>
    call<{ joined: boolean }>("POST", `/api/build/communities/${id}/join`, {}),
  sendCommunityMessage: (id: string, text: string) =>
    call<{ id: string; text: string; createdAt: string }>("POST", `/api/build/communities/${id}/messages`, { text }),

  // Video rooms
  createVideoRoom: (input: { title?: string; maxParticipants?: number; guestId?: string; scheduledAt?: string }) =>
    call<{ id: string; roomUrl: string; hostId: string; guestId: string | null; scheduledAt: string | null; status: string; hostName: string | null; guestName: string | null; createdAt: string }>("POST", "/api/build/video-rooms", input),
  myVideoRooms: () =>
    call<{ items: Array<{ id: string; roomUrl: string; hostId: string; guestId: string | null; scheduledAt: string | null; status: string; hostName: string | null; guestName: string | null; createdAt: string }> }>("GET", "/api/build/video-rooms/me"),
  inviteToVideoRoom: (roomId: string, userId: string) =>
    call<{ invited: boolean }>("POST", `/api/build/video-rooms/${roomId}/invite`, { userId }),

  // Push notifications
  pushPublicKey: () =>
    call<{ publicKey: string }>("GET", "/api/build/push/public-key", undefined, { auth: false }),
  registerPushSubscription: (subscription: object) =>
    call<{ registered: boolean }>("POST", "/api/build/push/subscribe", { subscription }),
  pushSubscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    call<{ subscribed: boolean }>("POST", "/api/build/push/subscribe", sub),
  pushUnsubscribe: (endpoint: string) =>
    call<{ unsubscribed: boolean }>("POST", "/api/build/push/unsubscribe", { endpoint }),
  pushTest: () =>
    call<{ sent: boolean }>("POST", "/api/build/push/test", {}),

  // Safety briefing
  safetyTemplate: () =>
    call<{ items: string[] }>("GET", "/api/build/safety/template", undefined, { auth: false }),
  signSafetyBriefing: (shiftId: string, checkedItemIds: string[]) =>
    call<{ signed: boolean; signedAt: string }>("POST", `/api/build/shifts/${shiftId}/safety-briefing`, { checkedItemIds }),

  // Quick apply
  quickApply: (input: { vacancyId: string; referredByUserId?: string | null }) =>
    call<{ applicationId: string; status: string }>("POST", "/api/build/quick-apply", input),

  // AI tools
  aiGenerateVacancy: (input: { brief: string; city?: string | null }) =>
    call<{ draft: AiVacancyDraft }>("POST", "/api/build/ai/generate-vacancy", input),
  aiMatchVacancy: (input: { profileText: string; vacancyText: string }) =>
    call<{
      match: { score: number; label: string; strengths: string[]; gaps: string[]; tip: string };
      usage: { input: number; output: number };
    }>("POST", "/api/build/ai/match-vacancy", input),
  aiCoverLetter: (input: { profileText: string; vacancyText: string; tone?: "professional" | "friendly" | "concise" }) =>
    call<{ coverLetter: string; usage: { input: number; output: number } }>(
      "POST", "/api/build/ai/cover-letter", input
    ),

  // Payment calendar
  myPaymentCalendar: () =>
    call<{ items: BuildPaymentEvent[]; summary: { due: number; paid: number; overdue: number } }>("GET", "/api/build/payment-calendar"),
  updatePaymentEvent: (id: string, patch: { status?: PaymentEventStatus; paidAt?: string | null; note?: string | null }) =>
    call<BuildPaymentEvent>("PATCH", `/api/build/payment-calendar/${id}`, patch),

  // Leaderboard
  leaderboard: (kind: "employer" | "worker", limit = 30) =>
    call<{ items: LeaderboardRow[] }>("GET", `/api/build/leaderboard?kind=${kind}&limit=${limit}`),

  // Documents — verification workflow
  uploadDocument: (input: { fileUrl: string; docType: string }) =>
    call<{ id: string; status: string; docType: string; fileUrl: string; createdAt: string }>(
      "POST", "/api/build/documents", input
    ),
  myDocuments: () =>
    call<{ items: Array<{ id: string; docType: string; status: string; fileUrl: string; verifiedAt: string | null; rejectReason: string | null; createdAt: string }>; total: number }>(
      "GET", "/api/build/documents/me"
    ),
  adminPendingDocuments: () =>
    call<{ items: Array<{ id: string; userId: string; docType: string; fileUrl: string; status: string; userName: string; userEmail: string; createdAt: string }>; total: number }>(
      "GET", "/api/build/documents/admin/pending"
    ),
  verifyDocument: (id: string) =>
    call<{ id: string; status: string }>("PATCH", `/api/build/documents/${id}/verify`, {}),
  rejectDocument: (id: string, reason?: string) =>
    call<{ id: string; status: string }>("PATCH", `/api/build/documents/${id}/reject`, { reason }),
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

/** Request a password reset email for the given address. */
export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(apiUrl("/api/auth/password/reset/request"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new BuildApiError(res.status, json?.error || "reset_request_failed", json);
  }
}

/** Complete a password reset with the token from the reset link and a new password. */
export async function completePasswordReset(email: string, token: string, newPassword: string): Promise<void> {
  const res = await fetch(apiUrl("/api/auth/password/reset/complete"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token, newPassword }),
    cache: "no-store",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new BuildApiError(res.status, json?.error || "reset_complete_failed", json);
  }
}

/** Request a verification email for the currently logged-in user. */
export async function requestEmailVerification(): Promise<void> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("build_auth_token") || sessionStorage.getItem("build_auth_token")
    : null;
  const res = await fetch(apiUrl("/api/auth/email/verify/request"), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new BuildApiError(res.status, json?.error || "verify_request_failed", json);
  }
}

/** Complete email verification with the token from the verification link. */
export async function completeEmailVerification(token: string): Promise<void> {
  const authToken = typeof window !== "undefined"
    ? localStorage.getItem("build_auth_token") || sessionStorage.getItem("build_auth_token")
    : null;
  const res = await fetch(apiUrl("/api/auth/email/verify/complete"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new BuildApiError(res.status, json?.error || "verify_complete_failed", json);
  }
}
