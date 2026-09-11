'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

import { AlertDialog } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Textarea } from '@/components/ui/Textarea';
import { SHORT_DESCRIPTION_MAX_LENGTH, TITLE_TRUNCATE_LENGTH } from '@/constants/config';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { Law } from '@/types/firestore.types';

const lawSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  shortDescription: z
    .string()
    .min(1, 'Short description is required')
    .max(SHORT_DESCRIPTION_MAX_LENGTH),
  fullContent: z.string().min(1, 'Full content is required'),
  category: z.string().min(1, 'Category is required'),
  tags: z.string(),
  isPublished: z.boolean(),
});

type LawFormValues = z.infer<typeof lawSchema>;

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function LawsTab(): React.JSX.Element {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const [dialogLaw, setDialogLaw] = useState<Law | 'new' | null>(null);
  const [deleteLaw, setDeleteLaw] = useState<Law | null>(null);

  const lawsQuery = useQuery({
    queryKey: ['content', 'laws'],
    queryFn: () => apiFetch<Law[]>('/api/content/laws', idToken ?? ''),
    enabled: idToken !== null,
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['content', 'laws'] }).catch(() => undefined);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: LawFormValues & { id?: string }) => {
      const tags = values.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const body = JSON.stringify({ ...values, tags });
      if (values.id) {
        return apiFetch(`/api/content/laws/${values.id}`, idToken ?? '', { method: 'PUT', body });
      }
      return apiFetch('/api/content/laws', idToken ?? '', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success('Law saved');
      setDialogLaw(null);
      invalidate();
    },
    onError: () => toast.error('Failed to save law'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/content/laws/${id}`, idToken ?? '', { method: 'PATCH' }),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to update law'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/content/laws/${id}`, idToken ?? '', { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Law deleted');
      setDeleteLaw(null);
      invalidate();
    },
    onError: () => toast.error('Failed to delete law'),
  });

  if (lawsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-deep-ink">Laws</h2>
        <Button size="sm" onClick={() => setDialogLaw('new')}>
          <Plus className="h-4 w-4" />
          Add Law
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(lawsQuery.data ?? []).map((law) => (
            <TableRow key={law.id}>
              <TableCell>{truncate(law.title, TITLE_TRUNCATE_LENGTH)}</TableCell>
              <TableCell>
                <Badge>{law.category}</Badge>
              </TableCell>
              <TableCell>
                <Switch
                  checked={law.isPublished}
                  onCheckedChange={() => toggleMutation.mutate(law.id)}
                />
              </TableCell>
              <TableCell>{law.order}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setDialogLaw(law)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteLaw(law)}>
                    <Trash2 className="h-4 w-4 text-error-red" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {dialogLaw ? (
        <LawFormDialog
          law={dialogLaw === 'new' ? null : dialogLaw}
          onClose={() => setDialogLaw(null)}
          onSubmit={(values) =>
            saveMutation.mutate({ ...values, id: dialogLaw === 'new' ? undefined : dialogLaw.id })
          }
          isSaving={saveMutation.isPending}
        />
      ) : null}

      {deleteLaw ? (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setDeleteLaw(null)}
          title="Delete this law?"
          description="This permanently removes the law from the app. This cannot be undone."
          confirmLabel="Delete"
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteLaw.id)}
        />
      ) : null}
    </div>
  );
}

interface LawFormDialogProps {
  law: Law | null;
  onClose: () => void;
  onSubmit: (values: LawFormValues) => void;
  isSaving: boolean;
}

function LawFormDialog({
  law,
  onClose,
  onSubmit,
  isSaving,
}: LawFormDialogProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LawFormValues>({
    resolver: zodResolver(lawSchema),
    defaultValues: {
      title: law?.title ?? '',
      shortDescription: law?.shortDescription ?? '',
      fullContent: law?.fullContent ?? '',
      category: law?.category ?? '',
      tags: law?.tags.join(', ') ?? '',
      isPublished: law?.isPublished ?? false,
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={law ? 'Edit Law' : 'Add Law'}>
      <form
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex flex-col gap-4"
      >
        <Input label="Title" {...register('title')} error={errors.title?.message} />
        <Textarea
          label="Short Description"
          {...register('shortDescription')}
          error={errors.shortDescription?.message}
        />
        <Textarea
          label="Full Content"
          className="min-h-48"
          {...register('fullContent')}
          error={errors.fullContent?.message}
        />
        <Input label="Category" {...register('category')} error={errors.category?.message} />
        <Input label="Tags (comma-separated)" {...register('tags')} />
        <Controller
          control={control}
          name="isPublished"
          render={({ field }) => (
            <Switch label="Published" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
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
