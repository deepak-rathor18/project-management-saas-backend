import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, requireFields, validateStringFields } from './http.js';

test('requireFields accepts non-empty string values', () => {
  assert.doesNotThrow(() => requireFields({ name: 'Studio North' }, ['name']));
});

test('requireFields rejects absent, non-string, and blank values with a client error', () => {
  for (const body of [{}, { name: 42 }, { name: '  ' }]) {
    assert.throws(
      () => requireFields(body, ['name']),
      (error) => error instanceof HttpError && error.status === 400 && error.message === 'name is required'
    );
  }
});

test('HttpError retains its intended HTTP status and message', () => {
  const error = new HttpError(403, 'Permission denied');
  assert.equal(error.status, 403);
  assert.equal(error.message, 'Permission denied');
});

test('validateStringFields rejects malformed bodies and non-text field values', () => {
  assert.throws(() => validateStringFields(null, ['name']), (error) => error instanceof HttpError && error.status === 400);
  assert.throws(() => validateStringFields({ name: 12 }, ['name']), (error) => error instanceof HttpError && error.status === 400);
  assert.doesNotThrow(() => validateStringFields({ name: 'Taskflow' }, ['name']));
});
