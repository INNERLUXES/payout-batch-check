import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRY_CODES, CURRENCIES, IBAN_FORMATS, UN_CODES, bicShapeProblem, coveredBy, electronicIban, ibanFormat, ibanRemainder, ibanShapeProblem, isCountry, isCurrency, minorUnitOf } from '../src/index.js';
import { IBAN, ibanOf } from './helpers.js';

test('ibanRemainder: 1 for the examples of the registry, and not 1 for a changed digit or two swapped characters', () => {
  for (const iban of Object.values(IBAN)) assert.equal(ibanRemainder(iban), 1, iban);
  assert.notEqual(ibanRemainder('DE89370400440532013001'), 1);
  assert.notEqual(ibanRemainder('DE89370400440532010300'), 1, 'two digits swapped');
  assert.notEqual(ibanRemainder('DE98370400440532013000'), 1, 'the check digits swapped');
  assert.equal(ibanRemainder(ibanOf('NL', 'ABNA041716430')), 1, 'ibanOf works out check digits that pass');
});

test('ibanRemainder: an IBAN of 34 characters is worked out digit by digit, never through a floating point number', () => {
  const long = ibanOf('LC', `HEMM${'9'.repeat(26)}`);
  assert.equal(long.length, 34);
  assert.equal(ibanRemainder(long), 1);
});

test('ibanShapeProblem and electronicIban: the form of an IBAN in electronic form', () => {
  assert.equal(electronicIban('gb29 nwbk 6016 1331 9268 19'), IBAN.GB);
  assert.equal(ibanShapeProblem(IBAN.GB), null);
  assert.match(ibanShapeProblem('GB29-NWBK'), /not a letter or a digit/);
  assert.match(ibanShapeProblem('1229NWBK'), /two letters of a country/);
  assert.match(ibanShapeProblem('GBX9NWBK'), /no two check digits/);
  assert.match(ibanShapeProblem('GB29'), /no account part/);
  assert.match(ibanShapeProblem(`GB29${'1'.repeat(31)}`), /35 characters, more than the 34/);
});

test('the table of the registry: lengths, the territories under a prefix, and coveredBy', () => {
  assert.equal(IBAN_FORMATS.length, 89);
  assert.equal(ibanFormat('NO').length, 15);
  assert.equal(ibanFormat('LC').length, 32);
  assert.equal(ibanFormat('US'), null);
  assert.deepEqual(ibanFormat('GB').includes, ['IM', 'JE', 'GG']);
  assert.ok(coveredBy('GB', 'JE'));
  assert.ok(coveredBy('FI', 'AX'));
  assert.ok(coveredBy('FR', 'RE'));
  assert.ok(coveredBy('DE', 'DE'));
  assert.ok(!coveredBy('DE', 'AT'));
  assert.ok(!coveredBy('US', 'GB'));
});

test('bicShapeProblem: 8 or 11 characters of ISO 9362, with near misses', () => {
  for (const ok of ['EXMPDEFF', 'EXMPDEFFXXX', 'EX12GB2L', '1234GB2L', 'EXMPGB2L500']) assert.equal(bicShapeProblem(ok), null, ok);
  assert.match(bicShapeProblem('EXMPDEF'), /7 characters, not 8 or 11/);
  assert.match(bicShapeProblem('EXMPDEFFXX'), /10 characters/);
  assert.match(bicShapeProblem('EXMP GB2L'), /9 characters/);
  assert.match(bicShapeProblem('exmpdeff'), /small letter/);
  assert.match(bicShapeProblem('EXMP-EFF'), /not a letter or a digit/);
  assert.match(bicShapeProblem('EXMP12FF'), /"12" in the place of the country code/);
});

test('currencies: the codes of ISO 4217 with their minor units, and texts that are not one', () => {
  assert.ok(CURRENCIES.length > 170);
  assert.equal(minorUnitOf('EUR'), 2);
  assert.equal(minorUnitOf('JPY'), 0);
  assert.equal(minorUnitOf('KWD'), 3);
  assert.equal(minorUnitOf('CLF'), 4);
  assert.equal(minorUnitOf('XAU'), null);
  assert.equal(minorUnitOf('EUX'), undefined);
  assert.ok(isCurrency('USD'));
  for (const no of ['usd', 'US', 'EURO', 'EUX', '', 'constructor', '__proto__']) assert.ok(!isCurrency(no), no);
});

test('countries: the alpha-2 codes of the UN table and the prefixes of the registry, in capitals', () => {
  assert.equal(UN_CODES.length, 248);
  assert.equal(new Set(UN_CODES).size, UN_CODES.length);
  assert.ok(isCountry('GB'));
  assert.ok(isCountry('XK'), 'a prefix of the registry');
  assert.ok(!UN_CODES.includes('XK'));
  for (const no of ['UK', 'gb', 'TW', 'EU', 'G', 'GBR', '', 'constructor']) assert.ok(!isCountry(no), no);
  assert.equal(COUNTRY_CODES.length, 249);
  assert.deepEqual([...COUNTRY_CODES].sort(), COUNTRY_CODES);
});
