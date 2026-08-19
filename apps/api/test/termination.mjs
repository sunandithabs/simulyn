// Removal from an exam: the violation threshold, a proctor's own decision, and
// readmission. Mutates the database — re-seed afterwards.
import { io } from 'socket.io-client';

import { FLAG_THRESHOLD } from '@simulyn/shared';

const BASE = 'http://localhost:3001';
let pass = 0;
let fail = 0;

function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

const login = async (username, password) => {
  const r = await req('POST', '/auth/login', { body: { username, password } });
  return { token: r.body.accessToken, user: r.body.user };
};

const section = (t) => console.log(`\n── ${t}`);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const teacher = await login('dr.sunitha', 'teacher1');
const sunan = await login('sunan', 'student1');
const vivek = await login('vivek', 'student2');

const classId = (await req('GET', '/classes', { token: teacher.token })).body[0].id;
const problems = (await req('GET', '/problems?limit=100', { token: teacher.token })).body.data;

// ── setup ───────────────────────────────────────────────────────────
section('setup');

const now = Date.now();
const exam = await req('POST', '/exams', {
  token: teacher.token,
  body: {
    classId,
    title: 'Termination Practical',
    durationMin: 60,
    gracePeriodMin: 5,
    randomizeOrder: false,
    isPublished: true,
    scheduledStart: new Date(now - 60_000).toISOString(),
    scheduledEnd: new Date(now + 3_600_000).toISOString(),
    problems: [{ problemId: problems[0].id }, { problemId: problems[1].id }],
  },
});
check('exam created and active', exam.status === 201 && exam.body.status === 'ACTIVE');
const examId = exam.body.id;

const started = await req('POST', `/exams/${examId}/start`, { token: sunan.token });
check('student starts the exam', started.status === 200, JSON.stringify(started.body).slice(0, 160));
const attemptId = started.body.attemptId;

const vivekStarted = await req('POST', `/exams/${examId}/start`, { token: vivek.token });
check('second student starts the exam', vivekStarted.status === 200);
const vivekAttemptId = vivekStarted.body.attemptId;

// ── the violation threshold ─────────────────────────────────────────
section(`automatic removal at ${FLAG_THRESHOLD} violations`);

let lastRecord = null;
for (let i = 0; i < FLAG_THRESHOLD; i++) {
  lastRecord = await req('POST', '/proctoring/violations', {
    token: sunan.token,
    body: { examAttemptId: attemptId, typeKey: 'TABSWITCH' },
  });
}

check(
  `${FLAG_THRESHOLD}th violation reports the attempt flagged`,
  lastRecord.status === 201 && lastRecord.body.flagged === true,
  JSON.stringify(lastRecord.body).slice(0, 160),
);
check('and reports it terminated', lastRecord.body.terminated === true);
check('justFlagged fires exactly once', lastRecord.body.justFlagged === true);

const board = await req('GET', `/proctoring/exams/${examId}/live`, { token: teacher.token });
const sunanRow = board.body.find((row) => row.attemptId === attemptId);
check('the live board shows them removed', sunanRow?.terminated === true);
check(
  'with an automatic reason and no proctor named',
  typeof sunanRow?.terminatedReason === 'string' && sunanRow.terminatedBy === null,
  JSON.stringify(sunanRow?.terminatedReason),
);

const blockedRestart = await req('POST', `/exams/${examId}/start`, { token: sunan.token });
check('a removed student cannot restart -> 403', blockedRestart.status === 403, `got ${blockedRestart.status}`);
check(
  'and the refusal carries the reason',
  String(blockedRestart.body?.message ?? '').includes('removed'),
  JSON.stringify(blockedRestart.body?.message),
);

const blockedSubmit = await req('POST', `/exams/${examId}/submit`, { token: sunan.token, body: {} });
check('a removed student cannot submit -> 403', blockedSubmit.status === 403, `got ${blockedSubmit.status}`);

const blockedViolation = await req('POST', '/proctoring/violations', {
  token: sunan.token,
  body: { examAttemptId: attemptId, typeKey: 'BLUR' },
});
check('further violations from them are refused -> 400', blockedViolation.status === 400);

// ── readmission ─────────────────────────────────────────────────────
section('readmission');

const readmitted = await req('POST', `/proctoring/attempts/${attemptId}/readmit`, {
  token: teacher.token,
});
check('teacher readmits the student', readmitted.status === 200, JSON.stringify(readmitted.body).slice(0, 160));
check(
  'the violation threshold is re-based to the current count',
  readmitted.body.violationBaseline >= FLAG_THRESHOLD,
  String(readmitted.body.violationBaseline),
);

const resumed = await req('POST', `/exams/${examId}/start`, { token: sunan.token });
check('the student can reopen the paper', resumed.status === 200, `got ${resumed.status}`);
check('on the same attempt, not a fresh one', resumed.body.attemptId === attemptId);

const afterReadmit = await req('POST', '/proctoring/violations', {
  token: sunan.token,
  body: { examAttemptId: attemptId, typeKey: 'BLUR' },
});
check('a new violation is accepted again', afterReadmit.status === 201);
check(
  'and does not re-eject them on the old count',
  afterReadmit.body.terminated === false && afterReadmit.body.flagged === false,
  JSON.stringify({ t: afterReadmit.body.terminated, f: afterReadmit.body.flagged }),
);

const doubleReadmit = await req('POST', `/proctoring/attempts/${attemptId}/readmit`, {
  token: teacher.token,
});
check('readmitting an active student -> 400', doubleReadmit.status === 400);

// ── a proctor removing a student ────────────────────────────────────
section('removal by a proctor');

const socket = io(`${BASE}/proctoring`, {
  auth: { token: teacher.token },
  transports: ['websocket'],
});
await new Promise((resolve) => socket.on('connect', resolve));
await new Promise((resolve) => socket.emit('join-exam', { examId }, resolve));

const broadcast = new Promise((resolve) => {
  socket.on('student-terminated', resolve);
  setTimeout(() => resolve(null), 4000);
});

const removed = await req('POST', `/proctoring/attempts/${vivekAttemptId}/terminate`, {
  token: teacher.token,
  body: { reason: 'Reading from a phone under the desk' },
});
check('teacher removes the student', removed.status === 200, JSON.stringify(removed.body).slice(0, 160));
check('the proctor is named on the record', removed.body.by === 'dr.sunitha');
check('the stated reason is kept', removed.body.reason === 'Reading from a phone under the desk');

const event = await broadcast;
check('the proctor room is told in real time', event !== null && event.attemptId === vivekAttemptId);
check('the event carries the reason', event?.reason === 'Reading from a phone under the desk');

const vivekBlocked = await req('POST', `/exams/${examId}/start`, { token: vivek.token });
check('the removed student cannot restart -> 403', vivekBlocked.status === 403, `got ${vivekBlocked.status}`);

const doubleRemove = await req('POST', `/proctoring/attempts/${vivekAttemptId}/terminate`, {
  token: teacher.token,
  body: { reason: 'again' },
});
check('removing an already-removed student -> 400', doubleRemove.status === 400);

const timeline = await req(`GET`, `/proctoring/attempts/${vivekAttemptId}/notes`, {
  token: teacher.token,
});
check(
  'the removal is written onto the proctor timeline',
  Array.isArray(timeline.body) && timeline.body.some((n) => n.note.includes('Removed from exam')),
  JSON.stringify(timeline.body).slice(0, 160),
);

// ── authorisation ───────────────────────────────────────────────────
section('authorisation');

const studentTerminate = await req('POST', `/proctoring/attempts/${attemptId}/terminate`, {
  token: sunan.token,
  body: { reason: 'letting myself off' },
});
check('a student cannot remove anyone -> 403', studentTerminate.status === 403, `got ${studentTerminate.status}`);

const studentReadmit = await req('POST', `/proctoring/attempts/${vivekAttemptId}/readmit`, {
  token: vivek.token,
});
check('a student cannot readmit themselves -> 403', studentReadmit.status === 403, `got ${studentReadmit.status}`);

const noReason = await req('POST', `/proctoring/attempts/${attemptId}/terminate`, {
  token: teacher.token,
  body: {},
});
check('removal without a reason is rejected -> 400', noReason.status === 400, `got ${noReason.status}`);

socket.disconnect();
await wait(100);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
