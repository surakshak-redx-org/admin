'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Copy, Search } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import {
  QUERY_ALWAYS_STALE_TIME_MS,
  SEARCH_DEBOUNCE_MS,
  TITLE_TRUNCATE_LENGTH,
} from '@/constants/config';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { DuplicateCluster } from '@/lib/incidents/duplicate-detection';
import { detectDuplicateClusters } from '@/lib/incidents/duplicate-detection';
import type { Serialized } from '@/types/api.types';
import type {
  IncidentCategory,
  IncidentReport,
  IncidentStatus,
  SurakshakUser,
} from '@/types/firestore.types';

type ClientIncident = Serialized<IncidentReport> & {
  id: string;
  user: Pick<SurakshakUser, 'name' | 'city'> | null;
};

type FilterValue = IncidentStatus | 'all';

const FILTER_ITEMS = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'resolved', label: 'Resolved' },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'resolved', label: 'Resolved' },
];

/** Sentinel filter value matching reports with no `category` set. */
const UNCATEGORIZED_VALUE = 'uncategorized';

type CategoryFilterValue = IncidentCategory | typeof UNCATEGORIZED_VALUE | 'all';

/** Display labels for each known incident category. */
const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  harassment: 'Harassment',
  theft: 'Theft',
  physical_abuse: 'Physical Abuse',
  stalking: 'Stalking',
  other: 'Other',
};

const CATEGORY_FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Categories' },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
  { value: UNCATEGORIZED_VALUE, label: 'Uncategorized' },
];

const ALL_CITIES_VALUE = 'all';

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function categoryLabel(category: IncidentCategory | undefined): string {
  return category ? CATEGORY_LABELS[category] : 'Uncategorized';
}

/**
 * Debounces a fast-changing value (e.g. a search input) so downstream
 * filtering doesn't re-run on every keystroke. Mirrors the identical local
 * hook in `(admin)/users/page.tsx` — kept as a page-local copy rather than
 * a shared export so this change stays scoped to the Incidents page.
 */
function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect((): (() => void) => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function IncidentsPage(): React.JSX.Element {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [viewIncident, setViewIncident] = useState<ClientIncident | null>(null);
  const [editIncident, setEditIncident] = useState<ClientIncident | null>(null);

  // Search & advanced filters — applied client-side on top of the
  // status-tab-filtered result set already fetched below (the incidents
  // list, like Moderation and Unsafe Areas, is not paginated, so the full
  // set for the active status tab is already in memory).
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [cityFilter, setCityFilter] = useState<string>(ALL_CITIES_VALUE);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const incidentsQuery = useQuery({
    queryKey: ['incidents', filter],
    queryFn: () =>
      apiFetch<ClientIncident[]>(
        filter === 'all' ? '/api/incidents' : `/api/incidents?status=${filter}`,
        idToken ?? '',
      ),
    enabled: idToken !== null,
    staleTime: QUERY_ALWAYS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      status,
      adminNote,
    }: {
      id: string;
      status: IncidentStatus;
      adminNote: string;
    }) =>
      apiFetch(`/api/incidents/${id}`, idToken ?? '', {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNote }),
      }),
    onSuccess: () => {
      toast.success('Incident updated');
      setEditIncident(null);
      queryClient.invalidateQueries({ queryKey: ['incidents'] }).catch(() => undefined);
    },
    onError: () => toast.error('Failed to update incident'),
  });

  const incidents = useMemo(() => incidentsQuery.data ?? [], [incidentsQuery.data]);

  const [showDuplicates, setShowDuplicates] = useState(false);

  const incidentById = useMemo((): Map<string, ClientIncident> => {
    return new Map(incidents.map((incident) => [incident.id, incident]));
  }, [incidents]);

  // Computed from `incidents` (the full, tab-scoped list) rather than
  // `filteredIncidents` below — duplicate detection should keep working
  // regardless of what the admin currently has searched/filtered for.
  // Switch to the "All" status tab to check for duplicates across every
  // status, since (like the rest of this page) nothing here makes a
  // separate network request beyond what the active tab already fetched.
  const duplicateClusters = useMemo((): DuplicateCluster[] => {
    return detectDuplicateClusters(incidents);
  }, [incidents]);

  // Cities are derived from the currently loaded incidents' reporters
  // rather than a separate lookup — there is no standalone "list of
  // cities" endpoint, and this keeps the filter scoped to cities that
  // actually have reports for the active status tab.
  const cityFilterOptions = useMemo((): SelectOption[] => {
    const cities = new Set<string>();
    incidents.forEach((incident) => {
      if (incident.user?.city) cities.add(incident.user.city);
    });
    return [
      { value: ALL_CITIES_VALUE, label: 'All Cities' },
      ...Array.from(cities)
        .sort((a, b) => a.localeCompare(b))
        .map((city) => ({ value: city, label: city })),
    ];
  }, [incidents]);

  // A selected city can drop out of the options when the loaded incidents
  // change (e.g. after a status update); fall back to "All Cities" rather
  // than silently filtering on a value the dropdown can no longer show.
  const activeCityFilter = cityFilterOptions.some((option) => option.value === cityFilter)
    ? cityFilter
    : ALL_CITIES_VALUE;

  const filteredIncidents = useMemo((): ClientIncident[] => {
    const query = debouncedSearch.trim().toLowerCase();
    // Date-only strings ("2026-09-01") parse as UTC midnight; appending a
    // time makes them parse in the admin's local time zone instead.
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

    return incidents.filter((incident) => {
      if (query) {
        const matchesSearch =
          incident.title.toLowerCase().includes(query) ||
          incident.description.toLowerCase().includes(query) ||
          (incident.user?.name.toLowerCase().includes(query) ?? false);
        if (!matchesSearch) return false;
      }

      if (activeCityFilter !== ALL_CITIES_VALUE && incident.user?.city !== activeCityFilter) {
        return false;
      }

      if (categoryFilter !== 'all') {
        const category = incident.category ?? UNCATEGORIZED_VALUE;
        if (category !== categoryFilter) return false;
      }

      const createdAt = new Date(incident.createdAt);
      if (fromDate && createdAt < fromDate) return false;
      if (toDate && createdAt > toDate) return false;

      return true;
    });
  }, [incidents, debouncedSearch, activeCityFilter, categoryFilter, dateFrom, dateTo]);

  const hasActiveFilters =
    debouncedSearch !== '' ||
    activeCityFilter !== ALL_CITIES_VALUE ||
    categoryFilter !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '';

  const clearFilters = (): void => {
    setSearch('');
    setCityFilter(ALL_CITIES_VALUE);
    setCategoryFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-deep-ink">Incidents</h1>
      <Tabs
        items={FILTER_ITEMS}
        value={filter}
        onValueChange={(v) => {
          setFilter(v as FilterValue);
          setCityFilter(ALL_CITIES_VALUE);
        }}
      />

      <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Input
            label="Search"
            placeholder="Search by title, description, or reporter…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full sm:w-64"
          />
          <Select
            label="City"
            value={activeCityFilter}
            onValueChange={setCityFilter}
            options={cityFilterOptions}
          />
          <Select
            label="Category"
            value={categoryFilter}
            onValueChange={(value) => setCategoryFilter(value as CategoryFilterValue)}
            options={CATEGORY_FILTER_OPTIONS}
          />
          <Input
            label="From"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
          {hasActiveFilters ? (
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          ) : null}
          {duplicateClusters.length > 0 ? (
            <Button variant="outline" onClick={() => setShowDuplicates(true)}>
              <Copy className="mr-1.5 h-4 w-4" />
              Possible Duplicates
              <Badge variant="warning" className="ml-1.5">
                {duplicateClusters.length}
              </Badge>
            </Button>
          ) : null}
        </div>
        {incidentsQuery.isLoading ? null : (
          <p className="text-sm text-stone">
            Showing {filteredIncidents.length} of {incidents.length} incident
            {incidents.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {incidentsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filteredIncidents.length === 0 && hasActiveFilters ? (
        <EmptyState
          icon={Search}
          title="No incidents match your filters"
          subtitle="Try adjusting or clearing the search and filters above."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>User</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Photos</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIncidents.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell>{truncate(incident.title, TITLE_TRUNCATE_LENGTH)}</TableCell>
                <TableCell>{incident.user?.name ?? '—'}</TableCell>
                <TableCell>{incident.user?.city ?? '—'}</TableCell>
                <TableCell>
                  <Badge>{categoryLabel(incident.category)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge>{incident.photoUrls.length}</Badge>
                </TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <StatusBadge status={incident.status} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setViewIncident(incident)}>
                      View
                    </Button>
                    <Button size="sm" onClick={() => setEditIncident(incident)}>
                      Update Status
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {viewIncident ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setViewIncident(null)}
          title={viewIncident.title}
          description={formatDistanceToNow(new Date(viewIncident.createdAt), { addSuffix: true })}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-deep-ink">{viewIncident.description}</p>
            <a
              href={`https://www.google.com/maps/place/${viewIncident.latitude},${viewIncident.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-shakti-purple hover:underline"
            >
              View location on Google Maps
            </a>
            {viewIncident.photoUrls.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {viewIncident.photoUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative block h-24 w-full overflow-hidden rounded"
                  >
                    <Image src={url} alt="Incident evidence" fill className="object-cover" />
                  </a>
                ))}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <span className="text-sm text-stone">Status:</span>
              <StatusBadge status={viewIncident.status} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-stone">Category:</span>
              <Badge>{categoryLabel(viewIncident.category)}</Badge>
            </div>
            {viewIncident.adminNote ? (
              <div>
                <p className="text-sm font-medium text-deep-ink">Admin Note</p>
                <p className="text-sm text-stone">{viewIncident.adminNote}</p>
              </div>
            ) : null}
          </div>
        </Dialog>
      ) : null}

      {editIncident ? (
        <UpdateStatusDialog
          incident={editIncident}
          onClose={() => setEditIncident(null)}
          onSave={(status, adminNote) =>
            updateMutation.mutate({ id: editIncident.id, status, adminNote })
          }
          isSaving={updateMutation.isPending}
        />
      ) : null}

      {showDuplicates ? (
        <DuplicateClustersDialog
          clusters={duplicateClusters}
          incidentById={incidentById}
          onClose={() => setShowDuplicates(false)}
          onViewIncident={(incident) => {
            setShowDuplicates(false);
            setViewIncident(incident);
          }}
        />
      ) : null}
    </div>
  );
}

interface UpdateStatusDialogProps {
  incident: ClientIncident;
  onClose: () => void;
  onSave: (status: IncidentStatus, adminNote: string) => void;
  isSaving: boolean;
}

interface UpdateStatusFormValues {
  status: IncidentStatus;
  adminNote: string;
}

function UpdateStatusDialog({
  incident,
  onClose,
  onSave,
  isSaving,
}: UpdateStatusDialogProps): React.JSX.Element {
  const { register, handleSubmit, control } = useForm<UpdateStatusFormValues>({
    defaultValues: { status: incident.status, adminNote: incident.adminNote ?? '' },
  });

  const onSubmit = (values: UpdateStatusFormValues): void =>
    onSave(values.status, values.adminNote);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Update Status">
      <form
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex flex-col gap-4"
      >
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select
              label="Status"
              value={field.value}
              onValueChange={field.onChange}
              options={STATUS_OPTIONS}
            />
          )}
        />
        <Textarea label="Admin Note (internal)" {...register('adminNote')} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

interface DuplicateClustersDialogProps {
  clusters: DuplicateCluster[];
  incidentById: Map<string, ClientIncident>;
  onClose: () => void;
  onViewIncident: (incident: ClientIncident) => void;
}

/**
 * Lists every detected duplicate cluster as a "master incident thread":
 * the earliest report in bold, followed by the other reports judged to be
 * about the same event. Purely a read-only summary — clicking "View" opens
 * the existing single-incident detail dialog (closing this one first,
 * rather than stacking dialogs); there is no merge/delete action here,
 * since collapsing reports together is an irreversible data change this
 * page does not perform on its own.
 */
function DuplicateClustersDialog({
  clusters,
  incidentById,
  onClose,
  onViewIncident,
}: DuplicateClustersDialogProps): React.JSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Possible Duplicate Incident Threads"
      description="Reports filed close together in time and location — likely the same event."
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        {clusters.map((cluster) => {
          const members = cluster.reportIds
            .map((id) => incidentById.get(id))
            .filter((incident): incident is ClientIncident => incident !== undefined);
          const master = members.find((incident) => incident.id === cluster.masterId);
          const linkedReports = members.filter((incident) => incident.id !== cluster.masterId);
          if (!master) return null;

          return (
            <div
              key={cluster.masterId}
              className="flex flex-col gap-3 rounded-md border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-deep-ink">
                  {members.length} reports near {master.user?.city ?? 'an unknown location'}
                </p>
                <Badge variant="warning">Possible duplicate</Badge>
              </div>

              <DuplicateClusterMemberRow
                incident={master}
                roleLabel="Master report"
                onView={() => onViewIncident(master)}
              />
              {linkedReports.map((incident) => (
                <DuplicateClusterMemberRow
                  key={incident.id}
                  incident={incident}
                  roleLabel="Linked report"
                  onView={() => onViewIncident(incident)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}

interface DuplicateClusterMemberRowProps {
  incident: ClientIncident;
  roleLabel: 'Master report' | 'Linked report';
  onView: () => void;
}

function DuplicateClusterMemberRow({
  incident,
  roleLabel,
  onView,
}: DuplicateClusterMemberRowProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-gray-100 bg-gray-50 p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-stone">{roleLabel}</span>
        <span className="text-sm font-medium text-deep-ink">
          {truncate(incident.title, TITLE_TRUNCATE_LENGTH)}
        </span>
        <span className="text-xs text-stone">
          {incident.user?.name ?? 'Unknown reporter'} ·{' '}
          {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={onView}>
        View
      </Button>
    </div>
  );
}
