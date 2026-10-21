/** Firestore top-level collection names — see CLAUDE.md → Firestore Schema. */
export const COLLECTIONS = {
  USERS: 'users',
  COMMUNITY: 'community',
  UNSAFE_AREAS: 'unsafeAreas',
  INCIDENT_REPORTS: 'incidentReports',
  BUG_REPORTS: 'bugReports',
  LAWS: 'laws',
  FAQS: 'faqs',
  SAFETY_TIPS: 'safetyTips',
  NEWS: 'news',
  ADMINS: 'admins',
} as const;

/** Values of `admins/{uid}.role` — see CLAUDE.md → Auth. */
export const ADMIN_ROLES = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;
