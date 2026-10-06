// Reading a payout batch from the nodes of the JSON reader, or from the nodes src/csv.js builds from a CSV table. Every
// field is read with the line and column of its key or cell, so a finding can point at it. A field that is missing, of
// the wrong type, unknown or not taken by the rail of its payment is a finding of its own, and its value is left out of
// the checks that need it; nothing that was not read is taken for a value that is fine. Keys of the file are only
// compared with the names below; no object is built with a key from the file. A value that src/secrets.js marked as a
// seed or a key is left out as if it were not there, and never shown.

import { isArray, isNumber, isObject, isString } from './json.js';
import { parseDecimal } from './decimal.js';
import { networkOf } from './networks.js';

export const BATCH_LIMITS = { maxPayments: 100000 };

export const TOP_KEYS = ['batch', 'payments', 'notes'];
export const BATCH_KEYS = ['id', 'debitCurrency', 'totals', 'notes'];
export const PAYMENT_KEYS = ['paymentId', 'beneficiaryName', 'beneficiaryCountry', 'rail', 'iban', 'accountNumber', 'bic', 'currency', 'amount', 'network', 'token', 'walletAddress', 'purposeCode', 'fxRate', 'sourceCurrency', 'notes'];
// The columns of a CSV file that carry a field of the batch, the same on every row.
export const CSV_BATCH_COLUMNS = ['batchId', 'debitCurrency'];
export const RAILS = ['bank', 'stablecoin'];

// The fields each rail takes besides the ones every payment takes.
const BANK_ONLY = ['iban', 'accountNumber', 'bic', 'currency'];
const CHAIN_ONLY = ['network', 'token', 'walletAddress'];

const where = (e) => ({ line: e.line, column: e.column });

// A text from the file as a message names it: cut at a length, so that a long value does not fill a report.
export const cut = (text, max = 120) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

// A known key that an unknown one is probably meant to be: the same letters in another case or with other separators,
// or one that starts with the other.
export function suggestKey(key, known) {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k.length < 3) return null;
  const flat = (n) => n.toLowerCase();
  return known.find((n) => flat(n) === k) ?? known.find((n) => flat(n).startsWith(k) || k.startsWith(flat(n))) ?? null;
}

export const describe = (node) => (node.secret ? 'a value that is not shown' : node.kind === 'object' ? 'an object' : node.kind === 'array' ? 'a list' : node.kind === 'null' ? 'null' : node.kind === 'boolean' ? `${node.value}` : node.kind === 'number' ? `the number ${node.raw.length > 40 ? `${node.raw.slice(0, 37)}...` : node.raw}` : 'text');

// The text of an amount or a rate: the characters of a JSON number, or a text, with spaces around it left out.
const amountText = (node) => (isNumber(node) ? node.raw : node.value.trim());

// Reads an amount: { state, value, text } with state 'ok', 'zero', 'negative' or 'nan'; never through a floating point
// number.
export function readAmount(text) {
  if (text.startsWith('-') && parseDecimal(text.slice(1))) return { state: 'negative', value: null, text };
  const d = parseDecimal(text);
  if (!d) return { state: 'nan', value: null, text };
  if (d.int === 0n) return { state: 'zero', value: d, text };
  return { state: 'ok', value: d, text };
}

// Reads the batch from the root node of a JSON file, or from the rows of a CSV file: { batch, payments, findings, notes }.
// batch is null when the file holds no batch at all.
export function readBatch(source, limits = BATCH_LIMITS) {
  const findings = [];
  const notes = [];
  const add = (id, at, message, entry = null) => findings.push({ id, line: at.line, column: at.column, message, entry });

  // The entries of an object, with a field-unknown finding for each key that is not in known (unless report is false),
  // and the first entry of each known key in a map. A key that names a seed or a key was reported by src/secrets.js and
  // is passed over.
  function fields(obj, known, label, report = true) {
    const map = new Map();
    for (const e of obj.entries) {
      if (e.secret) continue;
      if (known.includes(e.key)) map.set(e.key, e);
      else if (report) {
        const near = suggestKey(e.key, known);
        add('field-unknown', where(e), `The key "${cut(e.key)}" of ${label} is not one the tool reads, so its value was left out of every check.${near ? ` Did you mean "${near}"?` : ''} The keys of ${label} are ${known.join(', ')}.`);
      }
    }
    return map;
  }

  // A text field: null when it is missing, empty, of another type or marked as a secret; invalid is true when it is there
  // but could not be read, so that it is not reported as missing too. A number is taken as text when
  // numbers is true (a payment id or an account number written as a number).
  function text(map, key, of, numbers = false) {
    const e = map.get(key);
    if (!e) return { value: null, entry: null };
    if (e.value.secret) return { value: null, entry: e, invalid: true };
    if (isNumber(e.value) && numbers) return { value: e.value.raw, entry: e };
    if (!isString(e.value)) {
      add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be text.`);
      return { value: null, entry: e, invalid: true };
    }
    if (e.value.value.trim() === '') return { value: null, entry: e };
    return { value: e.value.value, entry: e };
  }

  // An amount field: { value: the text, entry } with the text of the number or of the string, or null.
  function amount(map, key, of) {
    const e = map.get(key);
    if (!e) return { value: null, entry: null };
    if (e.value.secret) return { value: null, entry: e, invalid: true };
    if (!isNumber(e.value) && !isString(e.value)) {
      add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be a decimal number, written as a number or as text.`);
      return { value: null, entry: e, invalid: true };
    }
    const t = amountText(e.value);
    return { value: t === '' ? null : t, entry: e };
  }

  let root = null;
  let rows = [];
  let batch = { id: null, idEntry: null, debitCurrency: null, debitEntry: null, totals: null, totalsEntry: null };

  if (source.format === 'csv') {
    rows = source.rows;
    // The columns of the header: an unknown column is reported once, at the header.
    for (const h of source.header) {
      if (h.secret) continue;
      if (h.key === '') add('field-invalid', where(h), 'A column of the header has no name, so its cells were left out of every check.');
      else if (!PAYMENT_KEYS.includes(h.key) && !CSV_BATCH_COLUMNS.includes(h.key)) {
        const near = suggestKey(h.key, [...PAYMENT_KEYS, ...CSV_BATCH_COLUMNS]);
        add('field-unknown', where(h), `The column "${cut(h.key)}" is not one the tool reads, so its cells were left out of every check.${near ? ` Did you mean "${near}"?` : ''} The columns are ${[...PAYMENT_KEYS, ...CSV_BATCH_COLUMNS].join(', ')}.`);
      }
    }
    // The columns of the batch: the first value is taken, and a row that gives another is reported.
    for (const [column, key] of [['batchId', 'id'], ['debitCurrency', 'debitCurrency']]) {
      let first = null;
      for (const r of rows) {
        const e = r.entries.find((x) => x.key === column);
        if (!e || e.value.secret) continue;
        const v = e.value.value.trim();
        if (first === null) {
          first = { v, e };
          batch[key] = v;
          batch[key === 'id' ? 'idEntry' : 'debitEntry'] = e;
        } else if (v !== first.v) add('field-invalid', where(e), `The ${column} of this row is "${cut(v)}", but the row at line ${first.e.line} gives "${cut(first.v)}"; a batch has one ${column}, the same on every row.`);
      }
    }
  } else {
    root = source.root;
    if (!isObject(root)) {
      return { batch: null, payments: [], findings: [{ id: 'batch-unreadable', line: root.line, column: root.column, message: `The top level of the file is ${describe(root)}, not an object with the payments of a batch, so nothing was checked.`, entry: null }], notes: ['the batch was not checked, because the file holds no batch object'] };
    }
    const top = fields(root, TOP_KEYS, 'the batch file');
    const be = top.get('batch');
    if (be && !be.value.secret) {
      if (!isObject(be.value)) add('field-invalid', where(be), `The batch is ${describe(be.value)}; it must be an object with ${BATCH_KEYS.join(', ')}.`);
      else {
        const b = fields(be.value, BATCH_KEYS, 'the batch');
        const id = text(b, 'id', 'the batch', true);
        batch.id = id.value === null ? null : id.value.trim();
        batch.idEntry = id.entry;
        const debit = text(b, 'debitCurrency', 'the batch');
        batch.debitCurrency = debit.value === null ? null : debit.value.trim();
        batch.debitEntry = debit.entry;
        const te = b.get('totals');
        if (te && !te.value.secret) {
          if (!isObject(te.value)) add('field-invalid', where(te), `The totals of the batch are ${describe(te.value)}; they must be an object with a total for each currency or token, such as {"EUR": "1500.00"}.`);
          else {
            batch.totalsEntry = te;
            batch.totals = [];
            for (const e of te.value.entries) {
              if (e.secret || e.value.secret) continue;
              const unit = e.key.trim();
              if (!isNumber(e.value) && !isString(e.value)) {
                add('field-invalid', where(e), `The total for ${cut(unit)} is ${describe(e.value)}; it must be a decimal number, written as a number or as text.`);
                continue;
              }
              const a = amount(new Map([[e.key, e]]), e.key, 'the totals');
              if (a.value === null) {
                if (!a.invalid) add('field-invalid', where(e), `The total for ${cut(unit)} is empty; it must be a decimal number.`);
                continue;
              }
              const value = parseDecimal(a.value);
              if (!value) {
                add('field-invalid', where(e), `The total for ${cut(unit)} is "${cut(a.value, 60)}"; it must be a plain decimal number such as 1500.00, with no sign, exponent or separator.`);
                continue;
              }
              if (batch.totals.some((t) => t.unit === unit)) {
                add('field-invalid', where(e), `The totals give ${cut(unit)} twice; the second one was left out.`);
                continue;
              }
              batch.totals.push({ unit, value, entry: e });
            }
          }
        }
      }
    }
    const pe = top.get('payments');
    if (!pe) {
      add('field-missing', where(root), 'The batch file has no payments.');
      return { batch, payments: [], findings, notes: [...notes, 'no payment was read'] };
    }
    if (!isArray(pe.value)) {
      if (!pe.value.secret) add('field-invalid', where(pe), `The payments are ${describe(pe.value)}; they must be a list of objects, one for each payment.`);
      return { batch, payments: [], findings, notes: [...notes, 'no payment was read'] };
    }
    rows = pe.value.items;
  }

  if (rows.length === 0) {
    const at = source.format === 'csv' ? { line: 1, column: 1 } : where(root);
    add('field-missing', at, 'The batch holds no payment.');
  }
  if (rows.length > limits.maxPayments) notes.push(`the batch holds ${rows.length} payments; the tool read the first ${limits.maxPayments} and left the rest out`);

  const payments = [];
  for (const [index, node] of rows.slice(0, limits.maxPayments).entries()) {
    const n = index + 1;
    if (!isObject(node)) {
      if (!node.secret) add('field-invalid', where(node), `Payment ${n} is ${describe(node)}; it must be an object.`);
      continue;
    }
    const map = fields(node, PAYMENT_KEYS, `payment ${n}`, false);
    const idText = text(map, 'paymentId', `payment ${n}`, true);
    const id = idText.value === null ? null : idText.value.trim();
    const title = id === null ? `${n}` : cut(id, 60);
    const of = `payment ${title}`;
    // The keys the tool does not read, named with the id of the payment; a CSV file reports its columns at the header.
    if (source.format !== 'csv') fields(node, PAYMENT_KEYS, of);
    const Of = `Payment ${title}`;
    const p = { index: n, line: node.line, column: node.column, title, id, idEntry: idText.entry };
    if (id === null && !idText.invalid) add('field-missing', where(node), `Payment ${n} has no paymentId, so it cannot be told apart from the other payments of the batch.`, title);

    const name = text(map, 'beneficiaryName', of);
    p.name = name.value === null ? null : name.value.trim();
    p.nameEntry = name.entry;
    p.nameInvalid = Boolean(name.invalid);
    const country = text(map, 'beneficiaryCountry', of);
    p.country = country.value === null ? null : country.value.trim();
    p.countryEntry = country.entry;
    if (p.country === null && !country.invalid) add('field-missing', where(node), `${Of} has no beneficiaryCountry.`, title);

    const rail = text(map, 'rail', of);
    p.rail = null;
    if (rail.value !== null) {
      const r = rail.value.trim().toLowerCase();
      if (RAILS.includes(r)) p.rail = r;
      else add('field-invalid', where(rail.entry), `The rail of ${of} is "${cut(rail.value)}"; it must be bank or stablecoin.`, title);
    } else if (!rail.invalid) add('field-missing', where(node), `${Of} has no rail; it must be bank or stablecoin.`, title);

    const amt = amount(map, 'amount', of);
    p.amountEntry = amt.entry;
    p.amount = amt.value === null ? null : readAmount(amt.value);
    if (amt.value === null && !amt.invalid) add('field-missing', amt.entry ? where(amt.entry) : where(node), `${Of} has no amount.`, title);

    for (const key of ['iban', 'accountNumber', 'bic', 'currency', 'network', 'token', 'walletAddress', 'purposeCode', 'sourceCurrency']) {
      const t = text(map, key, of, key === 'accountNumber');
      p[key] = t.value === null ? null : t.value.trim();
      p[`${key}Entry`] = t.entry;
      p[`${key}Invalid`] = Boolean(t.invalid);
    }
    const fx = amount(map, 'fxRate', of);
    p.fxEntry = fx.entry;
    p.fxRate = null;
    if (fx.value !== null) {
      const d = parseDecimal(fx.value);
      if (!d || d.int === 0n) add('field-invalid', where(fx.entry), `The fxRate of ${of} is "${cut(fx.value, 60)}"; it must be a plain decimal number above 0, such as 0.8571.`, title);
      else p.fxRate = d;
    }
    p.network = p.network === null ? null : { text: p.network, known: networkOf(p.network) };

    // The fields the rail takes.
    if (p.rail === 'bank') {
      for (const key of CHAIN_ONLY) if (p[`${key}Entry`] && p[key] !== null) add('field-invalid', where(p[`${key}Entry`]), `${Of} is a bank payment and takes no ${key}; a payment on a chain is written with rail stablecoin.`, title);
      if (p.currency === null && !p.currencyInvalid) add('field-missing', where(node), `${Of} is a bank payment with no currency.`, title);
      if (p.iban === null && p.accountNumber === null && !p.ibanInvalid && !p.accountNumberInvalid) add('field-missing', where(node), `${Of} is a bank payment with neither an iban nor an accountNumber, so it names no account to pay.`, title);
      else if (p.iban === null && p.bic === null && !p.bicInvalid && !p.ibanInvalid) add('field-missing', where(node), `${Of} is paid to an accountNumber with no bic, so it names no bank to pay through.`, title);
    } else if (p.rail === 'stablecoin') {
      for (const key of BANK_ONLY) if (p[`${key}Entry`] && p[key] !== null) add('field-invalid', where(p[`${key}Entry`]), `${Of} is a stablecoin payment and takes no ${key}; it is paid in its token to a walletAddress.`, title);
      for (const key of CHAIN_ONLY) if (p[key] === null && !p[`${key}Invalid`]) add('field-missing', where(node), `${Of} is a stablecoin payment with no ${key}.`, title);
    }
    payments.push(p);
  }
  return { batch, payments, findings, notes };
}
