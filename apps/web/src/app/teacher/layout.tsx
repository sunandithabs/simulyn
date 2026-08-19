'use client';

import { BarChart3, CircuitBoard, FileClock, LayoutDashboard, Users } from 'lucide-react';

import { AppShell, type NavItem } from '@/components/layout/app-shell';
import { SkeletonPanel } from '@/components/ui/skeleton';
import { useRequireRole } from '@/hooks/useAuth';

const NAV: NavItem[] = [
  { href: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/classes', label: 'Classes', icon: Users },
  { href: '/teacher/problems', label: 'Problems', icon: CircuitBoard },
  { href: '/teacher/exams', label: 'Exams', icon: FileClock },
  { href: '/teacher/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireRole('TEACHER');

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <SkeletonPanel lines={4} />
      </div>
    );
  }

  return (
    <AppShell role="TEACHER" nav={NAV}>
      {children}
    </AppShell>
  );
}
