'use client';

import { formatDistanceToNow } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AlertDialog } from '@/components/ui/AlertDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
import { useAddAdminMutation, useAdminsQuery, useRemoveAdminMutation } from '@/hooks';
import { useAuth } from '@/lib/auth/session';
import type { AdminUserWithId } from '@/services/admins.service';

interface AddAdminFormValues {
  email: string;
}

const PAGE_TITLE = 'Admins';
const ADD_ADMIN_TITLE = 'Add Admin';
const LOAD_ERROR_MESSAGE = 'Could not load admins.';
const REMOVE_DESCRIPTION = 'They will lose access immediately.';
const SUPER_ADMIN_ROLE = 'super_admin';

export default function AdminsPage(): React.JSX.Element {
  const { user } = useAuth();
  const [removeAdmin, setRemoveAdmin] = useState<AdminUserWithId | null>(null);
  const { register, handleSubmit, reset } = useForm<AddAdminFormValues>({
    defaultValues: { email: '' },
  });

  const adminsQuery = useAdminsQuery();
  const addMutation = useAddAdminMutation();
  const removeMutation = useRemoveAdminMutation();

  if (user?.role !== SUPER_ADMIN_ROLE) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-stone">You don&apos;t have permission to view this page.</p>
      </div>
    );
  }

  const handleRetry = (): void => {
    void adminsQuery.refetch();
  };

  let content: React.JSX.Element;

  if (adminsQuery.isLoading) {
    content = (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  } else if (adminsQuery.isError) {
    content = (
      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-error-red" aria-hidden="true" />
            <p className="text-sm text-error-red">{LOAD_ERROR_MESSAGE}</p>
          </div>
          <Button variant="outline" isLoading={adminsQuery.isFetching} onClick={handleRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  } else {
    content = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Admin</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(adminsQuery.data ?? []).map((admin: AdminUserWithId): React.JSX.Element => (
            <TableRow key={admin.uid}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar name={admin.displayName} src={admin.photoUrl} size="sm" />
                  <span>{admin.displayName}</span>
                </div>
              </TableCell>
              <TableCell>{admin.email}</TableCell>
              <TableCell>
                <Badge variant={admin.role === SUPER_ADMIN_ROLE ? 'info' : 'default'}>
                  {admin.role}
                </Badge>
              </TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(admin.createdAt), { addSuffix: true })}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={admin.uid === user.uid}
                  onClick={(): void => setRemoveAdmin(admin)}
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-deep-ink">{PAGE_TITLE}</h1>

      {content}

      <Card>
        <CardHeader>
          <CardTitle>{ADD_ADMIN_TITLE}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event: React.FormEvent<HTMLFormElement>): void =>
              void handleSubmit((values: AddAdminFormValues): void => {
                addMutation.mutate(values.email, {
                  onSuccess: (): void => {
                    reset();
                  },
                });
              })(event)
            }
            className="flex items-end gap-3"
          >
            <Input label="Email address" type="email" {...register('email', { required: true })} />
            <Button type="submit" isLoading={addMutation.isPending}>
              Add Admin
            </Button>
          </form>
        </CardContent>
      </Card>

      {removeAdmin ? (
        <AlertDialog
          open
          onOpenChange={(open: boolean): void => {
            if (!open) {
              setRemoveAdmin(null);
            }
          }}
          title={`Remove ${removeAdmin.displayName} as admin?`}
          description={REMOVE_DESCRIPTION}
          confirmLabel="Remove"
          isLoading={removeMutation.isPending}
          onConfirm={(): void => {
            removeMutation.mutate(removeAdmin.uid, {
              onSuccess: (): void => {
                setRemoveAdmin(null);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
