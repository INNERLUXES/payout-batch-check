# Contributing

Every change goes through a pull request and is reviewed before it is merged. The pipeline runs the tests on Linux,
Windows and macOS with Node 22 and 24, the tests with coverage, the repository checks, CodeQL, and a secure
development check of the repository itself.

Commit messages in this repository follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`,
with `!` for a breaking change.

This tool reads a payout batch and runs nothing; its result is an input to a review before the batch is sent: not a
compliance or sanctions screening and not a guarantee that a payment will arrive. A change must keep it that way: a
check reports what the file holds, and the tool never contacts a bank, a chain, a provider or an API, and never fetches,
runs or evaluates what it reads.

## Never a secret, never a real person

The tool never asks for a private key, a seed or an API key, and never looks up an account, a BIC or a wallet. Do not add
an option, a field or a test that gives it one: the checks are about the batch as written. A test of the search for
secrets builds its values from repeated characters (see test/secrets.test.js), so that no file of the repository holds
anything that could be a real key or seed. Never paste a real payout batch, the name or account of a real person, a key
or a seed into an issue, a pull request or an example.

## Changing a check

1. Describe the change in docs/method.md first: what the check looks at and what it can and cannot see, and add what it
   cannot see to docs/limits.md. Where the tool makes its own choice, say so in `own` in src/rules.js and in the
   message, and say why; a check is `documented` only when one of the saved pages or lists says the rule.
2. Keep the checks to what is written. A finding must point at something a reader can check in the file: a line and a
   column. Never add a check that needs the network, a bank, a chain, a provider, a key or the clock.
3. A check says what to change, in `fix` in src/rules.js, and names the points of the public pages it rests on in
   `basis`; a new page goes into src/data.js and research/sources.md, is saved as text under research/sources, and
   docs/rules-and-sources.md lists it. Fetch and read a page before it is listed, and never write a rule you could not
   read in the pages as if it were one.
4. A run must never pass because something could not be read: a file that is not strict JSON or CSV is an error finding,
   and a field that is missing, unknown or of the wrong type is a finding that names it.
5. Add a test with the batch written inline (`bank()`, `coin()`, `PAYMENTS`, `batch()`, `withPayment()`, `batchText()`,
   `csvText()`, `findingsOf()`, `idsOf()`, `ofCheck()`, `csvFindings()`, `ibanOf()`, `run()` and `cli()` in
   test/helpers.js), small enough to work out by hand, with a near miss on each side: the batch that is reported and the
   one next to it that is not.
6. A check id, once released, keeps its meaning: pipelines and other tools read it from the JSON, SARIF and markdown
   output.

## Changing a table

The IBAN formats of src/banking.js, the currencies of src/currencies.js and the country codes of src/countries.js are
copied from the saved copies under research/sources, and test/data.test.js checks each against its copy, entry by entry.
To update a table, save the new copy first, record in research/sources.md the lines it leaves out, and then change the
table. The table of networks and tokens of src/networks.js is the tool's own and says so in docs/inputs.md; the forms of
the wallet addresses come from the saved pages.

## Changing the readers

1. The JSON reader (src/json.js) keeps its limits (`JSON_LIMITS`) and works with a stack of its own; it has no
   recursion, and neither has the search for secrets (src/secrets.js). The CSV reader (src/csv.js) keeps `CSV_LIMITS`
   and is one loop. The batch reader (src/batch.js) keeps `BATCH_LIMITS` and the decimal reader (src/decimal.js) keeps
   `DECIMAL_LIMITS`. src/secrets.js is kept as it is in the sibling tools.
2. An amount, a total or a rate is read from the characters of the file into a whole number and a scale, and added and
   compared with BigInt; a number with an exponent is a finding, never a guess.
3. A value marked as a secret is left out as if it were not there; no message may name it.
4. A field that is read is listed in docs/inputs.md; a part the batch does not give is a finding, so that it never goes
   by unnoticed.
5. No pattern is built from a file or an argument. A test fails when `new RegExp` appears in src outside src/text.js.
6. A time check in a test widens under coverage: read `process.env.NODE_V8_COVERAGE`, which the test runner sets only
   when coverage is on, and allow four times the time (`allowed()` in test/helpers.js). Run `npm run test:coverage`
   before you open the pull request.
7. A file written with LF, CRLF or CR line ends, as UTF-8 with or without a byte order mark or as UTF-16 with one, must
   give the same findings.

## Changing a source

1. Every point the reports show is in src/data.js, written in this project's own words, with the page it comes from. A
   short phrase of a page may be named; a long quotation may not.
2. research/sources.md lists every page with a note on what it says and the lines its copy leaves out,
   research/sources holds a text copy of each page, and docs/rules-and-sources.md lists every check with its points and
   what to change. A test checks them against each other. Leave out a line of a page that holds a date or a number that
   reads like a year, and the contact details of people, and never write a publication date or the date a page was last
   changed.

## The examples

The batches under `examples/` are made-up input for the tool: one that holds a finding of nearly every check and one
that passes at error and warning level, with made-up names, IBANs that are the examples of the IBAN registry or changed
from them, BICs with EXMP as their party prefix, wallet addresses of one character written many times, and no key and
no seed. A change to them goes with the real output that `npm run example` writes to `examples/output`.

## Tests that depend on the system

A test that depends on the operating system (a symbolic link, a device) is guarded with `process.platform` and says why
in its `skip`. A test never asserts a line number written by hand: a line is worked out with `lineOf()` of
test/helpers.js or from the text itself. Every other test builds its paths with `resolve()` from names with forward
slashes, and a test never writes a backslash into a file name.

A test never reads the clock, the time zone of the machine or the locale.

## Rules for the code

- No runtime dependencies and no development dependencies. Node 22 or newer and nothing else; the tests use `node:test`.
- The tool reads the file it is given and writes only to standard output and standard error. It opens no network
  connection, contacts no bank, chain or provider, runs no program and evaluates nothing it reads.
- Text from the input, file names, batch ids, payment ids, names, codes and addresses included, goes through `safeText`
  before it reaches the output or an error message.
- Source files stay ASCII; write any other character as a Unicode escape, or build it from its code point.
- No file carries a date, and no file holds a number that reads like a year. Version numbers (Node 22, 1.0.0), amounts,
  account numbers and the number of a standard (ISO 4217, SARIF 2.1.0, NIST SP 800-218) are fine (decision 1).
- Examples and tests use made-up people and companies, and made-up accounts and addresses.
- Plain words in the documents: `npm run check` fails on a short list of words that say little.

## Before you open the pull request

```
npm test
npm run test:coverage
npm run check
npm run example
```
