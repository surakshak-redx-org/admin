'use client';

import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, MapPin } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

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
import { useUnsafeAreaActionMutation, useUnsafeAreasQuery } from '@/hooks';
import type { UnsafeAreaWithId } from '@/services/unsafe-areas.service';
import type { UnsafeAreaStatus } from '@/types/firestore.types';
type FilterValue = UnsafeAreaStatus | 'all';

const FILTER_ITEMS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
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
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<FilterValue>(
    (searchParams.get('filter') as FilterValue | null) ?? 'all',
  );
  const [approveArea, setApproveArea] = useState<UnsafeAreaWithId | null>(null);
  const [rejectArea, setRejectArea] = useState<UnsafeAreaWithId | null>(null);

  const areasQuery = useUnsafeAreasQuery(filter);
  const actionMutation = useUnsafeAreaActionMutation();

  const areas = areasQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-deep-ink">Unsafe Areas</h1>
      <Tabs
        items={FILTER_ITEMS}
        value={filter}
        onValueChange={(value: string): void => setFilter(value as FilterValue)}
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
            {areas.map((area): React.JSX.Element => (
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
                <TableCell title={area.reportedBy}>
                  {area.reporterName ?? <span className="text-stone">Unknown user</span>}
                </TableCell>
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
                        <Button
                          size="sm"
                          variant="default"
                          onClick={(): void => setApproveArea(area)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(): void => setRejectArea(area)}
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(): void => setRejectArea(area)}
                      >
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
          onOpenChange={(open: boolean): void => {
            if (!open) {
              setApproveArea(null);
            }
          }}
          title="Approve this unsafe area report?"
          description="It will appear as a verified unsafe area (red pin) on the Surakshak map."
          confirmLabel="Approve"
          confirmVariant="default"
          isLoading={actionMutation.isPending}
          onConfirm={(): void => {
            actionMutation.mutate(
              { id: approveArea.id, action: 'approve' },
              {
                onSuccess: (): void => {
                  setApproveArea(null);
                },
              },
            );
          }}
        />
      ) : null}

      {rejectArea ? (
        <AlertDialog
          open
          onOpenChange={(open: boolean): void => {
            if (!open) {
              setRejectArea(null);
            }
          }}
          title="Reject and remove this report?"
          description="This cannot be undone."
          confirmLabel="Reject"
          isLoading={actionMutation.isPending}
          onConfirm={(): void => {
            actionMutation.mutate(
              { id: rejectArea.id, action: 'reject' },
              {
                onSuccess: (): void => {
                  setRejectArea(null);
                },
              },
            );
          }}
        />
      ) : null}
    </div>
  );
}
