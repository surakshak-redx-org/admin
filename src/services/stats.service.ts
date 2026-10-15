import { apiFetch } from '@/lib/api/client';
import type { DashboardStats } from '@/types/firestore.types';

/**
 * Fetches dashboard aggregation statistics from `/api/stats`.
 *
 * @param idToken Firebase ID token for authentication
 * @returns Dashboard aggregated statistics
 */
export async function getStats(idToken: string): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/api/stats', idToken);
}
