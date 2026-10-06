import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BATCH_KEYS, BATCH_LIMITS, CSV_BATCH_COLUMNS, PAYMENT_KEYS, RAILS, TOP_KEYS, checkText, cut, describe, readAmount, readBatch, readJson, suggestKey } from '../src/index.js';
import { PAYMENTS, bank, batch, batchText, coin, csvFindings, csvText, findingsOf, idsOf, lineOf, ofCheck, withPayment } from './helpers.js';

test('readBatch: a clean batch is read whole, with the fields of each payment and the totals of the batch', () => {
  const r = checkText(batchText(batch()));
  assert.deepEqual(r.findings, []);
  assert.equal(r.batch.batch.id, 'TEST-BATCH');
  assert.equal(r.batch.batch.debitCurrency, 'EUR');
  assert.deepEqual(r.batch.batch.totals.map((t) => t.unit), ['EUR', 'GBP', 'USDC']);
  assert.deepEqual(r.batch.payments.map((p) => [p.id, p.rail]), [['B-1', 'bank'], ['B-2', 'bank'], ['B-3', 'bank'], ['C-1', 'stablecoin']]);
  assert.equal(r.batch.payments[3].network.known.id, 'solana');
  assert.deepEqual(TOP_KEYS, ['batch', 'payments', 'notes']);
  assert.deepEqual(BATCH_KEYS, ['id', 'debitCurrency', 'totals', 'notes']);
  assert.deepEqual(RAILS, ['bank', 'stablecoin']);
  assert.equal(PAYMENT_KEYS.length, 16);
});

test('readAmount: a plain decimal, 0, a negative amount and what is not a number, never through a floating point number', () => {
  assert.equal(readAmount('1500.00').state, 'ok');
  assert.equal(readAmount('0.00').state, 'zero');
  assert.equal(readAmount('-200').state, 'negative');
  for (const t of ['1,500.00', '1e3', 'EUR 10', '', '-', '--1', '+5', '10.']) assert.equal(readAmount(t).state, 'nan', t);
});

test('batch-unreadable: a JSON file that is not JSON, or whose top level is not an object, at its line', () => {
  const f = findingsOf({});
  assert.deepEqual(f.map((x) => x.id), ['field-missing']);
  const r = checkText('{"payments": [}\n');
  assert.deepEqual(r.findings.map((x) => [x.id, x.line]), [['batch-unreadable', 1]]);
  assert.match(r.findings[0].message, /^The file is not JSON the reader can follow: expected a value/);
  const list = checkText('[1, 2]');
  assert.deepEqual(list.findings.map((x) => x.id), ['batch-unreadable']);
  assert.match(list.findings[0].message, /top level of the file is a list, not an object/);
  assert.match(checkText('{"payments": [], "payments": []}').findings[0].message, /written twice/);
});

test('field-missing: the payments, an empty list, a payment id, a country, a rail and an amount, each at its line', () => {
  assert.match(ofCheck({ batch: { id: 'X' } }, 'field-missing')[0].message, /^The batch file has no payments\.$/);
  assert.match(ofCheck({ payments: [] }, 'field-missing')[0].message, /^The batch holds no payment\.$/);
  const b = withPayment(bank({ paymentId: undefined, beneficiaryCountry: undefined, rail: undefined, amount: undefined }));
  const text = batchText(b);
  const f = ofCheck(b, 'field-missing');
  assert.deepEqual(f.map((x) => x.message), ['Payment 5 has no paymentId, so it cannot be told apart from the other payments of the batch.', 'Payment 5 has no beneficiaryCountry.', 'Payment 5 has no rail; it must be bank or stablecoin.', 'Payment 5 has no amount.']);
  assert.ok(f.every((x) => x.line === lineOf(text, '{', 3 + 4)), 'each at the line of the payment');
  assert.deepEqual(ofCheck(withPayment(bank({ amount: '' })), 'field-missing').map((x) => x.message), ['Payment B-1 has no amount.']);
});

test('field-missing: what each rail needs, and a near miss on each side', () => {
  const msgs = (p) => ofCheck(withPayment(p), 'field-missing').map((x) => x.message);
  assert.deepEqual(msgs(bank({ paymentId: 'X', currency: undefined })), ['Payment X is a bank payment with no currency.']);
  assert.deepEqual(msgs(bank({ paymentId: 'X', iban: undefined, bic: undefined })), ['Payment X is a bank payment with neither an iban nor an accountNumber, so it names no account to pay.']);
  assert.deepEqual(msgs(bank({ paymentId: 'X', iban: undefined, accountNumber: '000123', bic: undefined })), ['Payment X is paid to an accountNumber with no bic, so it names no bank to pay through.']);
  assert.deepEqual(msgs(bank({ paymentId: 'X', iban: undefined, accountNumber: '000123' })), []);
  assert.deepEqual(msgs(bank({ paymentId: 'X', bic: undefined })), [], 'an IBAN needs no BIC');
  assert.deepEqual(msgs(coin({ paymentId: 'X', network: undefined, token: undefined, walletAddress: undefined })), ['Payment X is a stablecoin payment with no network.', 'Payment X is a stablecoin payment with no token.', 'Payment X is a stablecoin payment with no walletAddress.']);
  assert.deepEqual(msgs(coin({ paymentId: 'X' })), []);
});

test('field-unknown: a misspelt key at every level, with the key it is probably meant to be, and its value left out', () => {
  const b = { ...batch({ debitcurrency: 'EUR' }), paymnts: [] };
  const f = ofCheck(b, 'field-unknown');
  assert.deepEqual(f.map((x) => x.message.split('.')[0]), ['The key "paymnts" of the batch file is not one the tool reads, so its value was left out of every check', 'The key "debitcurrency" of the batch is not one the tool reads, so its value was left out of every check']);
  assert.match(f[1].message, /Did you mean "debitCurrency"\?/);
  const p = ofCheck(withPayment(bank({ paymentId: 'X', Amount: '5', amount: undefined })), 'field-unknown');
  assert.match(p[0].message, /^The key "Amount" of payment X is not one the tool reads.*Did you mean "amount"\?/);
  assert.ok(idsOf(withPayment(bank({ paymentId: 'X', Amount: '5', amount: undefined }))).includes('field-missing'), 'the misspelt amount is missing');
  assert.equal(suggestKey('IBAN', PAYMENT_KEYS), 'iban');
  assert.equal(suggestKey('beneficiary_name', PAYMENT_KEYS), 'beneficiaryName');
  assert.equal(suggestKey('zz', PAYMENT_KEYS), null);
  assert.equal(suggestKey('colour', PAYMENT_KEYS), null);
});

test('field-invalid: values of the wrong type or form, and fields the rail does not take', () => {
  const msgs = (b) => ofCheck(b, 'field-invalid').map((x) => x.message);
  assert.deepEqual(msgs(withPayment(bank({ paymentId: 'X', rail: 'wire' }))), ['The rail of payment X is "wire"; it must be bank or stablecoin.']);
  assert.deepEqual(msgs(withPayment(bank({ paymentId: 'X', rail: 'Bank' }))), [], 'a rail in any case');
  assert.deepEqual(msgs(withPayment(bank({ paymentId: 'X', beneficiaryName: { first: 'A' } }))), ['The beneficiaryName of payment X is an object; it must be text.']);
  assert.deepEqual(msgs(withPayment(bank({ paymentId: 'X', amount: [1] }))), ['The amount of payment X is a list; it must be a decimal number, written as a number or as text.']);
  assert.deepEqual(msgs(withPayment(bank({ paymentId: 'X', fxRate: '0' }))), ['The fxRate of payment X is "0"; it must be a plain decimal number above 0, such as 0.8571.']);
  assert.deepEqual(msgs(withPayment(bank({ paymentId: 'X', walletAddress: '0x1' }))), ['Payment X is a bank payment and takes no walletAddress; a payment on a chain is written with rail stablecoin.']);
  assert.deepEqual(msgs(withPayment(coin({ paymentId: 'X', iban: 'DE89', currency: 'USD' }))), ['Payment X is a stablecoin payment and takes no iban; it is paid in its token to a walletAddress.', 'Payment X is a stablecoin payment and takes no currency; it is paid in its token to a walletAddress.']);
  assert.deepEqual(msgs({ batch: 'X', payments: PAYMENTS }), ['The batch is text; it must be an object with id, debitCurrency, totals, notes.']);
  assert.deepEqual(msgs({ payments: { a: 1 } }), ['The payments are an object; they must be a list of objects, one for each payment.']);
  assert.deepEqual(msgs({ payments: [7] }), ['Payment 1 is the number 7; it must be an object.']);
  assert.deepEqual(msgs(batch({ totals: ['1'] })), ['The totals of the batch are a list; they must be an object with a total for each currency or token, such as {"EUR": "1500.00"}.']);
  assert.deepEqual(msgs(batch({ totals: { EUR: '1,000', GBP: '', USDC: true } })), ['The total for EUR is "1,000"; it must be a plain decimal number such as 1500.00, with no sign, exponent or separator.', 'The total for GBP is empty; it must be a decimal number.', 'The total for USDC is true; it must be a decimal number, written as a number or as text.']);
});

test('a payment id and an account number may be written as JSON numbers, and amounts as numbers keep their characters', () => {
  const r = checkText(batchText(withPayment(bank({ paymentId: 77, iban: undefined, accountNumber: 1234567, bic: 'EXMPDEFF', amount: 10.5 }))));
  const p = r.batch.payments[4];
  assert.equal(p.id, '77');
  assert.equal(p.accountNumber, '1234567');
  assert.equal(p.amount.text, '10.5');
  assert.deepEqual(r.findings, []);
});

test('a CSV batch: an unknown column once at the header, a column named twice, a column with no name, and batch columns that differ', () => {
  const rows = PAYMENTS.slice(0, 2).map((p) => ({ ...p, batchId: 'B', debitCurrency: 'EUR', Colour: 'x' }));
  const text = csvText(rows).replace('Colour', 'amount').replace(',x\n', ',9\n');
  const f = csvFindings(text);
  assert.deepEqual(f.map((x) => [x.id, x.line]), [['field-duplicate', 1]]);
  assert.match(f[0].message, /^The column "amount" is named twice in the header; the tool reads the first and left this one out of every check\.$/);
  const unknown = csvFindings(csvText(PAYMENTS.map((p) => ({ ...p, beneficiary_name: 'x' }))));
  assert.deepEqual(unknown.map((x) => [x.id, x.line]), [['field-unknown', 1]]);
  assert.match(unknown[0].message, /Did you mean "beneficiaryName"\?/);
  const noName = csvFindings(`${csvText(PAYMENTS.slice(0, 1)).replace('\n', ',\n').replace(/\n$/, ',z\n')}`);
  assert.deepEqual(noName.map((x) => x.id), ['field-invalid']);
  assert.match(noName[0].message, /A column of the header has no name/);
  const differ = csvFindings(csvText([{ ...PAYMENTS[0], debitCurrency: 'EUR' }, { ...PAYMENTS[1], debitCurrency: 'USD' }]));
  assert.deepEqual(differ.map((x) => [x.id, x.line]), [['field-invalid', 3]]);
  assert.match(differ[0].message, /^The debitCurrency of this row is "USD", but the row at line 2 gives "EUR"; a batch has one debitCurrency, the same on every row\.$/);
  assert.deepEqual(CSV_BATCH_COLUMNS, ['batchId', 'debitCurrency']);
  const read = checkText(csvText([{ ...PAYMENTS[0], batchId: 'CSV-1', debitCurrency: 'EUR' }]), {}, 'csv');
  assert.equal(read.batch.batch.id, 'CSV-1');
});

test('readBatch keeps its limit of payments, and cut and describe keep long values short', () => {
  const many = Array.from({ length: 5 }, (_, i) => bank({ paymentId: `P${i}`, amount: `${i + 1}.00` }));
  const r = readBatch({ format: 'json', root: readJson(batchText(batch({ totals: undefined }, many))) }, { ...BATCH_LIMITS, maxPayments: 3 });
  assert.equal(r.payments.length, 3);
  assert.deepEqual(r.notes, ['the batch holds 5 payments; the tool read the first 3 and left the rest out']);
  assert.equal(BATCH_LIMITS.maxPayments, 100000);
  assert.equal(cut('x'.repeat(200), 10), 'xxxxxxx...');
  assert.equal(describe({ kind: 'number', raw: '1'.repeat(50) }), `the number ${'1'.repeat(37)}...`);
  assert.equal(describe({ kind: 'string', secret: true }), 'a value that is not shown');
});
