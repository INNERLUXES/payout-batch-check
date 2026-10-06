# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "payout-batch-check security", or use private vulnerability reporting
on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up batch file that shows the problem, the command you ran, what you expected and what happened. Use
made-up names, the example IBANs of the IBAN registry and made-up wallet addresses, never a real payout batch, the name
or account of a real person, and never a real private key, seed or mnemonic, even an old one or one from a test network.

## Scope

In scope:

- an input that makes the tool show a private key, a seed or a mnemonic, or any part of one, in a report or an error
  message, in any format
- a key or a seed in one of the shapes docs/limits.md names that the tool does not report
- an input that makes the tool read a file other than the one it was given, or follow a symbolic link
- an input that makes the tool open a network connection, fetch a URL, contact a bank, a chain, a provider or an API,
  run any other program, or evaluate anything it reads
- an input that makes the tool write a file
- an input that makes the tool hang, take very long, exhaust the stack or use unbounded memory, such as very large files,
  a hundred thousand payments, arrays and objects nested deep, very long fields, numbers with thousands of digits or a
  quoted CSV field that is never closed
- binary or invalid input that the tool reads as if it were a batch
- a CSV row whose values the tool reads in the wrong columns, a key written twice or a column named twice whose second
  value is taken without a finding, a field the tool did not read that a check reports as fine, or a misspelt key that
  is not reported
- an IBAN that fails MOD 97-10 or has the wrong length for a country of the saved registry, a BIC not in the form of ISO
  9362, a currency out of the saved list or an amount with more decimals than its minor unit, that the tool does not
  report
- an amount, a total or a rate that the tool adds or compares in a way the decimal text of the file does not say, so
  that a check passes or fails because of it
- a run that passes at a `--fail-on` level although the input holds a finding at that level that docs/method.md says is
  reported
- text from a file or a file name that rewrites the terminal through control or direction characters, is shown unescaped
  in the output, or puts markup into the markdown report
- a name such as `__proto__` that changes how objects behave inside the tool

Out of scope: the forms docs/limits.md says the tool does not see, whether an account, a BIC or a wallet exists or
belongs to the beneficiary (a clean result is not a compliance or sanctions screening and not a guarantee that a payment
will arrive), sanctions and fraud, the table of networks and tokens that is the tool's own, entries added to the IBAN
registry, ISO 4217 or the country codes after the saved copies, secrets in shapes the search does not claim to know, who
may change or upload a batch, and where your pipeline keeps the output.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
