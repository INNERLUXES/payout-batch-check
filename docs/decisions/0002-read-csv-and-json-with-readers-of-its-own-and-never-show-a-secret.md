# 2. Read CSV and JSON with readers of its own, and never show a secret

## Status

Accepted

## Context

A payout batch comes as a CSV table or as a JSON body. `JSON.parse` would read the JSON, and splitting lines at commas
would read a simple CSV, but neither keeps the line and column of a value, so a finding could not point at the row of a
payment; `JSON.parse` takes the last of two values written under one key without a word, builds objects whose keys come
from the file and turns every amount into a floating point number, so that rows of 0.10 and 0.20 add up to
0.30000000000000004 and a total of 0.30 seems not to match; and splitting at commas reads a name such as
"Example, Ltd" as two fields, which moves every value after it to the wrong column: the amount into the currency, the
IBAN into the BIC.

A batch that pays out on a chain sits next to the wallets that pay, and a careless file can hold a secret: the seed of
the hot wallet pasted into a column, a private key in a notes field. A tool that reads such a file and echoes its values
in a report would copy the secret into a pipeline log, a pull request comment or a SARIF upload, where many more people
can read it.

A batch that is not complete (a payment with no currency, a misspelt amount) would also be read as if it were, and a
check could take a value it never saw for one that is fine.

## Decision

1. A JSON file is read by src/json.js, a reader of the tool's own for strict JSON, with the line and column of every
   value, a key written twice as an error, and limits of nesting, values and string length. It does not recurse. Every
   number keeps the characters it was written with.
2. A CSV file is read by src/csv.js, a reader of the tool's own for strict CSV (RFC 4180) with a header row, with the
   line and column of every field, quoted fields with commas, quotes and line ends, and LF, CRLF and CR line ends. A row
   with another number of fields than the header, a quote in the wrong place, a quoted field that is never closed and an
   empty line inside the table stop the reader with the line; a column named twice is a finding and the second is left
   out. The reader is one loop, with limits of rows, columns and the length of a field.
3. The CSV table is turned into the nodes of the JSON reader, so that the search for secrets and the batch reader read
   both formats the same way, and a column named for a seed is found once, at its header.
4. Amounts, totals and rates are read from the characters of the file by src/decimal.js into a whole number and a scale,
   and added and compared with BigInt. A number with an exponent, a sign where none belongs, a separator or more than 40
   digits on a side of the point is a finding, never rounded.
5. The tool never asks for a private key, a seed or an API key: it checks the batch as written. Before the batch is
   read, src/secrets.js, kept unchanged from the sibling tools, walks every key, column and value of the file. A key or
   column named for a key or a seed, and a value shaped like a mnemonic, an extended private key, a private key in hex or
   a key in WIF, is a `secret-in-batch` error at its line. The value is marked, the reader leaves it out as if it were
   not there, and no report and no error message shows it, in any format. A wallet address of 40 hex digits, a Solana
   address of up to 44 base58 characters and an IBAN are never taken for a key.
6. Every field the checks need and the file does not give, every key or column the tool does not read and every value of
   the wrong type is returned with its line and shown as a finding. A check never takes a value it did not read for one
   that is fine.
7. The checks are a heuristic over the batch as written, and every report says so; docs/method.md says what each check
   reads and docs/limits.md what it cannot see. The result is an input to a review before the batch is sent: not a
   compliance or sanctions screening and not a guarantee that a payment will arrive.

## Consequences

- The tool needs no install and no network, and the same file gives the same report on Linux, Windows and macOS.
- A finding points at the line of the field, the cell or the payment.
- A CSV file that a looser reader would read with shifted columns is refused with its line, so the team fixes the export
  instead of sending a batch whose amounts moved.
- A secret in the file fails the run and is never copied into the output. The shapes are loose, so a value that only
  looks like a secret, such as a name of twelve short lowercase words, is reported too; that is the safe side.
- Fixed-width files, ISO 20022 XML, spreadsheets and CSV with another separator are not read (docs/limits.md).
