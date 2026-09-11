'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { AlertDialog } from '@/components/ui/AlertDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { SEARCH_DEBOUNCE_MS } from '@/constants/config';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { Serialized } from '@/types/api.types';
import type { SurakshakUser } from '@/types/firestore.types';

type ClientUser = Serialized<Omit<SurakshakUser, 'phone'>> & { id: string };

interface UsersResponse {
  users: ClientUser[];
  nextCursor: string | null;
}

interface UserDetail {
  user: ClientUser;
  postCount: number;
  incidentCount: number;
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect((): (() => void) => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function UsersPage(): React.JSX.Element {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [suspendUser, setSuspendUser] = useState<ClientUser | null>(null);

  // One query per page of results. `pageCursors` grows via "Load more";
  // it resets to a single first page whenever the (debounced) search term
  // changes — done here, during render, rather than in an effect, so a
  // search-term change and the page reset land in the same render pass.
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const [committedSearch, setCommittedSearch] = useState(debouncedSearch);
  if (debouncedSearch !== committedSearch) {
    setCommittedSearch(debouncedSearch);
    setPageCursors([null]);
  }

  const pageQueries = useQueries({
    queries: pageCursors.map((cursor) => ({
      queryKey: ['users', committedSearch, cursor],
      queryFn: (): Promise<UsersResponse> => {
        const params = new URLSearchParams();
        if (committedSearch) params.set('search', committedSearch);
        if (cursor) params.set('cursor', cursor);
        return apiFetch<UsersResponse>(`/api/users?${params.toString()}`, idToken ?? '');
      },
      enabled: idToken !== null,
    })),
  });

  const accumulated = pageQueries.flatMap((page) => page.data?.users ?? []);
  const isInitialLoading = pageQueries[0]?.isLoading ?? false;
  const isFetchingMore =
    pageQueries.length > 1 && (pageQueries[pageQueries.length - 1]?.isFetching ?? false);
  const nextCursor = pageQueries[pageQueries.length - 1]?.data?.nextCursor ?? null;

  const handleLoadMore = (): void => {
    if (nextCursor) setPageCursors((prev) => [...prev, nextCursor]);
  };

  const detailQuery = useQuery({
    queryKey: ['user', viewUserId],
    queryFn: () => apiFetch<UserDetail>(`/api/users/${viewUserId ?? ''}`, idToken ?? ''),
    enabled: idToken !== null && viewUserId !== null,
  });

  const suspendMutation = useMutation({
    mutationFn: (uid: string) =>
      apiFetch(`/api/users/${uid}`, idToken ?? '', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'suspend' }),
      }),
    onSuccess: () => {
      toast.success('User suspended');
      setSuspendUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] }).catch(() => undefined);
    },
    onError: () => toast.error('Failed to suspend user'),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-deep-ink">Users</h1>
      <Input
        placeholder="Search by name or city…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-sm"
      />

      {isInitialLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accumulated.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar name={user.name} src={user.profilePhotoUrl} size="sm" />
                      <span>{user.name}</span>
                      {user.isSuspended ? <Badge variant="error">Suspended</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell>{user.city}</TableCell>
                  <TableCell>
                    <Badge>{user.language.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setViewUserId(user.id)}>
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={user.isSuspended}
                        onClick={() => setSuspendUser(user)}
                      >
                        Suspend
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {nextCursor ? (
            <div className="flex justify-center">
              <Button variant="outline" isLoading={isFetchingMore} onClick={handleLoadMore}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}

      {viewUserId ? (
        <Dialog open onOpenChange={(open) => !open && setViewUserId(null)} title="User Profile">
          {detailQuery.isLoading || !detailQuery.data ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <Avatar
                name={detailQuery.data.user.name}
                src={detailQuery.data.user.profilePhotoUrl}
                size="lg"
              />
              <div>
                <p className="text-lg font-semibold text-deep-ink">{detailQuery.data.user.name}</p>
                <p className="text-sm text-stone">
                  {detailQuery.data.user.city} · {detailQuery.data.user.language.toUpperCase()}
                </p>
              </div>
              {detailQuery.data.user.isSuspended ? <Badge variant="error">Suspended</Badge> : null}
              <p className="text-sm text-stone">
                Member since{' '}
                {formatDistanceToNow(new Date(detailQuery.data.user.createdAt), {
                  addSuffix: true,
                })}
              </p>
              <div className="flex gap-6 text-sm text-deep-ink">
                <span>{detailQuery.data.postCount} posts</span>
                <span>{detailQuery.data.incidentCount} incident reports</span>
              </div>
            </div>
          )}
        </Dialog>
      ) : null}

      {suspendUser ? (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setSuspendUser(null)}
          title={`Suspend ${suspendUser.name}?`}
          description="They will no longer be able to sign in to the app."
          confirmLabel="Suspend"
          isLoading={suspendMutation.isPending}
          onConfirm={() => suspendMutation.mutate(suspendUser.id)}
        />
      ) : null}
    </div>
  );
}
