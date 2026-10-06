import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const config = "const DEFAULT_CONFIG={cognito:{region:'ap-southeast-2',userPoolId:'test-pool',clientId:'test-client'}};";
const source = (await readFile(new URL('../src/services/cognito.js', import.meta.url), 'utf8'))
  .replace("import { DEFAULT_CONFIG } from '../config';", config);
const loadService = async (suffix) => (await import('data:text/javascript;base64,' + Buffer.from(source + `\n// ${suffix}`).toString('base64'))).cognitoService;
const service = await loadService('initial-page');
const storage = new Map();
globalThis.sessionStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
globalThis.localStorage = { getItem: () => null };
globalThis.fetch = () => { throw Error('Session restoration must not contact AWS'); };
const claims = overrides => ({
  sub: 'account-id', email: 'person@example.com', name: 'Person',
  exp: Math.floor(Date.now() / 1000) + 3600, aud: 'test-client',
  iss: 'https://cognito-idp.ap-southeast-2.amazonaws.com/test-pool', token_use: 'id',
  ...overrides,
});
const token = overrides => 'header.' + Buffer.from(JSON.stringify(claims(overrides))).toString('base64url') + '.signature';

test('Refresh restores visitor, student and admin identity without network calls', async () => {
  const refreshed = await loadService('refreshed-page');
  for (const [groups, role, isStudent] of [[['visitors'], 'visitor', false], [['students'], 'student', true], [['admins'], 'admin', false]]) {
    storage.clear();
    const idToken = token({ 'cognito:groups': groups });
    service.saveSession({ token: idToken, accessToken: 'access', password: 'must-not-save', session: 'challenge', role: 'wrong' });
    const restored = refreshed.restoreSession();
    assert.equal(restored.id, 'account-id');
    assert.equal(restored.role, role);
    assert.equal(restored.isStudent, isStudent);
    assert.equal(restored.token, idToken);
    assert.equal(restored.accessToken, 'access');
    assert.ok(restored.expiresAt > Date.now());
    assert.deepEqual(JSON.parse(storage.get('nexus_auth_session')), { token: idToken, accessToken: 'access' });
  }
});

test('Sign-out clears saved login and refresh remains signed out', () => {
  service.saveSession({ token: token() });
  service.clearSession();
  assert.equal(service.restoreSession(), null);
  assert.equal(storage.size, 0);
});

test('Expired, malformed, incomplete and wrong-account tokens are discarded', () => {
  for (const invalid of [
    'bad-token', token({ exp: 0 }), token({ exp: undefined }),
    token({ exp: String(Math.floor(Date.now() / 1000) + 3600) }),
    token({ aud: 'other-client' }), token({ iss: 'other-pool' }),
    token({ token_use: 'access' }), token({ sub: '' }), token({ email: '' }),
  ]) {
    service.saveSession({ token: invalid });
    assert.equal(service.restoreSession(), null);
    assert.equal(storage.size, 0);
  }
  storage.set('nexus_auth_session', '{invalid json');
  assert.equal(service.restoreSession(), null);
  assert.equal(storage.size, 0);
});

test('Changing configured Cognito client or pool invalidates saved login', () => {
  for (const key of ['nexus_client_id', 'nexus_pool_id']) {
    service.saveSession({ token: token() });
    globalThis.localStorage = { getItem: name => name === key ? 'different' : null };
    assert.equal(service.restoreSession(), null);
  }
  globalThis.localStorage = { getItem: () => null };
});

test('Blocked browser storage does not crash login or startup', () => {
  const original = globalThis.sessionStorage;
  try {
    globalThis.sessionStorage = {
      getItem: () => { throw Error('blocked'); },
      setItem: () => { throw Error('blocked'); },
      removeItem: () => { throw Error('blocked'); },
    };
    assert.doesNotThrow(() => service.saveSession({ token: token() }));
    assert.doesNotThrow(() => service.clearSession());
    assert.equal(service.restoreSession(), null);
  } finally { globalThis.sessionStorage = original; }
});
