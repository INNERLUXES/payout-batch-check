import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES, ibanRemainder } from '../src/index.js';
import { BAD, EXPECTED, GOOD, GOOD_EXPECTED, UNWANTED, run } from '../tools/example.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');
const BAD_FILE = 'examples/bad/batch.json';
const GOOD_FILE = 'examples/good/batch.csv';

test('examples: the bad batch fails with the report that is saved in examples/output', async () => {
  const r = await run(BAD);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('bad.txt'));
  for (const e of EXPECTED) assert.ok(r.out.includes(e), e);
  for (const u of UNWANTED) assert.ok(!r.out.includes(u), u);
});

test('examples: the good batch passes at error, warning and info level with the report that is saved', async () => {
  const r = await run(GOOD);
  assert.equal(r.code, 0);
  assert.equal(r.out, await saved('good.txt'));
  for (const e of GOOD_EXPECTED) assert.ok(r.out.includes(e), e);
  assert.equal((await run([...GOOD, '--fail-on', 'warning'])).code, 0);
  assert.equal((await run([...GOOD, '--fail-on', 'info'])).code, 0);
  assert.doesNotMatch(r.out, /ERROR {4}|WARNING {2}/);
});

test('examples: every output saved in examples/output is the real output, in all four formats for both batches', async () => {
  const outputs = {
    'bad-explain.txt': [...BAD, '--explain'],
    'bad.md': [...BAD, '--format', 'markdown'],
    'bad-explain.md': [...BAD, '--format', 'markdown', '--explain'],
    'bad.json': [...BAD, '--json', '--explain'],
    'bad.sarif': [...BAD, '--format', 'sarif'],
    'good.md': [...GOOD, '--format', 'markdown'],
    'good.json': [...GOOD, '--json'],
    'good.sarif': [...GOOD, '--format', 'sarif'],
    'checks.txt': ['--list-checks'],
    'checks.json': ['--list-checks', '--format', 'json']
  };
  for (const [name, args] of Object.entries(outputs)) assert.equal((await run(args)).out, await saved(name), name);
});

test('examples: every check but three fires on the bad batch, each on the line built for it', async () => {
  const report = JSON.parse((await run([...BAD, '--json'])).out);
  const lines = (await readFile(resolve(root, BAD_FILE), 'utf8')).split('\n');
  const at = (needle, n = 1) => {
    let seen = 0;
    for (let i = 0; i < lines.length; i += 1) if (lines[i].includes(needle) && (seen += 1) === n) return i + 1;
    throw new Error(`${needle} x${n}`);
  };
  const of = (id) => report.findings.filter((f) => f.id === id).map((f) => f.line).sort((x, y) => x - y);
  const start = (id) => at(`"paymentId": "${id}"`) - 1;
  assert.deepEqual(of('iban-checksum'), [at('"GR16 0110')]);
  assert.deepEqual(of('iban-length'), [at('"NL58ABNA041716430"')]);
  assert.deepEqual(of('iban-country-mismatch'), [at('"BE68539007547034"')]);
  assert.deepEqual(of('bic-format'), [at('"EXMP GB2L"')]);
  assert.deepEqual(of('bic-country-mismatch'), [at('"EXMPDEFF"')]);
  assert.deepEqual(of('currency-unknown'), [at('"currency": "EUX"')]);
  assert.deepEqual(of('amount-decimals'), [at('"150000.50"', 2)]);
  assert.deepEqual(of('amount-invalid'), [at('"-200.00"')]);
  assert.deepEqual(of('country-invalid'), [at('"UK"')]);
  assert.deepEqual(of('payment-id-duplicate'), [at('"paymentId": "P-001"', 2)]);
  assert.deepEqual(of('payment-possible-duplicate'), [at('"amount": "1500.00"', 2)]);
  assert.deepEqual(of('beneficiary-name-missing'), [start('P-013')]);
  assert.deepEqual(of('beneficiary-name-short'), [at('"beneficiaryName": "Q"')]);
  assert.deepEqual(of('fx-rate-missing'), [at('"currency": "USD"')]);
  assert.deepEqual(of('wallet-address-malformed'), [at('"0x1234"')]);
  assert.deepEqual(of('token-not-allowed'), [at('"token": "DAI"')]);
  assert.deepEqual(of('network-token-unknown'), [at('"token": "USDT"')]);
  assert.deepEqual(of('secret-in-batch'), [at('"seedPhrase"')]);
  assert.deepEqual(of('field-unknown'), [at('"purposeCod"')]);
  assert.deepEqual(of('field-invalid'), [at('"rail": "wire"')]);
  assert.deepEqual(of('field-missing'), [start('P-022')]);
  assert.deepEqual(of('batch-total-mismatch'), [at('"totals"'), at('"EUR": "6082.00"')]);
  // A JSON batch cannot be unreadable and read, or name a column twice, and --max-amount is not given; the tests of
  // test/batch.test.js, test/csv.test.js and test/rules.test.js cover those.
  assert.deepEqual(report.rules.filter((r) => r.findings === 0).map((r) => r.id), ['batch-unreadable', 'field-duplicate', 'amount-above-max']);
  assert.equal(report.rules.length, RULES.length);
});

test('examples: the good batch holds no finding, and every currency and token of it is in the table', async () => {
  const report = JSON.parse((await run([...GOOD, '--json'])).out);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.table.map((r) => r.unit), ['EUR', 'GBP', 'CHF', 'JPY', 'KWD', 'USD', 'USDC', 'USDT']);
  assert.equal(report.batch.id, 'PAYOUT-EXAMPLE-GOOD');
  assert.equal(report.input.format, 'csv');
});

test('examples: the same files written with CRLF line ends and as UTF-16 give the same findings', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'payout-batch-check-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    for (const [file, args] of [[BAD_FILE, BAD], [GOOD_FILE, [...GOOD, '--max-amount', '1000']]]) {
      const ids = async () => JSON.parse((await run([...args, '--json'], dir)).out).findings.map((f) => `${f.id}:${f.line}:${f.column}`);
      const base = await ids();
      const text = await readFile(resolve(root, file), 'utf8');
      await writeFile(resolve(dir, file), text.split('\n').join('\r\n'));
      assert.deepEqual(await ids(), base, `${file} with CRLF`);
      await writeFile(resolve(dir, file), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]));
      assert.deepEqual(await ids(), base, `${file} as UTF-16`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('examples: the files are plain ASCII with LF line ends, made up, hold no real key, and every IBAN comes from the registry', async () => {
  const registry = await readFile(resolve(root, 'research/sources/swift-iban-registry.txt'), 'utf8');
  for (const f of [BAD_FILE, GOOD_FILE]) {
    const text = await readFile(resolve(root, f), 'utf8');
    assert.ok([...text].every((c) => c.charCodeAt(0) < 128), f);
    assert.ok(!text.includes('\r'), f);
    assert.doesNotMatch(text, /\b(?:19|20)\d{2}\b/, f);
    assert.match(text, /A made-up batch for the examples of payout-batch-check/, f);
    // Every BIC has the made-up party prefix EXMP, and every wallet address is one character written many times.
    for (const m of text.matchAll(/\bEXMP[A-Z0-9 ]*/g)) assert.ok(m[0].startsWith('EXMP'), m[0]);
    for (const m of text.matchAll(/\b(?:0x[0-9a-fA-F]{4,}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/g)) assert.match(m[0], /^(?:0x|T)?(.)\1*$|^0x1234$/, m[0]);
  }
  // Every IBAN of the good batch is an example of the registry; the bad batch changes three of them on purpose.
  const good = await readFile(resolve(root, GOOD_FILE), 'utf8');
  for (const m of good.matchAll(/\b[A-Z]{2}\d{2}[A-Z0-9 ]{10,40}/g)) {
    const iban = m[0].replace(/ /g, '');
    if (ibanRemainder(iban) === 1) assert.ok(registry.includes(`| ${iban} |`), iban);
  }
  const outputs = ['bad.txt', 'bad.json', 'bad.md', 'bad.sarif', 'bad-explain.txt', 'bad-explain.md'];
  for (const o of outputs) assert.ok(!(await saved(o)).includes('lantern'), `${o} does not show the seed`);
});

test('examples: the sample output of the bad batch is the one the README shows', async () => {
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const bad = (await saved('bad.txt')).split('\n');
  assert.ok(readme.includes(bad.slice(0, bad.findIndex((l) => l.startsWith('Findings ('))).join('\n')));
  assert.ok(readme.includes(bad.slice(-6).join('\n')));
});
