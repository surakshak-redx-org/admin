'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  EyeOff,
  MapPin,
  MessageSquare,
  Newspaper,
  Scale,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { StatCard } from '@/components/features/dashboard/StatCard';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { Serialized } from '@/types/api.types';
import type { DashboardStats, IncidentReport, SurakshakUser } from '@/types/firestore.types';

interface UsersResponse {
  users: (Serialized<SurakshakUser> & { id: string })[];
  nextCursor: string | null;
}

export default function DashboardPage(): React.JSX.Element {
  const { user, idToken } = useAuth();

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<DashboardStats>('/api/stats', idToken ?? ''),
    enabled: idToken !== null,
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'recent'],
    queryFn: () => apiFetch<UsersResponse>('/api/users', idToken ?? ''),
    enabled: idToken !== null,
  });

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'recent'],
    queryFn: () => apiFetch<Serialized<IncidentReport>[]>('/api/incidents', idToken ?? ''),
    enabled: idToken !== null,
  });

  const stats = statsQuery.data;
  const recentUsers = usersQuery.data?.users.slice(0, 5) ?? [];
  const recentIncidents = (incidentsQuery.data ?? [])
    .filter((incident) => incident.status !== 'resolved')
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-deep-ink">Dashboard</h1>
        <p className="text-sm text-stone">
          Welcome back, {user?.displayName} —{' '}
          {new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}
        </p>
      </div>

      {statsQuery.isLoading || !stats ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={Users} color="blue" label="Total Users" value={stats.totalUsers} />
          <StatCard
            icon={MessageSquare}
            color="purple"
            label="Community Posts"
            value={stats.totalPosts}
          />
          <StatCard
            icon={EyeOff}
            color="red"
            label="Hidden Posts (needs review)"
            value={stats.hiddenPosts}
            badgeLabel={stats.hiddenPosts > 0 ? `${stats.hiddenPosts} need review` : undefined}
          />
          <StatCard
            icon={MapPin}
            color="amber"
            label="Pending Unsafe Areas"
            value={stats.pendingUnsafeAreas}
            badgeLabel={
              stats.pendingUnsafeAreas > 0 ? `${stats.pendingUnsafeAreas} pending` : undefined
            }
          />
          <StatCard
            icon={AlertTriangle}
            color="red"
            label="Open Incidents"
            value={stats.openIncidents}
          />
          <StatCard icon={Scale} color="blue" label="Published Laws" value={stats.publishedLaws} />
          <StatCard
            icon={Newspaper}
            color="purple"
            label="Published News"
            value={stats.publishedNews}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/content?tab=laws&action=new">
            <Button variant="outline">Add Law</Button>
          </Link>
          <Link href="/content?tab=news&action=new">
            <Button variant="outline">Add News</Button>
          </Link>
          <Link href="/unsafe-areas?filter=pending">
            <Button variant="outline">Review Unsafe Areas</Button>
          </Link>
          <Link href="/moderation">
            <Button variant="outline">Review Hidden Posts</Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-stone">No users yet.</p>
            ) : (
              recentUsers.map((recentUser) => (
                <div key={recentUser.id} className="flex items-center gap-3">
                  <Avatar name={recentUser.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-deep-ink">{recentUser.name}</p>
                    <p className="truncate text-xs text-stone">{recentUser.city}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-stone">
                    {formatDistanceToNow(new Date(recentUser.createdAt), { addSuffix: true })}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Incidents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentIncidents.length === 0 ? (
              <p className="text-sm text-stone">No open incidents.</p>
            ) : (
              recentIncidents.map((incident) => (
                <div key={incident.id} className="flex items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-deep-ink">
                    {incident.title}
                  </p>
                  <StatusBadge status={incident.status} />
                  <span className="whitespace-nowrap text-xs text-stone">
                    {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
