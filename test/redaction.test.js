const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const logging = require('../src/logging');

// Minimal fake config: silence console + file, route everything to the capture
// custom logger so we can inspect what Logger.log emits after redaction.
const fakeConfig = {
  _v: {
    'logs:console': { active: false, level: 'info', format: {} },
    'logs:console:active': false,
    'logs:file': { active: false },
    'logs:file:active': false,
    'logs:custom:active': true,
    'logs:custom:path': path.join(__dirname, 'captureLogger.js'),
    'logs:custom:settings': {},
    'logs:skipUncaughtException': true
  },
  get (k) { return this._v[k]; }
};

test('dev-newrelic-scrub redaction is wired into the boiler logger', async () => {
  logging.setGlobalName('test-app');
  await logging.initLoggerWithConfig(fakeConfig);

  const logger = logging.getLogger('auth');
  logger.info('login https://ctok123@jdoe.demo.datasafe.dev/', { accessToken: 'abc', op: 'signin', err: new Error('boom https://csecret@a.datasafe.dev/') });

  const entry = global.__captured.find((e) => e.key === 'test-app:auth');
  assert.ok(entry, 'expected a captured entry for the auth logger');

  // message: apiEndpoint token masked
  assert.ok(!entry.message.includes('ctok123@'), 'token must be removed from message');
  assert.ok(entry.message.includes('***@'), 'message must show masked userinfo');

  // context: single context object is wrapped as { context: <redacted> }
  const ctx = entry.context.context;
  assert.equal(ctx.accessToken, '***', 'accessToken value masked by field name');
  assert.equal(ctx.op, 'signin', 'non-sensitive field preserved');
  assert.ok(!ctx.err.message.includes('csecret@'), 'Error message inside context is scrubbed');
});
