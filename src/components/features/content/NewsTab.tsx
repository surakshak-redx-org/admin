'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
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
import type { Serialized } from '@/types/api.types';
import type { NewsItem } from '@/types/firestore.types';

type ClientNewsItem = Serialized<NewsItem> & { id: string };

const newsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  summary: z.string().min(1, 'Summary is required'),
  content: z.string().min(1, 'Content is required'),
  imageUrl: z.string(),
  category: z.string().min(1, 'Category is required'),
  isPublished: z.boolean(),
  publishedAt: z.string(),
});

type NewsFormValues = z.infer<typeof newsSchema>;

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function NewsTab(): React.JSX.Element {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const [dialogNews, setDialogNews] = useState<ClientNewsItem | 'new' | null>(null);
  const [deleteNews, setDeleteNews] = useState<ClientNewsItem | null>(null);

  const newsQuery = useQuery({
    queryKey: ['content', 'news'],
    queryFn: () => apiFetch<ClientNewsItem[]>('/api/content/news', idToken ?? ''),
    enabled: idToken !== null,
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['content', 'news'] }).catch(() => undefined);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: NewsFormValues & { id?: string }) => {
      const body = JSON.stringify(values);
      if (values.id) {
        return apiFetch(`/api/content/news/${values.id}`, idToken ?? '', { method: 'PUT', body });
      }
      return apiFetch('/api/content/news', idToken ?? '', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success('News item saved');
      setDialogNews(null);
      invalidate();
    },
    onError: () => toast.error('Failed to save news item'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/content/news/${id}`, idToken ?? '', { method: 'PATCH' }),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to update news item'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/content/news/${id}`, idToken ?? '', { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('News item deleted');
      setDeleteNews(null);
      invalidate();
    },
    onError: () => toast.error('Failed to delete news item'),
  });

  if (newsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-deep-ink">News</h2>
        <Button size="sm" onClick={() => setDialogNews('new')}>
          <Plus className="h-4 w-4" />
          Add News
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Published At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(newsQuery.data ?? []).map((news) => (
            <TableRow key={news.id}>
              <TableCell>{truncate(news.title, TITLE_TRUNCATE_LENGTH)}</TableCell>
              <TableCell>
                <Badge>{news.category}</Badge>
              </TableCell>
              <TableCell>
                <Switch
                  checked={news.isPublished}
                  onCheckedChange={() => toggleMutation.mutate(news.id)}
                />
              </TableCell>
              <TableCell>{format(new Date(news.publishedAt), 'PP')}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setDialogNews(news)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteNews(news)}>
                    <Trash2 className="h-4 w-4 text-error-red" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {dialogNews ? (
        <NewsFormDialog
          news={dialogNews === 'new' ? null : dialogNews}
          onClose={() => setDialogNews(null)}
          onSubmit={(values) =>
            saveMutation.mutate({ ...values, id: dialogNews === 'new' ? undefined : dialogNews.id })
          }
          isSaving={saveMutation.isPending}
        />
      ) : null}

      {deleteNews ? (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setDeleteNews(null)}
          title="Delete this news item?"
          description="This permanently removes the news item from the app. This cannot be undone."
          confirmLabel="Delete"
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteNews.id)}
        />
      ) : null}
    </div>
  );
}

interface NewsFormDialogProps {
  news: ClientNewsItem | null;
  onClose: () => void;
  onSubmit: (values: NewsFormValues) => void;
  isSaving: boolean;
}

function NewsFormDialog({
  news,
  onClose,
  onSubmit,
  isSaving,
}: NewsFormDialogProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<NewsFormValues>({
    resolver: zodResolver(newsSchema),
    defaultValues: {
      title: news?.title ?? '',
      summary: news?.summary ?? '',
      content: news?.content ?? '',
      imageUrl: news?.imageUrl ?? '',
      category: news?.category ?? '',
      isPublished: news?.isPublished ?? false,
      publishedAt: news
        ? format(new Date(news.publishedAt), "yyyy-MM-dd'T'HH:mm")
        : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={news ? 'Edit News' : 'Add News'}
    >
      <form
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex flex-col gap-4"
      >
        <Input label="Title" {...register('title')} error={errors.title?.message} />
        <Textarea label="Summary" {...register('summary')} error={errors.summary?.message} />
        <Textarea
          label="Content"
          className="min-h-32"
          {...register('content')}
          error={errors.content?.message}
        />
        <Input label="Image URL (optional)" {...register('imageUrl')} />
        <Input label="Category" {...register('category')} error={errors.category?.message} />
        <Input type="datetime-local" label="Published At" {...register('publishedAt')} />
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
