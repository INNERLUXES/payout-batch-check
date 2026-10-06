# Secure defaults

The default run is the safe run. Nothing in the first section needs a flag, and none of it can be switched off. The rest
of the document is about what the tool cannot do for you: which file you give it, where the output goes, and who may
change the batch it reads. A clean result is not a compliance or sanctions screening and not a guarantee that a payment
will arrive; it is a file with none of the problems the checks look for, not a finding that the payments in it are right
or allowed.

## How the tool behaves by default

- **Never a secret.** The tool needs no private key, no seed, no API key and no address of a bank, a chain or a
  provider, and has no option to take one. A key or column named for a key or a seed, and a value shaped like one,
  anywhere in the file, is a `secret-in-batch` error that fails the run; the value is left out of every check and never
  written to a report or an error message, in any format.
- **Reads, never sends.** The tool reads the one batch file it is given. It follows no symbolic link, fetches no URL,
  refuses an argument that looks like an address, contacts no bank, chain, provider or API, evaluates nothing and writes
  nothing to disk. It cannot send a payment.
- **Every check on from the first run.** A wrong IBAN, a malformed BIC, an unknown currency or country, an amount with
  too many decimals, an amount of 0, below 0 or not a number, an id written twice, a missing name, totals that do not
  match, a malformed wallet address and a token outside the list are errors; an account or bank abroad, a short name, a
  possible double payment, a token the table does not know on its network and a converted payment with no rate are
  warnings. There is no configuration file of the tool that could set a check off. `amount-above-max` is the one check
  that needs an option, because the limit is the team's own.
- **A short list of tokens.** A stablecoin payment may pay in USDC or USDT until `--tokens` says otherwise, so a token
  nobody chose fails the run.
- **Fail closed on what it cannot read.** A file that is not strict JSON or a strict CSV table is an error finding that
  fails the run at the default `--fail-on` of `error`. A row with a field too many or too few stops the reader instead
  of shifting the values. A missing field and a value of the wrong type are findings of their own, so a part of the batch
  that was not read is never taken for one that is fine. A misspelt key is a warning that names the key it is probably
  meant to be. A file that is not text, is too large or is a link stops the run with exit code `2` and no report.
- **Amounts as written.** An amount, a total or a rate is read and added from the characters of the file, never through
  a floating point number, and a number with an exponent or a separator is refused, so a total of 0.30 matches rows of
  0.10 and 0.20.
- **Unknown arguments are errors.** An option the tool does not know, a value that looks like an option and an option
  given twice stop the run, so a typo such as `--fail-no` cannot leave a default in place.
- **No pattern from the input.** No regular expression is built from a file or from an argument.
- **Bounded work.** The readers have limits of size, rows, columns, fields, nesting, values and string length, the JSON
  reader works with a stack of its own, and a batch has at most 100,000 payments (docs/limits.md), so a large or deep
  file cannot exhaust the stack, the memory or the time.
- **No prototype tricks.** Keys and columns from a file are kept in lists and compared with the names the tool reads,
  never set as properties of an object, so `__proto__` is only a name.
- **Clean output.** Text from the input, file names, batch ids, payment ids, names, codes and addresses included, has
  control characters, line separators and direction controls replaced and its length capped before it reaches a report
  or an error message; the markdown report also escapes what markdown gives a meaning to.
- **The same input gives the same output.** No clock, no zone, no locale and no random number
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).
- **No dependencies.** Node 22 or newer and nothing else.

## Settings that make the check stricter

- **`--fail-on warning`.** Accounts and banks abroad, short names, possible double payments, tokens the table does not
  know on their network, converted payments with no rate, amounts above `--max-amount` and misspelt keys fail the run
  too. Use it on a batch that is about to be sent, and record in the review each warning the team keeps on purpose, such
  as a beneficiary who banks abroad.
- **`--max-amount`.** Set the limit above which a payment needs a second look, for every payment and for each currency or
  token, such as `--max-amount 10000 --max-amount JPY=1500000`.
- **`--tokens`.** Name only the tokens your team pays in, such as `--tokens USDC`, so that a payment in another token is
  an error.

## Running it in a pipeline

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Payout batch check
    run: npx --yes github:INNERLUXES/payout-batch-check payouts/batch.csv --format markdown >> "$GITHUB_STEP_SUMMARY"
```

- Give the job read access to the contents and nothing more. The tool needs no secret, no API key and no access to a
  bank or a chain; never give it one.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because
  `npx` runs what it downloads.
- Run the tool on the exact file that is sent, after the last change to it and before it is signed or uploaded to the
  bank or provider. A batch edited after the check is a batch that was not checked.
- Keep payout batches out of public repositories: they hold names, accounts and amounts of real people. Run the tool
  where the file already is, and keep its reports with the same care, because a finding quotes payment ids, codes and
  parts of names.
- Do not hide the exit code with a trailing `|| true`. To keep the report without failing, keep `--fail-on` at `error`
  and keep the SARIF or JSON report as an artifact of the job.
- Treat a report built from a file you do not trust as untrusted data.
- If the tool ever reports `secret-in-batch`, treat the key or seed as exposed: remove it from the file and from every
  place the file was copied to, and move the funds it controls to a new key. The tool does not show the value, but the
  file itself was readable to everyone with access to it.

## Protecting the batch

A payout batch moves money as soon as it is sent. Keep the process that builds it in code, review a change to it like
code, and require a second person to approve a batch before it is sent. Check every batch with this tool in that
process, and screen it with the sanctions screening of the team as well: this tool reads codes, accounts and amounts, not
who the beneficiaries are.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with
`ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
