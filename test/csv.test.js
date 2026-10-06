import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSV_LIMITS, CsvError, checkText, csvNodes, formatOf, readCsv } from '../src/index.js';
import { PAYMENTS, csvFindings, csvText } from './helpers.js';

const fails = (text, pattern, line, column) => assert.throws(() => readCsv(text), (e) => e instanceof CsvError && pattern.test(e.message) && (line === undefined || (e.line === line && e.column === column)), JSON.stringify(text.slice(0, 40)));

test('readCsv: a header, rows and the line and column of every field', () => {
  const t = readCsv('a, b ,c\n1,2,3\n4,,6\n');
  assert.deepEqual(t.header.map((h) => h.value), ['a', 'b', 'c'], 'header names are trimmed');
  assert.deepEqual(t.rows.map((r) => r.cells.map((c) => c.value)), [['1', '2', '3'], ['4', '', '6']]);
  assert.deepEqual(t.rows.map((r) => r.line), [2, 3]);
  assert.deepEqual([t.rows[1].cells[2].line, t.rows[1].cells[2].column], [3, 4]);
});

test('readCsv: quoted fields hold commas, quotes written twice and line ends, which count as lines', () => {
  const t = readCsv('name,note\n"Example, Ltd","say ""hi""\nagain"\nnext,x\n');
  assert.equal(t.rows[0].cells[0].value, 'Example, Ltd');
  assert.equal(t.rows[0].cells[1].value, 'say "hi"\nagain');
  assert.equal(t.rows[1].line, 4);
  assert.equal(readCsv('a\n""\n').rows[0].cells[0].value, '');
});

test('readCsv: LF, CRLF and CR line ends give the same rows and lines, and empty lines at the end are allowed', () => {
  for (const sep of ['\n', '\r\n', '\r']) {
    const t = readCsv(['a,b', '1,2', '"x', 'y",3', '', ''].join(sep));
    assert.deepEqual(t.rows.map((r) => r.line), [2, 3], JSON.stringify(sep));
    assert.equal(t.rows[1].cells[0].value, `x${sep}y`);
  }
  assert.equal(readCsv('a,b\n1,2').rows.length, 1, 'no line end at the end of the file');
});

test('readCsv: what is not a strict table stops the reader with the line and column', () => {
  fails('', /holds no header row/, 1, 1);
  fails('\n\n', /holds no header row/);
  fails('a,b\n1\n', /the row has 1 field and the header has 2/, 2, 1);
  fails('a,b\n1,2,3\n', /the row has 3 fields and the header has 2/, 2, 1);
  fails('a\n1\n\n2\n', /an empty line inside the table/, 3, 1);
  fails('a,b\nx"y,2\n', /a quote inside a field that does not start with one/, 2, 2);
  fails('a,b\n"x"y,2\n', /text after the closing quote/, 2, 4);
  fails('a,b\n1,"open\n', /a quoted field is not closed/, 2, 3);
});

test('readCsv: the limits of rows, columns and the length of a field stop the reader with the limit named', () => {
  assert.throws(() => readCsv(`a\n${'1\n'.repeat(4)}`, { ...CSV_LIMITS, maxRows: 3 }), /more than 3 rows/);
  assert.throws(() => readCsv('a,b,c\n1,2,3\n', { ...CSV_LIMITS, maxColumns: 2 }), /more than 2 fields/);
  assert.throws(() => readCsv('a\nabcdef\n', { ...CSV_LIMITS, maxFieldLength: 5 }), /longer than 5 characters/);
  assert.throws(() => readCsv('a\n"abcdef"\n', { ...CSV_LIMITS, maxFieldLength: 5 }), /longer than 5 characters/);
  assert.equal(CSV_LIMITS.maxRows, 100000);
});

test('csvNodes: the cells by column for the search for secrets and by row for the reader, sharing one node per cell', () => {
  const t = readCsv('a,b\n1,\n3,4\n');
  const n = csvNodes(t);
  assert.deepEqual(n.byColumn.entries.map((e) => [e.key, e.value.items.length]), [['a', 2], ['b', 2]]);
  assert.deepEqual(n.rows.map((r) => r.entries.map((e) => e.key)), [['a'], ['a', 'b']], 'an empty cell is not an entry');
  assert.equal(n.byColumn.entries[1].value.items[1], n.rows[1].entries[1].value);
  assert.equal(n.rows[1].entries[1].line, 3);
});

test('formatOf: by the extension, and otherwise by the first character', () => {
  assert.equal(formatOf('payouts.CSV', '{'), 'csv');
  assert.equal(formatOf('payouts.json', 'a,b'), 'json');
  assert.equal(formatOf('payouts.txt', '  {"payments": []}'), 'json');
  assert.equal(formatOf('payouts', '[1]'), 'json');
  assert.equal(formatOf('payouts.txt', 'paymentId,amount'), 'csv');
});

test('a CSV batch is read like a JSON one: the same clean payments give no finding', () => {
  assert.deepEqual(csvFindings(csvText(PAYMENTS)), []);
  const r = checkText(csvText(PAYMENTS), {}, 'csv');
  assert.equal(r.batch.payments.length, 4);
  assert.equal(r.format, 'csv');
});

test('a CSV file that is not a strict table is one batch-unreadable finding at its line, and nothing else is checked', () => {
  const f = csvFindings('paymentId,amount\nP-1,"10\n');
  assert.deepEqual(f.map((x) => [x.id, x.line, x.column]), [['batch-unreadable', 2, 5]]);
  assert.match(f[0].message, /^The file is not CSV the reader can follow: a quoted field is not closed at line 2, column 5\. Nothing in the file was checked\.$/);
});
