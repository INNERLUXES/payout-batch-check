// Command line: payout-batch-check <batch.csv|batch.json> [options]

import { readFileSync } from 'node:fs';
import { InputError, LIMITS, checkFile } from './check.js';
import { LEVELS } from './data.js';
import { parseDecimal } from './decimal.js';
import { DEFAULT_TOKENS } from './networks.js';
import { listChecksJson, listChecksMarkdown, listChecksText, toJson, toMarkdown, toSarif, toText } from './report.js';
import { RULES } from './rules.js';
import { safeText } from './text.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

// The most tokens --tokens takes.
export const MAX_TOKENS = 50;

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson, sarif: toSarif };
const LISTS = { text: listChecksText, markdown: listChecksMarkdown, json: listChecksJson };

export const USAGE = `Usage: payout-batch-check <batch.csv|batch.json> [options]

Reads a cross-border payout batch before it is sent, as a CSV table with a header row or as JSON (each row a payment:
its id, the beneficiary name and country, the rail; for a bank payment the IBAN or account number, the BIC, the currency
and the amount; for a stablecoin payment the network, the token, the wallet address and the amount; a purpose code, an
FX rate and a source currency; and the id, debit currency and totals of the batch) and lists the problems that make a
payment fail, come back or reach the wrong account: an IBAN that fails its check digits or has the wrong length for its
country, a BIC not in the form of ISO 9362, a currency that is not in ISO 4217 or an amount with more decimals than its
minor unit, an amount of 0, below 0 or not a number, a country code that is not ISO 3166-1, an IBAN or BIC of another
country than the beneficiary, payment ids written twice and payments that look like one paid twice, a missing or short
beneficiary name, totals that are not the sum of the rows, a wallet address in the wrong form for its network, a token
that is not allowed or not known on its network, and a converted payment with no FX rate. A private key or a seed in the
file is an error whose value is never shown. It reads the file and is not a screening: it contacts no bank, chain or
API, fetches nothing, runs nothing, reads no clock and writes nothing to disk.

Options:
  --format <name>          text, markdown, json or sarif (default: text)
  --json                   the same as --format json
  --min-severity <level>   the lowest level of a finding that is shown: ${LEVELS.join(', ')} (default: info)
  --fail-on <level>        the lowest level of a finding that fails the run: ${LEVELS.join(', ')} (default: error)
  --tokens <list>          the tokens a stablecoin payment may pay in, comma-separated (default: ${DEFAULT_TOKENS.join(',')})
  --max-amount <limit>     the largest amount of one payment: an amount for every payment, such as 50000, or
                           <unit>=<amount> for one currency or token, such as EUR=25000; may be given once for each unit
  --explain                show the points of the pages behind each finding (text, markdown and JSON)
  --list-checks            list the checks with their level and kind, and exit
  --help                   show this text
  --version                show the version

Checks: ${RULES.map((r) => r.id).join(', ')}.

Exit codes: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
`;

const isUrl = (f) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);

// The list of --tokens: symbols of 2 to 12 letters and digits, in capitals, each once.
function tokensOf(flag, value) {
  const list = value.split(',').map((t) => t.trim().toUpperCase());
  if (list.length > MAX_TOKENS || list.some((t) => !/^[A-Z0-9]{2,12}$/.test(t))) throw new Error(`${flag} takes a list of up to ${MAX_TOKENS} token symbols of 2 to 12 letters and digits, separated by commas, such as USDC,USDT`);
  if (new Set(list).size !== list.length) throw new Error(`${flag} names a token twice`);
  return list;
}

// A limit of --max-amount: an amount for every unit, or <unit>=<amount>.
function limitOf(flag, value, current) {
  const m = /^(?:([A-Za-z0-9]{2,12})=)?(.*)$/.exec(value);
  const d = parseDecimal(m[2]);
  if (!d || d.int === 0n) throw new Error(`${flag} takes a plain decimal amount above 0 such as 50000, or <unit>=<amount> such as EUR=25000, with no sign, exponent or separator`);
  const unit = m[1] === undefined ? null : m[1].toUpperCase();
  if (unit === null ? current.all !== null : current.byUnit.some(([u]) => u === unit)) throw new Error(`${flag} was given twice for ${unit ?? 'every payment'}`);
  return { unit, value: d };
}

export function parseArgs(argv) {
  const o = { paths: [], format: null, json: false, minSeverity: null, failOn: null, tokens: null, maxAmount: { all: null, byUnit: [] }, explain: false, listChecks: false, help: false, version: false };
  const once = (name, current, value) => {
    if (current !== null) throw new Error(`${name} was given twice`);
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('--') && v.length > 2)) throw new Error(`${a} needs a value`);
      if (v === '-') throw new Error('reading from standard input is not supported; give a file');
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--explain') o.explain = true;
    else if (a === '--json') o.json = true;
    else if (a === '--list-checks') o.listChecks = true;
    else if (a === '--format') o.format = once(a, o.format, next());
    else if (a === '--min-severity') o.minSeverity = once(a, o.minSeverity, next());
    else if (a === '--fail-on') o.failOn = once(a, o.failOn, next());
    else if (a === '--tokens') o.tokens = once(a, o.tokens, tokensOf(a, next()));
    else if (a === '--max-amount') {
      const l = limitOf(a, next(), o.maxAmount);
      if (l.unit === null) o.maxAmount.all = l.value;
      else o.maxAmount.byUnit.push([l.unit, l.value]);
    } else if (a === '-') throw new Error('reading from standard input is not supported; give a file');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else {
      if (o.paths.length === 1) throw new Error('give one batch file');
      o.paths.push(a);
    }
  }
  if (o.json) {
    if (o.format !== null && o.format !== 'json') throw new Error(`--json and --format ${o.format} ask for two formats; give one`);
    o.format = 'json';
  }
  if (o.format === null) o.format = 'text';
  if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown, json or sarif)`);
  for (const [flag, v] of [['--min-severity', o.minSeverity], ['--fail-on', o.failOn]]) if (v !== null && !LEVELS.includes(v)) throw new Error(`${flag}: unknown level ${v} (${LEVELS.join(', ')})`);
  if (o.listChecks && o.format === 'sarif') throw new Error('--list-checks has no SARIF form; use text, markdown or json');
  if (!o.help && !o.version && !o.listChecks) {
    if (o.paths.length !== 1) throw new Error('give the batch file, such as payout-batch-check payouts.csv');
    if (o.paths.some(isUrl)) throw new Error('give a local path; the tool never fetches a URL');
    if (o.explain && o.format === 'sarif') throw new Error('--explain adds the points of the pages to the text, markdown and JSON reports; the sarif format has no place for them');
  }
  return o;
}

const clean = (text) => safeText(text, 1500);

// Exit code: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = undefined, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`payout-batch-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  if (o.listChecks) {
    io.out(LISTS[o.format]());
    return 0;
  }
  let report;
  try {
    report = await checkFile({ path: o.paths[0], minSeverity: o.minSeverity ?? 'info', failOn: o.failOn ?? 'error', tokens: o.tokens ?? DEFAULT_TOKENS, maxAmount: o.maxAmount, version: VERSION, limits: { ...LIMITS, ...(limits ?? {}) }, base });
  } catch (error) {
    if (error instanceof InputError) io.err(`payout-batch-check: no result, the input has ${error.problems.length === 1 ? 'a problem' : 'problems'}:\n${error.problems.map((p) => `  ${clean(p)}`).join('\n')}\n`);
    else io.err(`payout-batch-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report, { explain: o.explain }));
  return report.result.pass ? 0 : 1;
}
