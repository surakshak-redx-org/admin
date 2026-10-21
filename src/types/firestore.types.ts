import type { Timestamp } from 'firebase-admin/firestore';

// ─── Users ─────────────────────────────────────────────────────────
export type Language = 'en' | 'hi' | 'mr';

/** Mirrors Firestore `users/{userId}`. */
export interface SurakshakUser {
  userId: string;
  name: string;
  phone: string;
  profilePhotoUrl: string;
  city: string;
  state: string;
  language: Language;
  isGuest: boolean;
  /** Admin-only field. Not read or written by the app. */
  isSuspended?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Community ─────────────────────────────────────────────────────
export type PostType = 'text' | 'location' | 'image' | 'help_request';

/** Mirrors Firestore `community/{postId}`. */
export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string;
  content: string;
  type: PostType;
  isAnonymous: boolean;
  locationUrl: string | null;
  imageUrl: string | null;
  city: string;
  state: string;
  reportCount: number;
  isHidden: boolean;
  createdAt: Timestamp;
}

// ─── Unsafe Areas ───────────────────────────────────────────────────
export type UnsafeAreaCategory = 'poorly_lit' | 'isolated' | 'harassment_reported' | 'other';

export type UnsafeAreaStatus = 'pending' | 'approved' | 'rejected';
export type PinColor = 'orange' | 'red';

/** Mirrors Firestore `unsafeAreas/{areaId}`. */
export interface UnsafeArea {
  id: string;
  reportedBy: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  title: string;
  description: string;
  category: UnsafeAreaCategory;
  status: UnsafeAreaStatus;
  pinColor: PinColor;
  upvotes: number;
  downvotes: number;
  voterIds: string[];
  createdAt: Timestamp;
  /** Set by the admin dashboard when a report is rejected; kept as rejection history. */
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
}

// ─── Incidents ──────────────────────────────────────────────────────
export type IncidentStatus = 'submitted' | 'under_review' | 'resolved' | 'rejected';

/**
 * Incident category, used by the admin dashboard's Incidents search &
 * filter UI. Optional on `IncidentReport` — see the note on that field
 * below before assuming every document has one.
 */
export type IncidentCategory = 'harassment' | 'theft' | 'physical_abuse' | 'stalking' | 'other';

/** Mirrors Firestore `incidentReports/{reportId}`. `adminNote` is admin-only. */
export interface IncidentReport {
  id: string;
  userId: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  photoUrls: string[];
  createdAt: Timestamp;
  status: IncidentStatus;
  /**
   * Optional — added for the admin dashboard's Category/Incident Type
   * filter (see `(admin)/incidents/page.tsx`). The `app` repo does not
   * currently write this field on submission, so existing and newly
   * submitted reports alike may not have it; the dashboard treats a
   * missing value as "Uncategorized" rather than assuming one. Purely
   * additive — does not affect any existing read or write path.
   */
  category?: IncidentCategory;
  adminNote?: string;
}

export type BugReportCategory = 'crash' | 'ui' | 'login' | 'performance' | 'other';
export type BugReportSeverity = 'low' | 'medium' | 'high' | 'critical';
export type BugReportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

/** Mirrors bugReports/{reportId}; user identity comes only from Firebase Auth. */
export interface BugReport {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: BugReportCategory;
  severity: BugReportSeverity;
  status: BugReportStatus;
  platform: string;
  appVersion: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  adminNotes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Content ────────────────────────────────────────────────────────
export interface Law {
  id: string;
  title: string;
  shortDescription: string;
  fullContent: string;
  category: string;
  tags: string[];
  order: number;
  isPublished: boolean;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isPublished: boolean;
}

export interface SafetyTip {
  id: string;
  title: string;
  content: string;
  category: string;
  order: number;
  isPublished: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  category: string;
  publishedAt: Timestamp;
  isPublished: boolean;
}

// ─── Admin ──────────────────────────────────────────────────────────
export type AdminRole = 'admin' | 'super_admin';

/**
 * Mirrors Firestore `admins/{uid}`. `uid`, `email`, `fcmToken`, `role` and
 * `createdAt` must stay in sync with `functions/src/types/admin.types.ts` —
 * that repo reads this collection to notify admins of moderation events.
 * `displayName` / `photoUrl` are additions this dashboard owns for UI display
 * (written by `scripts/create-admin.ts` and refreshed from the Google profile).
 */
export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
  fcmToken?: string;
  role: AdminRole;
  createdAt: Timestamp;
}

/**
 * Mirrors Firestore `adminAuditLogs/{logId}`. Written by the admin dashboard
 * whenever a post is deleted or an unsafe-area report is rejected.
 */
export interface AuditLog {
  action: 'delete_post' | 'reject_unsafe_area';
  targetCollection: string;
  targetId: string;
  reason: string;
  adminUid: string;
  adminEmail: string;
  createdAt: Timestamp;
  /** Copy of the target document as it was before the action. */
  snapshot: Record<string, unknown>;
}

// ─── Dashboard Stats ────────────────────────────────────────────────
export interface DashboardStats {
  totalUsers: number;
  totalPosts: number;
  hiddenPosts: number;
  pendingUnsafeAreas: number;
  openIncidents: number;
  publishedLaws: number;
  publishedNews: number;
}
