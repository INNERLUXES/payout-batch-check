import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TOKENS, RULES, USAGE, VERSION, buildReport, checkText, listChecksJson, listChecksMarkdown, listChecksText, parseArgs, toJson, toMarkdown, toSarif, toText } from '../src/index.js';
import { BAD, GOOD, PAYMENTS, bank, batch, batchText, cli, coin, csvText, run, withPayment } from './helpers.js';

const FILES = { 'good.json': GOOD, 'bad.json': BAD };
const ch = (...codes) => String.fromCharCode(...codes);
// A batch with an error and a warning: a German IBAN with a wrong check digit, and a payment in USD with no rate.
const MIXED = batchText(withPayment(bank({ paymentId: 'B-9', iban: 'DE89370400440532013001', currency: 'USD' })));

test('exit codes: 0 for a pass, 1 for a finding at or above the fail-on level, 2 for a usage or input error', async () => {
  assert.equal((await run(FILES, ['good.json'])).code, 0);
  assert.equal((await run(FILES, ['bad.json'])).code, 1);
  assert.equal((await run(FILES, ['nothing.json'])).code, 2);
  assert.equal((await run(FILES, [])).code, 2);
  assert.equal((await run(FILES, ['good.json', 'bad.json'])).code, 2);
  assert.equal((await run(FILES, ['bad.json', '--bogus'])).code, 2);
});

test('--fail-on and --min-severity: a warning fails the run at warning, and a hidden finding still counts for the result', async () => {
  const w = { 'w.json': batchText(withPayment(bank({ paymentId: 'B-9', currency: 'USD', amount: '5.00' }))) };
  assert.equal((await run(w, ['w.json'])).code, 0);
  assert.equal((await run(w, ['w.json', '--fail-on', 'warning'])).code, 1);
  assert.equal((await run(w, ['w.json', '--fail-on', 'info'])).code, 1);
  const r = await run({ 'm.json': MIXED }, ['m.json', '--min-severity', 'error']);
  assert.match(r.out, /findings: 1 \(1 error\); 1 below error not shown\n/);
  const hidden = await run(w, ['w.json', '--min-severity', 'error', '--fail-on', 'warning']);
  assert.match(hidden.out, /findings: 0; 1 below error not shown/);
  assert.equal(hidden.code, 1);
});

test('--tokens: replaces the list of tokens, in any case, once, and refuses what is not a list of symbols', async () => {
  const c = { 'c.json': batchText(withPayment(coin({ paymentId: 'C-9', token: 'EURC', amount: '5.00' }))) };
  assert.equal((await run(c, ['c.json'])).code, 1);
  const r = await run(c, ['c.json', '--tokens', 'usdc, eurc', '--json']);
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(r.out).config.tokens, ['USDC', 'EURC']);
  assert.deepEqual(parseArgs(['a', '--tokens', 'USDC']).tokens, ['USDC']);
  for (const bad of ['', 'U', 'USDC,,USDT', 'US-DC', 'USDC,usdc', Array.from({ length: MAX_TOKENS + 1 }, (_, i) => `T${i}X`).join(',')]) assert.throws(() => parseArgs(['a', '--tokens', bad]), /takes a list|names a token twice|needs a value/, bad);
  assert.throws(() => parseArgs(['a', '--tokens', 'USDC', '--tokens', 'USDT']), /given twice/);
});

test('--max-amount: a limit for every payment and one for each unit, kept in the report, and refused when it is not a plain amount', async () => {
  const m = { 'm.json': GOOD };
  assert.equal((await run(m, ['m.json', '--fail-on', 'warning', '--max-amount', '1500'])).code, 0);
  const r = await run(m, ['m.json', '--fail-on', 'warning', '--max-amount', '1000', '--max-amount', 'gbp=2500', '--json']);
  assert.equal(r.code, 1);
  const report = JSON.parse(r.out);
  assert.deepEqual(report.config.maxAmount, { all: '1000', byUnit: { GBP: '2500' } });
  assert.deepEqual(report.findings.map((f) => f.payment), ['B-1']);
  for (const bad of ['0', '-5', '1e3', '1,000', 'EUR=', '=5', 'EUR=abc', 'EURO-1=5']) assert.throws(() => parseArgs(['a', '--max-amount', bad]), /takes a plain decimal amount above 0/, bad);
  assert.throws(() => parseArgs(['a', '--max-amount', '5', '--max-amount', '6']), /given twice for every payment/);
  assert.throws(() => parseArgs(['a', '--max-amount', 'EUR=5', '--max-amount', 'eur=6']), /given twice for EUR/);
});

test('the text report names the file, the batch, the checks table, each finding with its line and fix, the totals, and ends with the notice and the result', async () => {
  const r = await run(FILES, ['bad.json']);
  assert.match(r.out, /^payout-batch-check: bad\.json\n/);
  assert.match(r.out, /\nfile: \d+ lines, [\d,]+ bytes\n/);
  assert.match(r.out, /\nbatch: TEST-BATCH; JSON; 5 payments \(4 bank, 1 stablecoin\); debit EUR; paid in EUR, GBP and USDC\n/);
  assert.match(r.out, /\nfindings: 1 \(1 error\)\n/);
  assert.match(r.out, /ERROR {4}iban-checksum {15}bad\.json:\d+\n/);
  assert.match(r.out, /fix: Copy the IBAN again from the beneficiary/);
  assert.match(r.out, /\nChecks \(25\)\n/);
  assert.ok(r.out.includes(['Totals (3)', '', '  unit  payments  sum of rows  total given  state', '  EUR   3         3820         -            no total given'].join('\n')));
  assert.match(r.out, /will arrive\.\n\nRESULT: FAIL - 1 finding at or above error/);
  assert.ok(r.out.endsWith('\n'));
  const good = await run(FILES, ['good.json']);
  assert.match(good.out, /Findings \(0\)\n\n {2}none\n/);
  assert.match(good.out, / {2}EUR {3}2 {9}2320 {9}2320 {9}matches\n/);
});

test('--explain adds the points of the pages to text, markdown and JSON, and the tool\'s own choice to a best practice check', async () => {
  const r = await run({ 'm.json': MIXED }, ['m.json', '--explain']);
  assert.match(r.out, /basis: To check the two check digits, the communique moves the first four characters to the end.*\(Central Bank of the Republic of Turkiye: Communique on the International Bank Account Number, https:\/\/tcmb\.gov\.tr/);
  assert.match(r.out, /the tool's own choice: asking for the rate of a converted payment is a best practice of this tool/);
  const md = (await run({ 'm.json': MIXED }, ['m.json', '--format', 'markdown', '--explain'])).out;
  assert.match(md, /## Basis\n\n### iban-checksum\n\n- To check the two check digits/);
  const json = JSON.parse((await run({ 'm.json': MIXED }, ['m.json', '--json', '--explain'])).out);
  assert.equal(json.findings[0].basis[0].url, 'https://tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Bottom+Menu/IBAN/Communique');
  const plain = JSON.parse((await run({ 'm.json': MIXED }, ['m.json', '--json'])).out);
  assert.equal(plain.findings[0].basis, undefined);
  assert.equal((await run({ 'm.json': MIXED }, ['m.json', '--format', 'sarif', '--explain'])).code, 2);
});

test('the JSON report: the tool, the input, the batch, totals by level, the rules, the findings, the table and the result', async () => {
  const r = JSON.parse((await run({ 'm.csv': csvText([...PAYMENTS, bank({ paymentId: 'B-9', iban: 'DE89370400440532013001', amount: '5.00' })]) }, ['m.csv', '--json'])).out);
  assert.equal(r.tool, 'payout-batch-check');
  assert.equal(r.version, VERSION);
  assert.equal(r.input.format, 'csv');
  assert.deepEqual(r.batch, { id: null, format: 'csv', debitCurrency: null, payments: 5, bank: 4, stablecoin: 1, units: ['EUR', 'GBP', 'USDC'] });
  assert.deepEqual(r.totals, { findings: 1, byLevel: { error: 1, warning: 0, info: 0 }, hidden: 0 });
  assert.equal(r.rules.length, RULES.length);
  const f = r.findings[0];
  assert.deepEqual(Object.keys(f), ['id', 'severity', 'message', 'file', 'line', 'column', 'at', 'payment', 'fix', 'kind']);
  assert.equal(f.at, `m.csv:${f.line}`);
  assert.equal(f.line, 6);
  assert.equal(f.payment, 'B-9');
  assert.deepEqual(r.result, { pass: false, failOn: 'error', text: 'FAIL - 1 finding at or above error (1 error)' });
  assert.equal(r.table.length, 3);
});

test('the SARIF report: version 2.1.0, every check as a rule, and a result with its line and column', async () => {
  const s = JSON.parse((await run({ 'm.json': MIXED }, ['m.json', '--format', 'sarif'])).out);
  assert.equal(s.version, '2.1.0');
  const runOf = s.runs[0];
  assert.equal(runOf.tool.driver.name, 'payout-batch-check');
  assert.equal(runOf.tool.driver.rules.length, RULES.length);
  assert.deepEqual(runOf.results.map((x) => [x.ruleId, x.level]), [['iban-checksum', 'error'], ['fx-rate-missing', 'warning']]);
  assert.ok(runOf.results[0].locations[0].physicalLocation.region.startLine > 1);
  assert.equal(runOf.results[0].ruleIndex, RULES.findIndex((x) => x.id === 'iban-checksum'));
  assert.equal(runOf.properties.sources.length, 9);
});

test('the markdown report escapes what markdown gives a meaning to, and every format replaces control and direction characters', async () => {
  const name = `Example [link](https://x.example) | ${ch(0x1b)}[31m red ${ch(0x202e)}rtl ${ch(7)}`;
  const text = batchText(batch({ id: `ID ${ch(0x1b)}[2J`, totals: undefined }, [...PAYMENTS, bank({ paymentId: `P|${ch(0x2028)}9`, beneficiaryName: name, amount: '0' })]));
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const out = (await run({ 'x.json': text }, ['x.json', '--format', format])).out;
    assert.ok(![...out].some((c) => [0x1b, 0x202e, 0x2028, 7].includes(c.charCodeAt(0))), format);
  }
  const md = (await run({ 'x.json': text }, ['x.json', '--format', 'markdown'])).out;
  assert.match(md, /payment P\\\| 9/);
  assert.doesNotMatch(md, /\]\(https/);
});

test('--list-checks in text, markdown and JSON, and no SARIF form', async () => {
  assert.match((await cli(['--list-checks'], process.cwd())).out, /^payout-batch-check checks\n\n {2}batch-unreadable/);
  assert.equal(listChecksText().split('\n').filter((l) => /^ {2}[a-z]/.test(l)).length, RULES.length);
  assert.match(listChecksMarkdown(), /\| iban-checksum \| error \| documented \|/);
  assert.equal(JSON.parse(listChecksJson()).length, RULES.length);
  assert.equal((await cli(['--list-checks', '--format', 'markdown'], process.cwd())).code, 0);
  assert.equal((await cli(['--list-checks', '--format', 'sarif'], process.cwd())).code, 2);
});

test('--help, --version and usage errors: the usage names every check and option, and a value that looks like an option is refused', async () => {
  const help = await cli(['--help'], process.cwd());
  assert.equal(help.code, 0);
  for (const r of RULES) assert.ok(help.out.includes(r.id), r.id);
  for (const o of ['--format', '--json', '--min-severity', '--fail-on', '--tokens', '--max-amount', '--explain', '--list-checks', '--help', '--version']) assert.ok(USAGE.includes(o), o);
  assert.equal((await cli(['--version'], process.cwd())).out, `${VERSION}\n`);
  assert.throws(() => parseArgs(['a', '--fail-on', '--json']), /--fail-on needs a value/);
  assert.throws(() => parseArgs(['a', '--fail-on', 'fatal']), /unknown level fatal/);
  assert.throws(() => parseArgs(['a', '--format', 'xml']), /unknown format xml/);
  assert.throws(() => parseArgs(['a', '--json', '--format', 'text']), /ask for two formats/);
  assert.throws(() => parseArgs(['-']), /standard input is not supported/);
  assert.throws(() => parseArgs(['a', '--format', '-']), /standard input is not supported/);
  assert.throws(() => parseArgs(['https://example.com/batch.csv']), /never fetches a URL/);
  assert.throws(() => parseArgs(['a', '--fail-on', 'error', '--fail-on', 'warning']), /given twice/);
  const err = await cli(['--bogus'], process.cwd());
  assert.match(err.err, /^payout-batch-check: unknown argument --bogus\n\nUsage:/);
});

test('buildReport and the formats can be used without the file system', () => {
  const checked = checkText(GOOD);
  const report = buildReport({ file: { file: 'mem.json', bytes: GOOD.length, lines: 1 }, checked, version: '0' });
  assert.match(toText(report), /^payout-batch-check: mem\.json/);
  assert.match(toMarkdown(report), /^# payout-batch-check: mem\.json/);
  assert.equal(JSON.parse(toJson(report)).input.file, 'mem.json');
  assert.equal(JSON.parse(toSarif(report)).runs[0].results.length, 0);
  const none = buildReport({ file: { file: 'x.json', bytes: 1, lines: 1 }, checked: checkText('['), version: '0' });
  assert.match(toText(none), /batch: no batch was read/);
  assert.equal(none.table, null);
});
