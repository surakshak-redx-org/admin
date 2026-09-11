'use client';

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/unsafe-areas', label: 'Unsafe Areas', icon: MapPin },
  { href: '/moderation', label: 'Moderation', icon: Shield },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/admins', label: 'Admins', icon: UserCheck, superAdminOnly: true },
];

export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const { user, signOutAdmin } = useAuth();

  const handleSignOut = (): void => {
    signOutAdmin().catch(() => undefined);
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <ShieldCheck className="h-6 w-6 text-shakti-purple" />
        <span className="text-base font-semibold text-deep-ink">Surakshak Admin</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.filter((item) => !item.superAdminOnly || user?.role === 'super_admin').map(
          (item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-shakti-purple/10 text-shakti-purple'
                    : 'text-stone hover:bg-gray-100 hover:text-deep-ink',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          },
        )}
      </nav>

      {user ? (
        <div className="border-t border-gray-200 p-4">
          <div className="mb-3 flex items-center gap-3">
            <Avatar src={user.photoUrl} name={user.displayName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-deep-ink">{user.displayName}</p>
              <p className="truncate text-xs text-stone">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-stone hover:bg-gray-100 hover:text-error-red"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      ) : null}
    </aside>
  );
}
