import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync('web/vite.config.js', 'utf8');

test('PWA uses automatic updates', () => {
  assert.match(config, /registerType:\s*['"]autoUpdate['"]/);
});

test('new service worker activates immediately and claims clients', () => {
  assert.match(config, /skipWaiting:\s*true/);
  assert.match(config, /clientsClaim:\s*true/);
});
