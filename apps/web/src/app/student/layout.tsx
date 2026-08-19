'use client';

import { CircuitBoard, FileClock, LayoutDashboard, Trophy, User } from 'lucide-react';

import { AppShell, type NavItem } from '@/components/layout/app-shell';
import { LockdownProvider } from '@/components/layout/lockdown';
import { SkeletonPanel } from '@/components/ui/skeleton';
import { useRequireRole } from '@/hooks/useAuth';

const NAV: NavItem[] = [
  { href: '/student', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/student/problems', label: 'Problems', icon: CircuitBoard },
  { href: '/student/exams', label: 'Exams', icon: FileClock },
  { href: '/student/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/student/profile', label: 'Profile', icon: User },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireRole('STUDENT');

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <SkeletonPanel lines={4} />
      </div>
    );
  }

  return (
    <LockdownProvider>
      <AppShell role="STUDENT" nav={NAV}>
        {children}
      </AppShell>
    </LockdownProvider>
  );
}
