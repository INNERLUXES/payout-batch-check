import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { BATCH_LIMITS, JSON_LIMITS, checkText } from '../src/index.js';
import { PAYMENTS, allowed, bank, batch, batchText, cli, coin, csvText, evm, run, withFiles, withPayment } from './helpers.js';

// Each test builds input meant to make the tool slow or to exhaust the stack or the memory, and checks that it ends with
// an answer in good time. The time allowed is four times as long under coverage (NODE_V8_COVERAGE is set only when
// coverage is on).

function timed(fn) {
  const start = process.hrtime.bigint();
  const value = fn();
  return { value, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}

test('the most payments a batch may hold, as CSV, each compared with the others for ids and accounts, are checked in good time', () => {
  const rows = Array.from({ length: BATCH_LIMITS.maxPayments }, (_, i) => ({ ...PAYMENTS[0], paymentId: `P${i}`, amount: `${(i % 997) + 1}.00` }));
  const text = csvText(rows);
  const { value, ms } = timed(() => checkText(text, {}, 'csv'));
  assert.equal(value.batch.payments.length, BATCH_LIMITS.maxPayments);
  assert.equal(value.findings.filter((f) => f.id === 'payment-possible-duplicate').length, BATCH_LIMITS.maxPayments - 997);
  assert.ok(ms < allowed(20000), `took ${ms} ms`);
  const same = timed(() => checkText(csvText(Array.from({ length: 20000 }, () => PAYMENTS[0])), {}, 'csv'));
  assert.equal(same.value.findings.filter((f) => f.id === 'payment-id-duplicate').length, 19999);
  assert.ok(same.ms < allowed(10000), `took ${same.ms} ms`);
});

test('deep nesting ends with a batch-unreadable finding at the limit, never a stack overflow, and the secret scan does not recurse', () => {
  const deep = `${'['.repeat(100000)}${']'.repeat(100000)}`;
  const { value } = timed(() => checkText(deep));
  assert.equal(value.findings[0].id, 'batch-unreadable');
  assert.match(value.findings[0].message, new RegExp(`nested more than ${JSON_LIMITS.maxDepth} deep`));
  const nested = `{"notes": ${'['.repeat(JSON_LIMITS.maxDepth - 1)}"x"${']'.repeat(JSON_LIMITS.maxDepth - 1)}, "payments": []}`;
  assert.ok(checkText(nested).findings.some((f) => f.id === 'field-missing'));
  const keyed = `{"privateKey": ${'{"a": '.repeat(JSON_LIMITS.maxDepth - 1)}1${'}'.repeat(JSON_LIMITS.maxDepth - 1)}}`;
  assert.equal(checkText(keyed).findings.filter((f) => f.id === 'secret-in-batch').length, 1);
});

test('amounts and rates with thousands of digits, and numbers with a huge exponent, are refused, not worked out', () => {
  const huge = `1${'0'.repeat(5000)}`;
  const { value, ms } = timed(() => checkText(batchText(withPayment(bank({ paymentId: 'X', amount: huge, fxRate: huge, currency: 'USD' })))));
  assert.ok(value.findings.some((f) => f.id === 'amount-invalid'));
  assert.ok(value.findings.some((f) => f.id === 'field-invalid' && /fxRate/.test(f.message)));
  assert.ok(value.findings.every((f) => f.message.length < 600));
  assert.ok(ms < allowed(3000), `took ${ms} ms`);
  const exp = checkText(batchText(withPayment(bank({ paymentId: 'X', amount: 1 }))).replace('"amount": 1', '"amount": 1e999999'));
  assert.ok(exp.findings.some((f) => f.id === 'amount-invalid'));
  const total = checkText(batchText(batch({ totals: { EUR: `0.${'1'.repeat(5000)}` } })));
  assert.ok(total.findings.some((f) => f.id === 'field-invalid' && /The total for EUR/.test(f.message)));
});

test('long strings, long names and long fields are read in good time, and the messages stay short', () => {
  const long = batchText(batch({ id: 'b'.repeat(200000), totals: undefined }, [...PAYMENTS, bank({ paymentId: 'n'.repeat(200000), beneficiaryName: 'm '.repeat(200000), amount: '2.00' })]));
  const { value, ms } = timed(() => checkText(long));
  assert.deepEqual(value.findings, []);
  assert.ok(ms < allowed(5000), `took ${ms} ms`);
  const wallet = checkText(batchText(withPayment(coin({ paymentId: 'X', walletAddress: `0x${'1'.repeat(200000)}` }))));
  const f = wallet.findings.find((x) => x.id === 'wallet-address-malformed');
  assert.ok(f.message.length < 600);
  const csv = timed(() => checkText(`paymentId,notes\nP,"${'q'.repeat(90000)}"\n`, {}, 'csv'));
  assert.ok(csv.ms < allowed(3000), `took ${csv.ms} ms`);
  assert.equal(checkText(`paymentId\n"${'q'.repeat(200000)}"\n`, {}, 'csv').findings[0].id, 'batch-unreadable');
});

test('names such as __proto__, constructor and toString are only names', () => {
  const text = batchText(batch()).replace('"batch": {', '"__proto__": {"polluted": 1}, "hasOwnProperty": 2, "batch": {').replace('"EUR": "2320.00",', '"EUR": "2320.00", "__proto__": "1", "constructor": "2",');
  const { value } = timed(() => checkText(text));
  assert.ok(value.findings.some((f) => f.id === 'field-unknown' && /"__proto__"/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'field-unknown' && /"hasOwnProperty"/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'batch-total-mismatch' && /total of 1 __proto__/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'batch-total-mismatch' && /total of 2 constructor/.test(f.message)));
  assert.equal({}.polluted, undefined);
  const csv = checkText(csvText(PAYMENTS.map((p) => ({ ...p, __proto__x: 1 }))).replace('__proto__x', '__proto__'), {}, 'csv');
  assert.ok(csv.findings.some((f) => f.id === 'field-unknown' && /"__proto__"/.test(f.message)));
  assert.deepEqual(checkText(batchText(withPayment(coin({ paymentId: 'X', network: 'toString', walletAddress: evm() })))).findings.map((f) => f.id), ['network-token-unknown']);
});

test('a run leaves the folder as it was: the tool writes nothing', async () => {
  const files = { 'batch.json': batchText(batch()), 'batch.csv': csvText(PAYMENTS) };
  await withFiles(files, async (dir) => {
    const before = (await readdir(dir, { recursive: true })).sort();
    await cli(['batch.json', '--format', 'sarif'], dir);
    await cli(['batch.csv', '--json', '--explain'], dir);
    assert.deepEqual((await readdir(dir, { recursive: true })).sort(), before);
  });
  assert.equal((await run(files, ['batch.json'])).code, 0);
});
