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
import { TITLE_TRUNCATE_LENGTH } from '@/constants/config';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { SafetyTip } from '@/types/firestore.types';

const tipSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  category: z.string().min(1, 'Category is required'),
  isPublished: z.boolean(),
});

type TipFormValues = z.infer<typeof tipSchema>;

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function TipsTab(): React.JSX.Element {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const [dialogTip, setDialogTip] = useState<SafetyTip | 'new' | null>(null);
  const [deleteTip, setDeleteTip] = useState<SafetyTip | null>(null);

  const tipsQuery = useQuery({
    queryKey: ['content', 'tips'],
    queryFn: () => apiFetch<SafetyTip[]>('/api/content/tips', idToken ?? ''),
    enabled: idToken !== null,
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['content', 'tips'] }).catch(() => undefined);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: TipFormValues & { id?: string }) => {
      const body = JSON.stringify(values);
      if (values.id) {
        return apiFetch(`/api/content/tips/${values.id}`, idToken ?? '', { method: 'PUT', body });
      }
      return apiFetch('/api/content/tips', idToken ?? '', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success('Safety tip saved');
      setDialogTip(null);
      invalidate();
    },
    onError: () => toast.error('Failed to save safety tip'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/content/tips/${id}`, idToken ?? '', { method: 'PATCH' }),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to update safety tip'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/content/tips/${id}`, idToken ?? '', { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Safety tip deleted');
      setDeleteTip(null);
      invalidate();
    },
    onError: () => toast.error('Failed to delete safety tip'),
  });

  if (tipsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-deep-ink">Safety Tips</h2>
        <Button size="sm" onClick={() => setDialogTip('new')}>
          <Plus className="h-4 w-4" />
          Add Tip
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
          {(tipsQuery.data ?? []).map((tip) => (
            <TableRow key={tip.id}>
              <TableCell>{truncate(tip.title, TITLE_TRUNCATE_LENGTH)}</TableCell>
              <TableCell>
                <Badge>{tip.category}</Badge>
              </TableCell>
              <TableCell>
                <Switch
                  checked={tip.isPublished}
                  onCheckedChange={() => toggleMutation.mutate(tip.id)}
                />
              </TableCell>
              <TableCell>{tip.order}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setDialogTip(tip)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTip(tip)}>
                    <Trash2 className="h-4 w-4 text-error-red" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {dialogTip ? (
        <TipFormDialog
          tip={dialogTip === 'new' ? null : dialogTip}
          onClose={() => setDialogTip(null)}
          onSubmit={(values) =>
            saveMutation.mutate({ ...values, id: dialogTip === 'new' ? undefined : dialogTip.id })
          }
          isSaving={saveMutation.isPending}
        />
      ) : null}

      {deleteTip ? (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setDeleteTip(null)}
          title="Delete this safety tip?"
          description="This permanently removes the tip from the app. This cannot be undone."
          confirmLabel="Delete"
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTip.id)}
        />
      ) : null}
    </div>
  );
}

interface TipFormDialogProps {
  tip: SafetyTip | null;
  onClose: () => void;
  onSubmit: (values: TipFormValues) => void;
  isSaving: boolean;
}

function TipFormDialog({
  tip,
  onClose,
  onSubmit,
  isSaving,
}: TipFormDialogProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TipFormValues>({
    resolver: zodResolver(tipSchema),
    defaultValues: {
      title: tip?.title ?? '',
      content: tip?.content ?? '',
      category: tip?.category ?? '',
      isPublished: tip?.isPublished ?? false,
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={tip ? 'Edit Safety Tip' : 'Add Safety Tip'}
    >
      <form
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex flex-col gap-4"
      >
        <Input label="Title" {...register('title')} error={errors.title?.message} />
        <Textarea label="Content" {...register('content')} error={errors.content?.message} />
        <Input label="Category" {...register('category')} error={errors.category?.message} />
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
