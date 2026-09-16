import test from 'node:test';
import assert from 'node:assert/strict';

import { getVisibleDeviceIds } from '../../web/src/map/utils/markerVisibility.js';

test('every checked vehicle with a visible position is eligible for a marker', () => {
  const markerData = new Map([
    [7, { position: { deviceId: 7, latitude: -8.85, longitude: -78.60 } }],
    [8, { position: { deviceId: 8, latitude: -8.86, longitude: -78.61 } }],
  ]);

  const result = getVisibleDeviceIds({
    markerData,
    isVisible: () => true,
  });

  assert.deepEqual([...result], [7, 8]);
});

test('vehicle outside viewport is not included', () => {
  const markerData = new Map([
    [7, { position: { deviceId: 7, latitude: -8.85, longitude: -78.60 } }],
  ]);

  const result = getVisibleDeviceIds({
    markerData,
    isVisible: () => false,
  });

  assert.deepEqual([...result], []);
});
