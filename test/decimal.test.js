import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECIMAL_LIMITS, DEFAULT_TOKENS, FAMILIES, NETWORKS, TOKENS, WALLET_FORMS, ZERO, addDecimal, compareDecimal, formatDecimal, isZero, networkOf, pairKnown, parseDecimal, placesOf, walletProblem } from '../src/index.js';
import { evm, sol, tron } from './helpers.js';

const d = (raw) => parseDecimal(raw);

test('parseDecimal: plain decimals into a whole number and a scale', () => {
  assert.deepEqual(d('0'), { int: 0n, scale: 0 });
  assert.deepEqual(d('2500'), { int: 2500n, scale: 0 });
  assert.deepEqual(d('0.5'), { int: 5n, scale: 1 });
  assert.deepEqual(d('1.050'), { int: 1050n, scale: 3 });
  assert.deepEqual(d(`${'9'.repeat(40)}.${'1'.repeat(40)}`).scale, 40);
});

test('parseDecimal: a sign, an exponent, a leading zero, a lone point, a separator and too many digits are refused', () => {
  for (const raw of ['-1', '+1', '1e3', '1E-2', '01', '00.5', '.5', '5.', '', ' 1', '1,000', '1 000', '1.000,50', `1${'0'.repeat(40)}`, `0.${'1'.repeat(41)}`, '0x10', 'NaN', 'Infinity', 'EUR 10']) assert.equal(parseDecimal(raw), null, raw);
  assert.equal(DECIMAL_LIMITS.maxDigits, 40);
});

test('compareDecimal: compares as written, across scales, with no floating point', () => {
  assert.equal(compareDecimal(d('1000'), d('1000.000')), 0);
  assert.equal(compareDecimal(d('999.99'), d('1000')), -1);
  assert.equal(compareDecimal(d('1000.000000000000000001'), d('1000')), 1, 'a difference a double would lose');
  assert.equal(compareDecimal(d('30'), d('5')), 1);
});

test('addDecimal: exact sums across scales, where a floating point number would not be', () => {
  assert.equal(formatDecimal(addDecimal(d('0.1'), d('0.2'))), '0.3');
  assert.equal(0.1 + 0.2 === 0.3, false, 'the reason the sums are made with BigInt');
  assert.equal(formatDecimal(addDecimal(d('1500.00'), d('820.005'))), '2320.005');
  assert.equal(compareDecimal(addDecimal(ZERO, d('5')), d('5.0')), 0);
  assert.equal(formatDecimal(addDecimal(d(`9${'0'.repeat(30)}`), d('0.000000000000000001'))), `9${'0'.repeat(30)}.000000000000000001`);
});

test('placesOf, formatDecimal and isZero: the places a value needs and its shortest form', () => {
  assert.equal(placesOf(d('1500.50')), 1);
  assert.equal(placesOf(d('1500.00')), 0);
  assert.equal(placesOf(d('250.125')), 3);
  assert.equal(placesOf(d('0.0001')), 4);
  assert.equal(placesOf(d('7')), 0);
  assert.equal(formatDecimal(d('1.050')), '1.05');
  assert.equal(formatDecimal(d('1.000')), '1');
  assert.equal(formatDecimal(d('0.01')), '0.01');
  assert.equal(formatDecimal(d('0.000')), '0');
  assert.ok(isZero(d('0.00')));
  assert.ok(!isZero(d('0.01')));
});

test('networkOf: by id or alias, in any case and with outer spaces; a network out of the table is null', () => {
  assert.equal(networkOf('Ethereum').id, 'ethereum');
  assert.equal(networkOf(' erc20 ').id, 'ethereum');
  assert.equal(networkOf('matic').id, 'polygon');
  assert.equal(networkOf('SOL').family, 'solana');
  assert.equal(networkOf('TRC20').family, 'tron');
  assert.equal(networkOf('litecoin'), null);
  assert.equal(networkOf('toString'), null);
});

test('the table of networks and tokens: unique names, a family each, every token on networks of the table', () => {
  const names = NETWORKS.flatMap((n) => [n.id, ...n.aliases]);
  assert.equal(new Set(names).size, names.length);
  for (const n of NETWORKS) assert.ok(FAMILIES.includes(n.family), n.id);
  for (const t of TOKENS) for (const id of t.networks) assert.ok(networkOf(id), `${t.symbol} on ${id}`);
  assert.deepEqual(DEFAULT_TOKENS, ['USDC', 'USDT']);
  assert.ok(pairKnown('USDC', networkOf('base')));
  assert.ok(pairKnown('USDT', networkOf('tron')));
  assert.ok(!pairKnown('USDT', networkOf('base')));
  assert.ok(!pairKnown('DAI', networkOf('ethereum')));
  for (const f of FAMILIES) assert.ok(WALLET_FORMS[f], f);
});

test('walletProblem: the form of an address on an EVM network, with near misses', () => {
  assert.equal(walletProblem('evm', evm('a')), null);
  assert.equal(walletProblem('evm', `0x${'Ab'.repeat(20)}`), null, 'mixed case is a form, the checksum is not checked');
  assert.match(walletProblem('evm', '1x'.padEnd(42, '1')), /does not start with 0x/);
  assert.match(walletProblem('evm', '0x1234'), /has 4 characters after 0x, not 40/);
  assert.match(walletProblem('evm', evm('1').slice(0, 41)), /39 characters/);
  assert.match(walletProblem('evm', `0x${'g'.repeat(40)}`), /not a hex digit/);
  assert.match(walletProblem('evm', evm('0')), /zero address/);
  assert.match(walletProblem('evm', ` ${evm()}`), /spaces around it/);
});

test('walletProblem: Solana takes 32 to 44 base58 characters, and Tron T and 33 more', () => {
  assert.equal(walletProblem('solana', sol('G', 32)), null);
  assert.equal(walletProblem('solana', sol('G', 44)), null);
  assert.match(walletProblem('solana', sol('G', 31)), /31 characters, not 32 to 44/);
  assert.match(walletProblem('solana', sol('G', 45)), /45 characters/);
  assert.match(walletProblem('solana', sol('0', 40)), /base58 does not use/);
  assert.match(walletProblem('solana', evm()), /base58 does not use/);
  assert.equal(walletProblem('tron', tron()), null);
  assert.match(walletProblem('tron', `A${'H'.repeat(33)}`), /does not start with T/);
  assert.match(walletProblem('tron', `T${'H'.repeat(32)}`), /33 characters, not 34/);
  assert.match(walletProblem('tron', `T${'O'.repeat(33)}`), /base58 does not use/);
});
