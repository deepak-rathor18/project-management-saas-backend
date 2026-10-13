import test from 'node:test';
import assert from 'node:assert/strict';
import { isOriginAllowed } from './cors.js';

test('allows explicitly configured origins in every environment', () => {
  assert.equal(isOriginAllowed('https://app.example.com', ['https://app.example.com'], true), true);
});

test('allows localhost development origins on Vite alternate ports', () => {
  for (const origin of ['http://localhost:5174', 'http://127.0.0.1:5174', 'http://[::1]:5174']) {
    assert.equal(isOriginAllowed(origin, ['http://localhost:5173'], false), true);
  }
});

test('rejects non-local unconfigured origins and all unconfigured production origins', () => {
  assert.equal(isOriginAllowed('https://untrusted.example', [], false), false);
  assert.equal(isOriginAllowed('http://localhost:5174', ['http://localhost:5173'], true), false);
});

test('rejects malformed, credentialed, and non-HTTP development origins', () => {
  for (const origin of ['not an origin', 'http://user:pass@localhost:5174', 'https://localhost:5174']) {
    assert.equal(isOriginAllowed(origin, [], false), false);
  }
});
