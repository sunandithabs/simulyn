// Phase 5 verification: discussions, teacher tooling, the exam experience and
// live proctoring. Mutates the database — re-seed afterwards.
import { io } from 'socket.io-client';

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
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}

const login = async (username, password) => {
  const r = await req('POST', '/auth/login', { body: { username, password } });
  return { token: r.body.accessToken, user: r.body.user };
};

const section = (t) => console.log(`\n── ${t}`);

const teacher = await login('dr.sunitha', 'teacher1');
const admin = await login('admin', 'admin123');
const sunan = await login('sunan', 'student1');
const vivek = await login('vivek', 'student2');

const problems = (await req('GET', '/problems?limit=100', { token: teacher.token })).body.data;
const P = Object.fromEntries(problems.map((p) => [p.title, p]));
const classId = (await req('GET', '/classes', { token: teacher.token })).body[0].id;

// ── discussions ─────────────────────────────────────────────────────
section('discussions');
const twoSum = P['Two Sum'];

const empty = await req('GET', `/problems/${twoSum.id}/discussions`, { token: sunan.token });
check('GET thread on a fresh problem', empty.status === 200 && Array.isArray(empty.body));

const root = await req('POST', `/problems/${twoSum.id}/discussions`, {
  token: sunan.token,
  body: { content: 'Is the hash map approach the intended one? I got O(n).' },
});
check('student posts to the thread', root.status === 201 && root.body.isAuthor === true, JSON.stringify(root.body).slice(0, 160));

const reply = await req('POST', `/problems/${twoSum.id}/discussions`, {
  token: teacher.token,
  body: { content: 'Yes — one pass, `seen[target - n]`.', parentId: root.body.id },
});
check('teacher replies to it', reply.status === 201 && reply.body.parentId === root.body.id);

const threaded = await req('GET', `/problems/${twoSum.id}/discussions`, { token: sunan.token });
check('replies nest under their parent', threaded.body.length === 1 && threaded.body[0].replies.length === 1, JSON.stringify(threaded.body.map((p) => p.replies.length)));
check('author role exposed for the badge', threaded.body[0].replies[0].author.role === 'TEACHER');

const up1 = await req('POST', `/discussions/${root.body.id}/upvote`, { token: vivek.token });
check('upvote registers', up1.body.upvotes === 1 && up1.body.hasUpvoted === true, JSON.stringify(up1.body));
const up2 = await req('POST', `/discussions/${root.body.id}/upvote`, { token: vivek.token });
check('a second press removes the vote', up2.body.upvotes === 0 && up2.body.hasUpvoted === false, JSON.stringify(up2.body));
await req('POST', `/discussions/${root.body.id}/upvote`, { token: vivek.token });
const up3 = await req('POST', `/discussions/${root.body.id}/upvote`, { token: sunan.token });
check('one vote per account, counted once each', up3.body.upvotes === 2, JSON.stringify(up3.body));

const asVivek = await req('GET', `/problems/${twoSum.id}/discussions`, { token: vivek.token });
check('hasUpvoted is per viewer', asVivek.body[0].hasUpvoted === true);

const studentPin = await req('PATCH', `/discussions/${root.body.id}`, {
  token: vivek.token,
  body: { isPinned: true },
});
check('students cannot pin -> 403', studentPin.status === 403, `got ${studentPin.status}`);

const pinned = await req('PATCH', `/discussions/${root.body.id}`, {
  token: teacher.token,
  body: { isPinned: true },
});
check('teacher pins a post', pinned.status === 200 && pinned.body.isPinned === true);

const editOther = await req('PATCH', `/discussions/${root.body.id}`, {
  token: vivek.token,
  body: { content: 'hijacked' },
});
check('only the author may edit -> 403', editOther.status === 403, `got ${editOther.status}`);

const spam = await req('POST', `/problems/${twoSum.id}/discussions`, {
  token: vivek.token,
  body: { content: 'delete me' },
});
const del = await req('DELETE', `/discussions/${spam.body.id}`, { token: teacher.token });
check('teacher soft-deletes a post', del.status === 200 && del.body.success === true);
const afterDelete = await req('GET', `/problems/${twoSum.id}/discussions`, { token: sunan.token });
check('deleted root with no replies drops out of the thread', afterDelete.body.length === 1, `${afterDelete.body.length} roots`);

// ── teacher tooling ─────────────────────────────────────────────────
section('teacher tooling');
const lookup = await req('GET', '/users/lookup?q=viv', { token: teacher.token });
check('student lookup finds a match', lookup.status === 200 && lookup.body.some((u) => u.username === 'vivek'), JSON.stringify(lookup.body).slice(0, 140));
const shortQuery = await req('GET', '/users/lookup?q=v', { token: teacher.token });
check('a one-character query returns nothing', shortQuery.body.length === 0);
const studentLookup = await req('GET', '/users/lookup?q=viv', { token: sunan.token });
check('students cannot use the lookup -> 403', studentLookup.status === 403, `got ${studentLookup.status}`);
check('lookup never returns staff accounts', (await req('GET', '/users/lookup?q=sunitha', { token: teacher.token })).body.length === 0);

const newClass = await req('POST', '/classes', {
  token: teacher.token,
  body: { name: 'Phase 5 Lab', semester: 'Even 2026' },
});
check('teacher creates a class', newClass.status === 201 && /^[A-Z2-9]{6}$/.test(newClass.body.code));
const labId = newClass.body.id;

const enrolled = await req('POST', `/classes/${labId}/enroll`, {
  token: teacher.token,
  body: { userIds: [sunan.user.id, vivek.user.id] },
});
check('enrolls the students found by lookup', enrolled.body.enrolled === 2, JSON.stringify(enrolled.body));

const assigned = await req('POST', `/classes/${labId}/problems`, {
  token: teacher.token,
  body: { problemId: twoSum.id, dueDate: '2026-12-01T23:59:00.000Z' },
});
check('assigns a problem with a due date', assigned.status === 201 && assigned.body.dueDate !== null);

const authored = await req('POST', '/problems', {
  token: teacher.token,
  body: {
    type: 'PROGRAMMING',
    difficulty: 'EASY',
    category: 'Math',
    title: 'Phase 5 — Triple It',
    description: 'Return `n * 3`.',
    constraints: ['-1000 <= n <= 1000'],
    points: 60,
    tags: ['math'],
    isPublished: true,
    starterCode: { python: 'def tripleIt(n):\n    pass\n' },
    harness: { funcName: 'tripleIt', params: [{ name: 'n', type: 'int' }], returnType: 'int' },
    examples: [{ input: 'n = 3', output: '9' }],
    testCases: [
      { input: '3', expected: '9' },
      { input: '-2', expected: '-6', isHidden: true },
    ],
    hints: [{ level: 1, text: 'Multiply.' }],
  },
});
check('teacher authors a problem from the form payload', authored.status === 201 && authored.body.testCases.length === 2, JSON.stringify(authored.body).slice(0, 180));

const edited = await req('PATCH', `/problems/${authored.body.id}`, {
  token: teacher.token,
  body: { points: 80, difficulty: 'MEDIUM' },
});
check('teacher edits it', edited.status === 200 && edited.body.points === 80 && edited.body.difficulty === 'MEDIUM');

// ── exam lifecycle ──────────────────────────────────────────────────
section('exam lifecycle');
const now = Date.now();
const exam = await req('POST', '/exams', {
  token: teacher.token,
  body: {
    classId: labId,
    title: 'Phase 5 Practical',
    description: 'Two questions, thirty minutes.',
    durationMin: 30,
    gracePeriodMin: 5,
    randomizeOrder: true,
    isPublished: true,
    scheduledStart: new Date(now - 60_000).toISOString(),
    scheduledEnd: new Date(now + 3_600_000).toISOString(),
    problems: [
      { problemId: twoSum.id, points: 120 },
      { problemId: authored.body.id },
    ],
  },
});
check('exam created from the scheduler payload', exam.status === 201 && exam.body.status === 'ACTIVE', JSON.stringify(exam.body).slice(0, 180));
const examId = exam.body.id;

const teacherView = await req('GET', `/exams/${examId}`, { token: teacher.token });
check('teacher sees the paper', teacherView.body.problems?.length === 2);
check('per-problem points override applied', teacherView.body.problems.some((p) => p.points === 120));

const beforeStart = await req('GET', `/exams/${examId}`, { token: sunan.token });
check('student sees the schedule but not the paper', beforeStart.body.problems === null);

const started = await req('POST', `/exams/${examId}/start`, { token: sunan.token });
check('student starts and receives questions', started.status === 200 && started.body.questions.length === 2);
check('deadline is start + duration', Math.abs(new Date(started.body.endsAt) - new Date(started.body.startedAt) - 30 * 60_000) < 2000, started.body.endsAt);
const attemptId = started.body.attemptId;

const started2 = await req('POST', `/exams/${examId}/start`, { token: vivek.token });
const attempt2 = started2.body.attemptId;
check('second student gets their own attempt', attempt2 !== attemptId);

const answer = await req('POST', '/submissions', {
  token: sunan.token,
  body: {
    problemId: authored.body.id,
    code: 'def tripleIt(n):\n    return n * 3',
    language: 'PYTHON',
    examAttemptId: attemptId,
  },
});
check('answer submitted inside the exam', answer.status === 201 && answer.body.passed === true);
check('exam answers pay no XP', answer.body.reward === null);

// ── proctoring ──────────────────────────────────────────────────────
section('proctoring');
const paste = await req('POST', '/proctoring/violations', {
  token: sunan.token,
  body: { examAttemptId: attemptId, typeKey: 'PASTE', codeSnapshot: 'def tripleIt(n):', timeRemaining: 1500 },
});
check('student client reports a violation', paste.status === 201 && paste.body.integrityScore === 90);

const flagged = await req('POST', `/proctoring/attempts/${attemptId}/flag`, {
  token: teacher.token,
  body: { note: 'Looked off-screen repeatedly.' },
});
check('proctor records a note', flagged.status === 201 && flagged.body.typeKey === 'MANUAL');
check('notes carry zero weight', flagged.body.weight === 0 && flagged.body.integrityScore === 90, JSON.stringify(flagged.body).slice(0, 160));

const notes = await req('GET', `/proctoring/attempts/${attemptId}/notes`, { token: teacher.token });
check('notes read back with their author', notes.body.length === 1 && notes.body[0].note.startsWith('Looked off-screen') && notes.body[0].by === 'dr.sunitha', JSON.stringify(notes.body));

const studentFlag = await req('POST', `/proctoring/attempts/${attemptId}/flag`, {
  token: vivek.token,
  body: { note: 'nope' },
});
check('students cannot record notes -> 403', studentFlag.status === 403, `got ${studentFlag.status}`);

const board = await req('GET', `/proctoring/exams/${examId}/live`, { token: teacher.token });
check('live board seeds the proctor grid', board.status === 200 && board.body.length === 2, `${board.body.length} rows`);
check('board carries integrity + violation counts', board.body.some((r) => r.integrityScore === 90 && r.violationCount === 2));

const timeline = await req('GET', `/proctoring/violations?examAttemptId=${attemptId}`, { token: teacher.token });
check('timeline includes the code snapshot for staff', timeline.body.some((v) => v.codeSnapshot === 'def tripleIt(n):'));

// ── live socket ─────────────────────────────────────────────────────
section('proctor socket');
function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(`${BASE}/proctoring`, { auth: { token }, transports: ['websocket'], reconnection: false });
    const timer = setTimeout(() => reject(new Error('connect timeout')), 8000);
    socket.on('connect', () => { clearTimeout(timer); resolve(socket); });
    socket.on('connect_error', (e) => { clearTimeout(timer); reject(e); });
  });
}
const waitFor = (socket, event, ms = 8000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), ms);
    socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
  });
const emit = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

let proctorSocket, studentSocket;
try {
  proctorSocket = await connect(teacher.token);
  const join = await emit(proctorSocket, 'join-exam', { examId });
  check('proctor joins and receives the board', join.ok === true && join.board.length === 2);

  studentSocket = await connect(sunan.token);
  await emit(studentSocket, 'join-exam', { examId, attemptId });

  const heartbeatEvent = waitFor(proctorSocket, 'student-heartbeat');
  const hb = await emit(studentSocket, 'heartbeat', { examAttemptId: attemptId, currentQuestion: 1, timeRemaining: 1400 });
  check('heartbeat acknowledged with the deadline', hb.ok === true && hb.expired === false);
  const seen = await heartbeatEvent;
  check('proctor grid receives the heartbeat', seen.currentQuestion === 1 && seen.attemptId === attemptId, JSON.stringify(seen).slice(0, 160));

  const violationEvent = waitFor(proctorSocket, 'student-violation');
  const ack = await emit(studentSocket, 'violation', { examAttemptId: attemptId, typeKey: 'DEVTOOLS', timeRemaining: 1390 });
  check('violation over the socket is acknowledged', ack.ok === true && ack.integrityScore === 65, JSON.stringify(ack));
  const live = await violationEvent;
  check('proctor sees it in real time, flagged critical', live.typeKey === 'DEVTOOLS' && live.critical === true);

  // A note posted over REST must also reach the open proctor socket.
  const noteEvent = waitFor(proctorSocket, 'student-violation');
  await req('POST', `/proctoring/attempts/${attemptId}/flag`, {
    token: teacher.token,
    body: { note: 'Second observation.' },
  });
  const noteLive = await noteEvent;
  check('REST-recorded notes broadcast to the proctor room', noteLive.typeKey === 'MANUAL');
} catch (error) {
  check('proctor socket flow', false, error.message);
} finally {
  proctorSocket?.disconnect();
  studentSocket?.disconnect();
}

// ── results & export ────────────────────────────────────────────────
section('results');
const submitted = await req('POST', `/exams/${examId}/submit`, { token: sunan.token, body: {} });
check('student submits the exam', submitted.status === 200 && submitted.body.totalScore === 80, JSON.stringify(submitted.body));

const results = await req('GET', `/exams/${examId}/results`, { token: teacher.token });
check('results summary counts attempts', results.body.summary.started === 2 && results.body.summary.submitted === 1, JSON.stringify(results.body.summary));
check('max score honours the points override', results.body.exam.maxScore === 120 + 80, `${results.body.exam.maxScore}`);
check('rows carry every CSV column', ['totalScore', 'percentage', 'integrityScore', 'violationCount', 'timeTakenMin', 'autoSubmitted'].every((key) => key in results.body.attempts[0]));
check('integrity reflects the violations', results.body.attempts.find((a) => a.user.username === 'sunan').integrityScore === 65);

const attemptDetail = await req('GET', `/exams/${examId}/attempts/${attemptId}`, { token: teacher.token });
check('attempt detail exposes code for staff', attemptDetail.body.submissions[0].code?.includes('return n * 3'));
check('violation timeline attached', attemptDetail.body.violations.length === 4, `${attemptDetail.body.violations.length}`);

const studentPeek = await req('GET', `/exams/${examId}/attempts/${attempt2}`, { token: sunan.token });
check('a student cannot read another attempt -> 403', studentPeek.status === 403, `got ${studentPeek.status}`);

const ownAttempt = await req('GET', `/exams/${examId}/attempts/${attemptId}`, { token: sunan.token });
check('a student can read their own attempt', ownAttempt.status === 200);
check('code withheld from the student view', ownAttempt.body.submissions[0].code === undefined);

// ── analytics for the teacher dashboard ─────────────────────────────
section('analytics');
const overview = await req('GET', `/analytics/class/${classId}`, { token: teacher.token });
check('class overview drives the dashboard cards', overview.status === 200 && typeof overview.body.averageAccuracy === 'number');
const insights = await req('POST', '/analytics/classroom-insights', { token: teacher.token, body: { classId } });
check('classroom insights returns stats even without an LLM', insights.status === 200 && insights.body.stats.students === 4);

// ── cleanup ─────────────────────────────────────────────────────────
section('cleanup');
const delExam = await req('DELETE', `/exams/${examId}`, { token: teacher.token });
check('an exam with attempts refuses deletion', delExam.status === 400, `got ${delExam.status}`);
await req('DELETE', `/classes/${labId}/students/${sunan.user.id}`, { token: teacher.token });
await req('DELETE', `/classes/${labId}/students/${vivek.user.id}`, { token: teacher.token });
void admin;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
