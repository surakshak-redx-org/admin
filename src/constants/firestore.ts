/** Firestore top-level collection names — see CLAUDE.md → Firestore Schema. */
export const COLLECTIONS = {
  USERS: 'users',
  COMMUNITY: 'community',
  UNSAFE_AREAS: 'unsafeAreas',
  INCIDENT_REPORTS: 'incidentReports',
  LAWS: 'laws',
  FAQS: 'faqs',
  SAFETY_TIPS: 'safetyTips',
  NEWS: 'news',
  ADMINS: 'admins',
} as const;
