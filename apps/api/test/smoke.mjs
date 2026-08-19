// Temporary Phase 3 verification script — deleted after the run.
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
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
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

const admin = await login('admin', 'admin123');
const teacher = await login('dr.sunitha', 'teacher1');
const student = await login('sunan', 'student1');
const student2 = await login('vivek', 'student2');

const problemsRes = await req('GET', '/problems?limit=100', { token: teacher.token });
const P = {};
for (const p of problemsRes.body.data) P[p.title] = p;

// ── execution ───────────────────────────────────────────────────────
section('execute/run');
const health = await req('GET', '/execute/health', { token: teacher.token });
check('GET /execute/health', health.status === 200 && health.body.languages.javascript === true);
console.log(`        runtimes: ${JSON.stringify(health.body.languages)}  semaphore capacity ${health.body.concurrency.capacity}`);

const pyRun = await req('POST', '/execute/run', {
  token: student.token,
  body: { code: 'print("hello from python")\nprint(2 + 3)', lang: 'python' },
});
check('python run -> stdout', pyRun.body.ok && pyRun.body.stdout.includes('hello from python') && pyRun.body.stdout.includes('5'), JSON.stringify(pyRun.body));

const jsRun = await req('POST', '/execute/run', {
  token: student.token,
  body: { code: 'console.log("node says", 6 * 7);', lang: 'javascript' },
});
check('javascript run -> stdout', jsRun.body.ok && jsRun.body.stdout.includes('42'), JSON.stringify(jsRun.body));

const stdinRun = await req('POST', '/execute/run', {
  token: student.token,
  body: { code: 'import sys\nfor line in sys.stdin:\n    print(line.strip().upper())', lang: 'python', stdin: 'abc\ndef' },
});
check('stdin is piped through', stdinRun.body.stdout.includes('ABC') && stdinRun.body.stdout.includes('DEF'), JSON.stringify(stdinRun.body));

const errRun = await req('POST', '/execute/run', {
  token: student.token,
  body: { code: 'raise ValueError("boom")', lang: 'python' },
});
check('runtime error -> stderr + non-zero exit', !errRun.body.ok && errRun.body.stderr.includes('ValueError') && errRun.body.exitCode !== 0, JSON.stringify(errRun.body));

const cppRun = await req('POST', '/execute/run', {
  token: student.token,
  body: { code: 'int main(){return 0;}', lang: 'cpp' },
});
check('missing toolchain -> clean compileError, no crash', cppRun.status === 200 && typeof cppRun.body.compileError === 'string' && cppRun.body.compileError.includes('not installed'), JSON.stringify(cppRun.body));

const loopRun = await req('POST', '/execute/run', {
  token: student.token,
  body: { code: 'while True:\n    pass', lang: 'python' },
});
check('infinite loop is killed by the timeout', loopRun.body.timedOut === true, JSON.stringify(loopRun.body));

// ── harness across every type ───────────────────────────────────────
section('harness / execute/submit');

const solutions = {
  'Two Sum': `def twoSum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return []`,
  'Valid Palindrome': `def isPalindrome(s):
    t = [c.lower() for c in s if c.isalnum()]
    return t == t[::-1]`,
  'Reverse Linked List': `def reverseList(head):
    prev = None
    while head:
        nxt = head.next
        head.next = prev
        prev = head
        head = nxt
    return prev`,
  'Maximum Depth of Binary Tree': `def maxDepth(root):
    if root is None:
        return 0
    return 1 + max(maxDepth(root.left), maxDepth(root.right))`,
  'Longest Increasing Subsequence': `def lengthOfLIS(nums):
    import bisect
    tails = []
    for n in nums:
        i = bisect.bisect_left(tails, n)
        if i == len(tails):
            tails.append(n)
        else:
            tails[i] = n
    return len(tails)`,
  'Group Anagrams': `def groupAnagrams(strs):
    from collections import defaultdict
    d = defaultdict(list)
    for w in strs:
        d[''.join(sorted(w))].append(w)
    return list(d.values())`,
  'Number of Islands': `def numIslands(grid):
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "1":
                count += 1
                stack = [(r, c)]
                while stack:
                    x, y = stack.pop()
                    if 0 <= x < rows and 0 <= y < cols and grid[x][y] == "1":
                        grid[x][y] = "0"
                        stack.extend([(x+1,y),(x-1,y),(x,y+1),(x,y-1)])
    return count`,
  'N-Queens Count': `def totalNQueens(n):
    cols, d1, d2 = set(), set(), set()
    def place(r):
        if r == n:
            return 1
        total = 0
        for c in range(n):
            if c in cols or (r - c) in d1 or (r + c) in d2:
                continue
            cols.add(c); d1.add(r - c); d2.add(r + c)
            total += place(r + 1)
            cols.remove(c); d1.remove(r - c); d2.remove(r + c)
        return total
    return place(0)`,
  'Container With Most Water': `def maxArea(height):
    i, j, best = 0, len(height) - 1, 0
    while i < j:
        best = max(best, (j - i) * min(height[i], height[j]))
        if height[i] < height[j]:
            i += 1
        else:
            j -= 1
    return best`,
};

// class-style code exercises the Solution() fallback in the driver
solutions['Valid Parentheses'] = `class Solution:
    def isValid(self, s):
        pairs = {')': '(', ']': '[', '}': '{'}
        stack = []
        for c in s:
            if c in '([{':
                stack.append(c)
            else:
                if not stack or stack.pop() != pairs.get(c):
                    return False
        return not stack`;

for (const [title, code] of Object.entries(solutions)) {
  const r = await req('POST', '/execute/submit', {
    token: teacher.token,
    body: { problemId: P[title].id, code, lang: 'python' },
  });
  check(
    `${title} (python) -> all ${r.body?.totalCount ?? '?'} tests pass`,
    r.body?.allPassed === true,
    JSON.stringify(r.body?.compileError ?? r.body?.results?.filter((x) => !x.passed).slice(0, 1)),
  );
}

const jsTwoSum = await req('POST', '/execute/submit', {
  token: teacher.token,
  body: {
    problemId: P['Two Sum'].id,
    lang: 'javascript',
    code: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
    seen.set(nums[i], i);
  }
  return [];
}`,
  },
});
check('Two Sum (javascript) -> all tests pass', jsTwoSum.body?.allPassed === true, JSON.stringify(jsTwoSum.body).slice(0, 300));

const jsList = await req('POST', '/execute/submit', {
  token: teacher.token,
  body: {
    problemId: P['Reverse Linked List'].id,
    lang: 'javascript',
    code: `function reverseList(head) {
  let prev = null;
  while (head) { const n = head.next; head.next = prev; prev = head; head = n; }
  return prev;
}`,
  },
});
check('Reverse Linked List (javascript) -> all tests pass', jsList.body?.allPassed === true, JSON.stringify(jsList.body).slice(0, 300));

const wrong = await req('POST', '/execute/submit', {
  token: teacher.token,
  body: { problemId: P['Two Sum'].id, code: 'def twoSum(nums, target):\n    return [0, 0]', lang: 'python' },
});
check('wrong answer -> not all passed', wrong.body?.allPassed === false);
check('failing case reports actual output', wrong.body?.results?.[0]?.actual === '[0,0]', JSON.stringify(wrong.body?.results?.[0]));

const syntax = await req('POST', '/execute/submit', {
  token: teacher.token,
  body: { problemId: P['Two Sum'].id, code: 'def twoSum(nums, target)\n    return []', lang: 'python' },
});
check('syntax error -> every case fails with stderr', syntax.body?.allPassed === false && syntax.body?.results?.[0]?.stderr?.includes('SyntaxError'), JSON.stringify(syntax.body?.results?.[0]?.stderr));

const studentSubmit = await req('POST', '/execute/submit', {
  token: student.token,
  body: { problemId: P['Two Sum'].id, code: solutions['Two Sum'], lang: 'python' },
});
const hiddenRows = studentSubmit.body?.results?.filter((r) => r.isHidden) ?? [];
check('students get hidden cases masked', hiddenRows.length === 2 && hiddenRows.every((r) => r.input === 'hidden' && r.expected === 'hidden'), JSON.stringify(hiddenRows[0]));

// ── electronics ─────────────────────────────────────────────────────
section('electronics');
const vd = P['Voltage Divider'];
const correct = await req('POST', '/electronics/submit', {
  token: student.token,
  body: { problemId: vd.id, answers: [{ questionId: 'vout', value: 8 }, { questionId: 'current', value: 0.4 }, { questionId: 'power_r2', value: 3.2 }] },
});
check('all correct -> allCorrect true, full score', correct.body?.allCorrect === true && correct.body?.score === vd.points, JSON.stringify(correct.body));

const tolerant = await req('POST', '/electronics/submit', {
  token: student.token,
  body: { problemId: vd.id, answers: [{ questionId: 'vout', value: 8.04 }, { questionId: 'current', value: '0.4' }, { questionId: 'power_r2', value: 3.2 }] },
});
check('within tolerance + string coercion accepted', tolerant.body?.allCorrect === true, JSON.stringify(tolerant.body?.results?.[0]));

const outside = await req('POST', '/electronics/submit', {
  token: student.token,
  body: { problemId: vd.id, answers: [{ questionId: 'vout', value: 9 }, { questionId: 'current', value: 0.4 }, { questionId: 'power_r2', value: 3.2 }] },
});
check('outside tolerance -> partial score', outside.body?.allCorrect === false && outside.body?.correctCount === 2, JSON.stringify(outside.body?.results?.[0]));

const wrongType = await req('POST', '/electronics/submit', { token: student.token, body: { problemId: P['Two Sum'].id, answers: [] } });
check('electronics endpoint rejects a programming problem', wrongType.status === 400, `got ${wrongType.status}`);

// ── submissions + gamification ──────────────────────────────────────
section('submissions');
const before = await req('GET', '/gamification/me', { token: student2.token });

const sub = await req('POST', '/submissions', {
  token: student2.token,
  body: { problemId: P['Valid Parentheses'].id, code: solutions['Valid Parentheses'], language: 'PYTHON' },
});
check('POST /submissions -> 201 passed', sub.status === 201 && sub.body?.passed === true, JSON.stringify(sub.body).slice(0, 300));
check('score = full points', sub.body?.score === P['Valid Parentheses'].points, `${sub.body?.score}/${P['Valid Parentheses'].points}`);
check('test results persisted', sub.body?.totalCount === 6 && sub.body?.passedCount === 6, `${sub.body?.passedCount}/${sub.body?.totalCount}`);
check('XP awarded on first solve', sub.body?.reward?.xpAwarded === P['Valid Parentheses'].points, JSON.stringify(sub.body?.reward));
check('streak updated', sub.body?.reward?.currentStreak >= 1);

const after = await req('GET', '/gamification/me', { token: student2.token });
check('XP total increased', after.body.xp === before.body.xp + P['Valid Parentheses'].points, `${before.body.xp} -> ${after.body.xp}`);

const resub = await req('POST', '/submissions', {
  token: student2.token,
  body: { problemId: P['Valid Parentheses'].id, code: solutions['Valid Parentheses'], language: 'PYTHON' },
});
check('re-solving does not pay XP twice', resub.body?.reward?.xpAwarded === 0, JSON.stringify(resub.body?.reward));
check('attemptNumber increments', resub.body?.attemptNumber === 2, `got ${resub.body?.attemptNumber}`);

const failed = await req('POST', '/submissions', {
  token: student2.token,
  body: { problemId: P['Two Sum'].id, code: 'def twoSum(nums, target):\n    return []', language: 'PYTHON' },
});
check('failing submission scores 0 and awards nothing', failed.body?.passed === false && failed.body?.score === 0 && failed.body?.reward === null);

const list = await req('GET', '/submissions?limit=5', { token: student2.token });
check('GET /submissions lists own work', list.status === 200 && list.body.meta.total >= 3, JSON.stringify(list.body.meta));

const detail = await req('GET', `/submissions/${sub.body.id}`, { token: student2.token });
check('GET /submissions/:id returns test results', detail.status === 200 && detail.body.testResults.length === 6);

const peek = await req('GET', `/submissions/${sub.body.id}`, { token: student.token });
check('another student cannot read it -> 403', peek.status === 403, `got ${peek.status}`);

const teacherPeek = await req('GET', `/submissions/${sub.body.id}`, { token: teacher.token });
check('their teacher can read it', teacherPeek.status === 200);

const perProblem = await req('GET', `/problems/${P['Valid Parentheses'].id}/submissions`, { token: teacher.token });
check('GET /problems/:id/submissions (teacher)', perProblem.status === 200 && perProblem.body.meta.total >= 2, JSON.stringify(perProblem.body.meta));

const studentPerProblem = await req('GET', `/problems/${P['Valid Parentheses'].id}/submissions`, { token: student.token });
check('students blocked from problem analytics -> 403', studentPerProblem.status === 403, `got ${studentPerProblem.status}`);

// ── gamification ────────────────────────────────────────────────────
section('gamification');
const board = await req('GET', '/gamification/leaderboard', { token: student.token });
check('leaderboard ranked by XP', board.status === 200 && board.body[0].rank === 1 && board.body[0].xp >= board.body[1].xp, JSON.stringify(board.body.slice(0, 2)));
check('current user flagged', board.body.some((r) => r.isCurrentUser));

const classBoard = await req('GET', `/gamification/leaderboard?classId=${(await req('GET', '/classes', { token: teacher.token })).body[0].id}`, { token: student.token });
check('class leaderboard filters to the class', classBoard.status === 200 && classBoard.body.length === 4, `${classBoard.body.length} rows`);

const badges = await req('GET', '/gamification/badges', { token: student2.token });
check('badge catalogue with earned flags', badges.status === 200 && badges.body.length === 6 && badges.body.some((b) => b.earned));

// ── exams ───────────────────────────────────────────────────────────
section('exams');
const classId = (await req('GET', '/classes', { token: teacher.token })).body[0].id;
const now = Date.now();

const exam = await req('POST', '/exams', {
  token: teacher.token,
  body: {
    classId,
    title: 'Phase 3 Smoke Exam',
    durationMin: 60,
    scheduledStart: new Date(now - 60_000).toISOString(),
    scheduledEnd: new Date(now + 3_600_000).toISOString(),
    randomizeOrder: true,
    isPublished: true,
    problems: [
      { problemId: P['Two Sum'].id, points: 100 },
      { problemId: P['Valid Palindrome'].id },
      { problemId: P['Valid Parentheses'].id },
    ],
  },
});
check('POST /exams -> 201 ACTIVE', exam.status === 201 && exam.body.status === 'ACTIVE', JSON.stringify(exam.body).slice(0, 300));
const examId = exam.body.id;

const badWindow = await req('POST', '/exams', {
  token: teacher.token,
  body: { classId, title: 'bad', durationMin: 10, scheduledStart: new Date(now + 1000).toISOString(), scheduledEnd: new Date(now).toISOString(), problems: [{ problemId: P['Two Sum'].id }] },
});
check('end before start -> 400', badWindow.status === 400, `got ${badWindow.status}`);

const beforeStart = await req('GET', `/exams/${examId}`, { token: student.token });
check('student sees schedule but not the problems yet', beforeStart.status === 200 && beforeStart.body.problems === null, JSON.stringify(beforeStart.body).slice(0, 200));

const started = await req('POST', `/exams/${examId}/start`, { token: student.token });
check('POST /exams/:id/start -> attempt + questions', started.status === 200 && started.body.questions.length === 3, JSON.stringify(started.body).slice(0, 250));
check('deadline returned', typeof started.body.endsAt === 'string');
check('questions carry no hidden test cases', started.body.questions.every((q) => q.problem.testCases.every((t) => !t.isHidden)));
const attemptId = started.body.attemptId;

const started2 = await req('POST', `/exams/${examId}/start`, { token: student2.token });
check('second student gets their own attempt', started2.body.attemptId !== attemptId);
const order1 = started.body.questions.map((q) => q.problem.id).join(',');
const order2 = started2.body.questions.map((q) => q.problem.id).join(',');
console.log(`        shuffled orders: ${order1 === order2 ? 'identical (chance 1 in 6)' : 'different'}`);

const restart = await req('POST', `/exams/${examId}/start`, { token: student.token });
check('re-starting returns the same attempt', restart.body.attemptId === attemptId);

const examSub = await req('POST', '/submissions', {
  token: student.token,
  body: { problemId: P['Two Sum'].id, code: solutions['Two Sum'], language: 'PYTHON', examAttemptId: attemptId },
});
check('exam submission accepted', examSub.status === 201 && examSub.body.passed === true);
check('exam submissions award no XP', examSub.body.reward === null);

const foreign = await req('POST', '/submissions', {
  token: student2.token,
  body: { problemId: P['Two Sum'].id, code: solutions['Two Sum'], language: 'PYTHON', examAttemptId: attemptId },
});
check('submitting into another student’s attempt -> 403', foreign.status === 403, `got ${foreign.status}`);

const offExam = await req('POST', '/submissions', {
  token: student.token,
  body: { problemId: P['Number of Islands'].id, code: solutions['Number of Islands'], language: 'PYTHON', examAttemptId: attemptId },
});
check('problem outside the exam -> 400', offExam.status === 400, `got ${offExam.status}`);

const submitted = await req('POST', `/exams/${examId}/submit`, { token: student.token, body: {} });
check('POST /exams/:id/submit freezes the score', submitted.status === 200 && submitted.body.totalScore === 100, JSON.stringify(submitted.body));

const afterSubmit = await req('POST', '/submissions', {
  token: student.token,
  body: { problemId: P['Valid Palindrome'].id, code: solutions['Valid Palindrome'], language: 'PYTHON', examAttemptId: attemptId },
});
check('submitting after the exam closed -> 400', afterSubmit.status === 400, `got ${afterSubmit.status}`);

const results = await req('GET', `/exams/${examId}/results`, { token: teacher.token });
check('GET /exams/:id/results summary', results.status === 200 && results.body.summary.started === 2 && results.body.summary.submitted === 1, JSON.stringify(results.body.summary));
check('not-started students listed', results.body.notStarted.length === 2, `${results.body.notStarted.length}`);
check('maxScore summed from the problem set', results.body.exam.maxScore === 100 + P['Valid Palindrome'].points + P['Valid Parentheses'].points, `${results.body.exam.maxScore}`);

const studentResults = await req('GET', `/exams/${examId}/results`, { token: student.token });
check('students blocked from exam results -> 403', studentResults.status === 403, `got ${studentResults.status}`);

const attemptDetail = await req('GET', `/exams/${examId}/attempts/${attemptId}`, { token: teacher.token });
check('attempt detail has submissions + question order', attemptDetail.status === 200 && attemptDetail.body.submissions.length === 1 && attemptDetail.body.questionOrder.length === 3);

// ── proctoring (REST) ───────────────────────────────────────────────
section('proctoring');
const attempt2 = started2.body.attemptId;

const v1 = await req('POST', '/proctoring/violations', {
  token: student2.token,
  body: { examAttemptId: attempt2, typeKey: 'PASTE', codeSnapshot: 'print(1)', timeRemaining: 3200 },
});
check('violation recorded with catalogue weight', v1.status === 201 && v1.body.weight === 10 && v1.body.integrityScore === 90, JSON.stringify(v1.body).slice(0, 220));
check('teacher alert message rendered', typeof v1.body.message === 'string' && v1.body.message.includes('Vivek'));

const v2 = await req('POST', '/proctoring/violations', {
  token: student2.token,
  body: { examAttemptId: attempt2, typeKey: 'DEVTOOLS' },
});
check('integrity score keeps decreasing', v2.body.integrityScore === 65 && v2.body.critical === true, JSON.stringify(v2.body).slice(0, 200));

const foreignViolation = await req('POST', '/proctoring/violations', {
  token: student.token,
  body: { examAttemptId: attempt2, typeKey: 'COPY' },
});
check('cannot report against another attempt -> 403', foreignViolation.status === 403, `got ${foreignViolation.status}`);

const vList = await req('GET', `/proctoring/violations?examId=${examId}`, { token: teacher.token });
check('teacher lists violations', vList.status === 200 && vList.body.length === 2);
check('code snapshots visible to staff', vList.body.some((v) => v.codeSnapshot === 'print(1)'));

const ownList = await req('GET', '/proctoring/violations', { token: student2.token });
check('student sees only their own, without snapshots', ownList.body.length === 2 && ownList.body.every((v) => v.codeSnapshot === undefined));

const live = await req('GET', `/proctoring/exams/${examId}/live`, { token: teacher.token });
check('live board lists both attempts', live.status === 200 && live.body.length === 2 && live.body.some((r) => r.integrityScore === 65));

// ── proctoring (WebSocket) ──────────────────────────────────────────
section('proctoring gateway');

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

const emit = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

let teacherSocket, studentSocket;
try {
  teacherSocket = await connect(teacher.token);
  check('teacher socket connects with a JWT', teacherSocket.connected);

  const joinTeacher = await emit(teacherSocket, 'join-exam', { examId });
  check('teacher joins the proctor room and gets the board', joinTeacher.ok === true && Array.isArray(joinTeacher.board) && joinTeacher.board.length === 2, JSON.stringify(joinTeacher).slice(0, 160));

  studentSocket = await connect(student2.token);
  const joined = waitFor(teacherSocket, 'student-joined');
  const joinStudent = await emit(studentSocket, 'join-exam', { examId });
  check('student joins the exam room', joinStudent.ok === true && joinStudent.attemptId === attempt2);
  const joinEvent = await joined;
  check('teacher notified of the student joining', joinEvent.username === 'vivek', JSON.stringify(joinEvent).slice(0, 160));

  const violationEvent = waitFor(teacherSocket, 'student-violation');
  const ack = await emit(studentSocket, 'violation', { examAttemptId: attempt2, typeKey: 'TABSWITCH', timeRemaining: 3000 });
  check('violation over the socket is acknowledged', ack.ok === true && ack.integrityScore === 50, JSON.stringify(ack));
  const received = await violationEvent;
  check('teacher receives student-violation in real time', received.typeKey === 'TABSWITCH' && received.username === 'vivek' && received.integrityScore === 50, JSON.stringify(received).slice(0, 200));
  check('violation carries the alert copy + severity', received.critical === true && received.message.includes('switched away'));

  const heartbeatEvent = waitFor(teacherSocket, 'student-heartbeat');
  const hbAck = await emit(studentSocket, 'heartbeat', { examAttemptId: attempt2, currentQuestion: 2, timeRemaining: 2950 });
  check('heartbeat acknowledged with the deadline', hbAck.ok === true && typeof hbAck.endsAt === 'string' && hbAck.expired === false, JSON.stringify(hbAck));
  const hb = await heartbeatEvent;
  check('teacher receives student-heartbeat', hb.currentQuestion === 2 && hb.attemptId === attempt2, JSON.stringify(hb).slice(0, 200));

  const disconnected = waitFor(teacherSocket, 'student-disconnected');
  studentSocket.disconnect();
  const gone = await disconnected;
  check('teacher notified on disconnect', gone.username === 'vivek');

  // unauthenticated connection must be rejected
  await new Promise((resolve) => {
    const bad = io(`${BASE}/proctoring`, { auth: { token: 'not-a-jwt' }, transports: ['websocket'], reconnection: false });
    const timer = setTimeout(() => { check('bad token rejected', false, 'no disconnect within 6s'); bad.close(); resolve(); }, 6000);
    bad.on('disconnect', () => { clearTimeout(timer); check('bad token is disconnected', true); bad.close(); resolve(); });
    bad.on('connect_error', () => { clearTimeout(timer); check('bad token is rejected', true); bad.close(); resolve(); });
  });
} catch (error) {
  check('websocket flow', false, error.message);
} finally {
  teacherSocket?.disconnect();
  studentSocket?.disconnect();
}

// ── mentor ──────────────────────────────────────────────────────────
section('mentor');
const status = await req('GET', '/mentor/status', { token: teacher.token });
check('GET /mentor/status', status.status === 200 && status.body.ollama.model === 'phi3', JSON.stringify(status.body));

const hint = await req('POST', '/mentor/hint', {
  token: student.token,
  body: { problemId: P['Two Sum'].id, language: 'PYTHON', hintLevel: 1, code: 'def twoSum(nums, target):\n    pass' },
});
if (hint.status === 200) {
  check('mentor returned a hint', typeof hint.body.text === 'string' && hint.body.text.length > 0, hint.body.provider);
  const cached = await req('POST', '/mentor/hint', {
    token: student.token,
    body: { problemId: P['Two Sum'].id, language: 'PYTHON', hintLevel: 1, code: 'def twoSum(nums, target):\n    pass' },
  });
  check('identical request is served from cache', cached.body.cached === true);
} else {
  check('no Ollama -> graceful 503, not a crash', hint.status === 503 && typeof hint.body.message === 'string', JSON.stringify(hint.body));
  console.log(`        (Ollama not running: "${hint.body.message}")`);
}

const badLevel = await req('POST', '/mentor/hint', {
  token: student.token,
  body: { problemId: P['Two Sum'].id, language: 'PYTHON', hintLevel: 9, code: 'x' },
});
check('hintLevel is validated', badLevel.status === 400, `got ${badLevel.status}`);

// ── analytics ───────────────────────────────────────────────────────
section('analytics');
const overview = await req('GET', `/analytics/class/${classId}`, { token: teacher.token });
check('class overview', overview.status === 200 && overview.body.students === 4 && overview.body.totalSubmissions > 0, JSON.stringify(overview.body).slice(0, 260));
check('categories computed', Array.isArray(overview.body.categories) && overview.body.categories.length > 0);

const perStudent = await req('GET', `/analytics/class/${classId}/students`, { token: teacher.token });
check('per-student breakdown includes violations', perStudent.status === 200 && perStudent.body.length === 4 && perStudent.body.some((s) => s.violations === 3), JSON.stringify(perStudent.body.find((s) => s.violations > 0)));

const problemStats = await req('GET', `/analytics/problem/${P['Two Sum'].id}`, { token: teacher.token });
check('problem stats: pass rate + attempts', problemStats.status === 200 && problemStats.body.totalSubmissions > 0 && typeof problemStats.body.passRate === 'number', JSON.stringify(problemStats.body).slice(0, 260));

const studentAnalytics = await req('GET', `/analytics/class/${classId}`, { token: student.token });
check('students blocked from analytics -> 403', studentAnalytics.status === 403, `got ${studentAnalytics.status}`);

const insights = await req('POST', '/analytics/classroom-insights', { token: teacher.token, body: { classId } });
check('classroom insights returns stats even without an LLM', insights.status === 200 && insights.body.stats.students === 4, JSON.stringify(insights.body).slice(0, 200));
console.log(`        insights: ${insights.body.insights ? 'generated by ' + insights.body.provider : 'unavailable — ' + insights.body.error}`);

// ── concurrency ─────────────────────────────────────────────────────
section('concurrency (semaphore)');
const startedAt = Date.now();
const burst = await Promise.all(
  Array.from({ length: 24 }, (_, i) =>
    req('POST', '/execute/run', {
      token: admin.token,
      body: { code: `print(${i} * 2)`, lang: 'python' },
    }),
  ),
);
const allOk = burst.every((r, i) => r.body?.ok === true && r.body.stdout.trim() === String(i * 2));
check('24 concurrent runs all return correct output', allOk, burst.filter((r) => !r.body?.ok).length + ' failed');
console.log(`        24 parallel executions in ${Date.now() - startedAt}ms with capacity ${health.body.concurrency.capacity}`);

const healthAfter = await req('GET', '/execute/health', { token: teacher.token });
check('all semaphore slots released afterwards', healthAfter.body.concurrency.free === healthAfter.body.concurrency.capacity, JSON.stringify(healthAfter.body.concurrency));

// ── cleanup ─────────────────────────────────────────────────────────
section('cleanup');
const delExam = await req('DELETE', `/exams/${examId}`, { token: teacher.token });
check('exam with attempts cannot be deleted', delExam.status === 400, `got ${delExam.status}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
