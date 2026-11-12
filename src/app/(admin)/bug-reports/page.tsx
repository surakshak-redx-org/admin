'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import type { SelectOption } from '@/components/ui/Select';
import { Select } from '@/components/ui/Select';
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
import { Textarea } from '@/components/ui/Textarea';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';

type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type BugReport = {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: BugStatus;
  platform: string;
  appVersion: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
};
type ReportPage = {
  reports: BugReport[];
  nextCursor: string | null;
  total: number;
  counts: Record<BugStatus, number>;
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];
const FILTER_OPTIONS: SelectOption[] = [{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS];
const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All categories' },
  ...['crash', 'ui', 'login', 'performance', 'other'].map((value) => ({ value, label: value })),
];
const SEVERITY_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All severities' },
  ...['low', 'medium', 'high', 'critical'].map((value) => ({ value, label: value })),
];

export default function BugReportsPage(): React.JSX.Element {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<BugReport | null>(null);
  const [notes, setNotes] = useState('');
  const [detailStatus, setDetailStatus] = useState<BugStatus>('open');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return (): void => {
      clearTimeout(timer);
    };
  }, [search]);

  const reportsQuery = useInfiniteQuery({
    queryKey: ['bug-reports', status, category, severity, debouncedSearch],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<ReportPage> => {
      const params = new URLSearchParams({ status, category, severity, limit: '50' });
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<ReportPage>(`/api/bug-reports?${params.toString()}`, idToken ?? '');
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: idToken !== null,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      nextStatus,
      adminNotes,
    }: {
      id: string;
      nextStatus: BugStatus;
      adminNotes: string;
    }) =>
      apiFetch(`/api/bug-reports/${id}`, idToken ?? '', {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, adminNotes }),
      }),
    onSuccess: () => {
      toast.success('Bug report updated');
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] }).catch(() => undefined);
    },
    onError: () => toast.error('Could not update bug report'),
  });

  const pages = reportsQuery.data?.pages ?? [];
  const firstPage = pages[0];
  const reports = pages.flatMap((page) => page.reports);
  const visible = reports;

  function openDetails(report: BugReport): void {
    setSelected(report);
    setNotes(report.adminNotes);
    setDetailStatus(report.status);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-deep-ink">Bug Reports</h1>
          <p className="text-sm text-stone">Technical issues submitted by signed-in app users.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => void reportsQuery.refetch()}
          disabled={reportsQuery.isFetching}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {firstPage && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-stone">Total</p>
              <p className="mt-1 text-2xl font-semibold text-deep-ink">{firstPage.total}</p>
            </CardContent>
          </Card>
          {(['open', 'in_progress', 'resolved', 'closed'] as const).map((key) => (
            <Card key={key}>
              <CardContent className="p-4">
                <p className="text-sm capitalize text-stone">{key.replace('_', ' ')}</p>
                <p className="mt-1 text-2xl font-semibold text-deep-ink">{firstPage.counts[key]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              aria-label="Search reports"
              placeholder="Search title, description, or reporter"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              value={status}
              onValueChange={setStatus}
              options={FILTER_OPTIONS}
              label="Status"
            />
            <Select
              value={category}
              onValueChange={setCategory}
              options={CATEGORY_OPTIONS}
              label="Category"
            />
            <Select
              value={severity}
              onValueChange={setSeverity}
              options={SEVERITY_OPTIONS}
              label="Severity"
            />
          </div>
          {firstPage && (
            <p className="text-xs text-stone">
              {firstPage.total} reports total · {reports.length} loaded
            </p>
          )}
          {reportsQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : null}
          {reportsQuery.isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Could not load bug reports"
              subtitle="Check your connection and try refreshing."
              action={<Button onClick={() => void reportsQuery.refetch()}>Retry</Button>}
            />
          ) : null}
          {!reportsQuery.isLoading && !reportsQuery.isError && visible.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No bug reports found"
              subtitle={
                search
                  ? 'Try another search or load more reports.'
                  : 'There are no reports matching these filters.'
              }
            />
          ) : null}
          {visible.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="max-w-xs truncate font-medium">{report.title}</TableCell>
                    <TableCell className="capitalize">{report.category}</TableCell>
                    <TableCell className="capitalize">{report.severity}</TableCell>
                    <TableCell className="font-mono text-xs">{report.userId}</TableCell>
                    <TableCell>
                      {report.createdAt ? format(new Date(report.createdAt), 'PP p') : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={report.status} />
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openDetails(report)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {reportsQuery.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                isLoading={reportsQuery.isFetchingNextPage}
                onClick={() => void reportsQuery.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.title ?? 'Bug report'}
        description={
          selected
            ? `${selected.category} · ${selected.severity} · ${selected.platform} ${selected.appVersion} · ${selected.userId}`
            : undefined
        }
        className="max-w-2xl"
      >
        {selected && (
          <div className="space-y-4">
            <section>
              <h2 className="text-sm font-semibold">Description</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-stone">{selected.description}</p>
            </section>
            {selected.stepsToReproduce && (
              <section>
                <h2 className="text-sm font-semibold">Steps to reproduce</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-stone">
                  {selected.stepsToReproduce}
                </p>
              </section>
            )}
            {selected.expectedBehavior && (
              <section>
                <h2 className="text-sm font-semibold">Expected behavior</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-stone">
                  {selected.expectedBehavior}
                </p>
              </section>
            )}
            {selected.actualBehavior && (
              <section>
                <h2 className="text-sm font-semibold">Actual behavior</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-stone">
                  {selected.actualBehavior}
                </p>
              </section>
            )}
            <Select
              label="Status"
              value={detailStatus}
              onValueChange={(value) => setDetailStatus(value as BugStatus)}
              options={STATUS_OPTIONS}
              disabled={updateMutation.isPending}
            />
            <Textarea
              label="Administrator notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={4000}
              rows={4}
              disabled={updateMutation.isPending}
            />
            <div className="flex justify-end">
              <Button
                isLoading={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: selected.id,
                    nextStatus: detailStatus,
                    adminNotes: notes,
                  })
                }
              >
                Save changes
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
