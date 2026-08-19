// Verifies the visualisation tracing endpoint and the exam auto-flag.
// Mutates data — re-seed afterwards.
import { io } from 'socket.io-client';

const BASE = 'http://localhost:3001';
let pass = 0;
let fail = 0;

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}

const login = async (u, p) => {
  const r = await req('POST', '/auth/login', { body: { username: u, password: p } });
  return { token: r.body.accessToken, user: r.body.user };
};

const section = (t) => console.log(`\n── ${t}`);

const teacher = await login('dr.sunitha', 'teacher1');
const sunan = await login('sunan', 'student1');
const vivek = await login('vivek', 'student2');

const problems = (await req('GET', '/problems?limit=100', { token: teacher.token })).body.data;
const P = Object.fromEntries(problems.map((p) => [p.title, p]));
const classId = (await req('GET', '/classes', { token: teacher.token })).body[0].id;

// ── feature 1: tracing ──────────────────────────────────────────────
section('trace endpoint');

const solution = `def twoSum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return []`;

const py = await req('POST', '/execute/trace', {
  token: sunan.token,
  body: { problemId: P['Two Sum'].id, lang: 'python', code: solution },
});
check('python trace succeeds', py.status === 200 && py.body.ok === true, JSON.stringify(py.body).slice(0, 160));
check('fidelity reported as full for python', py.body.fidelity === 'full');
check('emits trace events', py.body.events.length > 0, `${py.body.events?.length} events`);
check('events carry vars, highlights and a description', py.body.events.every((e) => e.vars && Array.isArray(e.highlights) && typeof e.description === 'string'));
check('ops are from the documented set', py.body.events.every((e) => ['compare','swap','assign','push','pop','visit','return'].includes(e.op)));
check('steps increase monotonically', py.body.events.every((e, i) => e.step === i + 1));
check('a return event closes the trace', py.body.events.at(-1).op === 'return');
check('pointer highlights present', py.body.events.some((e) => e.highlights.length > 0));

const listTrace = await req('POST', '/execute/trace', {
  token: sunan.token,
  body: {
    problemId: P['Reverse Linked List'].id,
    lang: 'python',
    code: `def reverseList(head):
    prev = None
    while head:
        nxt = head.next
        head.next = prev
        prev = head
        head = nxt
    return prev`,
  },
});
const headVar = listTrace.body.events?.find((e) => Array.isArray(e.vars.head));
check('listNode serialised as an array of values', Array.isArray(headVar?.vars.head), JSON.stringify(headVar?.vars.head));

const gridTrace = await req('POST', '/execute/trace', {
  token: sunan.token,
  body: {
    problemId: P['Number of Islands'].id,
    lang: 'python',
    code: `def numIslands(grid):
    return len(grid)`,
  },
});
const gridVar = gridTrace.body.events?.find((e) => Array.isArray(e.vars.grid));
check('grid serialised as nested arrays', Array.isArray(gridVar?.vars.grid?.[0]), JSON.stringify(gridVar?.vars.grid).slice(0, 60));

const js = await req('POST', '/execute/trace', {
  token: sunan.token,
  body: {
    problemId: P['Two Sum'].id,
    lang: 'javascript',
    code: `function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) { if (nums[i] === target) return [i]; }
  return [];
}`,
  },
});
check('javascript trace reports array reads', js.body.ok === true && js.body.fidelity === 'partial' && js.body.events.some((e) => e.op === 'compare'));

const printed = await req('POST', '/execute/trace', {
  token: sunan.token,
  body: { problemId: P['Two Sum'].id, lang: 'python', code: 'def twoSum(nums, target):\n    print("mine")\n    return [0,1]' },
});
check('student stdout survives, separated from trace lines', printed.body.stdout === 'mine' && printed.body.events.length > 0, JSON.stringify(printed.body.stdout));

const cap = await req('POST', '/execute/trace', {
  token: sunan.token,
  body: { problemId: P['Two Sum'].id, lang: 'python', code: 'def twoSum(nums, target):\n    t=0\n    for i in range(50000):\n        t+=i\n    return [0,1]' },
});
check('capped at 5000 events and flagged truncated', cap.body.events.length === 5000 && cap.body.truncated === true, `${cap.body.events.length}`);

const elec = await req('POST', '/execute/trace', {
  token: sunan.token,
  body: { problemId: P['Voltage Divider'].id, lang: 'python', code: 'x = 1' },
});
check('electronics problems are rejected', elec.status === 400, `got ${elec.status}`);

// ── feature 2: auto-flag ────────────────────────────────────────────
section('exam auto-flag at 10 violations');

const now = Date.now();
const exam = await req('POST', '/exams', {
  token: teacher.token,
  body: {
    classId,
    title: 'Lockdown verification',
    durationMin: 60,
    scheduledStart: new Date(now - 60_000).toISOString(),
    scheduledEnd: new Date(now + 3_600_000).toISOString(),
    isPublished: true,
    problems: [{ problemId: P['Two Sum'].id }],
  },
});
const examId = exam.body.id;
const attemptId = (await req('POST', `/exams/${examId}/start`, { token: sunan.token })).body.attemptId;

const proctor = await new Promise((resolve, reject) => {
  const socket = io(`${BASE}/proctoring`, { auth: { token: teacher.token }, transports: ['websocket'], reconnection: false });
  const timer = setTimeout(() => reject(new Error('connect timeout')), 8000);
  socket.on('connect', () => { clearTimeout(timer); resolve(socket); });
  socket.on('connect_error', reject);
});
await new Promise((resolve) => proctor.emit('join-exam', { examId }, resolve));

const flaggedEvent = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('no student-flagged event')), 15000);
  proctor.once('student-flagged', (payload) => { clearTimeout(timer); resolve(payload); });
});

let lastRecorded = null;
for (let i = 0; i < 10; i++) {
  const r = await req('POST', '/proctoring/violations', {
    token: sunan.token,
    body: { examAttemptId: attemptId, typeKey: 'RIGHTCLICK' },
  });
  lastRecorded = r.body;
  if (i === 8) check('not flagged at 9 violations', r.body.flagged === false, `count=${r.body.violationCount}`);
}

check('flagged at the tenth violation', lastRecorded.flagged === true && lastRecorded.violationCount === 10, JSON.stringify(lastRecorded).slice(0, 140));
check('justFlagged set exactly on the tipping violation', lastRecorded.justFlagged === true);

try {
  const event = await flaggedEvent;
  check('teacher room receives student-flagged', event.username === 'sunan' && event.violationCount === 10, JSON.stringify(event).slice(0, 140));
} catch (error) {
  check('teacher room receives student-flagged', false, error.message);
}

// The tipping violation also removes the student, so there is no eleventh from
// them to record — see test/termination.mjs for the full removal contract.
const eleventh = await req('POST', '/proctoring/violations', {
  token: sunan.token,
  body: { examAttemptId: attemptId, typeKey: 'RIGHTCLICK' },
});
check('a removed student cannot record another violation', eleventh.status === 400, `got ${eleventh.status}`);

const board = await req('GET', `/proctoring/exams/${examId}/live`, { token: teacher.token });
const flaggedRow = board.body.find((r) => r.attemptId === attemptId);
check('live board exposes flagged', flaggedRow?.flagged === true);
check('live board exposes the removal', flaggedRow?.terminated === true);

const results = await req('GET', `/exams/${examId}/results`, { token: teacher.token });
check('results table exposes flagged', results.body.attempts.find((a) => a.user.username === 'sunan')?.flagged === true);

const clean = await req('POST', `/exams/${examId}/start`, { token: vivek.token });
const cleanBoard = await req('GET', `/proctoring/exams/${examId}/live`, { token: teacher.token });
check('an untouched attempt is not flagged', cleanBoard.body.find((r) => r.attemptId === clean.body.attemptId)?.flagged === false);

proctor.disconnect();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
