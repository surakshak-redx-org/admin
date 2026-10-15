'use client';

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
import { useRecentIncidentsQuery, useRecentUsersQuery, useStatsQuery } from '@/hooks';
import { useAuth } from '@/lib/auth/session';
import type { IncidentWithUser } from '@/services/incidents.service';
import type { UsersListResponse } from '@/services/users.service';

const DATE_LOCALE = 'en-IN';
const RECENT_USERS_LIMIT = 5;
const RECENT_INCIDENTS_LIMIT = 5;
const INCIDENTS_FETCH_LIMIT = 10;
const RESOLVED_STATUS = 'resolved';

const VIEW_ALL_LINK_CLASSES =
  'inline-block rounded text-sm font-medium text-shakti-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shakti-purple focus-visible:ring-offset-2';

export default function DashboardPage(): React.JSX.Element {
  const { user } = useAuth();

  const statsQuery = useStatsQuery();
  const usersQuery = useRecentUsersQuery(RECENT_USERS_LIMIT);
  const incidentsQuery = useRecentIncidentsQuery(INCIDENTS_FETCH_LIMIT);

  const stats = statsQuery.data;
  const recentUsers: UsersListResponse['users'] =
    usersQuery.data?.users.slice(0, RECENT_USERS_LIMIT) ?? [];
  const recentIncidents: IncidentWithUser[] = (incidentsQuery.data ?? [])
    .filter((incident: IncidentWithUser): boolean => incident.status !== RESOLVED_STATUS)
    .slice(0, RECENT_INCIDENTS_LIMIT);

  const today = new Date().toLocaleDateString(DATE_LOCALE, { dateStyle: 'full' });

  let statsSection: React.JSX.Element;

  if (statsQuery.isError) {
    statsSection = (
      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-error-red">Could not load dashboard stats.</p>
          <Button
            variant="outline"
            onClick={(): void => {
              void statsQuery.refetch();
            }}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  } else if (statsQuery.isLoading || !stats) {
    statsSection = (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  } else {
    statsSection = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          icon={Users}
          color="blue"
          label="Total Users"
          value={stats.totalUsers}
          href="/users"
        />
        <StatCard
          icon={MessageSquare}
          color="purple"
          label="Community Posts"
          value={stats.totalPosts}
          href="/community-posts"
        />
        <StatCard
          icon={EyeOff}
          color="red"
          label="Hidden Posts"
          value={stats.hiddenPosts}
          badgeLabel={
            stats.hiddenPosts > 0
              ? `${stats.hiddenPosts} ${stats.hiddenPosts === 1 ? 'needs' : 'need'} review`
              : undefined
          }
          href="/moderation"
        />
        <StatCard
          icon={MapPin}
          color="amber"
          label="Pending Unsafe Areas"
          value={stats.pendingUnsafeAreas}
          badgeLabel={
            stats.pendingUnsafeAreas > 0 ? `${stats.pendingUnsafeAreas} pending` : undefined
          }
          href="/unsafe-areas?filter=pending"
        />
        <StatCard
          icon={AlertTriangle}
          color="red"
          label="Open Incidents"
          value={stats.openIncidents}
          href="/incidents"
        />
        <StatCard
          icon={Scale}
          color="blue"
          label="Published Laws"
          value={stats.publishedLaws}
          href="/content?tab=laws"
        />
        <StatCard
          icon={Newspaper}
          color="purple"
          label="Published News"
          value={stats.publishedNews}
          href="/content?tab=news"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-deep-ink">Dashboard</h1>
        <p className="text-sm text-stone">Welcome back, {user?.displayName}</p>
        <p className="text-xs text-stone">{today}</p>
      </div>

      {statsSection}

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
              recentUsers.map((recentUser): React.JSX.Element => (
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
            <Link href="/users" className={VIEW_ALL_LINK_CLASSES}>
              View all users
            </Link>
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
              recentIncidents.map((incident): React.JSX.Element => (
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
            <Link href="/incidents" className={VIEW_ALL_LINK_CLASSES}>
              View all incidents
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
