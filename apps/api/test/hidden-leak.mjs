// Hidden test cases must reveal nothing but their verdict.
//
// A submission runs against hidden cases too, so every channel echoed back to
// the student is a way to read them. These are the actual exploits.
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

const student = await login('sunan', 'student1');
const teacher = await login('dr.sunitha', 'teacher1');

const problems = (await req('GET', '/problems?limit=100', { token: teacher.token })).body.data;
const twoSum = problems.find((p) => p.title === 'Two Sum');

// Two Sum's hidden cases use inputs that appear nowhere in the visible ones.
const full = await req('GET', `/problems/${twoSum.id}`, { token: teacher.token });
const hiddenInputs = full.body.testCases.filter((t) => t.isHidden).map((t) => t.input);
console.log(`hidden inputs the student must never see: ${JSON.stringify(hiddenInputs)}`);

/** Any fragment of a hidden input showing up anywhere in the payload is a leak. */
function leaks(payload) {
  const text = JSON.stringify(payload);
  return hiddenInputs.filter((input) =>
    input
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 2)
      .some((line) => text.includes(line)),
  );
}

console.log('\n── exploit 1: print the arguments');
const viaStdout = await req('POST', '/execute/submit', {
  token: student.token,
  body: {
    problemId: twoSum.id,
    lang: 'python',
    code: 'def twoSum(nums, target):\n    print(nums, target)\n    return [0, 1]',
  },
});
check('stdout does not leak hidden inputs', leaks(viaStdout.body).length === 0, JSON.stringify(leaks(viaStdout.body)));
check('hidden stdout is stripped', viaStdout.body.results.filter((r) => r.isHidden).every((r) => r.stdout === null));
check('visible stdout still reaches the student', viaStdout.body.results.some((r) => !r.isHidden && r.stdout));

console.log('\n── exploit 2: raise the arguments as an exception');
const viaStderr = await req('POST', '/execute/submit', {
  token: student.token,
  body: {
    problemId: twoSum.id,
    lang: 'python',
    code: 'def twoSum(nums, target):\n    raise ValueError(str(nums) + " " + str(target))',
  },
});
check('stderr does not leak hidden inputs', leaks(viaStderr.body).length === 0, JSON.stringify(leaks(viaStderr.body)));
check('hidden stderr replaced with a fixed notice',
  viaStderr.body.results.filter((r) => r.isHidden).every((r) => r.stderr === null || !r.stderr.includes('[')));

console.log('\n── exploit 3: a dynamically named exception class');
const viaClassName = await req('POST', '/execute/submit', {
  token: student.token,
  body: {
    problemId: twoSum.id,
    lang: 'python',
    code: 'def twoSum(nums, target):\n    raise type("L" + str(nums), (Exception,), {})()',
  },
});
check('exception type names do not leak', leaks(viaClassName.body).length === 0, JSON.stringify(leaks(viaClassName.body)));

console.log('\n── exploit 4: smuggle a value out through the exit code');
const viaExit = await req('POST', '/execute/submit', {
  token: student.token,
  body: {
    problemId: twoSum.id,
    lang: 'python',
    code: 'import sys\ndef twoSum(nums, target):\n    sys.exit(int(target) % 250)',
  },
});
check('hidden exit codes are stripped', viaExit.body.results.filter((r) => r.isHidden).every((r) => r.exitCode === null));

console.log('\n── the graded path: POST /submissions actually records the run');
const recorded = await req('POST', '/submissions', {
  token: student.token,
  body: {
    problemId: twoSum.id,
    language: 'PYTHON',
    code: 'def twoSum(nums, target):\n    print(nums, target)\n    return [0, 1]',
  },
});
check('submission created', recorded.status === 201 && typeof recorded.body.id === 'string', `status ${recorded.status}`);
check('graded response does not leak', leaks(recorded.body).length === 0, JSON.stringify(leaks(recorded.body)));
check('graded hidden stdout stripped',
  recorded.body.testResults.filter((r) => r.isHidden).every((r) => !r.stdout));

console.log('\n── and re-reading it later must mask too');
const stored = await req('GET', `/submissions/${recorded.body.id}`, { token: student.token });
check('stored submission fetched', stored.status === 200 && Array.isArray(stored.body.testResults), `status ${stored.status}`);
check('re-reading the submission does not leak', leaks(stored.body).length === 0, JSON.stringify(leaks(stored.body)));
check('stored hidden stdout and stderr stripped',
  stored.body.testResults.filter((r) => r.isHidden).every((r) => !r.stdout && !String(r.stderr ?? '').includes('[')));

console.log('\n── the verdict itself is still useful');
check('hidden cases still report passed/failed',
  viaStdout.body.results.filter((r) => r.isHidden).every((r) => typeof r.passed === 'boolean'));
check('hidden timing still reported', viaStdout.body.results.filter((r) => r.isHidden).every((r) => typeof r.executionMs === 'number'));

console.log('\n── staff still see everything');
const staffView = await req('POST', '/execute/submit', {
  token: teacher.token,
  body: {
    problemId: twoSum.id,
    lang: 'python',
    code: 'def twoSum(nums, target):\n    print(nums)\n    return [0, 1]',
  },
});
check('a teacher still sees hidden inputs and output', leaks(staffView.body).length > 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
