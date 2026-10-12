import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isArtName, parseRole, poseOf, roleBrief, roleOf, slug } from '../src/shared/tycoon.js';
import { artFile, listArt, listRoles } from '../src/server/tycoon.js';

test("a role's id, name and division come from its file name and title", () => {
  assert.deepEqual(parseRole('chief-of-staff.md', '# Role: Chief of Staff (Leadership)\n\nRead `_shared.md` first.'), { id: 'chief-of-staff', name: 'Chief of Staff', division: 'Leadership' });
  assert.deepEqual(parseRole('planner.md', '# Planner\n'), { id: 'planner', name: 'Planner', division: 'Team' });
  assert.equal(parseRole('_shared.md', '# MACATTING office: rules'), undefined, 'the shared rules are not a role');
  assert.equal(parseRole('notes.md', 'no title here'), undefined);
});

test("a worker's role is read back from the brief it was hired with", () => {
  const brief = roleBrief({ id: 'copywriter', name: 'Copywriter', brief: '# Role: Copywriter (Creative)' });
  assert.equal(roleOf(`${brief}\n\nWrite the About page`), 'copywriter');
  assert.equal(roleOf('Fix the login bug'), undefined);
  assert.equal(roleOf(undefined), undefined);
});

test('a status is one of four poses', () => {
  assert.equal(poseOf('working'), 'working');
  assert.equal(poseOf('starting'), 'working');
  assert.equal(poseOf('needs_input'), 'needs-you');
  assert.equal(poseOf('done'), 'done');
  for (const s of ['idle', 'exited', 'offline']) assert.equal(poseOf(s), 'idle');
});

test('art names are safe file names', () => {
  assert.equal(slug('Strategy & Growth'), 'strategy-growth');
  assert.ok(isArtName('minion-chief-of-staff-done'));
  for (const bad of ['../config', 'Floor', 'a/b', '', 'x'.repeat(65)]) assert.ok(!isArtName(bad), bad);
});

test('roles are read from every floor, with its shared rules in front; art from the tycoon-art folder', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'tycoon-'));
  try {
    const hq = path.join(root, 'hq');
    mkdirSync(path.join(hq, 'roles'), { recursive: true });
    writeFileSync(path.join(hq, 'roles', '_shared.md'), '# Rules\n\nNo fabrication.');
    writeFileSync(path.join(hq, 'roles', 'copywriter.md'), '# Role: Copywriter (Creative)\n\nWrite.');
    writeFileSync(path.join(hq, 'roles', 'README.txt'), 'not a role');
    const app = path.join(root, 'app');
    mkdirSync(path.join(app, 'roles'), { recursive: true });
    writeFileSync(path.join(app, 'roles', 'copywriter.md'), '# Role: Other Copywriter (Elsewhere)');
    const roles = listRoles([
      { name: 'hq', dir: hq },
      { name: 'app', dir: app },
      { name: 'empty', dir: path.join(root, 'nowhere') },
    ]);
    assert.equal(roles.length, 1, 'the first floor keeps a shared id');
    assert.equal(roles[0].division, 'Creative');
    assert.equal(roles[0].floor, 'hq');
    assert.match(roles[0].brief, /^# Rules[\s\S]*No fabrication\.[\s\S]*# Role: Copywriter/);

    const data = path.join(root, 'data');
    assert.deepEqual(listArt(data), []);
    mkdirSync(path.join(data, 'tycoon-art'), { recursive: true });
    writeFileSync(path.join(data, 'tycoon-art', 'Desk.png'), 'png');
    writeFileSync(path.join(data, 'tycoon-art', 'notes.txt'), 'x');
    assert.deepEqual(listArt(data), ['desk']);
    assert.ok(artFile(data, 'desk'));
    assert.equal(artFile(data, 'floor'), undefined);
    assert.equal(artFile(data, '../config'), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
