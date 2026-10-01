const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const winston = require('winston');
const { fileTransportSizeOptions } = require('../src/logging');

// winston's File transport only honours `maxsize` (bytes) and a numeric
// `maxFiles`: the old `maxSize: '10m'` / `maxFiles: '14d'` were ignored and
// application.log grew without bound (B-2026-09-26-1).

test('defaults cap the file at 10 MB x 14 files', () => {
  assert.deepEqual(fileTransportSizeOptions({}), { maxsize: 10 * 1024 * 1024, maxFiles: 14, tailable: true });
});

test('maxFileBytes accepts bytes or k/m/g strings, maxNbFiles a count', () => {
  assert.equal(fileTransportSizeOptions({ maxFileBytes: 2048 }).maxsize, 2048);
  assert.equal(fileTransportSizeOptions({ maxFileBytes: '512k' }).maxsize, 512 * 1024);
  assert.equal(fileTransportSizeOptions({ maxFileBytes: '5m' }).maxsize, 5 * 1024 * 1024);
  assert.equal(fileTransportSizeOptions({ maxFileBytes: '1G' }).maxsize, 1024 * 1024 * 1024);
  assert.equal(fileTransportSizeOptions({ maxFileBytes: 'nonsense' }).maxsize, 10 * 1024 * 1024);
  assert.equal(fileTransportSizeOptions({ maxNbFiles: '3' }).maxFiles, 3);
});

test('a real winston File transport stays within maxsize x maxFiles', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boiler-log-'));
  const filename = path.join(dir, 'application.log');
  const transport = new winston.transports.File({
    ...fileTransportSizeOptions({ maxFileBytes: '1k', maxNbFiles: 3 }),
    filename,
    format: winston.format.json()
  });
  const logger = winston.createLogger({ transports: [transport] });
  // A pre-open burst larger than maxsize stalls winston's rotation; real
  // startup output is far below the 10 MB default, so pace like a live process.
  await new Promise((resolve) => transport.once('open', resolve));
  for (let i = 0; i < 400; i++) {
    logger.info('x'.repeat(100), { i });
    await new Promise((resolve) => setImmediate(resolve));
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  logger.close();

  const files = fs.readdirSync(dir);
  const total = files.reduce((sum, f) => sum + fs.statSync(path.join(dir, f)).size, 0);
  assert.ok(files.includes('application.log'), 'current file keeps its name (tailable)');
  assert.ok(files.length <= 3, `expected at most 3 files, got ${files.join(', ')}`);
  assert.ok(total < 400 * 100, `expected the cap to drop old lines, total ${total} bytes`);
  fs.rmSync(dir, { recursive: true, force: true });
});
