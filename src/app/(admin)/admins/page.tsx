'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

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
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { Serialized } from '@/types/api.types';
import type { AdminUser } from '@/types/firestore.types';

type ClientAdmin = Serialized<AdminUser>;

interface AddAdminFormValues {
  email: string;
}

export default function AdminsPage(): React.JSX.Element {
  const { user, idToken } = useAuth();
  const queryClient = useQueryClient();
  const [removeAdmin, setRemoveAdmin] = useState<ClientAdmin | null>(null);
  const { register, handleSubmit, reset } = useForm<AddAdminFormValues>({
    defaultValues: { email: '' },
  });

  const adminsQuery = useQuery({
    queryKey: ['admins'],
    queryFn: () => apiFetch<ClientAdmin[]>('/api/admins', idToken ?? ''),
    enabled: idToken !== null && user?.role === 'super_admin',
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['admins'] }).catch(() => undefined);
  };

  const addMutation = useMutation({
    mutationFn: (email: string) =>
      apiFetch('/api/admins', idToken ?? '', { method: 'POST', body: JSON.stringify({ email }) }),
    onSuccess: () => {
      toast.success('Admin added');
      reset();
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || 'No Surakshak account with this email'),
  });

  const removeMutation = useMutation({
    mutationFn: (uid: string) =>
      apiFetch(`/api/admins/${uid}`, idToken ?? '', { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Admin removed');
      setRemoveAdmin(null);
      invalidate();
    },
    onError: () => toast.error('Failed to remove admin'),
  });

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
            {(adminsQuery.data ?? []).map((admin) => (
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
                    onClick={() => setRemoveAdmin(admin)}
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
            onSubmit={(event) =>
              void handleSubmit((values) => addMutation.mutate(values.email))(event)
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
          onOpenChange={(open) => !open && setRemoveAdmin(null)}
          title={`Remove ${removeAdmin.displayName} as admin?`}
          description="They will lose access immediately."
          confirmLabel="Remove"
          isLoading={removeMutation.isPending}
          onConfirm={() => removeMutation.mutate(removeAdmin.uid)}
        />
      ) : null}
    </div>
  );
}
