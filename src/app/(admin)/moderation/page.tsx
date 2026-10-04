'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
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
  COMMUNITY_REPORT_HIDE_THRESHOLD,
  CONTENT_PREVIEW_LENGTH,
  QUERY_ALWAYS_STALE_TIME_MS,
  REPORT_COUNT_DANGER_THRESHOLD,
} from '@/constants/config';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { Serialized } from '@/types/api.types';
import type { CommunityPost, PostType } from '@/types/firestore.types';

type ClientPost = Serialized<CommunityPost> & { id: string };

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

  const postsQuery = useQuery({
    queryKey: ['moderation'],
    queryFn: () => apiFetch<ClientPost[]>('/api/moderation', idToken ?? ''),
    enabled: idToken !== null,
    staleTime: QUERY_ALWAYS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['moderation'] }).catch(() => undefined);

    queryClient.invalidateQueries({ queryKey: ['community-posts'] }).catch(() => undefined);
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
      {/* What this queue is was never stated anywhere on the page (BUG-009). */}
      <div>
        <h1 className="text-2xl font-semibold text-deep-ink">Reported Posts</h1>
        <p className="mt-1 max-w-3xl text-sm text-stone">
          Community posts are hidden from the app automatically once{' '}
          {COMMUNITY_REPORT_HIDE_THRESHOLD} users report them. Review each one:{' '}
          <span className="font-medium">Restore</span> makes it visible again and clears its
          reports; <span className="font-medium">Delete</span> removes it permanently.
        </p>
      </div>

      {postsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : postsQuery.isError ? (
        <EmptyState
          icon={AlertCircle}
          iconClassName="h-10 w-10 text-error-red"
          title="Couldn't load reported posts"
          subtitle="Refresh the page to try again."
        />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          iconClassName="h-10 w-10 text-forest-green"
          title="All clear — no posts need review"
          subtitle="Posts appear here once they are hidden by user reports."
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
          description="The post and its report history are removed for everyone. This cannot be undone."
          confirmLabel="Delete"
          isLoading={actionMutation.isPending}
          onConfirm={() => actionMutation.mutate({ id: deletePost.id, action: 'delete' })}
        />
      ) : null}
    </div>
  );
}
