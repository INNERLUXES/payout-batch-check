// A run: read the file as JSON or CSV, look for keys and seeds, read the batch, run the checks and build the report object
// that the formats write.

import { analyzeBatch } from './analyze.js';
import { readBatch } from './batch.js';
import { CsvError, csvNodes, readCsv } from './csv.js';
import { formatDecimal } from './decimal.js';
import { LEVELS, NOTICE, POINTS, pointPage } from './data.js';
import { FILE_LIMITS, InputError, displayPath, locateBatch, readBatchText } from './files.js';
import { JsonError, readJson } from './json.js';
import { DEFAULT_TOKENS } from './networks.js';
import { RULES, decide, ruleById } from './rules.js';
import { findSecrets } from './secrets.js';
import { safeText } from './text.js';

export const LIMITS = { ...FILE_LIMITS };

export { InputError };

const clean = (t, max = 900) => safeText(t, max);

const ORDER = { error: 0, warning: 1, info: 2 };

// The basis of a rule: the points with their pages.
function basisOf(rule) {
  return rule.basis.map((id) => {
    const page = pointPage(id);
    return { text: POINTS[id].text, source: page.title, url: page.url };
  });
}

// The format of a file: by its extension, and otherwise by its first character that is not a space, a brace or a
// bracket for JSON and anything else for CSV.
export function formatOf(name, text) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.json')) return 'json';
  const first = text.trimStart()[0];
  return first === '{' || first === '[' ? 'json' : 'csv';
}

// The search for keys and seeds is the one of the sibling tools, kept unchanged in src/secrets.js; its finding is named
// for a configuration there and for a batch here.
const asBatch = (f) => ({ ...f, id: 'secret-in-batch', message: f.message.replace(/^The configuration holds/, 'The batch holds') });

// The findings of a text, with no file system: { format, batch, analysis, findings, notes }. batch is null when the text
// is not a batch the readers can follow, and findings then holds one batch-unreadable finding with its line.
export function checkText(text, options = {}, format = 'json') {
  const unreadable = (error, what) => ({ format, batch: null, analysis: null, findings: [{ id: 'batch-unreadable', line: error.line, column: error.column, message: `The file is not ${what} the reader can follow: ${error.message}. Nothing in the file was checked.` }], notes: [`the batch was not checked, because the file is not ${what} the reader can follow`] });
  let source;
  const findings = [];
  if (format === 'csv') {
    let table;
    try {
      table = readCsv(text);
    } catch (error) {
      if (!(error instanceof CsvError)) throw error;
      return unreadable(error, 'CSV');
    }
    // A column named twice: the first is read, and the rest are left out.
    const seen = new Set();
    const keep = table.header.map((h) => {
      if (h.value !== '' && seen.has(h.value)) {
        findings.push({ id: 'field-duplicate', line: h.line, column: h.column, message: `The column "${h.value.length > 120 ? `${h.value.slice(0, 117)}...` : h.value}" is named twice in the header; the tool reads the first and left this one out of every check.` });
        return false;
      }
      seen.add(h.value);
      return true;
    });
    const kept = { header: table.header.filter((_, j) => keep[j]), rows: table.rows.map((r) => ({ line: r.line, cells: r.cells.filter((_, j) => keep[j]) })) };
    const nodes = csvNodes(kept);
    findings.push(...findSecrets(nodes.byColumn).map(asBatch));
    source = { format, header: nodes.byColumn.entries, rows: nodes.rows };
  } else {
    let root;
    try {
      root = readJson(text);
    } catch (error) {
      if (!(error instanceof JsonError)) throw error;
      return unreadable(error, 'JSON');
    }
    findings.push(...findSecrets(root).map(asBatch));
    source = { format, root };
  }
  const read = readBatch(source);
  if (!read.batch) return { format, batch: null, analysis: null, findings: [...findings, ...read.findings], notes: read.notes };
  const analysis = analyzeBatch(read, options);
  return { format, batch: read, analysis, findings: [...findings, ...read.findings, ...analysis.findings], notes: [...read.notes, ...analysis.notes] };
}

const lineCount = (text) => {
  const parts = text === '' ? [] : text.split(/\r\n|\r|\n/);
  return parts.length > 0 && parts.at(-1) === '' ? parts.length - 1 : parts.length;
};

// The batch as the report shows it.
function batchOf(checked) {
  const read = checked.batch;
  if (!read) return null;
  const units = [...new Set(checked.analysis.rows.map((r) => r.unit))];
  return {
    id: read.batch.id === null ? null : clean(read.batch.id, 120),
    format: checked.format,
    debitCurrency: read.batch.debitCurrency === null ? null : clean(read.batch.debitCurrency, 20),
    payments: read.payments.length,
    bank: read.payments.filter((p) => p.rail === 'bank').length,
    stablecoin: read.payments.filter((p) => p.rail === 'stablecoin').length,
    units: units.map((u) => clean(u, 20))
  };
}

// The table of totals.
function tableOf(analysis) {
  if (!analysis) return null;
  return analysis.rows.map((r) => ({ unit: clean(r.unit, 20), payments: r.payments, sum: r.sum, total: r.total, state: r.state }));
}

// The report object for the findings of a file.
export function buildReport({ file, checked, version, minSeverity = 'info', failOn = 'error', tokens = DEFAULT_TOKENS, maxAmount = { all: null, byUnit: [] } }) {
  const all = checked.findings.map((f) => {
    const rule = ruleById(f.id);
    return {
      id: f.id,
      severity: rule.severity,
      message: clean(f.message),
      file: file.file,
      line: f.line,
      column: f.column,
      at: `${file.file}:${f.line}`,
      payment: f.entry == null ? null : clean(f.entry, 120),
      fix: rule.fix,
      kind: rule.kind,
      basis: basisOf(rule),
      own: rule.own ?? null
    };
  });
  all.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.line - b.line || a.column - b.column || a.id.localeCompare(b.id, 'en'));
  const shown = all.filter((f) => LEVELS.indexOf(f.severity) >= LEVELS.indexOf(minSeverity));
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of shown) byLevel[f.severity] += 1;
  const allByLevel = { error: 0, warning: 0, info: 0 };
  for (const f of all) allByLevel[f.severity] += 1;
  return {
    tool: 'payout-batch-check',
    version,
    input: { file: file.file, format: checked.format, bytes: file.bytes, lines: file.lines },
    batch: batchOf(checked),
    totals: { findings: shown.length, byLevel, hidden: all.length - shown.length },
    rules: RULES.map((r) => ({ id: r.id, level: r.severity, kind: r.kind, findings: shown.filter((f) => f.id === r.id).length })),
    config: { minSeverity, failOn, tokens: [...tokens], maxAmount: { all: maxAmount.all === null ? null : formatDecimal(maxAmount.all), byUnit: Object.fromEntries(maxAmount.byUnit.map(([u, d]) => [u, formatDecimal(d)])) } },
    findings: shown,
    table: tableOf(checked.analysis),
    notes: checked.notes.map((n) => clean(n)),
    notice: NOTICE,
    result: decide(allByLevel, failOn)
  };
}


export async function checkFile({ path, minSeverity = 'info', failOn = 'error', tokens = DEFAULT_TOKENS, maxAmount = { all: null, byUnit: [] }, version, limits = LIMITS, base = process.cwd() }) {
  const absolute = await locateBatch(path, base);
  const { text, bytes } = await readBatchText(absolute, base, limits);
  const checked = checkText(text, { tokens, maxAmount }, formatOf(absolute, text));
  const file = { file: displayPath(absolute, base), bytes, lines: lineCount(text) };
  return buildReport({ file, checked, version, minSeverity, failOn, tokens, maxAmount });
}
