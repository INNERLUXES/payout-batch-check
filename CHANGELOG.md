# Changes

## 1.0.0

First release.

- Reads a cross-border payout batch before it is sent, as a CSV table with a header row or as JSON, and lists the
  problems that make a payment fail, come back or reach the wrong account, with file and line, as an input to a review:
  not a compliance or sanctions screening and not a guarantee that a payment will arrive. It reads the file, contacts no
  bank, chain, provider or API, fetches nothing, runs nothing, needs no key, follows no symbolic link and reads no
  clock.
- Reads each payment with its id, the name and country of the beneficiary and its rail; for a bank payment the IBAN or
  the account number, the BIC, the currency and the amount; for a stablecoin payment the network, the token, the wallet
  address and the amount; and an optional purpose code, FX rate and source currency. Reads the id, the debit currency
  and the totals of the batch from JSON, and the id and the debit currency from the columns `batchId` and
  `debitCurrency` of a CSV file.
- A strict CSV reader and a strict JSON reader of its own, with no dependency and no recursion, with the line and column
  of every value, quoted CSV fields with commas, quotes and line ends, LF, CRLF and CR line ends, a row with the wrong
  number of fields, a key written twice and a column named twice as findings, and limits of size, rows, columns,
  fields, nesting, values and string length. Amounts, totals and rates are read, added and compared from the characters
  of the file with BigInt, never through a floating point number.
- Tables copied from saved copies of the official lists and checked against them by the tests: the IBAN formats of the
  89 countries of the IBAN registry of Swift with their lengths and the territories under a prefix, the currency codes of
  ISO 4217 list one of SIX with their minor units, and the ISO alpha-2 country codes of the M49 table of the UN
  Statistics Division with the prefixes of the registry. The MOD 97-10 check of ISO 13616 as the Central Bank of the
  Republic of Turkiye describes it, the form of a BIC of ISO 9362 from Swift, and the forms of wallet addresses on EVM
  networks, Solana and Tron from ethereum.org, Solana and TRON.
- A search for keys and seeds before anything else is read, kept unchanged from the sibling tools: each one found is an
  error whose value is left out of every check and never shown, and a CSV column named for one is reported once.
- Twenty-five checks in two levels, each documented or a best practice of the tool and saying which: an IBAN that fails
  its check digits (`iban-checksum`) or has the wrong length for its country (`iban-length`), or is of another country
  than the beneficiary (`iban-country-mismatch`); a BIC not in the form of ISO 9362 (`bic-format`) or of another country
  (`bic-country-mismatch`); a currency out of ISO 4217 (`currency-unknown`) and an amount with more decimals than its
  minor unit (`amount-decimals`); an amount of 0, below 0 or not a number (`amount-invalid`) or above `--max-amount`
  (`amount-above-max`); a country that is not a code of ISO 3166-1 (`country-invalid`); a payment id written twice
  (`payment-id-duplicate`) and a payment that looks like one paid twice (`payment-possible-duplicate`); a missing
  (`beneficiary-name-missing`) or short (`beneficiary-name-short`) beneficiary name; totals that are not the sum of the
  rows (`batch-total-mismatch`); a wallet address in the wrong form for its network (`wallet-address-malformed`); a token
  out of the list (`token-not-allowed`) or not known on its network (`network-token-unknown`); and a converted payment
  with no FX rate (`fx-rate-missing`); and six checks about the input (`batch-unreadable`, `field-missing`,
  `field-unknown`, `field-invalid`, `field-duplicate`, `secret-in-batch`).
- A table of the totals of each currency and token, with the sum of the rows, the total the batch gives and whether
  they match, in every format but SARIF.
- Reports as text, markdown, JSON and SARIF 2.1.0; every finding has its id, severity, message, file, line, column and
  payment; `--min-severity`, `--fail-on`, `--tokens`, `--max-amount`, `--explain` with the points of the pages behind
  each finding, and `--list-checks`. Exit code `0` when no finding is at or above the fail-on level, `1` when one is,
  `2` for a usage or input error, with no result.
- Plain text copies of the public pages and lists the documented checks rest on, under research/sources, with a note on
  each.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate
  of the repository.
