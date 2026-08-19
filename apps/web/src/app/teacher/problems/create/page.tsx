'use client';

import { ArrowLeft, Eye, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { ProblemBrief } from '@/components/problem/problem-brief';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import type { Difficulty, LangKey, Problem, ProblemType } from '@/lib/types';

const HARNESS_TYPES = [
  'int',
  'double',
  'string',
  'bool',
  'intArray',
  'stringArray',
  'listNode',
  'treeNode',
  'grid',
] as const;

const LANGS: { key: LangKey; label: string }[] = [
  { key: 'python', label: 'Python' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'cpp', label: 'C++' },
  { key: 'java', label: 'Java' },
];

interface TestCaseRow {
  input: string;
  expected: string;
  isHidden: boolean;
}
interface QuestionRow {
  id: string;
  text: string;
  answer: string;
  tolerance: string;
  unit: string;
}

const EMPTY_STARTER: Record<LangKey, string> = { python: '', javascript: '', cpp: '', java: '' };

export default function ProblemAuthorPage() {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-96 w-full" /></div>}>
      <ProblemForm />
    </Suspense>
  );
}

function ProblemForm() {
  const router = useRouter();
  const editId = useSearchParams().get('edit');

  const [loading, setLoading] = useState(Boolean(editId));
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const [type, setType] = useState<ProblemType>('PROGRAMMING');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [points, setPoints] = useState(100);
  const [constraints, setConstraints] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  const [starter, setStarter] = useState<Record<LangKey, string>>(EMPTY_STARTER);
  const [starterLang, setStarterLang] = useState<LangKey>('python');
  const [funcName, setFuncName] = useState('');
  const [returnType, setReturnType] = useState<string>('int');
  const [normalize, setNormalize] = useState('');
  const [harnessParams, setHarnessParams] = useState<{ name: string; type: string }[]>([
    { name: 'nums', type: 'intArray' },
  ]);
  const [testCases, setTestCases] = useState<TestCaseRow[]>([
    { input: '', expected: '', isHidden: false },
  ]);
  const [examples, setExamples] = useState<{ input: string; output: string; explanation: string }[]>(
    [{ input: '', output: '', explanation: '' }],
  );

  const [paramsJson, setParamsJson] = useState('{\n  "supply": 12,\n  "R1": 10000\n}');
  const [questions, setQuestions] = useState<QuestionRow[]>([
    { id: 'vout', text: '', answer: '', tolerance: '0.05', unit: 'V' },
  ]);

  const [hints, setHints] = useState<string[]>(['', '', '']);

  // Load an existing problem when editing.
  useEffect(() => {
    if (!editId) return;
    void api
      .get<Problem>(`/problems/${editId}`)
      .then((problem) => {
        setType(problem.type);
        setTitle(problem.title);
        setDescription(problem.description);
        setDifficulty(problem.difficulty);
        setCategory(problem.category);
        setTags(problem.tags.join(', '));
        setPoints(problem.points);
        setConstraints(problem.constraints.join('\n'));
        setIsPublished(problem.isPublished);
        setStarter({ ...EMPTY_STARTER, ...(problem.starterCode ?? {}) });

        const harness = problem.harness as {
          funcName?: string;
          returnType?: string;
          normalize?: string;
          params?: { name: string; type: string }[];
        } | null;
        if (harness) {
          setFuncName(harness.funcName ?? '');
          setReturnType(harness.returnType ?? 'int');
          setNormalize(harness.normalize ?? '');
          if (harness.params?.length) setHarnessParams(harness.params);
        }

        if (problem.testCases?.length) {
          setTestCases(
            problem.testCases.map((testCase) => ({
              input: testCase.input,
              expected: testCase.expected,
              isHidden: testCase.isHidden,
            })),
          );
        }
        if (problem.examples?.length) {
          setExamples(
            problem.examples.map((example) => ({
              input: example.input,
              output: example.output,
              explanation: example.explanation ?? '',
            })),
          );
        }
        if (problem.params) setParamsJson(JSON.stringify(problem.params, null, 2));
        if (problem.questions?.length) {
          setQuestions(
            problem.questions.map((question) => ({
              id: question.id,
              text: question.text,
              answer: String(question.answer ?? ''),
              tolerance: String(question.tolerance ?? ''),
              unit: question.unit ?? '',
            })),
          );
        }
        if (problem.hints?.length) {
          const next = ['', '', ''];
          for (const hint of problem.hints) next[hint.level - 1] = hint.text;
          setHints(next);
        }
      })
      .catch(() => toast.error('That problem could not be loaded'))
      .finally(() => setLoading(false));
  }, [editId]);

  function buildPayload() {
    const base: Record<string, unknown> = {
      type,
      title,
      description,
      difficulty,
      category,
      points,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      constraints: constraints.split('\n').map((line) => line.trim()).filter(Boolean),
      isPublished,
      hints: hints
        .map((text, index) => ({ level: index + 1, text: text.trim() }))
        .filter((hint) => hint.text.length > 0),
    };

    if (type === 'PROGRAMMING') {
      const starterCode = Object.fromEntries(
        Object.entries(starter).filter(([, value]) => value.trim().length > 0),
      );
      if (Object.keys(starterCode).length > 0) base.starterCode = starterCode;

      if (funcName.trim()) {
        base.harness = {
          funcName: funcName.trim(),
          returnType,
          params: harnessParams.filter((param) => param.name.trim()),
          ...(normalize ? { normalize } : {}),
        };
      }

      const cases = testCases.filter((row) => row.input.trim() && row.expected.trim());
      if (cases.length > 0) base.testCases = cases;

      const filledExamples = examples.filter((row) => row.input.trim() && row.output.trim());
      if (filledExamples.length > 0) {
        base.examples = filledExamples.map((row) => ({
          input: row.input,
          output: row.output,
          ...(row.explanation.trim() ? { explanation: row.explanation } : {}),
        }));
      }
    } else {
      try {
        base.params = JSON.parse(paramsJson || '{}');
      } catch {
        throw new Error('Circuit parameters are not valid JSON');
      }
      const filled = questions.filter((row) => row.id.trim() && row.text.trim());
      if (filled.length > 0) {
        base.questions = filled.map((row) => ({
          id: row.id.trim(),
          text: row.text,
          answer: Number(row.answer),
          tolerance: Number(row.tolerance),
          ...(row.unit.trim() ? { unit: row.unit.trim() } : {}),
        }));
      }
    }

    return base;
  }

  async function save() {
    setBusy(true);
    try {
      const payload = buildPayload();
      if (editId) {
        await api.patch(`/problems/${editId}`, payload);
        toast.success('Problem updated');
      } else {
        await api.post('/problems', payload);
        toast.success(isPublished ? 'Problem published' : 'Draft saved');
      }
      router.push('/teacher/problems');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the problem');
    } finally {
      setBusy(false);
    }
  }

  const previewProblem: Problem = {
    id: 'preview',
    type,
    difficulty,
    category: category || 'Uncategorised',
    title: title || 'Untitled problem',
    description: description || '_No description yet._',
    constraints: constraints.split('\n').map((line) => line.trim()).filter(Boolean),
    points,
    tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    isPublished,
    createdById: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    starterCode: starter,
    harness: null,
    examples: examples
      .filter((row) => row.input.trim())
      .map((row) => ({ input: row.input, output: row.output, explanation: row.explanation })),
    params: null,
    questions: null,
    hints: hints
      .map((text, index) => ({ id: String(index), level: index + 1, text }))
      .filter((hint) => hint.text.trim().length > 0),
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          href="/teacher/problems"
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-paper"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Problem bank
        </Link>

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">{editId ? 'Editing' : 'Author'}</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              {editId ? 'Edit problem' : 'New problem'}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreview((value) => !value)}>
              <Eye className="h-4 w-4" />
              {preview ? 'Back to form' : 'Preview'}
            </Button>
            <Button onClick={() => void save()} loading={busy} disabled={!title || !description}>
              <Save className="h-4 w-4" />
              {editId ? 'Save changes' : isPublished ? 'Publish' : 'Save draft'}
            </Button>
          </div>
        </header>

        {preview ? (
          <Panel className="mt-6 p-6">
            <ProblemBrief problem={previewProblem} />
          </Panel>
        ) : (
          <div className="mt-6 space-y-4">
            <Panel>
              <PanelHeader label="Basics" title="What is this problem?" />
              <PanelBody className="space-y-4 pt-4">
                <Tabs
                  value={type}
                  onChange={setType}
                  items={[
                    { value: 'PROGRAMMING', label: 'Programming' },
                    { value: 'ELECTRONICS', label: 'Electronics' },
                  ]}
                />

                <Field label="Title">
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Two Sum"
                  />
                </Field>

                <Field label="Description" hint="Markdown. Backticks render as inline code.">
                  <Textarea
                    rows={7}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={'Given an array of integers `nums`…'}
                    className="font-mono text-[12.5px]"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Difficulty">
                    <Select
                      className="h-10 w-full"
                      value={difficulty}
                      onChange={(event) => setDifficulty(event.target.value as Difficulty)}
                    >
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                    </Select>
                  </Field>
                  <Field label="Category">
                    <Input
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      placeholder="Arrays"
                    />
                  </Field>
                  <Field label="Points">
                    <Input
                      type="number"
                      min={0}
                      value={points}
                      onChange={(event) => setPoints(Number(event.target.value))}
                    />
                  </Field>
                </div>

                <Field label="Tags" hint="Comma separated.">
                  <Input
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="array, hash-table"
                  />
                </Field>

                <Field label="Constraints" hint="One per line.">
                  <Textarea
                    rows={3}
                    value={constraints}
                    onChange={(event) => setConstraints(event.target.value)}
                    placeholder={'2 <= nums.length <= 10^4'}
                    className="font-mono text-[12.5px]"
                  />
                </Field>

                <Switch
                  variant="card"
                  checked={isPublished}
                  onChange={setIsPublished}
                  label="Published"
                  hint="Draft problems stay hidden from students. Publishing requires a harness and at least one test case."
                />
              </PanelBody>
            </Panel>

            {type === 'PROGRAMMING' ? (
              <>
                <Panel>
                  <PanelHeader
                    label="Signature"
                    title="Harness"
                    action={
                      <span className="font-mono text-[10px] text-faint">
                        one JSON literal per line
                      </span>
                    }
                  />
                  <PanelBody className="space-y-4 pt-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Function name">
                        <Input
                          value={funcName}
                          onChange={(event) => setFuncName(event.target.value)}
                          placeholder="twoSum"
                          className="font-mono"
                        />
                      </Field>
                      <Field label="Return type">
                        <Select
                          className="h-10 w-full"
                          value={returnType}
                          onChange={(event) => setReturnType(event.target.value)}
                        >
                          {HARNESS_TYPES.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Normalise" hint="For order-insensitive answers.">
                        <Select
                          className="h-10 w-full"
                          value={normalize}
                          onChange={(event) => setNormalize(event.target.value)}
                        >
                          <option value="">Exact match</option>
                          <option value="sortArray">Sort the array</option>
                          <option value="sortRows">Sort rows, then rows</option>
                        </Select>
                      </Field>
                    </div>

                    <div>
                      <span className="instrument">Parameters</span>
                      <div className="mt-2 space-y-2">
                        {harnessParams.map((param, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={param.name}
                              placeholder="nums"
                              className="font-mono"
                              onChange={(event) =>
                                setHarnessParams((rows) =>
                                  rows.map((row, i) =>
                                    i === index ? { ...row, name: event.target.value } : row,
                                  ),
                                )
                              }
                            />
                            <Select
                              className="h-10 w-40"
                              value={param.type}
                              onChange={(event) =>
                                setHarnessParams((rows) =>
                                  rows.map((row, i) =>
                                    i === index ? { ...row, type: event.target.value } : row,
                                  ),
                                )
                              }
                            >
                              {HARNESS_TYPES.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Remove parameter"
                              onClick={() =>
                                setHarnessParams((rows) => rows.filter((_, i) => i !== index))
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() =>
                          setHarnessParams((rows) => [...rows, { name: '', type: 'int' }])
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add parameter
                      </Button>
                    </div>
                  </PanelBody>
                </Panel>

                <Panel>
                  <PanelHeader label="Stubs" title="Starter code" />
                  <PanelBody className="pt-4">
                    <Tabs
                      value={starterLang}
                      onChange={setStarterLang}
                      items={LANGS.map((lang) => ({ value: lang.key, label: lang.label }))}
                    />
                    <Textarea
                      rows={8}
                      value={starter[starterLang]}
                      onChange={(event) =>
                        setStarter({ ...starter, [starterLang]: event.target.value })
                      }
                      placeholder={'def twoSum(nums, target):\n    pass'}
                      className="mt-3 font-mono text-[12.5px]"
                    />
                  </PanelBody>
                </Panel>

                <Panel>
                  <PanelHeader
                    label="Grading"
                    title="Test cases"
                    action={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setTestCases((rows) => [
                            ...rows,
                            { input: '', expected: '', isHidden: false },
                          ])
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add case
                      </Button>
                    }
                  />
                  <PanelBody className="space-y-3 pt-4">
                    {testCases.map((row, index) => (
                      <div key={index} className="rounded-lg border border-line p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="instrument">Case {index + 1}</span>
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={row.isHidden}
                              onChange={(value) =>
                                setTestCases((rows) =>
                                  rows.map((r, i) => (i === index ? { ...r, isHidden: value } : r)),
                                )
                              }
                              label="Hidden"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove case ${index + 1}`}
                              onClick={() =>
                                setTestCases((rows) => rows.filter((_, i) => i !== index))
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Textarea
                            rows={3}
                            value={row.input}
                            placeholder={'[2,7,11,15]\n9'}
                            className="font-mono text-[12px]"
                            onChange={(event) =>
                              setTestCases((rows) =>
                                rows.map((r, i) =>
                                  i === index ? { ...r, input: event.target.value } : r,
                                ),
                              )
                            }
                          />
                          <Textarea
                            rows={3}
                            value={row.expected}
                            placeholder="[0,1]"
                            className="font-mono text-[12px]"
                            onChange={(event) =>
                              setTestCases((rows) =>
                                rows.map((r, i) =>
                                  i === index ? { ...r, expected: event.target.value } : r,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </PanelBody>
                </Panel>

                <Panel>
                  <PanelHeader
                    label="Illustration"
                    title="Worked examples"
                    action={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExamples((rows) => [
                            ...rows,
                            { input: '', output: '', explanation: '' },
                          ])
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add example
                      </Button>
                    }
                  />
                  <PanelBody className="space-y-3 pt-4">
                    {examples.map((row, index) => (
                      <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto]">
                        <Input
                          value={row.input}
                          placeholder="nums = [2,7], target = 9"
                          onChange={(event) =>
                            setExamples((rows) =>
                              rows.map((r, i) =>
                                i === index ? { ...r, input: event.target.value } : r,
                              ),
                            )
                          }
                        />
                        <Input
                          value={row.output}
                          placeholder="[0,1]"
                          onChange={(event) =>
                            setExamples((rows) =>
                              rows.map((r, i) =>
                                i === index ? { ...r, output: event.target.value } : r,
                              ),
                            )
                          }
                        />
                        <Input
                          value={row.explanation}
                          placeholder="Why (optional)"
                          onChange={(event) =>
                            setExamples((rows) =>
                              rows.map((r, i) =>
                                i === index ? { ...r, explanation: event.target.value } : r,
                              ),
                            )
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove example ${index + 1}`}
                          onClick={() => setExamples((rows) => rows.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </PanelBody>
                </Panel>
              </>
            ) : (
              <>
                <Panel>
                  <PanelHeader label="Circuit" title="Parameters" />
                  <PanelBody className="pt-4">
                    <Field label="JSON" hint="Shown to the student above the answer boxes.">
                      <Textarea
                        rows={6}
                        value={paramsJson}
                        onChange={(event) => setParamsJson(event.target.value)}
                        className="font-mono text-[12.5px]"
                      />
                    </Field>
                  </PanelBody>
                </Panel>

                <Panel>
                  <PanelHeader
                    label="Grading"
                    title="Questions"
                    action={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setQuestions((rows) => [
                            ...rows,
                            { id: '', text: '', answer: '', tolerance: '0.05', unit: '' },
                          ])
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add question
                      </Button>
                    }
                  />
                  <PanelBody className="space-y-3 pt-4">
                    {questions.map((row, index) => (
                      <div key={index} className="rounded-lg border border-line p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="instrument">Question {index + 1}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove question ${index + 1}`}
                            onClick={() =>
                              setQuestions((rows) => rows.filter((_, i) => i !== index))
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Input
                          value={row.text}
                          placeholder="What is the output voltage across R2?"
                          onChange={(event) =>
                            setQuestions((rows) =>
                              rows.map((r, i) =>
                                i === index ? { ...r, text: event.target.value } : r,
                              ),
                            )
                          }
                        />
                        <div className="mt-2 grid gap-2 sm:grid-cols-4">
                          <Input
                            value={row.id}
                            placeholder="id (vout)"
                            className="font-mono"
                            onChange={(event) =>
                              setQuestions((rows) =>
                                rows.map((r, i) =>
                                  i === index ? { ...r, id: event.target.value } : r,
                                ),
                              )
                            }
                          />
                          <Input
                            value={row.answer}
                            placeholder="answer (8)"
                            inputMode="decimal"
                            className="font-mono"
                            onChange={(event) =>
                              setQuestions((rows) =>
                                rows.map((r, i) =>
                                  i === index ? { ...r, answer: event.target.value } : r,
                                ),
                              )
                            }
                          />
                          <Input
                            value={row.tolerance}
                            placeholder="± tolerance"
                            inputMode="decimal"
                            className="font-mono"
                            onChange={(event) =>
                              setQuestions((rows) =>
                                rows.map((r, i) =>
                                  i === index ? { ...r, tolerance: event.target.value } : r,
                                ),
                              )
                            }
                          />
                          <Input
                            value={row.unit}
                            placeholder="unit (V)"
                            className="font-mono"
                            onChange={(event) =>
                              setQuestions((rows) =>
                                rows.map((r, i) =>
                                  i === index ? { ...r, unit: event.target.value } : r,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </PanelBody>
                </Panel>
              </>
            )}

            <Panel>
              <PanelHeader label="Scaffolding" title="Hints" />
              <PanelBody className="space-y-3 pt-4">
                {hints.map((hint, index) => (
                  <Field
                    key={index}
                    label={`Hint ${index + 1}`}
                    hint={
                      ['Points at the idea', 'Names the technique', 'Walks the algorithm'][index]
                    }
                  >
                    <Textarea
                      rows={2}
                      value={hint}
                      onChange={(event) =>
                        setHints((rows) =>
                          rows.map((row, i) => (i === index ? event.target.value : row)),
                        )
                      }
                    />
                  </Field>
                ))}
              </PanelBody>
            </Panel>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
