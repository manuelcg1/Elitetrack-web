import test from 'node:test';
import assert from 'node:assert/strict';
import { readView } from '../../web/src/common/util/geofenceReadView.js';

test('uses server-authorized folders and resolved parent instead of raw geometry attributes', () => {
  const result = readView({ folders: [{ id: 1, parentid: 0, contextOnly: true }], geofences: [
    { geofence: { id: 10, attributes: { folderId: 999 } }, folderId: 1, inherited: true, direct: false },
  ] });
  assert.equal(result.geofences[0].attributes.folderId, 1);
  assert.equal(result.geofences[0].readInherited, true);
  assert.equal(result.folders[0].contextOnly, true);
  assert.deepEqual(result.geofences.map((v) => v.id), [10]);
});
test('rejects incomplete payload instead of reusing stale permissions', () => {
  assert.throws(() => readView({ folders: [] }));
});
