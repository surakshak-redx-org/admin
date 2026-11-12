'use client';

import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, ExternalLink, MapPin } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { AlertDialog } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
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

const PAGE_TITLE = 'Unsafe Areas';
const LOAD_ERROR_MESSAGE = 'Could not load unsafe areas.';
const EMPTY_TITLE = 'No unsafe areas';
const EMPTY_SUBTITLE = 'Nothing matches this filter.';
const UNKNOWN_REPORTER_LABEL = 'Unknown user';
const COORDINATE_DECIMALS = 4;
const APPROVE_TITLE = 'Approve this unsafe area report?';
const APPROVE_DESCRIPTION =
  'It will appear as a verified unsafe area (red pin) on the Surakshak map.';
const REJECT_TITLE = 'Reject and remove this report?';
const REJECT_DESCRIPTION = 'This cannot be undone.';

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

  const handleRetry = (): void => {
    void areasQuery.refetch();
  };

  let content: React.JSX.Element;

  if (areasQuery.isLoading) {
    content = (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  } else if (areasQuery.isError) {
    content = (
      <Card>
        <CardContent role="alert" className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-error-red" aria-hidden="true" />
            <p className="text-sm text-error-red">{LOAD_ERROR_MESSAGE}</p>
          </div>
          <Button variant="outline" isLoading={areasQuery.isFetching} onClick={handleRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  } else if (areas.length === 0) {
    content = <EmptyState icon={MapPin} title={EMPTY_TITLE} subtitle={EMPTY_SUBTITLE} />;
  } else {
    content = (
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
          {areas.map((area: UnsafeAreaWithId): React.JSX.Element => {
            const canApprove = area.status === 'pending';
            const canReject = area.status !== 'rejected';

            return (
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
                    {area.latitude.toFixed(COORDINATE_DECIMALS)},{' '}
                    {area.longitude.toFixed(COORDINATE_DECIMALS)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
                <TableCell>
                  {area.reporterName ?? (
                    <span className="text-stone">{UNKNOWN_REPORTER_LABEL}</span>
                  )}
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
                    {canApprove ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={(): void => setApproveArea(area)}
                      >
                        Approve
                      </Button>
                    ) : null}
                    {canReject ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(): void => setRejectArea(area)}
                      >
                        Reject
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-deep-ink">{PAGE_TITLE}</h1>
      <Tabs
        items={FILTER_ITEMS}
        value={filter}
        onValueChange={(value: string): void => setFilter(value as FilterValue)}
      />

      {content}

      {approveArea ? (
        <AlertDialog
          open
          onOpenChange={(open: boolean): void => {
            if (!open) {
              setApproveArea(null);
            }
          }}
          title={APPROVE_TITLE}
          description={APPROVE_DESCRIPTION}
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
          title={REJECT_TITLE}
          description={REJECT_DESCRIPTION}
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
