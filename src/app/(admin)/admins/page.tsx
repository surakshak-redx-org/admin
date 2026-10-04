'use client';

import { formatDistanceToNow } from 'date-fns';
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

export default function AdminsPage(): React.JSX.Element {
  const { user } = useAuth();
  const [removeAdmin, setRemoveAdmin] = useState<AdminUserWithId | null>(null);
  const { register, handleSubmit, reset } = useForm<AddAdminFormValues>({
    defaultValues: { email: '' },
  });

  const adminsQuery = useAdminsQuery();
  const addMutation = useAddAdminMutation();
  const removeMutation = useRemoveAdminMutation();

  if (user?.role !== 'super_admin') {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-stone">You don&apos;t have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-deep-ink">Admins</h1>

      {adminsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
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
                  <Badge variant={admin.role === 'super_admin' ? 'info' : 'default'}>
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
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add Admin</CardTitle>
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
          description="They will lose access immediately."
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
