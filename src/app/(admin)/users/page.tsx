'use client';

import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

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
import {
  useDebouncedValue,
  useSuspendUserMutation,
  useUserDetailQuery,
  useUsersListQuery,
} from '@/hooks';
import type { UsersListResponse } from '@/services/users.service';

type ClientUser = UsersListResponse['users'][number];

export default function UsersPage(): React.JSX.Element {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [suspendUser, setSuspendUser] = useState<ClientUser | null>(null);

  const [cursor, setCursor] = useState<string | null>(null);
  const [prevSearch, setPrevSearch] = useState(debouncedSearch);
  const [prevData, setPrevData] = useState<UsersListResponse | undefined>(undefined);
  const [accumulatedUsers, setAccumulatedUsers] = useState<ClientUser[]>([]);

  if (debouncedSearch !== prevSearch) {
    setPrevSearch(debouncedSearch);
    setCursor(null);
  }

  const usersQuery = useUsersListQuery(debouncedSearch, cursor, undefined, 0);
  const detailQuery = useUserDetailQuery(viewUserId);
  const suspendMutation = useSuspendUserMutation();

  if (usersQuery.data && usersQuery.data !== prevData) {
    setPrevData(usersQuery.data);
    if (cursor === null) {
      setAccumulatedUsers(usersQuery.data.users);
    } else {
      const existingIds = new Set(accumulatedUsers.map((u: ClientUser): string => u.id));
      const newUsers = usersQuery.data.users.filter(
        (u: ClientUser): boolean => !existingIds.has(u.id),
      );
      setAccumulatedUsers([...accumulatedUsers, ...newUsers]);
    }
  }

  const isInitialLoading = usersQuery.isLoading && cursor === null;
  const isFetchingMore = usersQuery.isFetching && cursor !== null;
  const nextCursor = usersQuery.data?.nextCursor ?? null;

  const handleLoadMore = (): void => {
    if (nextCursor) {
      setCursor(nextCursor);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-deep-ink">Users</h1>
      <Input
        placeholder="Search by name or city…"
        value={search}
        onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
          setSearch(event.target.value)
        }
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
              {accumulatedUsers.map((user: ClientUser): React.JSX.Element => (
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(): void => setViewUserId(user.id)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={user.isSuspended}
                        onClick={(): void => setSuspendUser(user)}
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
        <Dialog
          open
          onOpenChange={(open: boolean): void => {
            if (!open) {
              setViewUserId(null);
            }
          }}
          title="User Profile"
        >
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
          onOpenChange={(open: boolean): void => {
            if (!open) {
              setSuspendUser(null);
            }
          }}
          title={`Suspend ${suspendUser.name}?`}
          description="They will no longer be able to sign in to the app."
          confirmLabel="Suspend"
          isLoading={suspendMutation.isPending}
          onConfirm={(): void => {
            suspendMutation.mutate(suspendUser.id, {
              onSuccess: (): void => {
                setAccumulatedUsers((prev: ClientUser[]): ClientUser[] =>
                  prev.map((u: ClientUser): ClientUser =>
                    u.id === suspendUser.id ? { ...u, isSuspended: true } : u,
                  ),
                );
                setSuspendUser(null);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
