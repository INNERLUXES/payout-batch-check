# 3. Check the batch on disk, and contact no bank or chain

## Status

Accepted

## Context

Some facts about a payment live with a bank, a chain or a provider: whether an account behind an IBAN is open and in
the name of the beneficiary, whether a BIC is in the directory of Swift, whether a wallet address is held by anyone,
which contract a token is, the rate of the day, and whether a payment was sent in an earlier batch. A check could call an
account check service on every run, look up each BIC, query a chain for each wallet and fetch the newest IBAN registry
and currency list. Each would need the network and an account with a provider, would make the result depend on the state
of a server and of a chain, would need keys in the pipeline, would send the names and accounts of the beneficiaries to a
third party, and would let a file in a pull request make the pipeline reach any address it names.

What a team needs first, before the batch is sent, is a list of what is wrong in the file and where: the IBANs, the
BICs, the currencies and their decimals, the countries, the ids, the totals and the wallets, as the file writes them.

## Decision

1. The tool reads the one file it is given, and nothing else. It contacts no bank, chain, provider or API, fetches
   nothing, needs no key, runs no program and sends no data anywhere. It cannot send a payment.
2. The IBAN registry, the currency list and the country codes are tables in the code, copied from the saved copies of
   the registry of Swift, list one of ISO 4217 from SIX and the M49 table of the UN Statistics Division, and a test
   checks each table against its copy. They are updated in a release, with the copy, never fetched while the tool runs.
3. The rules the checks apply are listed in docs/method.md, and the public pages each documented check rests on are
   named in src/data.js and research/sources.md, each fetched and read before it was listed, with a copy of its text
   under research/sources.
4. The table of networks and tokens in src/networks.js is short and the tool's own, and says so. A network or a token
   out of it is a warning that asks for a look by hand, never a guess.
5. The tool lists what to look at and what to change; it changes nothing and sends nothing.

## Consequences

- The result depends only on the file, and a run needs no network access, no secret and no account with a provider, and
  sends the data of no beneficiary anywhere.
- An IBAN with the right check digits and length, a BIC in the right form and a wallet address in the right form pass,
  even when no account, bank or wallet stands behind them; docs/secure-defaults.md says to verify accounts with the bank
  or provider as well.
- An IBAN format, a currency or a country added after the copies were saved is not known until the tables are updated in
  a release, with a test.
