// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// batches to examples/output. CI runs it and then fails if those files changed, so the example output in the repository
// is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the examples; every path is relative to the root of the repository.
export const BAD = ['examples/bad/batch.json'];
export const GOOD = ['examples/good/batch.csv'];

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the bad batch: the counts, a finding of nearly every check, and the result.
export const EXPECTED = [
  'batch: PAYOUT-EXAMPLE-BAD; JSON; 22 payments (17 bank, 4 stablecoin); debit EUR; paid in EUR, GBP, CHF, EUX, JPY, SEK, USDC, DAI and 2 more',
  'findings: 23 (16 error, 7 warning)',
  'The batch has a payment of 2500 USD, but its totals give none for USD',
  'The batch gives a total of 6082 EUR, but its 10 payments in EUR add up to 5982.',
  'The iban of payment P-002, GR1601101250000000012300696, fails the check of ISO 13616: the remainder of MOD 97-10 is 28, not 1',
  'The iban of payment P-003 has 17 characters, but the IBAN registry of Swift gives NL IBANs 18.',
  'The bic of payment P-005, "EXMP GB2L", has 9 characters, not 8 or 11.',
  'The currency of payment P-007 is "EUX", which is not an alphabetic code of the ISO 4217 list SIX keeps.',
  'The amount of payment P-008 is 150000.50 JPY, with 1 decimal place, but the ISO 4217 list gives JPY a minor unit of 0',
  'The amount of payment P-009 is negative (-200.00)',
  'The beneficiaryCountry of payment P-010 is "UK"',
  'The code of the United Kingdom is GB.',
  'The paymentId P-001 is also the id of the payment at line 19',
  'Payment P-013 has no beneficiaryName',
  'The walletAddress of payment P-016 on Ethereum, "0x1234", has 4 characters after 0x, not 40',
  'Payment P-017 pays in DAI, which is not in the list of tokens the batch may pay in (USDC and USDT; --tokens sets another).',
  'The batch holds the key "seedPhrase", which names a seed, a mnemonic or a private key.',
  'The rail of payment P-021 is "wire"; it must be bank or stablecoin.',
  'Payment P-022 is a bank payment with no currency.',
  'The iban of payment P-004 is an account in BE, but the beneficiaryCountry is AT.',
  'The bic of payment P-006, EXMPDEFF, is of a bank in DE, but the beneficiaryCountry is CH and the iban is in CH.',
  'Payment P-012 pays 1500 EUR to the same account as payment P-001 at line 19, for the same amount.',
  'The beneficiaryName of payment P-014 is "Q", with fewer than 3 letters',
  'Payment P-015 is paid in USD from EUR, the debitCurrency of the batch, and gives no fxRate',
  'Payment P-018 pays in USDT on Base, a pair the tool\'s table does not list',
  'The key "purposeCod" of payment P-020 is not one the tool reads, so its value was left out of every check. Did you mean "purposeCode"?',
  'note: the total for SEK was not compared, because the amount of one of its payments could not be read',
  'not a compliance or sanctions screening and not a guarantee that a payment will arrive',
  'RESULT: FAIL - 16 findings at or above error (16 error, 7 warning)'
];
// What must not be reported: the checks the bad batch does not hold, the seed, and a pass.
export const UNWANTED = ['ERROR    batch-unreadable', 'ERROR    field-duplicate', 'WARNING  amount-above-max', 'lantern', 'RESULT: PASS'];

// What the README says of the good batch: no finding, and the note on the totals it does not give.
export const GOOD_EXPECTED = [
  'batch: PAYOUT-EXAMPLE-GOOD; CSV; 11 payments (8 bank, 3 stablecoin); debit EUR; paid in EUR, GBP, CHF, JPY, KWD, USD, USDC and USDT',
  'findings: 0',
  'note: the batch gives no totals, so batch-total-mismatch had nothing to compare',
  'RESULT: PASS - no finding at or above error'
];

const problems = [];
function expect(name, result, code, expected, unwanted, stream = 'out') {
  const text = result[stream];
  const missing = expected.filter((e) => !text.includes(e));
  const wrong = unwanted.filter((e) => text.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bad = await run(BAD);
  process.stdout.write(bad.out);
  expect('bad batch', bad, 1, EXPECTED, UNWANTED);

  const good = await run(GOOD);
  expect('good batch', good, 0, GOOD_EXPECTED, ['ERROR    ', 'WARNING  ', 'RESULT: FAIL']);
  // The good batch also passes when warnings and notes fail the run.
  expect('good, fail on warning', await run([...GOOD, '--fail-on', 'warning']), 0, ['RESULT: PASS - no finding at or above warning'], []);
  expect('good, fail on info', await run([...GOOD, '--fail-on', 'info']), 0, ['RESULT: PASS - no finding at or above info'], []);
  // A limit of 1000 for every payment reports the payments above it.
  expect('good, max amount of 1000', await run([...GOOD, '--fail-on', 'warning', '--max-amount', '1000']), 1, ['amount-above-max', 'is above the --max-amount limit of 1000'], []);
  // A list of tokens without USDT reports the USDT payment.
  expect('good, USDC only', await run([...GOOD, '--tokens', 'USDC']), 1, ['Payment G-011 pays in USDT, which is not in the list of tokens the batch may pay in (USDC; --tokens sets another).'], []);
  // The bad batch with only the errors shown still counts the rest.
  expect('bad, errors only', await run([...BAD, '--min-severity', 'error']), 1, ['findings: 16 (16 error); 7 below error not shown'], ['WARNING  ']);
  // A file that is not there stops the run with no report.
  expect('missing file', await run(['examples/none/batch.csv']), 2, ['examples/none/batch.csv: does not exist'], [], 'err');

  // The README shows the head of the report of the bad batch with its table of checks, one finding, the table of totals
  // and the end of the report, and the end of the report of the good batch.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const lines = bad.out.split('\n');
  const head = lines.slice(0, lines.findIndex((l) => l.startsWith('Findings ('))).join('\n');
  if (!readme.includes(head)) problems.push('README: the head of the sample output of the bad batch differs from a real run');
  const explained = (await run([...BAD, '--explain'])).out.split('\n');
  const at = explained.findIndex((l) => l.includes('iban-checksum') && l.includes('examples/bad/batch.json:'));
  const sample = explained.slice(at, at + 5).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the sample finding of the IBAN check differs from a real run');
  const t = lines.findIndex((l) => l.startsWith('Totals ('));
  const table = lines.slice(t, t + 13).join('\n');
  if (t < 0 || !readme.includes(table)) problems.push('README: the table of totals of the bad batch differs from a real run');
  const tail = lines.slice(-6).join('\n');
  if (!readme.includes(tail)) problems.push('README: the tail of the sample output of the bad batch differs from a real run');
  const goodTail = good.out.split('\n').slice(-6).join('\n');
  if (!readme.includes(goodTail)) problems.push('README: the tail of the sample output of the good batch differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/bad.txt'), bad.out);
  await writeFile(resolve(root, 'examples/output/good.txt'), good.out);
  const outputs = [
    ['bad-explain.txt', [...BAD, '--explain'], 1],
    ['bad.md', [...BAD, '--format', 'markdown'], 1],
    ['bad-explain.md', [...BAD, '--format', 'markdown', '--explain'], 1],
    ['bad.json', [...BAD, '--json', '--explain'], 1],
    ['bad.sarif', [...BAD, '--format', 'sarif'], 1],
    ['good.md', [...GOOD, '--format', 'markdown'], 0],
    ['good.json', [...GOOD, '--json'], 0],
    ['good.sarif', [...GOOD, '--format', 'sarif'], 0],
    ['checks.txt', ['--list-checks'], 0],
    ['checks.json', ['--list-checks', '--format', 'json'], 0]
  ];
  for (const [name, args, code] of outputs) {
    const r = await run(args);
    if (r.code !== code) problems.push(`${name}: exit code ${r.code}, expected ${code}`);
    await writeFile(resolve(root, 'examples/output', name), r.out);
  }

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
