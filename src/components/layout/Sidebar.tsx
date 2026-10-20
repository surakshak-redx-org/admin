'use client';

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
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

const APP_NAME = 'Surakshak Admin';
const NAV_LABEL = 'Main navigation';
const SIGN_OUT_LABEL = 'Sign Out';
const SUPER_ADMIN_ROLE = 'super_admin';
const ROOT_HREF = '/';
const FOCUS_RING_CLASSES =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shakti-purple';

const NAV_ITEMS: NavItem[] = [
  { href: ROOT_HREF, label: 'Dashboard', icon: LayoutDashboard },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/unsafe-areas', label: 'Unsafe Areas', icon: MapPin },
  { href: '/moderation', label: 'Reported Posts', icon: Shield },
  { href: '/community-posts', label: 'Community Posts', icon: MessageSquare },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/admins', label: 'Admins', icon: UserCheck, superAdminOnly: true },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === ROOT_HREF) {
    return pathname === ROOT_HREF;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const { user, signOutAdmin } = useAuth();

  const handleSignOut = (): void => {
    signOutAdmin().catch((): undefined => undefined);
  };

  const visibleItems = NAV_ITEMS.filter(
    (item: NavItem): boolean => !item.superAdminOnly || user?.role === SUPER_ADMIN_ROLE,
  );

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <ShieldCheck className="h-6 w-6 text-shakti-purple" aria-hidden="true" />
        <span className="text-base font-semibold text-deep-ink">{APP_NAME}</span>
      </div>

      <nav aria-label={NAV_LABEL} className="flex-1 space-y-1 px-3">
        {visibleItems.map((item: NavItem): React.JSX.Element => {
          const isActive = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                FOCUS_RING_CLASSES,
                isActive
                  ? 'bg-shakti-purple/10 text-shakti-purple'
                  : 'text-stone hover:bg-gray-100 hover:text-deep-ink',
              )}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
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
            type="button"
            onClick={handleSignOut}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-stone hover:bg-gray-100 hover:text-error-red',
              FOCUS_RING_CLASSES,
            )}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {SIGN_OUT_LABEL}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
