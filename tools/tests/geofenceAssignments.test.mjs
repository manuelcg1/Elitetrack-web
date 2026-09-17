import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentRows, assignmentBatch, visibleAssignmentRows } from '../../web/src/common/util/geofenceAssignments.js';

const folders = [{ id: 1, parentid: 0, name: 'Parent' }, { id: 2, parentid: 1, name: 'Child' }];
const geofences = [{ id: 10, name: 'Zone', attributes: { folderId: 2 } }];

test('folders start collapsed and each level requires explicit expansion', () => {
  const rows = assignmentRows(folders, geofences, [1], []);
  assert.deepEqual(visibleAssignmentRows(rows, new Set()).map((r) => r.key), ['folder:1']);
  assert.deepEqual(visibleAssignmentRows(rows, new Set([1])).map((r) => r.key), ['folder:1', 'folder:2']);
  assert.deepEqual(visibleAssignmentRows(rows, new Set([1, 2])).map((r) => r.key), ['folder:1', 'folder:2', 'geofence:10']);
  assert.deepEqual(visibleAssignmentRows(rows, new Set([2])).map((r) => r.key), ['folder:1']);
});

test('collapsing one branch leaves other branches and assignments unchanged', () => {
  const rows = assignmentRows([...folders, { id: 3, parentid: 0, name: 'Other' }],
    [...geofences, { id: 20, attributes: { folderId: 3 } }], [1], [10]);
  assert.deepEqual(visibleAssignmentRows(rows, new Set([3])).map((r) => r.key), ['folder:1', 'folder:3', 'geofence:20']);
  assert.equal(rows.find((r) => r.id === 10).direct, true);
});

test('search preserves ancestor context without opening collapsed folders', () => {
  const rows = assignmentRows(folders, geofences, [], []);
  assert.deepEqual(visibleAssignmentRows(rows, new Set(), 'zone').map((r) => r.key), ['folder:1']);
  assert.deepEqual(visibleAssignmentRows(rows, new Set([1, 2]), 'zone').map((r) => r.key), ['folder:1', 'folder:2', 'geofence:10']);
  assert.deepEqual(visibleAssignmentRows(rows, new Set([1, 2]), 'absent'), []);
});
test('parent grant previews inherited descendants without creating direct grants', () => {
  const rows = assignmentRows(folders, geofences, [1], []);
  assert.deepEqual(rows.map((r) => [r.key, r.direct, r.inherited]), [
    ['folder:1', true, false], ['folder:2', false, true], ['geofence:10', false, true],
  ]);
});
test('removing a parent preserves explicit child grants', () => {
  const rows = assignmentRows(folders, geofences, [], [10]);
  assert.equal(rows.at(-1).direct, true);
  assert.equal(rows.at(-1).inherited, false);
});
test('cycles, missing parents and fractional folder IDs never imply inheritance', () => {
  const rows = assignmentRows([{ id: 2, parentid: 2 }], geofences, [2], []);
  assert.equal(rows.find((r) => r.key === 'geofence:10').inherited, false);
  assert.equal(rows.find((r) => r.key === 'folder:2').invalid, true);
  assert.equal(assignmentRows(folders, [{ id: 10, attributes: { folderId: 1.5 } }], [1], []).at(-1).inherited, false);
});
test('mixed folder and geofence edits form one numeric batch preserving unrelated grants', () => {
  assert.deepEqual(assignmentBatch(7, { folders: [1, 99], geofences: [10] }, { folders: [2, 99], geofences: [] }), {
    additions: [{ userId: 7, geofenceFolderId: 2 }],
    removals: [{ userId: 7, geofenceFolderId: 1 }, { userId: 7, geofenceId: 10 }],
  });
});
