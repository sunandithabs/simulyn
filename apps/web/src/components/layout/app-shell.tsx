'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  Flame,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ThemeSwitcher } from '@/components/brand/theme-switcher';
import { useLockdown } from '@/components/layout/lockdown';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LevelMeter } from '@/components/ui/meter';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { GamificationMe, Role } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const COLLAPSE_KEY = 'simulyn.sidebar.collapsed';

export function AppShell({
  role,
  nav,
  children,
}: {
  role: Role;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const { locked } = useLockdown();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [progress, setProgress] = useState<GamificationMe | null>(null);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (role !== 'STUDENT') return;
    let alive = true;
    api
      .get<GamificationMe>('/gamification/me')
      .then((data) => alive && setProgress(data))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [role, pathname]);

  const isActive = (href: string) =>
    pathname === href || (href !== `/${role.toLowerCase()}` && pathname.startsWith(`${href}/`));

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className={cn('flex items-center gap-2.5 px-4 py-5', collapsed && 'justify-center px-0')}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brass/40 bg-brass/12 font-mono text-sm font-bold text-brass-lit">
          S
        </span>
        {!collapsed ? (
          <div className="min-w-0">
            <div className="brand-mark text-sm font-semibold tracking-[-0.02em]">SIMULYN</div>
            <div className="instrument">{role.toLowerCase()}</div>
          </div>
        ) : null}
      </div>

      <ul className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition-all duration-200',
                  collapsed && 'justify-center px-0',
                  active
                    ? 'bg-violet/18 text-paper'
                    : 'text-muted hover:bg-white/[0.04] hover:text-paper',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-violet-lit"
                    transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                  />
                ) : null}
                <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="p-3">
        <button
          onClick={() => setCollapsed((value) => !value)}
          className={cn(
            'hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-faint transition-colors hover:text-paper lg:flex',
            collapsed && 'justify-center px-0',
          )}
        >
          <ChevronLeft
            className={cn('h-4 w-4 transition-transform duration-300', collapsed && 'rotate-180')}
          />
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/*
        Desktop rail. During a locked-down exam the chrome is hidden rather
        than unmounted: removing it would reshape the tree and remount the exam
        page, losing the attempt and every answer typed so far.
      */}
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-ink-raised/40 backdrop-blur-xl transition-[width] duration-300',
          locked ? 'lg:hidden' : 'lg:block',
          collapsed ? 'w-[72px]' : 'w-[228px]',
        )}
      >
        {sidebar}
      </aside>

      {/* Mobile drawer — never openable while an exam is locked down. */}
      <AnimatePresence>
        {mobileOpen && !locked ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-ink/80 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-[228px] border-r border-line bg-ink-raised lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-5 right-3 text-muted hover:text-paper"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              {sidebar}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            'sticky top-0 z-30 border-b border-line bg-ink/75 backdrop-blur-xl',
            locked && 'hidden',
          )}
        >
          <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-muted transition-colors hover:text-paper lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {role === 'STUDENT' ? (
              <div className="flex min-w-0 flex-1 items-center gap-5">
                {progress ? (
                  <>
                    <LevelMeter
                      xp={progress.xp}
                      level={progress.level}
                      thresholds={progress.levelThresholds}
                      className="hidden w-52 sm:block"
                      compact
                    />
                    <div className="flex items-center gap-1.5" title="Current streak">
                      <Flame
                        className={cn(
                          'h-4 w-4',
                          progress.currentStreak > 0 ? 'text-brass-lit' : 'text-faint',
                        )}
                        strokeWidth={1.6}
                      />
                      <span className="font-mono text-[13px] text-paper tabular">
                        {progress.currentStreak}
                      </span>
                      <span className="instrument hidden sm:inline">day streak</span>
                    </div>
                    <div className="hidden items-center gap-1.5 md:flex">
                      <span className="font-mono text-[13px] text-brass-lit tabular">
                        {progress.xp.toLocaleString()}
                      </span>
                      <span className="instrument">xp</span>
                    </div>
                  </>
                ) : (
                  <Skeleton className="h-4 w-52" />
                )}
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <span className="instrument">{role.toLowerCase()} console</span>
              </div>
            )}

            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-[13px] font-medium text-paper">{user?.displayName}</div>
                <div className="font-mono text-[10px] text-faint">@{user?.username}</div>
              </div>
              <Avatar name={user?.displayName ?? '?'} avatar={user?.avatar} size="sm" />
              <ThemeSwitcher />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void logout()}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Fades each page in — one gesture, applied consistently. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
