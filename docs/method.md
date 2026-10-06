# Method

This document says how the tool reads a payout batch and what each check looks at. The tool is an input to a review
before the batch is sent: not a compliance or sanctions screening and not a guarantee that a payment will arrive. A
clean run means only that none of the problems below were found in the file.

## Why the batch file

A cross-border payout leaves as a file: a CSV exported from a payroll or marketplace system, or a JSON body built for the
API of a bank or a payout provider. Once it is sent, every row of it moves money. A wrong check digit in an IBAN comes
back days later with a fee; a BIC with a space is refused; an amount in yen with cents is rounded or refused; a country
written UK instead of GB stops the payment at screening; a row copied twice is paid twice; a total that does not match
the rows makes the bank refuse the whole batch; a wallet address cut short on a chain sends the money nowhere, with no
one to return it.

Most of these are visible in the file before it leaves. The tool reads the file as it is, so the same check runs on every
batch, in a pipeline or by hand, and every finding points at a line.

## Reading the file

1. The path is resolved against the folder the command runs in. A link, a folder, a device or a pipe is refused; a file
   over 16 MB is refused before it is read; a file with a null byte, or bytes that are not UTF-8 (or UTF-16 with a byte
   order mark), is refused with exit code `2` and no report.
2. The format is taken from the name of the file (`.csv` or `.json`), or else from its first character.
3. A CSV file goes to a CSV reader of the tool's own (`src/csv.js`), which keeps the line and column of every field and
   reads strict CSV: a quote in the wrong place, a quoted field that is not closed, a row with more or fewer fields than
   the header or an empty line inside the table is a `batch-unreadable` finding with the line. A column named twice is
   `field-duplicate`, and the second is left out. A JSON file goes to a JSON reader of the tool's own (`src/json.js`),
   which keeps the line and column of every value and the characters every number was written with, and reads strict
   JSON: a comment, a trailing comma, a key written twice in one object or text after the value is `batch-unreadable`.
4. Every key, column and value of the file is looked at for a key or a seed (`src/secrets.js`, kept unchanged from the
   sibling tools). A key or column named for a private key, a seed or a mnemonic, and a value shaped like a mnemonic, an
   extended private key, a private key in hex or a key in WIF, is `secret-in-batch`. A column named for one is reported
   once, at the header. The value is marked and left out of everything that follows, and no report shows it.
5. The fields are read (`src/batch.js`) as docs/inputs.md lists them. A missing field is `field-missing`, a key the tool
   does not read is `field-unknown`, and a value of the wrong type or form, or a field the rail of the payment does not
   take, is `field-invalid`. The value is then left out of every check that needs it. Amounts, totals and rates are read
   by `src/decimal.js` into a whole number and a scale, from the characters of the file.

## The checks of one payment

Each payment is checked on its own (`src/analyze.js`).

- The beneficiary: no name (`beneficiary-name-missing`), a name of fewer than three letters or digits
  (`beneficiary-name-short`), and a country that is not a two-letter code of the table (`country-invalid`).
- The amount: 0, below 0 or not a plain decimal (`amount-invalid`), and, with `--max-amount`, above the limit of its
  unit or of every payment (`amount-above-max`).
- A bank payment: a currency that is not in ISO 4217 (`currency-unknown`); an amount with more decimal places than the
  minor unit of its currency, with trailing zeros left out (`amount-decimals`); an IBAN that is not in the form of one or
  fails the MOD 97-10 check (`iban-checksum`), or has another length than the registry gives its country
  (`iban-length`), or is of another country than the beneficiary and not one of the territories the registry lists
  under the prefix (`iban-country-mismatch`); a BIC that is not in the form of ISO 9362 or whose country letters are not
  a country code (`bic-format`), or of another country than the beneficiary (`bic-country-mismatch`); and a payment in
  another currency than its `sourceCurrency`, or the `debitCurrency` of the batch, with no `fxRate` (`fx-rate-missing`).
- A stablecoin payment: a token that is not in the list `--tokens` gives, USDC and USDT by default
  (`token-not-allowed`); a network out of the table, or a token the table does not list on its network
  (`network-token-unknown`); and a wallet address that is not in the form of its network (`wallet-address-malformed`).

## The checks across the batch

- Two payments with one id, compared without case and outer spaces: the second is `payment-id-duplicate`.
- Two payments to one account (the IBAN in electronic form, the account number with the BIC, or the wallet on its
  network, in small letters on an EVM network) for one amount in one currency or token: the second is
  `payment-possible-duplicate`.
- The totals of the batch: for each currency or token the batch gives a total for, the sum of the payments in that unit
  is worked out exactly and compared (`batch-total-mismatch`); a unit with payments and no total is the same finding at
  the line of the totals. When the amount of a payment of a unit could not be read, the unit is not compared and a note
  says so. A batch with no totals is a note.

## Levels

- **error**: the payment fails, comes back or goes to the wrong place as written, or the file cannot be read as it
  should be: a wrong IBAN, BIC, currency, country, amount or wallet, an id written twice, a missing name, totals that do
  not match, a token outside the list, and a key or seed in the file.
- **warning**: something that is often a mistake but can be right: an account or bank abroad, a short name, a possible
  double payment, a token the table does not know on a network, a converted payment with no rate, an amount above the
  team's limit, and a key the tool does not read.
- **info**: no check is a note today; `--fail-on info` and `--min-severity info` are there for the levels of a later
  version.

## Notes

A note is not a finding. A run notes a batch with no totals, a total that was not compared because an amount could not
be read, the prefixes of IBANs that are not in the saved registry (only their check digits were checked), and a batch
that holds more payments than the tool reads.

## What a documented check rests on

A documented check rests on a page or list kept under research/sources: the IBAN page and the IBAN registry of Swift,
the communique of the Central Bank of the Republic of Turkiye on the check digits, the BIC page of Swift, list one of ISO
4217 from SIX, the M49 table of the UN Statistics Division, and the pages of ethereum.org, Solana and TRON on addresses.
A best practice check is this tool's own choice, and its message and docs/rules-and-sources.md say so and why.
