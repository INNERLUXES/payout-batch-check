# payout-batch-check

Payout batch check. Give it a cross-border payout batch before it is sent, as a CSV table with a header row or as a JSON
file: for each payment its id, the name and country of the beneficiary and its rail; for a bank payment the IBAN or the
account number, the BIC, the currency and the amount; for a stablecoin payment the network, the token, the wallet
address and the amount; an optional purpose code, FX rate and source currency; and the id, debit currency and totals of
the batch. It reads the file and lists the problems that make a payment fail, come back or reach the wrong account: an
IBAN that fails its check digits or has the wrong length for its country, a BIC not in the form of ISO 9362, a currency
that is not in ISO 4217 or an amount with more decimals than its minor unit, an amount of 0, below 0 or not a number, a
country code that is not ISO 3166-1, an IBAN or BIC of another country than the beneficiary, payment ids written twice and
payments that look like one paid twice, a missing or short beneficiary name, totals that are not the sum of the rows, a
wallet address in the wrong form for its network, a token that is not allowed or not known on its network, and a
converted payment with no FX rate. Every finding has its id, level, message and file and line, and the run exits with a
code a pipeline can act on.

**It is an input to a review before the batch is sent: not a compliance or sanctions screening and not a guarantee that
a payment will arrive.** It is not a screening and not a bank. It reads one file only: it contacts no bank, chain,
provider or API, fetches nothing, runs nothing, needs no key and reads no clock, so it does not know whether an account,
a BIC or a wallet exists or belongs to the beneficiary; the checks are a heuristic. A clean run means only that none of
the problems of its checks were found in the file, and the team still has to verify accounts with the bank or provider,
screen the beneficiaries and approve the batch.

A payout batch moves money as soon as it is sent, and most of what makes a payment come back is visible in the file
before it leaves. Swift publishes the IBAN registry with the length of the IBAN of each country; the check digits of an
IBAN follow MOD 97-10, and a central bank lets its banks reject a transfer whose IBAN fails it; Swift writes the BIC of
ISO 9362 as eight or eleven characters with a country code in the middle; SIX keeps ISO 4217, where the yen has no
decimals and the Kuwaiti dinar three; and ethereum.org, Solana and TRON describe the form of an address on their chains.
A space in a BIC, UK written for GB, cents on an amount in yen, a row copied twice or a wallet address cut short is easy
to miss in a file of thousands of rows and costly once the batch is sent. This tool reads the file on every batch and
points at the line.

- **One check per problem.** Twenty-five checks, each with what it looks at, what it cannot see, the public pages it
  rests on and what to change. Each check is either documented (in a page or list of Swift, the Central Bank of the
  Republic of Turkiye, SIX, the UN Statistics Division, ethereum.org, Solana or TRON) or a best practice of this tool,
  and its message says which.
- **Tables from the official lists.** The IBAN formats of the 89 countries of the registry of Swift, the currency codes
  and minor units of ISO 4217 list one from SIX, and the two-letter country codes of the UN M49 table are copied from
  saved copies of the lists, and the tests check every entry against its copy.
- **Never a secret.** The tool needs no private key, no seed and no API key. A key or column named for a private key or
  a seed, and a value shaped like a mnemonic, an extended private key, a private key in hex or a key in WIF, is an error,
  and the value is never shown in any report.
- **Amounts as written.** Amounts, totals and rates are read, added and compared from the characters of the file, never
  through a floating point number, so rows of 0.10 and 0.20 add up to a total of 0.30.
- **Strict readers of its own.** The CSV and JSON readers keep the line and column of every value, so a finding points at
  the row of the payment; a CSV row with a field too many, which would shift every value after it, stops the reader
  instead. What the batch does not say is listed as a finding, never taken for a value that is fine.
- Reports as text, markdown, JSON and SARIF, with an exit code for a pipeline: `0` no finding at or above the
  `--fail-on` level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies, no clock and no network.

```
npm test
```

```
tests 144
pass 142
fail 0
skipped 2
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a
symbolic link or a device (a link to a batch file, and `/dev/null` named as a file); they are guarded with
`process.platform`, run on Linux and macOS, and none of them asserts a line. `npm run test:coverage` runs the same tests
with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/payout-batch-check.git
cd payout-batch-check
node bin/payout-batch-check.js examples/bad/batch.json
```

Or without a clone, in your own project:

```
npx --yes github:INNERLUXES/payout-batch-check payouts/batch.csv
```

`examples/` holds two made-up payout batches. Every name in them is made up, every IBAN is an example of the IBAN
registry of Swift or one changed from it on purpose, every BIC has the made-up party prefix EXMP, every wallet address is
one character written many times, and neither holds a real key or seed. `examples/bad/batch.json` holds a finding of
nearly every check: an IBAN with a wrong check digit, an IBAN of the Netherlands one character short, an IBAN of Belgium
for a beneficiary in Austria, a BIC with a space, a BIC of Germany for a beneficiary in Switzerland, the currency EUX, an
amount in yen with cents, a negative amount, the country UK, a payment id written twice, the same payment written twice,
a payment with no name and one named Q, a payment in USD with no rate, a wallet address of four hex digits, a payment in
DAI, USDT on Base, a seed phrase next to a wallet, a misspelt purposeCode, the rail wire, a bank payment with no
currency, a total for EUR that is 100 more than its rows and no total for USD. `examples/good/batch.csv` passes at error,
warning and info level: euro payments to Germany, France and the Netherlands, payments in pounds, Swiss francs, yen,
Kuwaiti dinars and US dollars with their rates, and USDC on Ethereum and Solana and USDT on Tron; the one note it shows is
that a CSV batch gives no totals to compare.

## Usage

```
payout-batch-check <batch.csv|batch.json> [options]
```

```
--format <name>          text, markdown, json or sarif (default: text)
--json                   the same as --format json
--min-severity <level>   the lowest level of a finding that is shown: info, warning, error (default: info)
--fail-on <level>        the lowest level of a finding that fails the run: info, warning, error (default: error)
--tokens <list>          the tokens a stablecoin payment may pay in, comma-separated (default: USDC,USDT)
--max-amount <limit>     the largest amount of one payment: an amount for every payment, such as 50000, or
                         <unit>=<amount> for one currency or token, such as EUR=25000; once for each unit
--explain                show the points of the pages behind each finding (text, markdown and JSON)
--list-checks            list the checks with their level and kind, and exit
--help                   show the usage
--version                show the version
```

Name one file: the batch. [docs/inputs.md](docs/inputs.md) lists every field. The path in the report is relative to the
folder you run the command in, with forward slashes on every system, followed by the line.

A short batch looks like this as CSV:

```
paymentId,beneficiaryName,beneficiaryCountry,rail,iban,bic,currency,amount,network,token,walletAddress,debitCurrency
G-001,Harbor Example Supplies GmbH,DE,bank,DE89370400440532013000,EXMPDEFFXXX,EUR,1500.00,,,,EUR
G-009,Lumen Example Pte Ltd,SG,stablecoin,,,,750.00,ethereum,USDC,0x1111111111111111111111111111111111111111,EUR
```

and like this as JSON, where the batch can give its totals:

```json
{
  "batch": { "id": "PAYOUT-EXAMPLE", "debitCurrency": "EUR", "totals": { "EUR": "1500.00", "USDC": "750.00" } },
  "payments": [
    { "paymentId": "P-001", "beneficiaryName": "Harbor Example Supplies GmbH", "beneficiaryCountry": "DE", "rail": "bank", "iban": "DE89370400440532013000", "bic": "EXMPDEFFXXX", "currency": "EUR", "amount": "1500.00" },
    { "paymentId": "P-002", "beneficiaryName": "Lumen Example Pte Ltd", "beneficiaryCountry": "SG", "rail": "stablecoin", "network": "ethereum", "token": "USDC", "walletAddress": "0x1111111111111111111111111111111111111111", "amount": "750.00" }
  ]
}
```

The report of the bad example starts with what was read, the findings in one line, and the checks with the number of
findings of each; then the findings, errors first, each with what to change:

```
payout-batch-check: examples/bad/batch.json
file: 240 lines, 6,625 bytes
batch: PAYOUT-EXAMPLE-BAD; JSON; 22 payments (17 bank, 4 stablecoin); debit EUR; paid in EUR, GBP, CHF, EUX, JPY, SEK, USDC, DAI and 2 more
findings: 23 (16 error, 7 warning)

Checks (25)

  check                       level    kind           findings
  batch-unreadable            error    input          0
  field-missing               error    input          1
  field-unknown               warning  input          1
  field-invalid               error    input          1
  field-duplicate             error    input          0
  secret-in-batch             error    input          1
  iban-checksum               error    documented     1
  iban-length                 error    documented     1
  iban-country-mismatch       warning  best practice  1
  bic-format                  error    documented     1
  bic-country-mismatch        warning  best practice  1
  currency-unknown            error    documented     1
  amount-decimals             error    documented     1
  amount-invalid              error    best practice  1
  amount-above-max            warning  best practice  0
  country-invalid             error    documented     1
  payment-id-duplicate        error    best practice  1
  payment-possible-duplicate  warning  best practice  1
  beneficiary-name-missing    error    best practice  1
  beneficiary-name-short      warning  best practice  1
  batch-total-mismatch        error    best practice  2
  wallet-address-malformed    error    documented     1
  token-not-allowed           error    best practice  1
  network-token-unknown       warning  best practice  1
  fx-rate-missing             warning  best practice  1

```

A finding names its check, its level, the file and the line of the field and what to change. With `--explain` it also
gives the points of the pages behind it and, for a best practice check, the tool's own choice:

```
  ERROR    iban-checksum               examples/bad/batch.json:35
           The iban of payment P-002, GR1601101250000000012300696, fails the check of ISO 13616: the remainder of MOD 97-10 is 28, not 1, so a character is wrong or two are swapped. A bank may return or reject the payment.
           fix: Copy the IBAN again from the beneficiary, in electronic form or in groups of four; never correct the check digits by hand to make it pass.
           basis: To check the two check digits, the communique moves the first four characters to the end, turns every letter into a number from 10 for A to 35 for Z, and asks that the result divided by 97 leave 1, the MOD 97-10 of ISO 7064. (Central Bank of the Republic of Turkiye: Communique on the International Bank Account Number, https://tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Bottom+Menu/IBAN/Communique)
           basis: The communique lets a bank return or reject a transfer order whose IBAN fails that check. (Central Bank of the Republic of Turkiye: Communique on the International Bank Account Number, https://tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Bottom+Menu/IBAN/Communique)
```

After the findings come the totals of each currency and token: the sum of the rows, the total the batch gives, and
whether they match:

```
Totals (10)

  unit  payments  sum of rows  total given  state
  EUR   10        5982         6082         differs
  GBP   1         1200         1200         matches
  CHF   1         950          950          matches
  EUX   1         410          410          matches
  JPY   1         150000.5     150000.5     matches
  SEK   1         0            200          1 not read
  USDC  2         1250         1250         matches
  DAI   1         300          300          matches
  USDT  1         400          400          matches
  USD   1         2500         -            no total given
```

The end of the report holds the notes, the notice and the result:

```
note: the total for SEK was not compared, because the amount of one of its payments could not be read

This report is an input to a review before the batch is sent: not a compliance or sanctions screening and not a guarantee that a payment will arrive.

RESULT: FAIL - 16 findings at or above error (16 error, 7 warning)
```

The good example passes:

```
  USDC  2         1250         -            no total given
  USDT  1         400          -            no total given

note: the batch gives no totals, so batch-total-mismatch had nothing to compare

This report is an input to a review before the batch is sent: not a compliance or sanctions screening and not a guarantee that a payment will arrive.

RESULT: PASS - no finding at or above error
```

## How the batch is read

1. The path is resolved against the folder you run the command in. A link, a folder, a device or a file over 16 MB is
   refused, and so is a file that is not UTF-8 (or UTF-16 with a byte order mark) or holds a null byte, with exit code
   `2` and no report.
2. A file whose name ends in `.csv` is read as CSV and one that ends in `.json` as JSON; another is read by its first
   character. The readers of the tool keep the line and column of every value. The CSV reader reads quoted fields with
   commas, quotes and line ends, and refuses a row with the wrong number of fields; the JSON reader reads strict JSON and
   refuses a key written twice in one object.
3. Every key, column and value is looked at for a private key or a seed. One that is found is an error at its line, and
   its value is left out of everything that follows and never shown.
4. The fields of the batch and of each payment are read with their lines. A key or column the tool does not read is a
   `field-unknown` finding; a missing field, a value of the wrong type and a field the rail of the payment does not take
   are findings of their own, and that value is left out of the checks that need it.
5. Each payment is checked against the IBAN registry, the BIC form, the currency list, the country codes, the networks
   and the tokens; then the payments are compared with each other, and the totals of the batch with the sum of its rows.

[docs/method.md](docs/method.md) says what each check reads, and [docs/inputs.md](docs/inputs.md) lists the fields, the
networks with their address forms and the tables.

## What it checks

| Check | Level | Kind | What it reports |
| --- | --- | --- | --- |
| `iban-checksum` | error | documented | an IBAN that fails MOD 97-10 of ISO 13616, or is not in the form of one |
| `iban-length` | error | documented | an IBAN whose length is not the one the registry of Swift gives its country |
| `iban-country-mismatch` | warning | best practice | an IBAN of another country than the beneficiary |
| `bic-format` | error | documented | a BIC not in the form of ISO 9362, or with unknown country letters |
| `bic-country-mismatch` | warning | best practice | a BIC of another country than the beneficiary |
| `currency-unknown` | error | documented | a currency that is not a code of ISO 4217 |
| `amount-decimals` | error | documented | more decimal places than the minor unit of the currency |
| `amount-invalid` | error | best practice | an amount of 0, below 0 or not a plain decimal |
| `amount-above-max` | warning | best practice | an amount above `--max-amount`, when it is given |
| `country-invalid` | error | documented | a beneficiary country that is not a code of ISO 3166-1 |
| `payment-id-duplicate` | error | best practice | two payments of one id |
| `payment-possible-duplicate` | warning | best practice | two payments of one amount to one account in one currency |
| `beneficiary-name-missing` | error | best practice | a payment with no beneficiary name |
| `beneficiary-name-short` | warning | best practice | a name of fewer than three letters |
| `batch-total-mismatch` | error | best practice | a total that is not the sum of its rows, or a unit with no total |
| `wallet-address-malformed` | error | documented | a wallet address not in the form of its network |
| `token-not-allowed` | error | best practice | a token out of the list (`--tokens`) |
| `network-token-unknown` | warning | best practice | a network out of the table, or a token the table does not list on it |
| `fx-rate-missing` | warning | best practice | a converted bank payment with no FX rate |
| `secret-in-batch` | error | input | a key or a seed; its value is never shown |
| `field-duplicate` | error | input | a CSV column named twice |
| `field-invalid` | error | input | a value of the wrong type or form, or a field the rail does not take |
| `field-unknown` | warning | input | a key or column the tool does not read, often a misspelt one |
| `field-missing` | error | input | a field the checks need |
| `batch-unreadable` | error | input | a file that is not strict JSON or CSV, or holds no batch object |

A documented check rests on a page or list of Swift, the Central Bank of the Republic of Turkiye, SIX, the UN Statistics
Division, ethereum.org, Solana or TRON. A best practice check is this tool's own choice, and its message says "a best
practice of this tool, not a rule in the pages it cites". `--list-checks` shows the kind of each check. Some of the
levels are worth a word:

- `iban-country-mismatch` and `bic-country-mismatch` are warnings: a beneficiary may bank abroad. The territories the
  registry lists under a prefix (Jersey under GB, Aland under FI, Reunion under FR) are not reported.
- `amount-decimals` leaves trailing zeros out: 150000.00 JPY needs no decimal place and passes, 150000.50 JPY does not.
- `payment-possible-duplicate` is a warning: two invoices of one amount to one supplier are two real payments.
- `beneficiary-name-short` is a warning: three letters is the tool's own floor, and a real name can be that short.
- `network-token-unknown` is a warning: the table of tokens on each network is the tool's own and short.
- `amount-above-max` runs only with `--max-amount`; the limit is the team's own.
- `country-invalid` reads the codes of the UN M49 table, which lists no code for Taiwan (TW); a payment to it needs a
  look by hand (docs/limits.md).

## What is not checked

[docs/limits.md](docs/limits.md) lists what the tool cannot see. Among them: whether an account, a BIC or a wallet
exists or belongs to the beneficiary (verify them with the bank or provider), sanctions and fraud, the structure of the
account part of an IBAN, the checksum of a wallet address, the contract and the decimals of a token, the rate and the
fees, payments sent in earlier batches, entries added to the official lists after the saved copies, and secrets in a
shape the search does not know.

## Formats

`--format text` (the default) is for a terminal. `--format markdown` is a report for a job summary or a pull request,
with a table of findings and the table of totals. `--format json` writes every finding with its `id`, `severity`,
`message`, `file`, `line`, `column`, `payment` and `fix`, the table of totals, and with `--explain` the points of the
pages. `--format sarif` writes SARIF 2.1.0, with the checks as rules, the batch file as the artifact and a result for
each finding with its line and column, for code scanning; the table of totals has no place in it. The saved output of
the examples is in [examples/output](examples/output).

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | no finding at or above the `--fail-on` level (default `error`) |
| `1` | a finding at or above it |
| `2` | a usage error, or an input error such as a path that does not exist, a link or a folder, or a file that is not text or is too large; there is no report |

Findings below `--min-severity` are not shown, and still count for the result.

## Limits

The tool reads one file; it contacts no bank, chain or provider and connects to nothing. A run reports the problems of
docs/method.md that the file holds. [docs/limits.md](docs/limits.md) lists what it cannot see, with the size limits: 16
MB for a file, 100,000 payments, CSV fields of up to 100,000 characters, JSON nested up to 1,000 deep, and amounts of up
to 40 digits on each side of the point. [docs/threat-model.md](docs/threat-model.md) lists the risks of reading a file
from a pull request or an upload and their controls, and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults
and how to run the tool in a pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the file as CSV or JSON, looks for keys and seeds, reads the batch, runs the checks and builds the report of the run |
| `src/files.js` | the bounded reading of a file by its byte order mark, with no link followed |
| `src/csv.js` | the CSV reader: a header row, quoted fields, lines and columns, limits, one loop |
| `src/json.js` | the JSON reader: lines and columns, keys written twice, limits, a stack of its own |
| `src/secrets.js` | the search for keys and seeds by the name of a key and the shape of a value, kept from the sibling tools |
| `src/batch.js` | the fields of the batch and of each payment, what each rail needs and takes, and the input checks |
| `src/decimal.js` | amounts, totals and rates read from the characters of the file, added and compared with BigInt |
| `src/banking.js` | the IBAN registry, the MOD 97-10 check and the form of a BIC |
| `src/currencies.js` | the currency codes of ISO 4217 with their minor units |
| `src/countries.js` | the two-letter country codes |
| `src/networks.js` | the networks, the form of a wallet address on each, and the tokens the tool expects on each |
| `src/analyze.js` | the checks on each payment, across the payments and on the totals |
| `src/rules.js` | the checks, their levels and kinds, and the result |
| `src/report.js`, `src/text.js`, `src/size.js` | the text, markdown, JSON and SARIF output, the cleaning of text from the input and number formats |
| `src/data.js` | the public pages and the points the checks rest on, in this project's own words |
| `research/sources/` | text copies of the pages and lists, as they were read |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

The documented checks rest on nine public pages and lists, nothing else. Each was read before it was listed, a text copy
of it is kept in [research/sources](research/sources), and [research/sources.md](research/sources.md) has a note on each
and lists the lines the copies leave out. [docs/rules-and-sources.md](docs/rules-and-sources.md) lists every check with
the points of the pages it rests on, what it cannot see and what to change. Where a check is a best practice and not a
rule in the pages, it says so.

- Swift, International Bank Account Number (IBAN): https://www.swift.com/standards/data-standards/iban-international-bank-account-number
- Swift, IBAN Registry (TXT): https://www.swift.com/swift-resource/11971/download
- Central Bank of the Republic of Turkiye, Communique on the International Bank Account Number: https://tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Bottom+Menu/IBAN/Communique
- Swift, Business Identifier Code (BIC): https://www.swift.com/standards/data-standards/bic-business-identifier-code
- SIX, ISO 4217 list one: https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml
- United Nations Statistics Division, Standard country or area codes for statistical use (M49): https://unstats.un.org/unsd/methodology/m49/overview/
- ethereum.org, Ethereum accounts: https://ethereum.org/en/developers/docs/accounts/
- Solana, Account Structure: https://solana.com/docs/core/accounts/account-structure
- TRON Developer Hub, Accounts and keys: https://developers.tron.network/docs/account

## Background

A payout batch is checked by the people who send it, and every payment in it is paid as it is written. Batches are read
line by line when a marketplace adds a country, when payroll moves to a new provider, when a treasury team starts to pay
suppliers in stablecoins next to bank transfers, or when engineers are brought in to build the payout service, its
exports and its tests. How such work is staffed and carried out is described on the page
[Blockchain Cross-Border Payment Services](https://innerluxes.dev/blockchain/cross-border-payments).

## License

MIT
