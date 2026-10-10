// Verifies notifications, announcements, progress reports and hackathon invites/scoreboard.
// Mutates data — re-seed afterwards.
const BASE = 'http://localhost:3001';
let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); } else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
};
async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}
const login = async (u, p) => { const r = await req('POST', '/auth/login', { body: { username: u, password: p } }); return { token: r.body.accessToken, user: r.body.user }; };
const section = (t) => console.log(`\n── ${t}`);

const teacher = await login('dr.sunitha', 'teacher1');
const sunan = await login('sunan', 'student1');
const vivek = await login('vivek', 'student2');
const classes = (await req('GET', '/classes', { token: teacher.token })).body;
const classId = classes[0].id;

section('announcements + notifications');
const before = (await req('GET', '/notifications/unread-count', { token: sunan.token })).body.count;
const ann = await req('POST', `/classes/${classId}/announcements`, { token: teacher.token, body: { title: 'Test', body: 'Hello class' } });
check('teacher can post', ann.status === 201, JSON.stringify(ann.body));
const denied = await req('POST', `/classes/${classId}/announcements`, { token: sunan.token, body: { title: 'x', body: 'y' } });
check('student cannot post', denied.status === 403);
const after = (await req('GET', '/notifications/unread-count', { token: sunan.token })).body.count;
check('enrolled student notified', after === before + 1, `${before} -> ${after}`);
await req('POST', '/notifications/read-all', { token: sunan.token });
check('read-all clears unread', (await req('GET', '/notifications/unread-count', { token: sunan.token })).body.count === 0);

section('progress report');
const rep = await req('GET', `/analytics/class/${classId}/report`, { token: teacher.token });
check('class report', rep.status === 200 && Array.isArray(rep.body.students));
check('student cannot read report', (await req('GET', `/analytics/class/${classId}/report`, { token: sunan.token })).status === 403);

section('hackathon: problem mode, invites, scoreboard');
const probs = (await req('GET', '/problems?limit=2', { token: teacher.token })).body.data;
const now = Date.now();
const h = await req('POST', '/hackathons', { token: teacher.token, body: {
  title: 'Engagement test', description: 'd', startsAt: new Date(now - 60_000).toISOString(),
  endsAt: new Date(now + 3_600_000).toISOString(), mode: 'PROBLEMS', problemIds: probs.map((p) => p.id),
} });
check('create problem-mode hackathon', h.status === 201, JSON.stringify(h.body));
const bad = await req('POST', '/hackathons', { token: teacher.token, body: {
  title: 'Bad', description: 'd', startsAt: new Date(now).toISOString(), endsAt: new Date(now + 1000).toISOString(),
  mode: 'PROBLEMS', problemIds: ['nope'] } });
check('unknown problem id rejected', bad.status === 400);
const id = h.body.id;
await req('PATCH', `/hackathons/${id}`, { token: teacher.token, body: { isPublished: true } });
const team = await req('POST', `/hackathons/${id}/teams`, { token: sunan.token, body: { name: 'Alpha' } });
check('team created', team.status === 201, JSON.stringify(team.body));
const inv = await req('POST', `/hackathons/${id}/invites`, { token: sunan.token, body: { username: 'vivek' } });
check('leader invites by username', inv.status === 201, JSON.stringify(inv.body));
check('non-leader cannot invite', (await req('POST', `/hackathons/${id}/invites`, { token: vivek.token, body: { username: 'sunan' } })).status === 403);
const mine = await req('GET', '/hackathons/invites/mine', { token: vivek.token });
check('invitee sees invite', mine.body.some((i) => i.id === inv.body.id));
const acc = await req('POST', `/hackathons/invites/${inv.body.id}/accept`, { token: vivek.token });
check('invite accepted', acc.status === 200, JSON.stringify(acc.body));
const sb = await req('GET', `/hackathons/${id}/scoreboard`, { token: vivek.token });
check('scoreboard lists team', sb.status === 200 && sb.body.rows.some((r) => r.team === 'Alpha'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
