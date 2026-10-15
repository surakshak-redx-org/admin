'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useTogglePublished } from '@/components/features/content/useTogglePublished';
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
import { useDeleteLawMutation, useLawsQuery, useSaveLawMutation } from '@/hooks';
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
  const [dialogLaw, setDialogLaw] = useState<Law | 'new' | null>(null);
  const [deleteLaw, setDeleteLaw] = useState<Law | null>(null);
  const lawsQuery = useLawsQuery();
  const saveMutation = useSaveLawMutation();
  const deleteMutation = useDeleteLawMutation();
  const publish = useTogglePublished<Law>('laws', 'Law');

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
        <Button size="sm" onClick={(): void => setDialogLaw('new')}>
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
          {(lawsQuery.data ?? []).map((law: Law): React.JSX.Element => (
            <TableRow key={law.id}>
              <TableCell>{truncate(law.title, TITLE_TRUNCATE_LENGTH)}</TableCell>
              <TableCell>
                <Badge>{law.category}</Badge>
              </TableCell>
              <TableCell>
                <Switch
                  checked={law.isPublished}
                  onCheckedChange={(checked: boolean): void => publish.toggle(law.id, checked)}
                  disabled={publish.pendingId === law.id}
                />
              </TableCell>
              <TableCell>{law.order}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={(): void => setDialogLaw(law)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(): void => setDeleteLaw(law)}>
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
          onClose={(): void => setDialogLaw(null)}
          onSubmit={(values: LawFormValues): void => {
            const tags = values.tags
              .split(',')
              .map((tag: string): string => tag.trim())
              .filter(Boolean);
            saveMutation.mutate(
              dialogLaw === 'new' ? { ...values, tags } : { ...values, tags, id: dialogLaw.id },
              {
                onSuccess: (): void => {
                  setDialogLaw(null);
                },
              },
            );
          }}
          isSaving={saveMutation.isPending}
        />
      ) : null}

      {deleteLaw ? (
        <AlertDialog
          open
          onOpenChange={(open: boolean): void => {
            if (!open) {
              setDeleteLaw(null);
            }
          }}
          title="Delete this law?"
          description="This permanently removes the law from the app. This cannot be undone."
          confirmLabel="Delete"
          isLoading={deleteMutation.isPending}
          onConfirm={(): void => {
            deleteMutation.mutate(deleteLaw.id, {
              onSuccess: (): void => {
                setDeleteLaw(null);
              },
            });
          }}
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
    <Dialog
      open
      onOpenChange={(open: boolean): void => {
        if (!open) {
          onClose();
        }
      }}
      title={law ? 'Edit Law' : 'Add Law'}
    >
      <form
        onSubmit={(event: React.FormEvent<HTMLFormElement>): void =>
          void handleSubmit(onSubmit)(event)
        }
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
          render={({ field }): React.JSX.Element => (
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
