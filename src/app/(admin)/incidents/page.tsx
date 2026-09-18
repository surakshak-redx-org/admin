'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
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
import { TITLE_TRUNCATE_LENGTH } from '@/constants/config';
import type { ClientIncident } from '@/hooks';
import { useIncidents } from '@/hooks';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { IncidentStatus } from '@/types/firestore.types';

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

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export default function IncidentsPage(): React.JSX.Element {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [viewIncident, setViewIncident] = useState<ClientIncident | null>(null);
  const [editIncident, setEditIncident] = useState<ClientIncident | null>(null);

  const incidentsQuery = useIncidents({ status: filter });

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

  const incidents = incidentsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-deep-ink">Incidents</h1>
      <Tabs
        items={FILTER_ITEMS}
        value={filter}
        onValueChange={(v) => setFilter(v as FilterValue)}
      />

      {incidentsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>User</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Photos</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell>{truncate(incident.title, TITLE_TRUNCATE_LENGTH)}</TableCell>
                <TableCell>{incident.user?.name ?? '—'}</TableCell>
                <TableCell>{incident.user?.city ?? '—'}</TableCell>
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
