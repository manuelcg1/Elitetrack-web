import test from 'node:test';
import assert from 'node:assert/strict';
import savePermissionChanges from '../../web/src/common/util/savePermissionChanges.js';

const selection = { previous: [10, 20], next: [20, 30], baseId: 1, keyBase: 'userId', keyLink: 'geofenceId' };

test('one request contains additions and removals together', async () => {
  const calls = [];
  await savePermissionChanges({
    ...selection,
    request: async (url, options) => {
      calls.push({ url, ...options });
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/permissions/batch');
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].body), {
    additions: [{ userId: 1, geofenceId: 30 }],
    removals: [{ userId: 1, geofenceId: 10 }],
  });
});

test('unchanged selection does not write', async () => {
  const result = await savePermissionChanges({
    ...selection,
    next: [20, 10],
    request: () => assert.fail('Unexpected request'),
  });
  assert.equal(result, null);
});

test('failure never falls back to separate partial writes', async () => {
  let calls = 0;
  await assert.rejects(savePermissionChanges({
    ...selection,
    request: async () => {
      calls++;
      throw new Error('Transaction rejected');
    },
  }), /Transaction rejected/);
  assert.equal(calls, 1);
});
