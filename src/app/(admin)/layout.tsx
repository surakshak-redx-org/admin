'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { Sidebar } from '@/components/layout/Sidebar';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth/session';

export default function AdminLayout({ children }: { children: ReactNode }): React.JSX.Element {
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push('/login');
    }
  }, [isLoading, isAdmin, router]);

  if (isLoading || !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-off-white">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-off-white">{children}</main>
    </div>
  );
}
