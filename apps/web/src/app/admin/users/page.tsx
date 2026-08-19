'use client';

import {
  AlertTriangle,
  Ban,
  Check,
  Pencil,
  Search,
  Upload,
  UserPlus,
  Users,
  VenetianMask,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Field, Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { HOME_ROUTE, useAuth } from '@/hooks/useAuth';
import { api, query } from '@/lib/api';
import { setAccessToken } from '@/lib/api';
import type { AdminUser, AuthResponse, Paginated, Role } from '@/lib/types';
import { cn, formatDate, relativeTime } from '@/lib/utils';

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-96 w-full" /></div>}>
      <UsersTable />
    </Suspense>
  );
}

function UsersTable() {
  const params = useSearchParams();
  const { user: me, setUser } = useAuth();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<AdminUser> | null>(null);

  const [createOpen, setCreateOpen] = useState(params.get('new') === '1');
  const [importOpen, setImportOpen] = useState(params.get('import') === '1');
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const load = useCallback(() => {
    setResult(null);
    void api
      .get<Paginated<AdminUser>>(
        `/users${query({ search, role, isActive: active, page, limit: PAGE_SIZE, sortBy: 'createdAt', order: 'desc' })}`,
      )
      .then(setResult)
      .catch(() => setResult(null));
  }, [search, role, active, page]);

  useEffect(load, [load]);
  useEffect(() => setPage(1), [search, role, active]);

  async function impersonate(target: AdminUser) {
    if (
      !window.confirm(
        `Sign in as ${target.displayName}? Your admin session ends and this is recorded in the server log.`,
      )
    ) {
      return;
    }
    try {
      const session = await api.post<AuthResponse>(`/auth/impersonate/${target.id}`);
      setAccessToken(session.accessToken);
      setUser(session.user);
      toast.success(`Now signed in as ${session.user.displayName}`);
      router.push(HOME_ROUTE[session.user.role]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not impersonate that account');
    }
  }

  async function toggleActive(target: AdminUser) {
    try {
      if (target.isActive) {
        await api.delete(`/users/${target.id}`);
        toast.success(`Deactivated ${target.displayName}`);
      } else {
        await api.patch(`/users/${target.id}`, { isActive: true });
        toast.success(`Reactivated ${target.displayName}`);
      }
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change that account');
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">Directory</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              Users
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Bulk import
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Create user
            </Button>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, username or email"
              className="h-9 pl-9"
            />
          </div>
          <Select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">Any role</option>
            <option value="STUDENT">Students</option>
            <option value="TEACHER">Teachers</option>
            <option value="ADMIN">Admins</option>
          </Select>
          <Select value={active} onChange={(event) => setActive(event.target.value)}>
            <option value="">Any state</option>
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
          </Select>
          {result ? (
            <span className="ml-auto font-mono text-[11px] text-faint tabular">
              {result.meta.total} total
            </span>
          ) : null}
        </div>

        <Panel className="mt-4 overflow-hidden">
          {result === null ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : result.data.length === 0 ? (
            <Empty
              icon={Users}
              title="No accounts match those filters"
              description="Clear the search, or create the account you are looking for."
              action={<Button size="sm" onClick={() => setCreateOpen(true)}>Create user</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem]">
                <thead>
                  <tr className="border-b border-line">
                    {['Account', 'Role', 'State', 'Last sign-in', 'Created', ''].map((h, i) => (
                      <th
                        key={h || i}
                        className={cn('instrument px-4 py-2.5 text-left font-normal', i === 5 && 'text-right')}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-b border-line transition-colors last:border-b-0 hover:bg-white/[0.02]',
                        !row.isActive && 'opacity-55',
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.displayName} avatar={row.avatar} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate text-[13.5px] text-paper">
                              {row.displayName}
                              {row.id === me?.id ? (
                                <span className="ml-1.5 font-mono text-[10px] text-violet-lit">you</span>
                              ) : null}
                            </div>
                            <div className="truncate font-mono text-[10px] text-faint">
                              @{row.username} · {row.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={row.role === 'ADMIN' ? 'brass' : row.role === 'TEACHER' ? 'violet' : 'neutral'}>
                          {row.role.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.isActive ? (
                          row.mustChangePassword ? (
                            <Badge tone="warn">must reset</Badge>
                          ) : (
                            <Badge tone="pass">active</Badge>
                          )
                        ) : (
                          <Badge tone="fail">disabled</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted">
                        {row.lastLoginAt ? relativeTime(row.lastLoginAt) : 'never'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-faint">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            aria-label={`Edit ${row.displayName}`}
                            onClick={() => setEditing(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {row.role !== 'ADMIN' && row.isActive ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Sign in as this user"
                              aria-label={`Impersonate ${row.displayName}`}
                              onClick={() => void impersonate(row)}
                            >
                              <VenetianMask className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          {row.id !== me?.id ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={row.isActive ? 'Deactivate' : 'Reactivate'}
                              aria-label={`${row.isActive ? 'Deactivate' : 'Reactivate'} ${row.displayName}`}
                              onClick={() => void toggleActive(row)}
                            >
                              {row.isActive ? (
                                <Ban className="h-3.5 w-3.5" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-trace" />
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {result && result.meta.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            <span className="font-mono text-[11px] text-faint tabular">
              Page {result.meta.page} of {result.meta.totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= result.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={load} />
      <BulkImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
      <EditUserModal user={editing} onClose={() => setEditing(null)} onDone={load} />
    </PageTransition>
  );
}

function CreateUserModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    username: '',
    email: '',
    displayName: '',
    password: '',
    role: 'STUDENT' as Role,
  });
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/users', form);
      toast.success(`Created ${form.username}`, {
        description: 'They will be asked to choose a new password on first sign-in.',
      });
      setForm({ username: '', email: '', displayName: '', password: '', role: 'STUDENT' });
      onDone();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create that account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Directory"
      title="Create a user"
      description="The password below is temporary — they choose their own on first sign-in."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="create-user" type="submit" loading={busy}>
            Create user
          </Button>
        </>
      }
    >
      <form id="create-user" className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username">
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="new.student"
              required
              autoFocus
            />
          </Field>
          <Field label="Role">
            <Select
              className="h-10 w-full"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Field>
        </div>
        <Field label="Display name">
          <Input
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder="New Student"
            required
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="new.student@simulyn.edu"
            required
          />
        </Field>
        <Field label="Temporary password" hint="At least 6 characters.">
          <Input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={6}
            required
          />
        </Field>
      </form>
    </Modal>
  );
}

interface ParsedRow {
  username: string;
  email: string;
  displayName: string;
  password: string;
}

/** Accepts a header row in any column order; falls back to positional order. */
function parseCsv(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], errors: ['The file is empty'] };

  const split = (line: string) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
  const first = split(lines[0]).map((cell) => cell.toLowerCase());
  const known = ['username', 'email', 'displayname', 'password'];
  const hasHeader = known.some((key) => first.includes(key));

  const index = hasHeader
    ? {
        username: first.indexOf('username'),
        email: first.indexOf('email'),
        displayName: first.indexOf('displayname'),
        password: first.indexOf('password'),
      }
    : { username: 0, email: 1, displayName: 2, password: 3 };

  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  for (const [i, line] of lines.slice(hasHeader ? 1 : 0).entries()) {
    const cells = split(line);
    const row = {
      username: cells[index.username] ?? '',
      email: cells[index.email] ?? '',
      displayName: cells[index.displayName] ?? '',
      password: cells[index.password] ?? '',
    };
    const lineNumber = i + (hasHeader ? 2 : 1);

    if (!row.username || !row.email || !row.displayName || !row.password) {
      errors.push(`Line ${lineNumber}: needs username, email, displayName and password`);
      continue;
    }
    if (row.password.length < 6) {
      errors.push(`Line ${lineNumber}: password must be at least 6 characters`);
      continue;
    }
    rows.push(row);
  }

  return { rows, errors };
}

function BulkImportModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [role, setRole] = useState<Role>('STUDENT');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{
    created: number;
    failed: number;
    failures: { username: string; reason: string }[];
  } | null>(null);

  const { rows, errors } = text.trim() ? parseCsv(text) : { rows: [], errors: [] };

  async function submit() {
    setBusy(true);
    try {
      const result = await api.post<typeof outcome>('/users/bulk', { users: rows, role });
      setOutcome(result);
      if (result) {
        toast.success(`Created ${result.created} account${result.created === 1 ? '' : 's'}`, {
          description: result.failed > 0 ? `${result.failed} row(s) failed` : undefined,
        });
      }
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import those accounts');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setOutcome(null);
        onClose();
      }}
      label="Directory"
      title="Bulk import"
      description="Paste CSV or choose a file. Columns: username, email, displayName, password."
      className="max-w-2xl"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setOutcome(null);
              onClose();
            }}
          >
            Close
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={rows.length === 0}>
            Import {rows.length > 0 ? rows.length : ''} account{rows.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Role for every row">
          <Select
            className="h-10 w-44"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            <option value="STUDENT">Student</option>
            <option value="TEACHER">Teacher</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </Field>
        <label className="mb-0.5">
          <span className="sr-only">Choose a CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full cursor-pointer text-[12px] text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line-strong file:bg-white/[0.03] file:px-3 file:py-2 file:text-[12px] file:text-paper hover:file:border-violet-lit/50"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) setText(await file.text());
            }}
          />
        </label>
      </div>

      <Textarea
        rows={8}
        className="mt-4 font-mono text-[12px]"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={'username,email,displayName,password\nasha.r,asha@simulyn.edu,Asha R,welcome123'}
      />

      {text.trim() ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge tone={rows.length > 0 ? 'pass' : 'neutral'}>{rows.length} ready</Badge>
          {errors.length > 0 ? <Badge tone="fail">{errors.length} skipped</Badge> : null}
        </div>
      ) : null}

      {errors.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {errors.slice(0, 6).map((error) => (
            <li key={error} className="flex items-start gap-1.5 text-[12px] text-warn">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
              {error}
            </li>
          ))}
        </ul>
      ) : null}

      {outcome ? (
        <div className="mt-4 rounded-lg border border-line bg-white/[0.02] p-3">
          <p className="text-[13px] text-paper">
            {outcome.created} created, {outcome.failed} failed.
          </p>
          {outcome.failures.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {outcome.failures.map((failure) => (
                <li key={failure.username} className="font-mono text-[11px] text-fault">
                  {failure.username}: {failure.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function EditUserModal({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('STUDENT');
  const [password, setPassword] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setEmail(user.email);
    setRole(user.role);
    setPassword('');
    setMustChange(true);
  }, [user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await api.patch(`/users/${user.id}`, {
        displayName,
        email,
        role,
        ...(password ? { password, mustChangePassword: mustChange } : {}),
      });
      toast.success(`Updated ${displayName}`, {
        description: password ? 'Password reset — their other sessions were signed out.' : undefined,
      });
      onDone();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update that account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={user !== null}
      onClose={onClose}
      label="Account"
      title={user ? `Edit ${user.username}` : ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="edit-user" type="submit" loading={busy}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-user" className="space-y-4" onSubmit={submit}>
        <Field label="Display name">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Role">
          <Select
            className="h-10 w-full"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="STUDENT">Student</option>
            <option value="TEACHER">Teacher</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </Field>

        <div className="border-t border-line pt-4">
          <Field label="Reset password" hint="Leave blank to keep the current password.">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New temporary password"
              minLength={6}
            />
          </Field>
          {password ? (
            <div className="mt-3">
              <Switch
                checked={mustChange}
                onChange={setMustChange}
                label="Require a password change on next sign-in"
              />
            </div>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
