'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { AlertDialog } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  CONTENT_PREVIEW_LENGTH,
  REPORT_COUNT_DANGER_THRESHOLD,
} from '@/constants/config';
import type { ClientPost } from '@/hooks';
import { useModeration } from '@/hooks';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { PostType } from '@/types/firestore.types';

const TYPE_VARIANT: Record<PostType, BadgeVariant> = {
  help_request: 'error',
  location: 'info',
  image: 'default',
  text: 'default',
};

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export default function ModerationPage(): React.JSX.Element {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const [restorePost, setRestorePost] = useState<ClientPost | null>(null);
  const [deletePost, setDeletePost] = useState<ClientPost | null>(null);

  const postsQuery = useModeration();

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['moderation'] }).catch(() => undefined);
  };

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'restore' | 'delete' }) =>
      apiFetch(`/api/moderation/${id}`, idToken ?? '', {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.action === 'restore'
          ? 'Post restored and visible again'
          : 'Post permanently deleted',
      );
      setRestorePost(null);
      setDeletePost(null);
      invalidate();
    },
    onError: () => toast.error('Failed to update post'),
  });

  const posts = postsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-deep-ink">Moderation</h1>

      {postsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          iconClassName="h-10 w-10 text-forest-green"
          title="All clear — no posts need review"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Content Preview</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Reports</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => (
              <TableRow key={post.id}>
                <TableCell className="max-w-xs">
                  {truncate(post.content, CONTENT_PREVIEW_LENGTH)}
                </TableCell>
                <TableCell>{post.isAnonymous ? 'Anonymous' : post.authorName}</TableCell>
                <TableCell>{post.city}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      post.reportCount >= REPORT_COUNT_DANGER_THRESHOLD ? 'error' : 'default'
                    }
                  >
                    {post.reportCount}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[post.type]}>{post.type}</Badge>
                </TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setRestorePost(post)}>
                      Restore
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeletePost(post)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {restorePost ? (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setRestorePost(null)}
          title="Restore this post?"
          description="This will make the post visible again and reset report count."
          confirmLabel="Restore"
          confirmVariant="default"
          isLoading={actionMutation.isPending}
          onConfirm={() => actionMutation.mutate({ id: restorePost.id, action: 'restore' })}
        />
      ) : null}

      {deletePost ? (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setDeletePost(null)}
          title="Permanently delete this post?"
          description="Cannot be undone."
          confirmLabel="Delete"
          isLoading={actionMutation.isPending}
          onConfirm={() => actionMutation.mutate({ id: deletePost.id, action: 'delete' })}
        />
      ) : null}
    </div>
  );
}
