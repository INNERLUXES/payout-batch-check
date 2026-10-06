import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEST, CURRENCIES, IBAN_FORMATS, NOT_A, NOTICE, POINTS, RULES, SOURCES, UN_CODES, flat, grouped, ibanRemainder, listText, plural, pointPage, safeText, source } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const read = (rel) => readFile(resolve(root, rel), 'utf8');
const norm = (t) => t.replace(/\s+/g, ' ');
// The lines of a saved list after its two-line header and the line that names its columns.
const rowsOf = async (file, skip) => (await read(file)).split('\n').slice(skip).filter(Boolean).map((l) => l.split(' | '));

const PLACES = /^https:\/\/(?:www\.swift\.com\/(?:standards\/data-standards\/[a-z-]+|swift-resource\/11971\/download)|tcmb\.gov\.tr\/wps\/wcm\/connect\/EN\/TCMB\+EN\/Bottom\+Menu\/IBAN\/Communique|www\.six-group\.com\/dam\/download\/financial-information\/data-center\/iso-currrency\/lists\/list-one\.xml|unstats\.un\.org\/unsd\/methodology\/m49\/overview\/|ethereum\.org\/en\/developers\/docs\/accounts\/|solana\.com\/docs\/core\/accounts\/account-structure|developers\.tron\.network\/docs\/account)$/;

test('every source has an official address, and no number that reads like a year', () => {
  for (const s of SOURCES) {
    assert.match(s.url, PLACES, s.id);
    assert.doesNotMatch(s.url, /(?<!(?:EIP|ERC)[- ]?)\b(?:19|20)\d{2}\b/i, s.id);
    assert.ok(s.title.length > 5);
  }
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  assert.deepEqual(SOURCES.map((s) => s.id), ['swift-iban', 'swift-iban-registry', 'tcmb-iban', 'swift-bic', 'six-iso-4217', 'un-m49', 'ethereum-accounts', 'solana-accounts', 'tron-accounts']);
  assert.equal(NOTICE, `This report is an input to a review before the batch is sent: ${NOT_A}.`);
});

test('every source has a text copy under research/sources that starts with its address, and research/sources.md lists it', async () => {
  const notes = await read('research/sources.md');
  for (const s of SOURCES) {
    const copy = await read(s.file);
    assert.ok(copy.startsWith(`Source: ${s.url}\n`), s.file);
    assert.ok(copy.length > 1500, `${s.file} holds the page`);
    assert.ok(notes.includes(s.url), `research/sources.md lists ${s.id}`);
    assert.ok(notes.includes(s.file), `research/sources.md names ${s.file}`);
  }
});

test('every point belongs to a listed source, is written in a sentence of its own and is not a long quotation of its page', async () => {
  for (const [id, p] of Object.entries(POINTS)) {
    const page = source(p.source);
    assert.ok(page, `${id}: the source ${p.source}`);
    assert.equal(pointPage(id), page);
    assert.ok(p.text.length > 40 && p.text.length < 400, id);
    assert.match(p.text, /\.$/, id);
    const copy = norm(await read(page.file));
    // No run of 12 words of the point appears word for word in its page.
    const words = norm(p.text).split(' ');
    for (let i = 0; i + 12 <= words.length; i += 1) assert.ok(!copy.includes(words.slice(i, i + 12).join(' ')), `${id} quotes its page`);
  }
});

test('every point is used by a rule, and every basis of a rule is a point', () => {
  const used = new Set(RULES.flatMap((r) => r.basis));
  for (const id of Object.keys(POINTS)) assert.ok(used.has(id), `${id} is not used by a rule`);
  for (const id of used) assert.ok(Object.hasOwn(POINTS, id), `${id} is not a point`);
});

test('docs/rules-and-sources.md lists every page with its copy and every check with its level, kind and points', async () => {
  const doc = await read('docs/rules-and-sources.md');
  for (const s of SOURCES) assert.ok(doc.includes(s.url) && doc.includes(s.file), s.id);
  for (const r of RULES) {
    const section = doc.split(/^## /m).find((p) => p.startsWith(`${r.id}\n`));
    assert.ok(section, r.id);
    assert.ok(section.includes(`- Level: ${r.severity}`), r.id);
    assert.ok(section.includes('- Cannot see: '), r.id);
    for (const b of r.basis) assert.ok(section.includes(POINTS[b].text), `${r.id}: ${b}`);
    if (r.kind === 'best practice') assert.ok(norm(section).includes(BEST), r.id);
    if (r.own) assert.ok(section.includes(r.own), `${r.id}: its own choice`);
  }
});

test('the documented checks name a page, the best practice checks say what is their own choice, and the input checks rest on no page', () => {
  for (const r of RULES.filter((x) => x.kind === 'documented')) {
    assert.ok(r.basis.length > 0, r.id);
    assert.equal(r.own, undefined, r.id);
  }
  for (const r of RULES.filter((x) => x.kind === 'best practice')) assert.ok(r.own && r.own.includes(BEST), `${r.id} says what is its own choice`);
  for (const r of RULES.filter((x) => x.kind === 'input')) assert.deepEqual(r.basis, [], r.id);
});

test('the pages say what the documented checks rest on', async () => {
  const iban = norm(await read('research/sources/swift-iban-page.txt'));
  assert.ok(iban.includes('ISO has designated Swift to act as the registration authority for national IBAN formats.'));
  assert.ok(iban.includes('Swift publishes the ISO 13616 IBAN Registry.'));
  const tcmb = norm(await read('research/sources/tcmb-iban-communique.txt'));
  assert.ok(tcmb.includes('The first four characters of the IBAN are moved to the right of the IBAN'));
  assert.ok(tcmb.includes('In order for the check digits to be correct, the remainder (MOD 97-10) of dividing the result by 97 must be 1.'));
  assert.ok(tcmb.includes('A=10'));
  assert.ok(tcmb.includes('Banks may return or reject the transfer orders that are detected to have an invalid IBAN'));
  const bic = norm(await read('research/sources/swift-bic-page.txt'));
  assert.ok(bic.includes('BIC is the International ISO standard ISO 9362.'));
  assert.ok(bic.includes('consisting of the business party prefix (4 alphanumeric), the country code as defined in ISO 3166-1 (2 alphabetic), and the business party suffix (2 alphanumeric).'));
  assert.ok(bic.includes('The branch identifier is a 3 character optional element'));
  const six = await read('research/sources/six-iso-4217-list-one.txt');
  assert.ok(six.includes('JAPAN | Yen | JPY | 392 | 0 |'));
  assert.ok(six.includes('KUWAIT | Kuwaiti Dinar | KWD | 414 | 3 |'));
  assert.ok(six.includes('GERMANY | Euro | EUR | 978 | 2 |'));
  assert.ok(six.includes('ZZ08_Gold | Gold | XAU | 959 | N.A. |'));
  const m49 = await read('research/sources/un-m49-country-codes.txt');
  assert.ok(m49.includes('Country or Area | M49 Code | ISO-alpha2 Code | ISO-alpha3 Code'));
  assert.ok(m49.includes('United Kingdom of Great Britain and Northern Ireland | 826 | GB | GBR'));
  assert.ok(!m49.includes('| TW |'), 'the UN table lists no code for Taiwan');
  const eth = norm(await read('research/sources/ethereum-org-accounts.txt'));
  assert.ok(eth.includes('This means an Externally owned account (EOA) has a 42-character address (20-byte segment which is 40 hexadecimal characters plus the `0x` prefix).'));
  const sol = norm(await read('research/sources/solana-account-structure.txt'));
  assert.ok(sol.includes('Every account address is a 32-byte value, displayed as a base58-encoded string.'));
  const tron = norm(await read('research/sources/tron-accounts-and-keys.txt'));
  assert.ok(tron.includes('**Base58Check** - 34 characters starting with `T`'));
  assert.ok(tron.includes('A TRON address is a 21-byte value with a leading `0x41` prefix byte.'));
});

test('the table of IBAN formats is the saved copy of the registry, and every example IBAN of the copy passes the checksum', async () => {
  const rows = await rowsOf('research/sources/swift-iban-registry.txt', 4);
  assert.equal(rows.length, IBAN_FORMATS.length);
  for (const [i, r] of rows.entries()) {
    const f = IBAN_FORMATS[i];
    assert.equal(f.code, r[1], r[0]);
    assert.equal(f.length, Number(r[4]), r[0]);
    assert.deepEqual(f.includes, r[8] === 'N/A' ? [] : r[8].split(', ').map((x) => x.slice(0, 2)), r[0]);
    assert.equal(r[5].length, f.length, `${r[0]}: the example has the length of the registry`);
    assert.equal(ibanRemainder(r[5]), 1, `${r[0]}: ${r[5]}`);
    assert.ok(r[5].startsWith(f.code), r[0]);
  }
});

test('the table of currencies is the saved copy of ISO 4217 list one: every code with its minor unit, and no code left out', async () => {
  const rows = (await rowsOf('research/sources/six-iso-4217-list-one.txt', 4)).filter((r) => r[2]);
  const fromCopy = new Map(rows.map((r) => [r[2], /^\d$/.test(r[4]) ? Number(r[4]) : null]));
  assert.deepEqual(CURRENCIES.map(([c]) => c), [...fromCopy.keys()].sort());
  for (const [code, unit] of CURRENCIES) assert.equal(unit, fromCopy.get(code), code);
});

test('the country codes are the ISO alpha-2 codes of the saved copy of the UN table, in order', async () => {
  const rows = await rowsOf('research/sources/un-m49-country-codes.txt', 7);
  assert.deepEqual(UN_CODES, rows.map((r) => r[2]).sort());
});

test('size helpers: grouped numbers, lists for a sentence and plurals', () => {
  assert.equal(grouped(12345), '12,345');
  assert.equal(grouped(10n ** 12n), '1,000,000,000,000');
  assert.equal(listText(['a']), 'a');
  assert.equal(listText(['a', 'b']), 'a and b');
  assert.equal(listText(['a', 'b', 'c']), 'a, b and c');
  assert.equal(listText(['a', 'b', 'c', 'd', 'e'], 3), 'a, b, c and 2 more');
  assert.equal(plural(1, 'line'), '1 line');
  assert.equal(plural(2, 'payment'), '2 payments');
});

test('text helpers: safeText replaces control, direction and separator characters and caps the length; flat folds white space', () => {
  const bad = ['a', String.fromCharCode(0x1b), '[31m', String.fromCharCode(0x202e), 'b', String.fromCharCode(0x2028), 'c', String.fromCharCode(7), 'd', String.fromCharCode(0x85), 'e'].join('');
  const out = safeText(bad);
  assert.ok(![...out].some((c) => c.charCodeAt(0) < 32 || [0x202e, 0x2028, 0x85].includes(c.charCodeAt(0))));
  assert.equal(safeText('x'.repeat(50), 10), 'xxxxxxx...');
  assert.equal(safeText('short', 10), 'short');
  assert.equal(flat('  a \n  b\t c '), 'a b c');
});
