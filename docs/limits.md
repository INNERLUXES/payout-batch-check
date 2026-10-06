# Limits

The tool is not a screening and not a bank. It reads one payout batch, and its result is an input to a review before the
batch is sent: not a compliance or sanctions screening and not a guarantee that a payment will arrive. A clean run means
only that none of the problems in [method.md](method.md) were found in the file.

## What it cannot see

- **Whether an account exists.** An IBAN with the right check digits and length can still be an account that was closed,
  never opened or belongs to someone else; only the bank of the beneficiary, or an account check of a provider, can
  tell. The account part of an IBAN is not checked against the structure of the registry, only its length.
- **Whether a BIC exists.** A BIC in the right form is not looked up in the BIC directory of Swift, so a BIC that no bank
  holds passes.
- **Sanctions, fraud and the beneficiary.** The tool reads names for their presence and length only. It does not screen
  a name, a country or a wallet against sanctions lists, does not know who the beneficiary is, and does not judge whether
  a payment is allowed. A clean run says nothing about compliance.
- **The chains.** It contacts no chain, so it cannot tell whether a wallet address is held by anyone, whether it is a
  contract that cannot receive the token, which contract the token of a payment is, or whether a network is congested.
  A wallet address is checked for its form only, with no checksum of EIP-55 or of Base58Check.
- **Rates and fees.** An `fxRate` is looked for, not checked against a market rate; fees and the amount the beneficiary
  receives are not worked out.
- **Earlier batches.** Ids and payments are compared within one file; a payment sent in an earlier batch is not seen.
- **Tokens and their decimals.** The table of tokens on each network is the tool's own and short. The decimals of a
  token are not checked, and an amount of a stablecoin payment is checked only for being a plain decimal above 0.
- **Countries the UN table leaves out.** The country codes come from the UN M49 table, which lists no code for Taiwan
  (TW); a payment to it is `country-invalid` and needs a look by hand. ISO 3166-1 itself could not be read without
  accepting the terms of use of the ISO platform (research/sources.md).
- **Changes to the standards.** The registry, the currency list and the country table are the saved copies. A country,
  currency or IBAN format added after a copy was saved is not known until the table is updated in a release, with a test.
- **What a misspelt key meant.** A key or column the tool does not read is reported and left out. A misspelt `amount`
  makes the payment look as if it had none; read the `field-unknown` findings first.
- **Every secret.** The search for keys and seeds knows them by the name of their key or column and by their shape: a
  mnemonic of 12 to 24 lowercase English words, an extended private key, 64 hex digits or a key in WIF. A secret split
  over fields, encoded another way or written under another name is not caught. API keys and passwords of a bank are not
  looked for by their shape. A clean run does not say that the file holds no secret.

## What the readers do not read

[inputs.md](inputs.md) lists the fields. A file that is not strict JSON or a strict CSV table is one `batch-unreadable`
finding, and nothing else is checked. A value that is missing, of the wrong type or a secret is a finding, and the
checks that need it leave it out: a clean run says nothing about that part. Fixed-width files, ISO 20022 XML (pain.001),
spreadsheets, CSV with another separator than a comma, amounts with a thousands separator or a decimal comma, and
numbers with an exponent are not read.

## Size limits

| Limit | Value |
| --- | --- |
| file size | 16 MB |
| payments | 100,000; the rest are not read, and a note says so |
| CSV rows | 100,000 after the header |
| CSV columns | 200 |
| a CSV field | 100,000 characters |
| JSON nesting of objects and arrays | 1,000 levels |
| JSON values (nodes) in a file | 2,000,000 |
| a JSON string | 1,000,000 characters |
| an amount, a total or a rate | 40 digits on each side of the point |
| a text the search for keys looks at | 4,000 characters |

Input past a limit is a `batch-unreadable` or `field-invalid` finding, a note, or, for the file size, an input error
with exit code `2`. The tool never passes a run because something could not be read.

## What a run does not do

It never reads or asks for a private key, a seed or an API key, contacts no bank, chain, provider or API, fetches
nothing and connects to nothing, runs no program, evaluates nothing it reads, reads no clock and no locale, follows no
symbolic link and writes nothing to disk. [threat-model.md](threat-model.md) lists the risks of reading a file from a
pull request or an upload and their controls.
