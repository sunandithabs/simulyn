'use client';

import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ProblemPicker } from '@/components/hackathon/problem-picker';
import { PageTransition } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import type { HackathonDetail } from '@/lib/types';
import { cn } from '@/lib/utils';

type Mode = 'PROJECT' | 'PROBLEMS';
interface Criterion {
  name: string;
  max: string;
}

interface FormState {
  title: string;
  description: string;
  rules: string;
  mode: Mode;
  problemIds: string[];
  maxTeamSize: number;
  criteria: Criterion[];
  startsAt: string;
  endsAt: string;
  publish: boolean;
}

const STEPS = ['Basics', 'Format', 'Judging', 'Schedule', 'Review'] as const;
const RUBRIC_PRESETS: Criterion[] = [
  { name: 'Innovation', max: '30' },
  { name: 'Technical depth', max: '30' },
  { name: 'Design & usability', max: '20' },
  { name: 'Presentation', max: '20' },
];
const TEAM_SIZES = [
  { label: 'Solo', value: 1 },
  { label: 'Pairs', value: 2 },
  { label: 'Up to 4', value: 4 },
  { label: 'Up to 6', value: 6 },
];

/** Value for <input type="datetime-local"> in the viewer's own timezone. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaults(initial?: HackathonDetail): FormState {
  if (initial) {
    return {
      title: initial.title,
      description: initial.description,
      rules: initial.rules ?? '',
      mode: initial.mode ?? 'PROJECT',
      problemIds: (initial.problems ?? []).map((p) => p.id),
      maxTeamSize: initial.maxTeamSize,
      criteria: initial.criteria.map((c) => ({ name: c.name, max: String(c.max) })),
      startsAt: toLocalInput(new Date(initial.startsAt)),
      endsAt: toLocalInput(new Date(initial.endsAt)),
      publish: initial.isPublished,
    };
  }
  const start = new Date(Date.now() + 24 * 3_600_000);
  start.setMinutes(0, 0, 0);
  return {
    title: '',
    description: '',
    rules: '',
    mode: 'PROJECT',
    problemIds: [],
    maxTeamSize: 4,
    criteria: [],
    startsAt: toLocalInput(start),
    endsAt: toLocalInput(new Date(start.getTime() + 24 * 3_600_000)),
    publish: false,
  };
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="instrument">{label}</div>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

function Choice({ active, onClick, title, body, disabled }: { active: boolean; onClick: () => void; title: string; body: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        'rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        active ? 'border-violet-lit bg-violet/15' : 'border-line hover:border-line-strong',
      )}
    >
      <div className="text-sm font-medium text-paper">{title}</div>
      <div className="mt-1 text-xs text-muted">{body}</div>
    </button>
  );
}

function durationLabel(startsAt: string, endsAt: string): string {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const hours = Math.round(ms / 360_000) / 10;
  return hours >= 48 ? `${Math.round((hours / 24) * 10) / 10} days` : `${hours} hours`;
}

export function HackathonForm({ base, initial }: { base: string; initial?: HackathonDetail }) {
  const router = useRouter();
  const editing = !!initial;
  const [form, setForm] = useState<FormState>(() => defaults(initial));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sizeText, setSizeText] = useState(() => String(defaults(initial).maxTeamSize));
  const started = initial ? initial.status === 'LIVE' || initial.status === 'ENDED' : false;
  const patch = (next: Partial<FormState>) => setForm((f) => ({ ...f, ...next }));

  const rubric = useMemo(
    () => form.criteria.map((c) => ({ name: c.name.trim(), max: Number(c.max) })),
    [form.criteria],
  );
  const rubricTotal = rubric.reduce((a, c) => a + (Number.isFinite(c.max) ? c.max : 0), 0);
  const rubricProblems = (() => {
    if (form.mode !== 'PROJECT' || rubric.length === 0) return null;
    if (rubric.length > 8) return 'A rubric can have at most 8 criteria.';
    if (rubric.some((c) => !c.name)) return 'Every criterion needs a name.';
    if (new Set(rubric.map((c) => c.name.toLowerCase())).size !== rubric.length) return 'Criterion names must be unique.';
    if (rubric.some((c) => !Number.isInteger(c.max) || c.max < 1 || c.max > 100)) return 'Each max must be a whole number from 1 to 100.';
    return null;
  })();

  const start = new Date(form.startsAt);
  const end = new Date(form.endsAt);
  const scheduleProblem = !form.startsAt || !form.endsAt || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    ? 'Pick a start and an end.'
    : end <= start
      ? 'The end must be after the start.'
      : !editing && end.getTime() < Date.now()
        ? 'The end is already in the past.'
        : null;

  const stepProblem: (string | null)[] = [
    !form.title.trim() ? 'Give the hackathon a title.' : !form.description.trim() ? 'Add a description or theme.' : null,
    form.mode === 'PROBLEMS' && form.problemIds.length === 0 ? 'Pick at least one problem.' : null,
    rubricProblems,
    scheduleProblem,
    null,
  ];
  const firstBad = stepProblem.findIndex((p) => p !== null);

  function shiftEnd(hours: number) {
    const s = new Date(form.startsAt);
    if (Number.isNaN(s.getTime())) return;
    patch({ endsAt: toLocalInput(new Date(s.getTime() + hours * 3_600_000)) });
  }

  async function save() {
    if (firstBad !== -1) {
      setStep(firstBad);
      toast.error(stepProblem[firstBad]!);
      return;
    }
    setBusy(true);
    try {
      const criteria = form.mode === 'PROJECT' ? rubric : [];
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        rules: form.rules.trim(),
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        maxTeamSize: form.maxTeamSize,
      };
      if (!editing) {
        await api
          .post<{ id: string }>('/hackathons', {
            ...body,
            criteria,
            mode: form.mode,
            problemIds: form.mode === 'PROBLEMS' ? form.problemIds : [],
          })
          .then(async (created) => {
            if (form.publish) await api.patch(`/hackathons/${created.id}`, { isPublished: true });
            toast.success(form.publish ? 'Hackathon published' : 'Saved as a draft');
            router.push(`${base}/${created.id}`);
          });
      } else {
        const before = defaults(initial);
        if (JSON.stringify(form.criteria) !== JSON.stringify(before.criteria) || form.mode !== before.mode) body.criteria = criteria;
        if (form.mode !== before.mode) body.mode = form.mode;
        if (form.mode === 'PROBLEMS' && JSON.stringify(form.problemIds) !== JSON.stringify(before.problemIds)) {
          body.problemIds = form.problemIds;
        }
        await api.patch(`/hackathons/${initial!.id}`, body);
        toast.success('Changes saved');
        router.push(`${base}/${initial!.id}`);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save the hackathon');
    } finally {
      setBusy(false);
    }
  }

  function next() {
    const problem = stepProblem[step];
    if (problem) return toast.error(problem);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header>
          <span className="instrument">Host</span>
          <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
            {editing ? 'Edit hackathon' : 'New hackathon'}
          </h1>
        </header>

        <ol className="mt-6 flex flex-wrap gap-2" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                disabled={i > step && stepProblem.slice(0, i).some(Boolean)}
                onClick={() => setStep(i)}
                aria-current={i === step ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] transition-colors disabled:opacity-40',
                  i === step ? 'border-violet-lit bg-violet/15 text-paper' : 'border-line text-muted hover:text-paper',
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 font-mono text-[10px]">
                  {i < step && !stepProblem[i] ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {label}
              </button>
            </li>
          ))}
        </ol>

        <Panel className="mt-5">
          <PanelHeader label={`Step ${step + 1} of ${STEPS.length}`} title={STEPS[step]} />
          <PanelBody className="space-y-5 pt-4">
            {step === 0 ? (
              <>
                <Section label="Title">
                  <Input aria-label="Title" value={form.title} maxLength={120} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Embedded Systems Sprint 2026" />
                </Section>
                <Section label="Description / theme" hint="What participants will build or solve. Shown to students once published.">
                  <Textarea aria-label="Description" rows={5} maxLength={5000} value={form.description} onChange={(e) => patch({ description: e.target.value })} />
                </Section>
                <Section label="Rules (optional)" hint="Eligibility, allowed tools, plagiarism policy, deliverables.">
                  <Textarea aria-label="Rules" rows={4} maxLength={5000} value={form.rules} onChange={(e) => patch({ rules: e.target.value })} />
                </Section>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Section label="Format">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Choice
                      active={form.mode === 'PROJECT'}
                      onClick={() => patch({ mode: 'PROJECT' })}
                      disabled={started}
                      title="Project (judged)"
                      body="Teams build something and submit a repo or demo. Judges score it after the event ends."
                    />
                    <Choice
                      active={form.mode === 'PROBLEMS'}
                      onClick={() => patch({ mode: 'PROBLEMS' })}
                      disabled={started}
                      title="Problem solving (live scoreboard)"
                      body="Teams solve platform problems with the normal code runner. Ranked live by best scores."
                    />
                  </div>
                  {started ? <p className="mt-2 text-xs text-warn">The format and problem list are locked once a hackathon has started.</p> : null}
                </Section>

                {form.mode === 'PROBLEMS' ? (
                  <Section label="Problems" hint="Pick from published problems. Students see the titles when the event starts.">
                    {started ? (
                      <p className="text-sm text-muted">{form.problemIds.length} problems selected.</p>
                    ) : (
                      <ProblemPicker
                        value={form.problemIds}
                        initial={initial?.problems}
                        onChange={(ids) => patch({ problemIds: ids })}
                      />
                    )}
                  </Section>
                ) : null}

                <Section label="Team size" hint="A team of one is an individual entry.">
                  <div className="flex flex-wrap items-center gap-2">
                    {TEAM_SIZES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          patch({ maxTeamSize: t.value });
                          setSizeText(String(t.value));
                        }}
                        aria-pressed={form.maxTeamSize === t.value}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-[13px] transition-colors',
                          form.maxTeamSize === t.value ? 'border-violet-lit bg-violet/15 text-paper' : 'border-line text-muted hover:text-paper',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      className="w-24"
                      value={sizeText}
                      onChange={(e) => {
                        setSizeText(e.target.value);
                        const n = Math.round(Number(e.target.value));
                        if (e.target.value !== '' && n >= 1 && n <= 10) patch({ maxTeamSize: n });
                      }}
                      onBlur={() => setSizeText(String(form.maxTeamSize))}
                      aria-label="Custom maximum team size"
                    />
                  </div>
                </Section>
              </>
            ) : null}

            {step === 2 ? (
              form.mode === 'PROBLEMS' ? (
                <p className="text-sm text-muted">
                  Problem-solving hackathons are ranked automatically from submission scores, so there is no rubric to set up.
                </p>
              ) : (
                <>
                  <Section
                    label="Judging rubric"
                    hint="Each criterion is scored from 0 to its max, then everything is normalised to 100. Leave the rubric empty for a single 0 to 100 score."
                  >
                    <div className="space-y-2">
                      {form.criteria.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            value={c.name}
                            maxLength={40}
                            placeholder="Criterion"
                            aria-label={`Criterion ${i + 1} name`}
                            onChange={(e) => patch({ criteria: form.criteria.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                          />
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            className="w-24"
                            value={c.max}
                            aria-label="Max points"
                            onChange={(e) => patch({ criteria: form.criteria.map((x, j) => (j === i ? { ...x, max: e.target.value } : x)) })}
                          />
                          <Button type="button" variant="ghost" size="icon" aria-label="Remove criterion" onClick={() => patch({ criteria: form.criteria.filter((_, j) => j !== i) })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={form.criteria.length >= 8} onClick={() => patch({ criteria: [...form.criteria, { name: '', max: '10' }] })}>
                        <Plus className="h-3.5 w-3.5" />
                        Add criterion
                      </Button>
                      {form.criteria.length === 0 ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => patch({ criteria: RUBRIC_PRESETS })}>
                          Use a standard rubric
                        </Button>
                      ) : (
                        <span className="font-mono text-[11px] text-muted">
                          {rubric.length} criteria · {rubricTotal} points total
                        </span>
                      )}
                    </div>
                    {rubricProblems ? <p className="mt-2 text-xs text-warn">{rubricProblems}</p> : null}
                  </Section>
                </>
              )
            ) : null}

            {step === 3 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Section label="Starts">
                    <Input type="datetime-local" aria-label="Starts" value={form.startsAt} onChange={(e) => patch({ startsAt: e.target.value })} />
                  </Section>
                  <Section label="Ends">
                    <Input type="datetime-local" aria-label="Ends" value={form.endsAt} onChange={(e) => patch({ endsAt: e.target.value })} />
                  </Section>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="instrument">Length</span>
                  {[3, 6, 24, 48, 72].map((h) => (
                    <Button key={h} type="button" variant="outline" size="sm" onClick={() => shiftEnd(h)}>
                      {h < 24 ? `${h} h` : `${h / 24} d`}
                    </Button>
                  ))}
                  {durationLabel(form.startsAt, form.endsAt) ? (
                    <span className="font-mono text-[11px] text-muted">{durationLabel(form.startsAt, form.endsAt)}</span>
                  ) : null}
                </div>
                <p className="text-xs text-faint">Times are in your local timezone. Judging opens when the hackathon ends.</p>
                {scheduleProblem ? <p className="text-xs text-warn">{scheduleProblem}</p> : null}
              </>
            ) : null}

            {step === 4 ? (
              <>
                <dl className="grid gap-3 text-sm sm:grid-cols-[140px_1fr]">
                  <dt className="text-faint">Title</dt>
                  <dd className="text-paper">{form.title}</dd>
                  <dt className="text-faint">Format</dt>
                  <dd className="text-paper">
                    {form.mode === 'PROJECT' ? 'Project (judged)' : `Problem solving, ${form.problemIds.length} problem${form.problemIds.length === 1 ? '' : 's'}`}
                  </dd>
                  <dt className="text-faint">Teams</dt>
                  <dd className="text-paper">{form.maxTeamSize === 1 ? 'Solo entries' : `Up to ${form.maxTeamSize} per team`}</dd>
                  {form.mode === 'PROJECT' ? (
                    <>
                      <dt className="text-faint">Judging</dt>
                      <dd className="text-paper">
                        {rubric.length ? rubric.map((c) => `${c.name} (${c.max})`).join(', ') : 'Single 0 to 100 score'}
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-faint">Schedule</dt>
                  <dd className="text-paper">
                    {start.toLocaleString()} to {end.toLocaleString()} ({durationLabel(form.startsAt, form.endsAt)})
                  </dd>
                </dl>
                {!editing ? (
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line p-3 text-sm text-paper">
                    <input type="checkbox" checked={form.publish} onChange={(e) => patch({ publish: e.target.checked })} />
                    Publish now and notify students
                  </label>
                ) : null}
              </>
            ) : null}
          </PanelBody>
        </Panel>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={() => (step === 0 ? router.push(editing ? `${base}/${initial!.id}` : base) : setStep(step - 1))}>
            <ArrowLeft className="h-4 w-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" loading={busy} onClick={save}>
              {editing ? 'Save changes' : form.publish ? 'Create and publish' : 'Create draft'}
            </Button>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
