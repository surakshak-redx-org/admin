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
  AUDIT_LOGS: 'adminAuditLogs',
} as const;

/** `action` values written to `adminAuditLogs/{logId}` for destructive moderation actions. */
export const AUDIT_ACTIONS = {
  DELETE_POST: 'delete_post',
  REJECT_UNSAFE_AREA: 'reject_unsafe_area',
} as const;
