# payout-batch-check: examples/bad/batch.json

- File: 240 lines, 6,625 bytes
- Batch: PAYOUT-EXAMPLE-BAD; JSON; 22 payments \(17 bank, 4 stablecoin\); debit EUR; paid in EUR, GBP, CHF, EUX, JPY, SEK, USDC, DAI and 2 more
- Findings: 23 \(16 error, 7 warning\)
- Result: **FAIL - 16 findings at or above error \(16 error, 7 warning\)**

## Findings

| Level | Check | Where | Message |
| --- | --- | --- | --- |
| error | batch-total-mismatch | examples/bad/batch.json:6 | The batch has a payment of 2500 USD, but its totals give none for USD, so a bank that checks the totals of the batch refuses it. This is a best practice of this tool, not a rule in the pages it cites. Fix: Work out the totals again from the rows, and find the row that was added or lost before the batch is sent. |
| error | batch-total-mismatch | examples/bad/batch.json:7 | The batch gives a total of 6082 EUR, but its 10 payments in EUR add up to 5982. A batch whose control total is off is refused by the bank, or a row was added or lost on the way. This is a best practice of this tool, not a rule in the pages it cites. Fix: Work out the totals again from the rows, and find the row that was added or lost before the batch is sent. |
| error | iban-checksum | examples/bad/batch.json:35 | The iban of payment P-002, GR1601101250000000012300696, fails the check of ISO 13616: the remainder of MOD 97-10 is 28, not 1, so a character is wrong or two are swapped. A bank may return or reject the payment. Fix: Copy the IBAN again from the beneficiary, in electronic form or in groups of four; never correct the check digits by hand to make it pass. |
| error | iban-length | examples/bad/batch.json:45 | The iban of payment P-003 has 17 characters, but the IBAN registry of Swift gives NL IBANs 18. Fix: Copy the IBAN again from the beneficiary; an IBAN of the right country always has the length of the registry. |
| error | bic-format | examples/bad/batch.json:65 | The bic of payment P-005, "EXMP GB2L", has 9 characters, not 8 or 11. A BIC of ISO 9362 is four letters or digits, two letters of a country, two letters or digits, and an optional branch code of three. Fix: Copy the BIC again from the bank of the beneficiary, in capitals and with no spaces. |
| error | currency-unknown | examples/bad/batch.json:88 | The currency of payment P-007 is "EUX", which is not an alphabetic code of the ISO 4217 list SIX keeps. A bank refuses a payment in a currency it does not know. Fix: Write the three capital letters of the currency as list one of ISO 4217 gives them, such as EUR, USD or JPY. |
| error | amount-decimals | examples/bad/batch.json:99 | The amount of payment P-008 is 150000.50 JPY, with 1 decimal place, but the ISO 4217 list gives JPY a minor unit of 0: it has no fractions. A bank refuses the amount or rounds it. Fix: Round the amount to the minor unit of the currency before the batch is sent, and make sure the rounding is the one the beneficiary is owed. |
| error | amount-invalid | examples/bad/batch.json:110 | The amount of payment P-009 is negative \(-200.00\); a payout pays out, and a reversal or a fee belongs in a file of its own. This is a best practice of this tool, not a rule in the pages it cites. Fix: Write the amount as a plain decimal number above 0, such as 1500.00, and move reversals and fees to a file of their own. |
| error | country-invalid | examples/bad/batch.json:116 | The beneficiaryCountry of payment P-010 is "UK", which is not a two-letter code of the country table the tool reads \(the ISO alpha-2 codes of the UN M49 table\). The code of the United Kingdom is GB. Fix: Write the two capital letters of the country, such as GB for the United Kingdom. |
| error | payment-id-duplicate | examples/bad/batch.json:124 | The paymentId P-001 is also the id of the payment at line 19; a bank or a payout provider refuses the second, or pays both when it takes the id for a new instruction. This is a best practice of this tool, not a rule in the pages it cites. Fix: Give every payment an id of its own and keep it the same when the batch is sent again, so that a provider can refuse a payment it has already made. |
| error | beneficiary-name-missing | examples/bad/batch.json:143 | Payment P-013 has no beneficiaryName, so the payment cannot be screened against sanctions lists and the bank of the beneficiary cannot match it to the account holder. This is a best practice of this tool, not a rule in the pages it cites. Fix: Give the full name of the beneficiary as the bank or the wallet provider knows it. |
| error | wallet-address-malformed | examples/bad/batch.json:177 | The walletAddress of payment P-016 on Ethereum, "0x1234", has 4 characters after 0x, not 40; an address on Ethereum is 0x followed by 40 hex digits, not the zero address. A payment to it fails, or goes to an address no one holds. Fix: Copy the wallet address again from the beneficiary, and confirm it with a small test payment before a large one. |
| error | token-not-allowed | examples/bad/batch.json:186 | Payment P-017 pays in DAI, which is not in the list of tokens the batch may pay in \(USDC and USDT; --tokens sets another\). This is a best practice of this tool, not a rule in the pages it cites. Fix: Pay in a token of the list, or give the tokens your team pays in with --tokens. |
| error | secret-in-batch | examples/bad/batch.json:209 | The batch holds the key "seedPhrase", which names a seed, a mnemonic or a private key. The tool never reads one, and the value is not shown. Fix: Remove the value from the file and from wherever the file was copied, treat it as exposed and move the funds it controls. A payout batch names wallets by their public address only. |
| error | field-invalid | examples/bad/batch.json:226 | The rail of payment P-021 is "wire"; it must be bank or stablecoin. Fix: Write the value as docs/inputs.md shows: text for names, codes, accounts and addresses, decimal numbers for amounts and rates. |
| error | field-missing | examples/bad/batch.json:231 | Payment P-022 is a bank payment with no currency. Fix: Add the field named; docs/inputs.md lists what each payment needs. |
| warning | iban-country-mismatch | examples/bad/batch.json:55 | The iban of payment P-004 is an account in BE, but the beneficiaryCountry is AT. Either can be right, as a beneficiary may bank abroad, but a wrong country is also how a payment reaches the wrong account. This is a best practice of this tool, not a rule in the pages it cites. Fix: Check the beneficiary country and the IBAN with the beneficiary; when the account is abroad on purpose, keep the warning and say so in the review. |
| warning | bic-country-mismatch | examples/bad/batch.json:76 | The bic of payment P-006, EXMPDEFF, is of a bank in DE, but the beneficiaryCountry is CH and the iban is in CH. This is a best practice of this tool, not a rule in the pages it cites. Fix: Check the BIC with the beneficiary; when the bank is abroad on purpose, keep the warning and say so in the review. |
| warning | payment-possible-duplicate | examples/bad/batch.json:141 | Payment P-012 pays 1500 EUR to the same account as payment P-001 at line 19, for the same amount. It may be one payment written twice. This is a best practice of this tool, not a rule in the pages it cites. Fix: Check that the two payments are meant; remove one when the same payment was written twice. |
| warning | beneficiary-name-short | examples/bad/batch.json:153 | The beneficiaryName of payment P-014 is "Q", with fewer than 3 letters, too short to screen against sanctions lists or to match to the account holder. This is a best practice of this tool, not a rule in the pages it cites. Fix: Write the full name of the beneficiary, not initials or a placeholder. |
| warning | fx-rate-missing | examples/bad/batch.json:167 | Payment P-015 is paid in USD from EUR, the debitCurrency of the batch, and gives no fxRate, so the amount debited is not known until the bank converts it. This is a best practice of this tool, not a rule in the pages it cites. Fix: Give the rate the batch was priced at in fxRate, so that the amount debited is known before the batch is sent. |
| warning | network-token-unknown | examples/bad/batch.json:196 | Payment P-018 pays in USDT on Base, a pair the tool's table does not list, so the token may be a bridged copy or not exist on the network. Check the token contract of the issuer by hand. This is a best practice of this tool, not a rule in the pages it cites. Fix: Check by hand that the issuer of the token lists a contract on the network, and how a wallet address on it is written. |
| warning | field-unknown | examples/bad/batch.json:220 | The key "purposeCod" of payment P-020 is not one the tool reads, so its value was left out of every check. Did you mean "purposeCode"? The keys of payment P-020 are paymentId, beneficiaryName, beneficiaryCountry, rail, iban, accountNumber, bic, currency, amount, network, token, walletAddress, purposeCode, fxRate, sourceCurrency, notes. Fix: Correct the spelling to a field of docs/inputs.md, or remove it. |

## Totals (10)

| Unit | Payments | Sum of rows | Total given | State |
| --- | ---: | ---: | ---: | --- |
| EUR | 10 | 5982 | 6082 | differs |
| GBP | 1 | 1200 | 1200 | matches |
| CHF | 1 | 950 | 950 | matches |
| EUX | 1 | 410 | 410 | matches |
| JPY | 1 | 150000.5 | 150000.5 | matches |
| SEK | 1 | 0 | 200 | 1 not read |
| USDC | 2 | 1250 | 1250 | matches |
| DAI | 1 | 300 | 300 | matches |
| USDT | 1 | 400 | 400 | matches |
| USD | 1 | 2500 | - | no total given |

Note: the total for SEK was not compared, because the amount of one of its payments could not be read

This report is an input to a review before the batch is sent: not a compliance or sanctions screening and not a guarantee that a payment will arrive.
