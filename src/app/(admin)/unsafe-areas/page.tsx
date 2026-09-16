'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, MapPin } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import toast from 'react-hot-toast';

import { AlertDialog } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import { QUERY_ALWAYS_STALE_TIME_MS } from '@/constants/config';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { Serialized } from '@/types/api.types';
import type { UnsafeArea, UnsafeAreaStatus } from '@/types/firestore.types';

type ClientUnsafeArea = Serialized<UnsafeArea> & { id: string };
type FilterValue = UnsafeAreaStatus | 'all';

const FILTER_ITEMS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
];

function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/place/${lat},${lng}`;
}

export default function UnsafeAreasPage(): React.JSX.Element {
  return (
    <Suspense fallback={<Spinner />}>
      <UnsafeAreasPageInner />
    </Suspense>
  );
}

function UnsafeAreasPageInner(): React.JSX.Element {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<FilterValue>(
    (searchParams.get('filter') as FilterValue | null) ?? 'all',
  );
  const [approveArea, setApproveArea] = useState<ClientUnsafeArea | null>(null);
  const [rejectArea, setRejectArea] = useState<ClientUnsafeArea | null>(null);

  const areasQuery = useQuery({
    queryKey: ['unsafe-areas', filter],
    queryFn: () =>
      apiFetch<ClientUnsafeArea[]>(`/api/unsafe-areas?status=${filter}`, idToken ?? ''),
    enabled: idToken !== null,
    staleTime: QUERY_ALWAYS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['unsafe-areas'] }).catch(() => undefined);
  };

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      apiFetch(`/api/unsafe-areas/${id}`, idToken ?? '', {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.action === 'approve' ? 'Area approved and visible on map' : 'Report removed',
      );
      setApproveArea(null);
      setRejectArea(null);
      invalidate();
    },
    onError: () => toast.error('Failed to update unsafe area'),
  });

  const areas = areasQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-deep-ink">Unsafe Areas</h1>
      <Tabs
        items={FILTER_ITEMS}
        value={filter}
        onValueChange={(v) => setFilter(v as FilterValue)}
      />

      {areasQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : areas.length === 0 ? (
        <EmptyState icon={MapPin} title="No unsafe areas" subtitle="Nothing matches this filter." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Reported By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Votes</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {areas.map((area) => (
              <TableRow key={area.id}>
                <TableCell>{area.title}</TableCell>
                <TableCell>
                  <Badge>{area.category}</Badge>
                </TableCell>
                <TableCell>
                  <a
                    href={mapsUrl(area.latitude, area.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-shakti-purple hover:underline"
                  >
                    {area.latitude.toFixed(4)}, {area.longitude.toFixed(4)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
                <TableCell className="font-mono text-xs">{area.reportedBy.slice(0, 8)}…</TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(area.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <StatusBadge status={area.status} />
                </TableCell>
                <TableCell>{area.upvotes - area.downvotes}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {area.status === 'pending' ? (
                      <>
                        <Button size="sm" variant="default" onClick={() => setApproveArea(area)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setRejectArea(area)}>
                          Reject
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="destructive" onClick={() => setRejectArea(area)}>
                        Reject
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {approveArea ? (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setApproveArea(null)}
          title="Approve this unsafe area report?"
          description="It will appear as a verified unsafe area (red pin) on the Surakshak map."
          confirmLabel="Approve"
          confirmVariant="default"
          isLoading={actionMutation.isPending}
          onConfirm={() => actionMutation.mutate({ id: approveArea.id, action: 'approve' })}
        />
      ) : null}

      {rejectArea ? (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setRejectArea(null)}
          title="Reject and remove this report?"
          description="This cannot be undone."
          confirmLabel="Reject"
          isLoading={actionMutation.isPending}
          onConfirm={() => actionMutation.mutate({ id: rejectArea.id, action: 'reject' })}
        />
      ) : null}
    </div>
  );
}
