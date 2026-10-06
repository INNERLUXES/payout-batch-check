// The checks on a batch that was read: for each payment its beneficiary, its country, its account and bank or its
// network, token and wallet, its currency, its amount and its rate; then the payments against each other for ids written
// twice and payments that look like one paid twice; then the totals of the batch against the sum of its rows. Each
// finding names the line of the field it is about.

import { addDecimal, compareDecimal, formatDecimal, placesOf, ZERO } from './decimal.js';
import { bicShapeProblem, coveredBy, electronicIban, ibanFormat, ibanRemainder, ibanShapeProblem } from './banking.js';
import { isCountry } from './countries.js';
import { isCurrency, minorUnitOf } from './currencies.js';
import { DEFAULT_TOKENS, NETWORKS, WALLET_FORMS, pairKnown, walletProblem } from './networks.js';
import { BEST } from './rules.js';
import { grouped, listText } from './size.js';

const BP = `This is ${BEST}.`;
const at = (e) => ({ line: e.line, column: e.column });
const shown = (text, max = 60) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

// The fewest letters or digits a beneficiary name may have before it is reported as short.
export const MIN_NAME_LETTERS = 3;

// The number of letters and digits of a name, in any script.
export const nameLetters = (name) => (name.match(/[\p{L}\p{N}]/gu) ?? []).length;

// The unit a payment is counted in: the currency of a bank payment, the token of a stablecoin payment, in capitals.
export function unitOf(p) {
  if (p.rail === 'bank') return p.currency === null ? null : p.currency.toUpperCase();
  if (p.rail === 'stablecoin') return p.token === null ? null : p.token.toUpperCase();
  return null;
}

// The account a payment goes to, as one text, so that two payments to one account can be found: the IBAN in electronic
// form, the account number with the BIC, or the network with the wallet address (in small letters on an EVM network,
// where case does not change the address).
export function accountOf(p) {
  if (p.rail === 'bank') {
    if (p.iban !== null) return `iban:${electronicIban(p.iban)}`;
    if (p.accountNumber !== null) return `account:${p.accountNumber.replace(/\s+/g, '')}@${(p.bic ?? '').toUpperCase()}`;
    return null;
  }
  if (p.rail === 'stablecoin' && p.walletAddress !== null && p.network !== null) {
    const net = p.network.known;
    const address = net && net.family === 'evm' ? p.walletAddress.toLowerCase() : p.walletAddress;
    return `wallet:${net ? net.id : p.network.text.toLowerCase()}:${address}`;
  }
  return null;
}

// The largest amount for a unit: the limit given for the unit, or the one given for every unit, or null.
export const maxFor = (maxAmount, unit) => maxAmount.byUnit.find(([u]) => u === unit)?.[1] ?? maxAmount.all;

// The checks of a batch: { findings, notes, rows }. rows holds the totals of each currency or token as the table of the
// report shows them.
export function analyzeBatch(read, { tokens = DEFAULT_TOKENS, maxAmount = { all: null, byUnit: [] } } = {}) {
  const findings = [];
  const notes = [];
  const add = (id, where, message, entry = null) => findings.push({ id, line: where.line, column: where.column, message, entry });
  const { batch, payments } = read;
  const allowed = tokens.map((t) => t.toUpperCase());
  const outsideRegistry = new Set();

  // The debit currency of the batch.
  if (batch && batch.debitCurrency !== null && !isCurrency(batch.debitCurrency)) {
    add('currency-unknown', at(batch.debitEntry), `The debitCurrency of the batch is "${shown(batch.debitCurrency)}", which is not an alphabetic code of the ISO 4217 list SIX keeps. ${batch.debitCurrency.length === 3 && isCurrency(batch.debitCurrency.toUpperCase()) ? 'Write the code in capitals.' : 'A bank refuses a payment in a currency it does not know.'}`);
  }

  for (const p of payments) {
    const of = `payment ${p.title}`;
    const Of = `Payment ${p.title}`;

    // The beneficiary.
    if (p.name === null) {
      if (!p.nameInvalid) add('beneficiary-name-missing', p.nameEntry ? at(p.nameEntry) : p, `${Of} has no beneficiaryName, so the payment cannot be screened against sanctions lists and the bank of the beneficiary cannot match it to the account holder. ${BP}`, p.title);
    } else if (nameLetters(p.name) < MIN_NAME_LETTERS) {
      add('beneficiary-name-short', at(p.nameEntry), `The beneficiaryName of ${of} is "${shown(p.name)}", with fewer than ${MIN_NAME_LETTERS} letters, too short to screen against sanctions lists or to match to the account holder. ${BP}`, p.title);
    }
    const countryOk = p.country !== null && isCountry(p.country);
    if (p.country !== null && !countryOk) {
      const hint = p.country === 'UK' ? ' The code of the United Kingdom is GB.' : isCountry(p.country.toUpperCase()) ? ' Write the code in capitals.' : p.country === 'TW' ? ' The UN table the tool reads lists no code for Taiwan; check the code by hand.' : '';
      add('country-invalid', at(p.countryEntry), `The beneficiaryCountry of ${of} is "${shown(p.country)}", which is not a two-letter code of the country table the tool reads (the ISO alpha-2 codes of the UN M49 table).${hint}`, p.title);
    }

    // The amount.
    const unit = unitOf(p);
    if (p.amount !== null) {
      const a = p.amount;
      if (a.state === 'nan') add('amount-invalid', at(p.amountEntry), `The amount of ${of} is "${shown(a.text)}", which is not a plain decimal number such as 1500.00: no sign, exponent, currency sign or thousands separator. ${BP}`, p.title);
      else if (a.state === 'negative') add('amount-invalid', at(p.amountEntry), `The amount of ${of} is negative (${shown(a.text)}); a payout pays out, and a reversal or a fee belongs in a file of its own. ${BP}`, p.title);
      else if (a.state === 'zero') add('amount-invalid', at(p.amountEntry), `The amount of ${of} is 0; a payment of nothing is refused by a bank or a chain, or hides a row that lost its amount. ${BP}`, p.title);
      else if (unit !== null) {
        const max = maxFor(maxAmount, unit);
        if (max && compareDecimal(a.value, max) > 0) add('amount-above-max', at(p.amountEntry), `The amount of ${of}, ${formatDecimal(a.value)} ${shown(unit, 12)}, is above the --max-amount limit of ${formatDecimal(max)}; a payment that large needs a second look before the batch is sent. ${BP}`, p.title);
      }
    }

    if (p.rail === 'bank') {
      // The currency, its minor unit and the rate.
      const cur = p.currency;
      const curOk = cur !== null && isCurrency(cur);
      if (cur !== null && !curOk) add('currency-unknown', at(p.currencyEntry), `The currency of ${of} is "${shown(cur)}", which is not an alphabetic code of the ISO 4217 list SIX keeps. ${cur.length === 3 && isCurrency(cur.toUpperCase()) ? 'Write the code in capitals.' : 'A bank refuses a payment in a currency it does not know.'}`, p.title);
      if (curOk && p.amount?.state === 'ok') {
        const minor = minorUnitOf(cur);
        const places = placesOf(p.amount.value);
        if (minor !== null && places > minor) add('amount-decimals', at(p.amountEntry), `The amount of ${of} is ${shown(p.amount.text)} ${cur}, with ${places} decimal ${places === 1 ? 'place' : 'places'}, but the ISO 4217 list gives ${cur} a minor unit of ${minor}: ${minor === 0 ? 'it has no fractions' : `it has ${minor} decimal ${minor === 1 ? 'place' : 'places'}`}. A bank refuses the amount or rounds it.`, p.title);
      }
      const src = p.sourceCurrency;
      if (src !== null && !isCurrency(src)) add('currency-unknown', at(p.sourceCurrencyEntry), `The sourceCurrency of ${of} is "${shown(src)}", which is not an alphabetic code of the ISO 4217 list SIX keeps.`, p.title);
      const from = src ?? batch?.debitCurrency ?? null;
      if (curOk && from !== null && isCurrency(from) && from !== cur && p.fxRate === null && !p.fxEntry) {
        add('fx-rate-missing', at(p.currencyEntry), `${Of} is paid in ${cur} from ${from}${src === null ? ', the debitCurrency of the batch,' : ''} and gives no fxRate, so the amount debited is not known until the bank converts it. ${BP}`, p.title);
      }

      // The IBAN.
      let ibanCountry = null;
      if (p.iban !== null) {
        const iban = electronicIban(p.iban);
        const problem = ibanShapeProblem(iban);
        if (problem) add('iban-checksum', at(p.ibanEntry), `The iban of ${of}, "${shown(p.iban)}", ${problem}, so it is not an IBAN of ISO 13616 and its check digits cannot be checked.`, p.title);
        else {
          ibanCountry = iban.slice(0, 2);
          const r = ibanRemainder(iban);
          if (r !== 1) add('iban-checksum', at(p.ibanEntry), `The iban of ${of}, ${shown(iban, 40)}, fails the check of ISO 13616: the remainder of MOD 97-10 is ${r}, not 1, so a character is wrong or two are swapped. A bank may return or reject the payment.`, p.title);
          const format = ibanFormat(ibanCountry);
          if (format && iban.length !== format.length) add('iban-length', at(p.ibanEntry), `The iban of ${of} has ${iban.length} characters, but the IBAN registry of Swift gives ${ibanCountry} IBANs ${format.length}.`, p.title);
          if (!format) outsideRegistry.add(ibanCountry);
          if (countryOk && !coveredBy(ibanCountry, p.country)) add('iban-country-mismatch', at(p.ibanEntry), `The iban of ${of} is an account in ${ibanCountry}, but the beneficiaryCountry is ${p.country}. Either can be right, as a beneficiary may bank abroad, but a wrong country is also how a payment reaches the wrong account. ${BP}`, p.title);
        }
      }

      // The BIC.
      if (p.bic !== null) {
        const problem = bicShapeProblem(p.bic);
        const bicCountry = problem ? null : p.bic.slice(4, 6);
        if (problem) add('bic-format', at(p.bicEntry), `The bic of ${of}, "${shown(p.bic)}", ${problem}. A BIC of ISO 9362 is four letters or digits, two letters of a country, two letters or digits, and an optional branch code of three.`, p.title);
        else if (!isCountry(bicCountry)) add('bic-format', at(p.bicEntry), `The bic of ${of}, ${p.bic}, has the country letters ${bicCountry}, which are not a country code of ISO 3166-1 in the table the tool reads.`, p.title);
        else if (countryOk && !coveredBy(bicCountry, p.country)) add('bic-country-mismatch', at(p.bicEntry), `The bic of ${of}, ${p.bic}, is of a bank in ${bicCountry}, but the beneficiaryCountry is ${p.country}${ibanCountry && ibanCountry !== bicCountry ? ` and the iban is in ${ibanCountry}` : ''}. ${BP}`, p.title);
      }
    }

    if (p.rail === 'stablecoin') {
      const net = p.network?.known ?? null;
      const token = p.token === null ? null : p.token.toUpperCase();
      if (p.network !== null && !net) add('network-token-unknown', at(p.networkEntry), `The network "${shown(p.network.text)}" of ${of} is not in the tool's table (${NETWORKS.map((n) => n.id).join(', ')}), so the form of its wallet address and the tokens on it were not judged. ${BP}`, p.title);
      if (token !== null && !allowed.includes(token)) add('token-not-allowed', at(p.tokenEntry), `${Of} pays in ${shown(p.token, 20)}, which is not in the list of tokens the batch may pay in (${listText(allowed, 8)}; --tokens sets another). ${BP}`, p.title);
      else if (token !== null && net && !pairKnown(token, net)) add('network-token-unknown', at(p.tokenEntry), `${Of} pays in ${token} on ${net.title}, a pair the tool's table does not list, so the token may be a bridged copy or not exist on the network. Check the token contract of the issuer by hand. ${BP}`, p.title);
      if (net && p.walletAddress !== null) {
        const problem = walletProblem(net.family, p.walletAddress);
        if (problem) add('wallet-address-malformed', at(p.walletAddressEntry), `The walletAddress of ${of} on ${net.title}, "${shown(p.walletAddress)}", ${problem}; an address on ${net.title} is ${WALLET_FORMS[net.family]}. A payment to it fails, or goes to an address no one holds.`, p.title);
      }
    }
  }

  // Ids written twice, and payments that look like one paid twice.
  const ids = new Map();
  const paid = new Map();
  for (const p of payments) {
    if (p.id !== null) {
      const key = p.id.toLowerCase();
      const first = ids.get(key);
      if (first) add('payment-id-duplicate', at(p.idEntry), `The paymentId ${shown(p.id)} is also the id of the payment at line ${first.line}; a bank or a payout provider refuses the second, or pays both when it takes the id for a new instruction. ${BP}`, p.title);
      else ids.set(key, p);
    }
    const account = accountOf(p);
    const unit = unitOf(p);
    if (account !== null && unit !== null && p.amount?.state === 'ok') {
      const key = `${account}|${unit}|${formatDecimal(p.amount.value)}`;
      const first = paid.get(key);
      if (first) add('payment-possible-duplicate', at(p.amountEntry), `Payment ${p.title} pays ${formatDecimal(p.amount.value)} ${shown(unit, 12)} to the same account as payment ${first.title} at line ${first.line}, for the same amount. It may be one payment written twice. ${BP}`, p.title);
      else paid.set(key, p);
    }
  }

  // The totals of the batch against the sum of its rows, for each currency or token.
  const sums = new Map();
  for (const p of payments) {
    const unit = unitOf(p);
    if (unit === null) continue;
    const s = sums.get(unit) ?? { unit, count: 0, sum: ZERO, unread: 0 };
    s.count += 1;
    if (p.amount?.state === 'ok' || p.amount?.state === 'zero') s.sum = addDecimal(s.sum, p.amount.value);
    else s.unread += 1;
    sums.set(unit, s);
  }
  const rows = [];
  const totals = batch?.totals ?? null;
  if (totals === null) {
    notes.push('the batch gives no totals, so batch-total-mismatch had nothing to compare');
    for (const s of sums.values()) rows.push({ unit: s.unit, payments: s.count, sum: formatDecimal(s.sum), total: null, state: s.unread ? `${grouped(s.unread)} not read` : 'no total given' });
  } else {
    for (const t of totals) {
      const s = sums.get(t.unit) ?? { unit: t.unit, count: 0, sum: ZERO, unread: 0 };
      if (s.unread) {
        notes.push(`the total for ${shown(t.unit, 12)} was not compared, because the amount of ${s.unread === 1 ? 'one of its payments' : `${grouped(s.unread)} of its payments`} could not be read`);
        rows.push({ unit: t.unit, payments: s.count, sum: formatDecimal(s.sum), total: formatDecimal(t.value), state: `${grouped(s.unread)} not read` });
        continue;
      }
      const same = compareDecimal(s.sum, t.value) === 0;
      if (!same) add('batch-total-mismatch', at(t.entry), `The batch gives a total of ${formatDecimal(t.value)} ${shown(t.unit, 12)}, but its ${s.count === 1 ? 'payment' : `${grouped(s.count)} payments`} in ${shown(t.unit, 12)} add up to ${formatDecimal(s.sum)}. A batch whose control total is off is refused by the bank, or a row was added or lost on the way. ${BP}`);
      rows.push({ unit: t.unit, payments: s.count, sum: formatDecimal(s.sum), total: formatDecimal(t.value), state: same ? 'matches' : 'differs' });
    }
    for (const s of sums.values()) {
      if (totals.some((t) => t.unit === s.unit)) continue;
      if (s.unread) {
        notes.push(`the batch gives no total for ${shown(s.unit, 12)}, and the amount of ${s.unread === 1 ? 'one of its payments' : `${grouped(s.unread)} of its payments`} could not be read, so the rows were not summed`);
        rows.push({ unit: s.unit, payments: s.count, sum: formatDecimal(s.sum), total: null, state: `${grouped(s.unread)} not read` });
        continue;
      }
      add('batch-total-mismatch', at(batch.totalsEntry), `The batch has ${s.count === 1 ? `a payment of ${formatDecimal(s.sum)} ${shown(s.unit, 12)}` : `${grouped(s.count)} payments in ${shown(s.unit, 12)} that add up to ${formatDecimal(s.sum)}`}, but its totals give none for ${shown(s.unit, 12)}, so a bank that checks the totals of the batch refuses it. ${BP}`);
      rows.push({ unit: s.unit, payments: s.count, sum: formatDecimal(s.sum), total: null, state: 'no total given' });
    }
  }
  if (outsideRegistry.size) notes.push(`the IBAN registry the tool reads has no format for ${listText([...outsideRegistry].sort(), 8)}, so only the check digits of an iban of ${outsideRegistry.size === 1 ? 'that country' : 'those countries'} were checked`);
  return { findings, notes, rows };
}
