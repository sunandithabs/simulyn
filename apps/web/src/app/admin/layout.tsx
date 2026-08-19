'use client';

import { GraduationCap, LayoutDashboard, Settings, Users } from 'lucide-react';

import { AppShell, type NavItem } from '@/components/layout/app-shell';
import { SkeletonPanel } from '@/components/ui/skeleton';
import { useRequireRole } from '@/hooks/useAuth';

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/classes', label: 'Classes', icon: GraduationCap },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireRole('ADMIN');

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <SkeletonPanel lines={4} />
      </div>
    );
  }

  return (
    <AppShell role="ADMIN" nav={NAV}>
      {children}
    </AppShell>
  );
}
