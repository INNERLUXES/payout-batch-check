import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEST, MIN_NAME_LETTERS, RULES, accountOf, atOrAbove, checkText, decide, maxFor, nameLetters, parseDecimal, ruleById, unitOf } from '../src/index.js';
import { IBAN, PAYMENTS, bank, batch, batchText, coin, evm, ibanOf, lineOf, ofCheck, sol, tron, withPayment } from './helpers.js';

const one = (p, id, options) => ofCheck(withPayment(p), id, options);

test('the rules: unique ids, a level and a kind each, a fix, and the best practice checks say so', () => {
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  assert.equal(RULES.length, 25);
  for (const r of RULES) {
    assert.ok(['error', 'warning', 'info'].includes(r.severity), r.id);
    assert.ok(['documented', 'best practice', 'input'].includes(r.kind), r.id);
    assert.ok(r.fix.length > 20 && r.summary.length > 20, r.id);
    if (r.kind === 'best practice') assert.ok(r.own.includes(BEST), r.id);
  }
  assert.equal(ruleById('iban-checksum').severity, 'error');
  assert.equal(ruleById('nope'), undefined);
});

test('decide and atOrAbove: the result of a run from the counts by level', () => {
  assert.ok(atOrAbove('error', 'warning'));
  assert.ok(!atOrAbove('info', 'warning'));
  assert.deepEqual(decide({ error: 0, warning: 2, info: 0 }, 'error'), { pass: true, failOn: 'error', text: 'PASS - no finding at or above error (2 warning)' });
  assert.equal(decide({ error: 1, warning: 2, info: 0 }, 'warning').text, 'FAIL - 3 findings at or above warning (1 error, 2 warning)');
  assert.equal(decide({}, 'info').text, 'PASS - no finding at or above info');
});

test('iban-checksum: a changed digit, a swapped pair and a malformed IBAN, at the line of the iban; the right one and its print form pass', () => {
  const b = withPayment(bank({ paymentId: 'X', iban: 'DE89370400440532013001' }));
  const f = ofCheck(b, 'iban-checksum');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(batchText(b), '"DE89370400440532013001"'));
  assert.match(f[0].message, /^The iban of payment X, DE89370400440532013001, fails the check of ISO 13616: the remainder of MOD 97-10 is \d+, not 1/);
  assert.equal(one(bank({ iban: 'DE89370400440532010300' }), 'iban-checksum').length, 1);
  assert.match(one(bank({ iban: 'DE89-3704' }), 'iban-checksum')[0].message, /holds a character that is not a letter or a digit, so it is not an IBAN of ISO 13616/);
  assert.match(one(bank({ iban: '12345' }), 'iban-checksum')[0].message, /does not start with two letters/);
  assert.deepEqual(one(bank({ iban: 'DE89 3704 0044 0532 0130 00' }), 'iban-checksum'), []);
  assert.deepEqual(one(bank({ iban: 'de89370400440532013000' }), 'iban-checksum'), [], 'small letters are read as capitals');
  for (const [country, iban] of Object.entries(IBAN)) assert.deepEqual(one(bank({ beneficiaryCountry: country, iban, bic: undefined, currency: 'EUR' }), 'iban-checksum'), [], iban);
});

test('iban-length: the length of the registry for the country, with a near miss on each side; a country out of the registry is a note', () => {
  const short = ibanOf('NL', 'ABNA041716430');
  const f = one(bank({ paymentId: 'X', beneficiaryCountry: 'NL', iban: short, bic: undefined }), 'iban-length');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /^The iban of payment X has 17 characters, but the IBAN registry of Swift gives NL IBANs 18\.$/);
  assert.equal(one(bank({ beneficiaryCountry: 'NL', iban: ibanOf('NL', 'ABNA04171643000'), bic: undefined }), 'iban-length').length, 1, 'one too many');
  assert.deepEqual(one(bank({ beneficiaryCountry: 'NL', iban: IBAN.NL, bic: undefined }), 'iban-length'), []);
  const us = checkText(batchText(withPayment(bank({ paymentId: 'X', beneficiaryCountry: 'US', iban: ibanOf('US', '12345678'), bic: undefined }))));
  assert.deepEqual(us.findings.map((x) => x.id), []);
  assert.ok(us.notes.includes('the IBAN registry the tool reads has no format for US, so only the check digits of an iban of that country were checked'));
});

test('iban-country-mismatch: an IBAN of another country than the beneficiary, but not a territory the registry lists under the prefix', () => {
  const f = one(bank({ paymentId: 'X', beneficiaryCountry: 'AT', iban: IBAN.BE, bic: undefined }), 'iban-country-mismatch');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /^The iban of payment X is an account in BE, but the beneficiaryCountry is AT\./);
  assert.match(f[0].message, /a best practice of this tool/);
  assert.deepEqual(one(bank({ beneficiaryCountry: 'JE', iban: IBAN.GB, bic: undefined }), 'iban-country-mismatch'), [], 'Jersey is listed under GB');
  assert.deepEqual(one(bank({ beneficiaryCountry: 'BE', iban: IBAN.BE, bic: undefined }), 'iban-country-mismatch'), []);
  assert.deepEqual(one(bank({ beneficiaryCountry: 'UK', iban: IBAN.BE, bic: undefined }), 'iban-country-mismatch'), [], 'a country that is not a code is reported as such, not compared');
});

test('bic-format: 8 or 11 characters of ISO 9362, in capitals, with known country letters, at the line of the bic', () => {
  const b = withPayment(bank({ paymentId: 'X', bic: 'EXMP DEFF' }));
  const f = ofCheck(b, 'bic-format');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(batchText(b), '"EXMP DEFF"'));
  assert.match(f[0].message, /^The bic of payment X, "EXMP DEFF", has 9 characters, not 8 or 11\./);
  assert.match(one(bank({ bic: 'exmpdeff' }), 'bic-format')[0].message, /small letter/);
  assert.match(one(bank({ bic: 'EXMPZZFF' }), 'bic-format')[0].message, /has the country letters ZZ, which are not a country code of ISO 3166-1/);
  assert.match(one(bank({ bic: 'EXMP12FF' }), 'bic-format')[0].message, /"12" in the place of the country code/);
  for (const ok of ['EXMPDEFF', 'EXMPDEFFXXX', 'EX12DE2L']) assert.deepEqual(one(bank({ bic: ok }), 'bic-format'), [], ok);
});

test('bic-country-mismatch: a BIC of another country than the beneficiary, with territories of the registry allowed', () => {
  const f = one(bank({ paymentId: 'X', beneficiaryCountry: 'DE', bic: 'EXMPATWW' }), 'bic-country-mismatch');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /^The bic of payment X, EXMPATWW, is of a bank in AT, but the beneficiaryCountry is DE and the iban is in DE\./);
  assert.match(one(bank({ beneficiaryCountry: 'US', iban: undefined, accountNumber: '1', bic: 'EXMPGB2L' }), 'bic-country-mismatch')[0].message, /is of a bank in GB, but the beneficiaryCountry is US\. /);
  assert.deepEqual(one(bank({ beneficiaryCountry: 'JE', iban: IBAN.GB, bic: 'EXMPGB2L' }), 'bic-country-mismatch'), []);
  assert.deepEqual(one(bank(), 'bic-country-mismatch'), []);
});

test('currency-unknown: a code out of ISO 4217, in a payment, as a source currency and as the debit currency', () => {
  const f = one(bank({ paymentId: 'X', currency: 'EUX' }), 'currency-unknown');
  assert.match(f[0].message, /^The currency of payment X is "EUX", which is not an alphabetic code of the ISO 4217 list SIX keeps\. A bank refuses/);
  assert.match(one(bank({ currency: 'eur' }), 'currency-unknown')[0].message, /Write the code in capitals\./);
  assert.match(one(bank({ sourceCurrency: 'USX', fxRate: '1.1' }), 'currency-unknown')[0].message, /^The sourceCurrency of payment B-1 is "USX"/);
  assert.match(ofCheck(batch({ debitCurrency: 'EURO' }), 'currency-unknown')[0].message, /^The debitCurrency of the batch is "EURO"/);
  assert.deepEqual(one(bank({ currency: 'XAU', amount: '1.123' }), 'currency-unknown'), []);
  assert.deepEqual(one(coin({ token: 'USDC' }), 'currency-unknown'), [], 'a token is not a currency of ISO 4217');
});

test('amount-decimals: more places than the minor unit of the currency, with near misses on each side', () => {
  const f = one(bank({ paymentId: 'X', currency: 'JPY', amount: '150000.50', fxRate: '162.4' }), 'amount-decimals');
  assert.match(f[0].message, /^The amount of payment X is 150000\.50 JPY, with 1 decimal place, but the ISO 4217 list gives JPY a minor unit of 0: it has no fractions\./);
  assert.deepEqual(one(bank({ currency: 'JPY', amount: '150000', fxRate: '162.4' }), 'amount-decimals'), []);
  assert.deepEqual(one(bank({ currency: 'JPY', amount: '150000.00', fxRate: '162.4' }), 'amount-decimals'), [], 'trailing zeros add no value');
  assert.equal(one(bank({ amount: '10.005' }), 'amount-decimals').length, 1);
  assert.deepEqual(one(bank({ currency: 'KWD', amount: '250.125', iban: IBAN.KW, beneficiaryCountry: 'KW', bic: undefined, fxRate: '0.33' }), 'amount-decimals'), []);
  assert.match(one(bank({ currency: 'KWD', amount: '250.1255', iban: IBAN.KW, beneficiaryCountry: 'KW', bic: undefined, fxRate: '0.33' }), 'amount-decimals')[0].message, /minor unit of 3: it has 3 decimal places/);
  assert.deepEqual(one(bank({ currency: 'XAU', amount: '1.12345' }), 'amount-decimals'), [], 'a code with no minor unit');
  assert.deepEqual(one(coin({ amount: '1.1234567' }), 'amount-decimals'), [], 'a token has no minor unit of ISO 4217');
});

test('amount-invalid: 0, a negative amount and what is not a number, with the near miss of the smallest amount', () => {
  assert.match(one(bank({ paymentId: 'X', amount: '0.00' }), 'amount-invalid')[0].message, /^The amount of payment X is 0;/);
  assert.match(one(bank({ paymentId: 'X', amount: '-200.00' }), 'amount-invalid')[0].message, /^The amount of payment X is negative \(-200\.00\)/);
  assert.match(one(bank({ paymentId: 'X', amount: '1,500.00' }), 'amount-invalid')[0].message, /^The amount of payment X is "1,500\.00", which is not a plain decimal number/);
  assert.equal(one(bank({ amount: -5 }), 'amount-invalid').length, 1, 'a JSON number below 0');
  assert.match(one(bank({ paymentId: 'X', amount: 1e21 }), 'amount-invalid')[0].message, /^The amount of payment X is "1e\+21", which is not a plain decimal number/, 'a JSON number is read from its characters, and an exponent is not read');
  assert.equal(checkText(batchText(withPayment(bank({ paymentId: 'X', amount: 10.5 })))).batch.payments[4].amount.text, '10.5');
  assert.deepEqual(one(bank({ amount: '0.01' }), 'amount-invalid'), []);
});

test('amount-above-max: only with --max-amount, for every payment or for one unit, compared as written', () => {
  const p = bank({ paymentId: 'X', amount: '1500.01' });
  assert.deepEqual(one(p, 'amount-above-max'), []);
  const all = { maxAmount: { all: parseDecimal('1500'), byUnit: [] } };
  assert.match(one(p, 'amount-above-max', all)[0].message, /^The amount of payment X, 1500\.01 EUR, is above the --max-amount limit of 1500;/);
  assert.deepEqual(ofCheck(batch({ totals: undefined }), 'amount-above-max', all), [], 'an amount at the limit is not above it');
  const eur = { maxAmount: { all: parseDecimal('5000'), byUnit: [['EUR', parseDecimal('1500')]] } };
  assert.equal(one(p, 'amount-above-max', eur).length, 1, 'the limit of the unit comes before the one for every payment');
  assert.deepEqual(one(bank({ paymentId: 'X', currency: 'GBP', amount: '1500.01', fxRate: '0.85' }), 'amount-above-max', eur), []);
  assert.equal(one(coin({ amount: '5000.5' }), 'amount-above-max', eur).length, 1, 'a token falls back to the limit for every payment');
  assert.equal(maxFor(eur.maxAmount, 'USDC'), eur.maxAmount.all);
});

test('country-invalid: a code out of the table or not in capitals, with hints, and the codes that pass', () => {
  assert.match(one(bank({ paymentId: 'X', beneficiaryCountry: 'UK' }), 'country-invalid')[0].message, /^The beneficiaryCountry of payment X is "UK".*The code of the United Kingdom is GB\.$/);
  assert.match(one(bank({ beneficiaryCountry: 'de' }), 'country-invalid')[0].message, /Write the code in capitals\./);
  assert.match(one(bank({ beneficiaryCountry: 'TW', iban: undefined, accountNumber: '1', bic: 'EXMPTWTP' }), 'country-invalid')[0].message, /lists no code for Taiwan/);
  assert.equal(one(bank({ beneficiaryCountry: 'Germany' }), 'country-invalid').length, 1);
  for (const ok of ['DE', 'XK', 'JE', 'AX']) assert.deepEqual(one(bank({ beneficiaryCountry: ok, iban: undefined, accountNumber: '1', bic: undefined }), 'country-invalid'), [], ok);
});

test('payment-id-duplicate: the second payment with an id, without case and outer spaces, at its line', () => {
  const b = withPayment(bank({ paymentId: ' b-1 ', amount: '5.00' }));
  const f = ofCheck(b, 'payment-id-duplicate');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(batchText(b), '" b-1 "'));
  assert.match(f[0].message, /^The paymentId b-1 is also the id of the payment at line \d+;/);
  assert.deepEqual(ofCheck(withPayment(bank({ paymentId: 'B-1x', amount: '5.00' })), 'payment-id-duplicate'), []);
});

test('payment-possible-duplicate: one account, one amount and one unit; a different amount, unit or account is no finding', () => {
  const f = one(bank({ paymentId: 'X', iban: 'DE89 3704 0044 0532 0130 00', amount: '1500' }), 'payment-possible-duplicate');
  assert.match(f[0].message, /^Payment X pays 1500 EUR to the same account as payment B-1 at line \d+, for the same amount\./);
  assert.deepEqual(one(bank({ paymentId: 'X', amount: '1500.01' }), 'payment-possible-duplicate'), []);
  assert.deepEqual(one(bank({ paymentId: 'X', currency: 'GBP', fxRate: '0.8' }), 'payment-possible-duplicate'), []);
  assert.deepEqual(one(bank({ paymentId: 'X', iban: IBAN.NL, beneficiaryCountry: 'NL', bic: undefined }), 'payment-possible-duplicate'), []);
  const w = coin({ paymentId: 'C-2', network: 'solana', walletAddress: sol() });
  assert.equal(ofCheck(batch({ totals: undefined }, [...PAYMENTS, w]), 'payment-possible-duplicate').length, 1);
  assert.equal(ofCheck(batch({ totals: undefined }, [coin({ walletAddress: evm('a') }), coin({ paymentId: 'C-2', walletAddress: evm('A') })]), 'payment-possible-duplicate').length, 1, 'an EVM address in any case');
  assert.equal(accountOf({ rail: 'bank', iban: null, accountNumber: '12 34', bic: 'exmpdeff' }), 'account:1234@EXMPDEFF');
  assert.equal(accountOf({ rail: null }), null);
  assert.equal(unitOf(coin({ token: 'usdc' })), 'USDC');
});

test('beneficiary-name-missing and beneficiary-name-short: no name, an empty name, and a name of fewer than three letters', () => {
  assert.match(one(bank({ paymentId: 'X', beneficiaryName: undefined }), 'beneficiary-name-missing')[0].message, /^Payment X has no beneficiaryName, so the payment cannot be screened/);
  assert.equal(one(bank({ beneficiaryName: '   ' }), 'beneficiary-name-missing').length, 1);
  assert.match(one(bank({ paymentId: 'X', beneficiaryName: 'Q.' }), 'beneficiary-name-short')[0].message, /^The beneficiaryName of payment X is "Q\.", with fewer than 3 letters/);
  assert.deepEqual(one(bank({ beneficiaryName: 'Abe' }), 'beneficiary-name-short'), []);
  assert.deepEqual(one(bank({ beneficiaryName: '\u674e\u5c0f\u9f99' }), 'beneficiary-name-short'), [], 'letters of any script count');
  assert.equal(nameLetters('A. B-C'), 3);
  assert.equal(MIN_NAME_LETTERS, 3);
});

test('batch-total-mismatch: a total that is not the sum of its rows, a unit with no total, and rows that cannot be summed', () => {
  const b = batch({ totals: { EUR: '2320.01', GBP: '1200', USDC: '750.00' } });
  const f = ofCheck(b, 'batch-total-mismatch');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(batchText(b), '"EUR": "2320.01"'));
  assert.match(f[0].message, /^The batch gives a total of 2320\.01 EUR, but its 2 payments in EUR add up to 2320\./);
  const missing = ofCheck(batch({ totals: { EUR: '2320.00', GBP: '1200.00' } }), 'batch-total-mismatch');
  assert.match(missing[0].message, /^The batch has a payment of 750 USDC, but its totals give none for USDC/);
  const extra = ofCheck(batch({ totals: { EUR: '2320.00', GBP: '1200.00', USDC: '750.00', CHF: '1.00' } }), 'batch-total-mismatch');
  assert.match(extra[0].message, /^The batch gives a total of 1 CHF, but its 0 payments in CHF add up to 0\./);
  const unread = checkText(batchText(batch({}, [...PAYMENTS, bank({ paymentId: 'B-9', amount: 'ten' })])));
  assert.deepEqual(unread.findings.map((x) => x.id), ['amount-invalid']);
  assert.ok(unread.notes.includes('the total for EUR was not compared, because the amount of one of its payments could not be read'));
  assert.deepEqual(ofCheck(batch(), 'batch-total-mismatch'), []);
  assert.ok(checkText(batchText(batch({ totals: undefined }))).notes.includes('the batch gives no totals, so batch-total-mismatch had nothing to compare'));
});

test('wallet-address-malformed: the form of each family, at the line of the address, and never for a network out of the table', () => {
  const b = withPayment(coin({ paymentId: 'X', walletAddress: '0x1234' }));
  const f = ofCheck(b, 'wallet-address-malformed');
  assert.equal(f[0].line, lineOf(batchText(b), '"0x1234"'));
  assert.match(f[0].message, /^The walletAddress of payment X on Ethereum, "0x1234", has 4 characters after 0x, not 40; an address on Ethereum is 0x followed by 40 hex digits/);
  assert.match(one(coin({ network: 'solana', walletAddress: evm() }), 'wallet-address-malformed')[0].message, /on Solana.*base58 does not use/);
  assert.match(one(coin({ network: 'tron', token: 'USDT', walletAddress: evm() }), 'wallet-address-malformed')[0].message, /on Tron.*does not start with T/);
  assert.deepEqual(one(coin({ network: 'tron', token: 'USDT', walletAddress: tron() }), 'wallet-address-malformed'), []);
  assert.deepEqual(one(coin({ network: 'litecoin', walletAddress: 'x' }), 'wallet-address-malformed'), []);
});

test('token-not-allowed: a token out of the list, the default list and --tokens', () => {
  assert.match(one(coin({ paymentId: 'X', token: 'DAI' }), 'token-not-allowed')[0].message, /^Payment X pays in DAI, which is not in the list of tokens the batch may pay in \(USDC and USDT; --tokens sets another\)\./);
  assert.deepEqual(one(coin({ token: 'usdt' }), 'token-not-allowed'), []);
  assert.equal(one(coin({ token: 'USDT' }), 'token-not-allowed', { tokens: ['USDC'] }).length, 1);
  assert.deepEqual(one(coin({ token: 'EURC' }), 'token-not-allowed', { tokens: ['USDC', 'EURC'] }), []);
});

test('network-token-unknown: a network out of the table, and a token the table does not list on its network', () => {
  assert.match(one(coin({ paymentId: 'X', network: 'litecoin' }), 'network-token-unknown')[0].message, /^The network "litecoin" of payment X is not in the tool's table/);
  assert.match(one(coin({ paymentId: 'X', network: 'base', token: 'USDT' }), 'network-token-unknown')[0].message, /^Payment X pays in USDT on Base, a pair the tool's table does not list/);
  assert.deepEqual(one(coin({ network: 'base', token: 'USDC' }), 'network-token-unknown'), []);
  assert.deepEqual(one(coin({ token: 'DAI' }), 'network-token-unknown'), [], 'a token out of the list is reported once, as not allowed');
});

test('fx-rate-missing: a converted bank payment with no rate, from the debit currency or its own source currency', () => {
  assert.match(one(bank({ paymentId: 'X', currency: 'USD' }), 'fx-rate-missing')[0].message, /^Payment X is paid in USD from EUR, the debitCurrency of the batch, and gives no fxRate/);
  assert.match(one(bank({ paymentId: 'X', sourceCurrency: 'GBP' }), 'fx-rate-missing')[0].message, /^Payment X is paid in EUR from GBP and gives no fxRate/);
  assert.deepEqual(one(bank({ currency: 'USD', fxRate: '1.085' }), 'fx-rate-missing'), []);
  assert.deepEqual(one(bank(), 'fx-rate-missing'), []);
  assert.deepEqual(one(bank({ currency: 'USD', sourceCurrency: 'USD' }), 'fx-rate-missing'), [], 'a source currency of its own comes first');
  assert.deepEqual(ofCheck(batch({ debitCurrency: undefined, totals: undefined }, [bank({ currency: 'USD' })]), 'fx-rate-missing'), [], 'no debit currency, nothing to compare');
});
