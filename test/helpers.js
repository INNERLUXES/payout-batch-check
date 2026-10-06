// Shared test helpers: batches built inline, checked in memory or written into a temporary folder that is removed after
// the test. Paths are built with resolve() from forward-slash names, so the same test runs on Linux, macOS and Windows.
// The line a test expects is found with lineOf(), which counts lines the way the readers do, so a test never holds a line
// number worked out by hand for one system only. No test reads the clock, the time zone or the locale. Every IBAN is an
// example of the saved copy of the IBAN registry, or one built from it with check digits worked out by ibanOf(); every
// BIC is made up with EXMP as its party prefix, and every wallet address is one character written many times.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkText, ibanRemainder, main } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'payout-batch-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// The line (from 1) of the n-th place where needle starts in text.
export function lineOf(text, needle, n = 1) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return text.slice(0, at).split('\n').length;
}

// The example IBANs of the saved copy of the registry, by country.
export const IBAN = {
  DE: 'DE89370400440532013000',
  FR: 'FR1420041010050500013M02606',
  GB: 'GB29NWBK60161331926819',
  NL: 'NL91ABNA0417164300',
  BE: 'BE68539007547034',
  NO: 'NO9386011117947',
  LC: 'LC55HEMM000100010012001200023015',
  KW: 'KW81CBKU0000000000001234560101'
};

// An IBAN with the check digits worked out for a country and an account part, so that a test can build one of any length
// whose check digits are right.
export function ibanOf(country, account) {
  const r = ibanRemainder(`${country}00${account}`);
  return `${country}${String(98 - r).padStart(2, '0')}${account}`;
}

// Made-up wallet addresses of one repeated character.
export const evm = (c = '1') => `0x${c.repeat(40)}`;
export const sol = (c = 'G', n = 44) => c.repeat(n);
export const tron = (c = 'H') => `T${c.repeat(33)}`;

const drop = (out) => {
  for (const [k, v] of Object.entries(out)) if (v === undefined) delete out[k];
  return out;
};

// A bank payment that passes every check: EUR to a German IBAN; over replaces fields, and a field set to undefined is
// left out.
export const bank = (over = {}) => drop({ paymentId: 'B-1', beneficiaryName: 'Harbor Example Supplies GmbH', beneficiaryCountry: 'DE', rail: 'bank', iban: IBAN.DE, bic: 'EXMPDEFFXXX', currency: 'EUR', amount: '1500.00', ...over });

// A stablecoin payment that passes every check: USDC on Ethereum.
export const coin = (over = {}) => drop({ paymentId: 'C-1', beneficiaryName: 'Lumen Example Pte Ltd', beneficiaryCountry: 'SG', rail: 'stablecoin', network: 'ethereum', token: 'USDC', walletAddress: evm(), amount: '750.00', ...over });

// Four payments that pass every check: EUR to Germany and France, GBP to the United Kingdom with a rate, and USDC on
// Solana.
export const PAYMENTS = [
  bank(),
  bank({ paymentId: 'B-2', beneficiaryName: 'Lantern Example Studio SARL', beneficiaryCountry: 'FR', iban: IBAN.FR, bic: 'EXMPFRPP', amount: '820.00' }),
  bank({ paymentId: 'B-3', beneficiaryName: 'Willow Example Trading Ltd', beneficiaryCountry: 'GB', iban: IBAN.GB, bic: 'EXMPGB2L', currency: 'GBP', amount: '1200.00', fxRate: '0.8571' }),
  coin({ paymentId: 'C-1', network: 'solana', walletAddress: sol() })
];

// A batch with every field the checks need; over replaces fields of the batch, and a field set to undefined is left out.
export function batch(over = {}, payments = PAYMENTS) {
  return drop({ batch: drop({ id: 'TEST-BATCH', debitCurrency: 'EUR', totals: { EUR: '2320.00', GBP: '1200.00', USDC: '750.00' }, ...over }), payments });
}

// The batch with one payment replaced by another, or added when at is past the end; the totals are left out, so that a
// test of one payment is not also a test of the totals.
export const withPayment = (p, at = PAYMENTS.length) => batch({ totals: undefined }, [...PAYMENTS.slice(0, at), p, ...PAYMENTS.slice(at + 1)]);

export const batchText = (obj) => `${JSON.stringify(obj, null, 2)}\n`;

// A CSV table of rows of objects, with the header taken from the keys of all rows in the order they first appear.
export function csvText(rows, header = [...new Set(rows.flatMap((r) => Object.keys(r)))]) {
  const field = (v) => (v === undefined ? '' : /[",\r\n]/.test(String(v)) ? `"${String(v).split('"').join('""')}"` : String(v));
  return `${[header.join(','), ...rows.map((r) => header.map((h) => field(r[h])).join(','))].join('\n')}\n`;
}

// The findings of a batch given as an object, through the readers and the checks.
export const findingsOf = (obj, options = {}) => checkText(batchText(obj), options, 'json').findings;

// The ids of the findings of a batch.
export const idsOf = (obj, options = {}) => findingsOf(obj, options).map((f) => f.id);

// The findings of one check.
export const ofCheck = (obj, id, options = {}) => findingsOf(obj, options).filter((f) => f.id === id);

// The findings of a CSV text.
export const csvFindings = (text, options = {}) => checkText(text, options, 'csv').findings;

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, base) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// Writes the files and runs the command line in the folder.
export async function run(files, args) {
  return withFiles(files, (dir) => cli(args, dir));
}

// A clean batch, and one whose German IBAN has a wrong check digit, for the command line tests.
export const GOOD = batchText(batch());
export const BAD = batchText(withPayment(bank({ paymentId: 'B-9', iban: 'DE89370400440532013001' })));

// The time a hostile test may take: four times as long when the runner collects coverage, which sets NODE_V8_COVERAGE.
export const allowed = (ms) => (process.env.NODE_V8_COVERAGE ? ms * 4 : ms);
