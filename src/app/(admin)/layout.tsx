'use client';

import { Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { NewIncidentNotifier } from '@/components/features/incidents/NewIncidentNotifier';
import { Sidebar } from '@/components/layout/Sidebar';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth/session';

interface AdminLayoutProps {
  children: ReactNode;
}

const LOGIN_PATH = '/login';
const APP_NAME = 'Surakshak Admin';
const OPEN_MENU_LABEL = 'Open menu';

export default function AdminLayout({ children }: AdminLayoutProps): React.JSX.Element {
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const openMenu = useCallback((): void => {
    setIsMenuOpen(true);
  }, []);

  const closeMenu = useCallback((): void => {
    setIsMenuOpen(false);
  }, []);

  useEffect((): void => {
    if (!isLoading && !isAdmin) {
      router.push(LOGIN_PATH);
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
      <Sidebar isOpen={isMenuOpen} onClose={closeMenu} />
      <NewIncidentNotifier />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            aria-label={OPEN_MENU_LABEL}
            aria-expanded={isMenuOpen}
            onClick={openMenu}
            className="rounded-md p-1 text-deep-ink hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shakti-purple"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="text-base font-semibold text-deep-ink">{APP_NAME}</span>
        </header>
        <main className="flex-1 overflow-auto bg-off-white">{children}</main>
      </div>
    </div>
  );
}
