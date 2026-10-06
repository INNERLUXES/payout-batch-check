# Rules and sources

Every check of the tool, with what it looks at, the points of the public pages and lists it rests on, what it cannot see, and what to change. The points are in this project's own words and are the ones the reports show with `--explain`; each page was fetched and read before it was listed, and a copy of its text is kept under [research/sources](../research/sources) so that a point can be checked against the page it came from. [../research/sources.md](../research/sources.md) has a note on each page.

The tool is an input to a review before the batch is sent: not a compliance or sanctions screening and not a guarantee that a payment will arrive. A check that is a best practice of this tool says so in its message; it is not a rule in the pages it cites.

## The pages

- Swift: International Bank Account Number (IBAN): https://www.swift.com/standards/data-standards/iban-international-bank-account-number (copy: `research/sources/swift-iban-page.txt`)
- Swift: IBAN Registry (TXT): https://www.swift.com/swift-resource/11971/download (copy: `research/sources/swift-iban-registry.txt`)
- Central Bank of the Republic of Turkiye: Communique on the International Bank Account Number: https://tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Bottom+Menu/IBAN/Communique (copy: `research/sources/tcmb-iban-communique.txt`)
- Swift: Business Identifier Code (BIC): https://www.swift.com/standards/data-standards/bic-business-identifier-code (copy: `research/sources/swift-bic-page.txt`)
- SIX: ISO 4217 list one, current currency and funds code list: https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml (copy: `research/sources/six-iso-4217-list-one.txt`)
- United Nations Statistics Division: Standard country or area codes for statistical use (M49): https://unstats.un.org/unsd/methodology/m49/overview/ (copy: `research/sources/un-m49-country-codes.txt`)
- ethereum.org: Ethereum accounts: https://ethereum.org/en/developers/docs/accounts/ (copy: `research/sources/ethereum-org-accounts.txt`)
- Solana: Account Structure: https://solana.com/docs/core/accounts/account-structure (copy: `research/sources/solana-account-structure.txt`)
- TRON Developer Hub: Accounts and keys: https://developers.tron.network/docs/account (copy: `research/sources/tron-accounts-and-keys.txt`)

## batch-unreadable

- Level: error
- Kind: a problem with the batch file itself; it has no setting to lower
- Looks at: the file is not JSON or CSV the readers can follow, or its top level is not an object, so no payment was read.
- Cannot see: It stops at the first place that is not strict JSON or a strict CSV table, or at a top level that is not an object, so nothing in that file is checked.
- What to change: Write the batch as one JSON object or as a CSV table with a header row (docs/inputs.md), and fix the line named.
- Points of the pages: none; this check is about the batch file itself.

## field-missing

- Level: error
- Kind: a problem with the batch file itself; it has no setting to lower
- Looks at: a field the checks need is not in the batch: the payments, a payment id, a beneficiary country, a rail, an amount, the currency and account of a bank payment, or the network, token and wallet of a stablecoin payment.
- Cannot see: It names the field and the payment that lacks it; it does not guess the value, and the checks that need the field do not run for that payment.
- What to change: Add the field named; docs/inputs.md lists what each payment needs.
- Points of the pages: none; this check is about the batch file itself.

## field-unknown

- Level: warning
- Kind: a problem with the batch file itself; it has no setting to lower
- Looks at: a key or column the tool does not read, often a misspelt one; its value was left out of every check.
- Cannot see: It cannot tell what a misspelt key was meant to say; it names a known key when one differs only in case or separators or starts the same, and the value is left out of every check. In a CSV file an unknown column is reported once, at the header.
- What to change: Correct the spelling to a field of docs/inputs.md, or remove it.
- Points of the pages: none; this check is about the batch file itself.

## field-invalid

- Level: error
- Kind: a problem with the batch file itself; it has no setting to lower
- Looks at: a value of the wrong type or form: an object where text belongs, a rail the tool does not know, a field the rail of the payment does not take, a rate that is not a decimal above 0, or a batch field that differs from row to row.
- Cannot see: It names the value and the form it needs; the value is left out of the checks that need it.
- What to change: Write the value as docs/inputs.md shows: text for names, codes, accounts and addresses, decimal numbers for amounts and rates.
- Points of the pages: none; this check is about the batch file itself.

## field-duplicate

- Level: error
- Kind: a problem with the batch file itself; it has no setting to lower
- Looks at: a column is named twice in the header of a CSV file, so two readers of the file could take different values; the second column was left out.
- Cannot see: It compares the names of the header as written; two names that differ in case are two columns, and the second is then reported as unknown or read as its own field.
- What to change: Keep one column of each name. In a JSON file a key written twice stops the reader (batch-unreadable).
- Points of the pages: none; this check is about the batch file itself.

## secret-in-batch

- Level: error
- Kind: a problem with the batch file itself; it has no setting to lower
- Looks at: the batch holds a private key, a seed or a mnemonic, under a key or column named for one or as a value shaped like one; the tool never reads it and never shows it.
- Cannot see: It knows keys and seeds by the name of their key or column and by their shape; a secret split over fields, encoded another way or written under another name is not caught. The search is kept unchanged from the sibling tools, and this check is about the file and rests on no point of a page.
- What to change: Remove the value from the file and from wherever the file was copied, treat it as exposed and move the funds it controls. A payout batch names wallets by their public address only.
- Points of the pages: none; this check is about the batch file itself.

## iban-checksum

- Level: error
- Kind: documented
- Looks at: an IBAN that fails the MOD 97-10 check of ISO 13616, or is not in the form of an IBAN at all (two letters, two check digits, up to 30 letters and digits).
- Cannot see: It checks the form and the check digits of the IBAN as written, with spaces left out and letters read as capitals; an IBAN with the right check digits can still be an account that does not exist or belongs to someone else, which only the bank can tell.
- What to change: Copy the IBAN again from the beneficiary, in electronic form or in groups of four; never correct the check digits by hand to make it pass.
- Points of the pages:
  - To check the two check digits, the communique moves the first four characters to the end, turns every letter into a number from 10 for A to 35 for Z, and asks that the result divided by 97 leave 1, the MOD 97-10 of ISO 7064. (Central Bank of the Republic of Turkiye: Communique on the International Bank Account Number, https://tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Bottom+Menu/IBAN/Communique)
  - The communique lets a bank return or reject a transfer order whose IBAN fails that check. (Central Bank of the Republic of Turkiye: Communique on the International Bank Account Number, https://tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Bottom+Menu/IBAN/Communique)

## iban-length

- Level: error
- Kind: documented
- Looks at: an IBAN whose length is not the one the IBAN registry of Swift gives its country; the IBAN of a country out of the saved registry is checked for its check digits only.
- Cannot see: It knows the length of the 89 countries of the saved copy of the registry and nothing of the structure of their account part; an IBAN of a prefix out of the copy is checked for its check digits only, and a note names the prefix.
- What to change: Copy the IBAN again from the beneficiary; an IBAN of the right country always has the length of the registry.
- Points of the pages:
  - ISO named Swift the registration authority for the national formats of the IBAN, and the registry Swift publishes holds the format of each country whose IBAN follows ISO 13616. (Swift: International Bank Account Number (IBAN), https://www.swift.com/standards/data-standards/iban-international-bank-account-number)
  - For every country it covers, the registry gives the two letters an IBAN starts with, its structure, its length in electronic form and an example; an IBAN of Norway has 15 characters and one of Saint Lucia 32. (Swift: IBAN Registry (TXT), https://www.swift.com/swift-resource/11971/download)

## iban-country-mismatch

- Level: warning
- Kind: best practice
- Looks at: the country of the IBAN is not the beneficiary country, and not a territory the registry lists under that IBAN prefix.
- Cannot see: It compares the two letters of the IBAN with the beneficiary country and the territories the registry lists under the prefix; it cannot tell a beneficiary who banks abroad on purpose from a wrong account.
- What to change: Check the beneficiary country and the IBAN with the beneficiary; when the account is abroad on purpose, keep the warning and say so in the review.
- Points of the pages:
  - Some prefixes of the registry stand for other territories as well: Aland banks under FI, the Isle of Man, Jersey and Guernsey under GB, and the French overseas departments and territories under FR. (Swift: IBAN Registry (TXT), https://www.swift.com/swift-resource/11971/download)
- The tool's own choice: comparing the country of the IBAN with the beneficiary country is a best practice of this tool, not a rule in the pages it cites; a beneficiary may hold an account abroad, and the registry only says which territories a prefix covers.

## bic-format

- Level: error
- Kind: documented
- Looks at: a BIC that is not 8 or 11 characters of the form of ISO 9362 (four letters or digits, two letters of a country, two letters or digits, an optional branch code of three), or whose country letters are not a country code.
- Cannot see: It checks the form of the BIC and that its country letters are a country code of the table; whether a bank holds the BIC, and whether it is connected to the Swift network, needs the BIC directory, which the tool does not read.
- What to change: Copy the BIC again from the bank of the beneficiary, in capitals and with no spaces.
- Points of the pages:
  - ISO 9362 defines the BIC as eight characters, four letters or digits for the party, two letters for a country code of ISO 3166-1 and two letters or digits after them, with a branch code of three more characters that may be added. (Swift: Business Identifier Code (BIC), https://www.swift.com/standards/data-standards/bic-business-identifier-code)

## bic-country-mismatch

- Level: warning
- Kind: best practice
- Looks at: the country letters of the BIC are not the beneficiary country, or a territory the IBAN registry lists under that country.
- Cannot see: It compares the country letters of the BIC with the beneficiary country and the territories the IBAN registry lists under that country; a bank abroad can be right.
- What to change: Check the BIC with the beneficiary; when the bank is abroad on purpose, keep the warning and say so in the review.
- Points of the pages:
  - ISO 9362 defines the BIC as eight characters, four letters or digits for the party, two letters for a country code of ISO 3166-1 and two letters or digits after them, with a branch code of three more characters that may be added. (Swift: Business Identifier Code (BIC), https://www.swift.com/standards/data-standards/bic-business-identifier-code)
- The tool's own choice: comparing the country of the BIC with the beneficiary country is a best practice of this tool, not a rule in the pages it cites; the BIC page gives the place of the country code, not a rule that the bank and the beneficiary share a country.

## currency-unknown

- Level: error
- Kind: documented
- Looks at: a currency, a source currency or a debit currency that is not an alphabetic code of the ISO 4217 list SIX keeps, written in capitals.
- Cannot see: It knows the codes of the saved copy of list one; a code that SIX adds after the copy was saved is reported until the table is updated in a release, and a code that is withdrawn stays known until then.
- What to change: Write the three capital letters of the currency as list one of ISO 4217 gives them, such as EUR, USD or JPY.
- Points of the pages:
  - List one of ISO 4217, kept by SIX as the maintenance agency, names for each country or entity its currency with an alphabetic code of three letters, a numeric code and a minor unit. (SIX: ISO 4217 list one, current currency and funds code list, https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml)

## amount-decimals

- Level: error
- Kind: documented
- Looks at: an amount of a bank payment with more decimal places than the minor unit ISO 4217 gives its currency, such as JPY with any fraction or EUR with three places.
- Cannot see: It compares the places the amount needs, with trailing zeros left out, with the minor unit of the currency; a code with no minor unit (N.A. in the list) is not checked, and the decimals of a token are not checked at all.
- What to change: Round the amount to the minor unit of the currency before the batch is sent, and make sure the rounding is the one the beneficiary is owed.
- Points of the pages:
  - The minor unit of the list is the number of decimal places a currency is counted in: 0 for the Japanese yen, 2 for the euro, 3 for the Kuwaiti dinar, and N.A. for codes such as gold that have no fraction. (SIX: ISO 4217 list one, current currency and funds code list, https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml)

## amount-invalid

- Level: error
- Kind: best practice
- Looks at: an amount that is 0, negative or not a plain decimal number (a sign, an exponent, a currency sign or a thousands separator).
- Cannot see: It reads the amount from the characters of the file; it cannot tell whether a positive amount is the one the beneficiary is owed.
- What to change: Write the amount as a plain decimal number above 0, such as 1500.00, and move reversals and fees to a file of their own.
- Points of the pages: none.
- The tool's own choice: refusing an amount of 0, a negative amount and an amount in another notation is a best practice of this tool, not a rule in the pages it cites; none of the cited pages sets a rule on how a batch writes an amount.

## amount-above-max

- Level: warning
- Kind: best practice
- Looks at: an amount above the limit --max-amount sets for every payment or for its currency or token; the check runs only when the option is given.
- Cannot see: It runs only with --max-amount and compares an amount with the limit of its unit or with the limit for every payment; it knows no limit of its own and converts nothing.
- What to change: Check the payment with its approver before the batch is sent, or set the limit your team has agreed with --max-amount.
- Points of the pages: none.
- The tool's own choice: a limit on the amount of one payment is a best practice of this tool, not a rule in the pages it cites; the limit is the team's own, and the tool has none of its own.

## country-invalid

- Level: error
- Kind: documented
- Looks at: a beneficiary country that is not a two-letter code of ISO 3166-1 as the UN M49 table lists them, written in capitals, such as UK for GB.
- Cannot see: The UN table lists no code for Taiwan (TW), which ISO 3166-1 assigns, so a payment to it is reported and needs a look by hand; the prefixes of the IBAN registry, such as XK, are accepted. Whether the country is the right one for the beneficiary is not known.
- What to change: Write the two capital letters of the country, such as GB for the United Kingdom.
- Points of the pages:
  - The M49 table of the UN Statistics Division gives each country or area it lists a number of three digits and its ISO codes of two and of three letters. (United Nations Statistics Division: Standard country or area codes for statistical use (M49), https://unstats.un.org/unsd/methodology/m49/overview/)

## payment-id-duplicate

- Level: error
- Kind: best practice
- Looks at: two payments share a payment id (compared without case and outer spaces), so the second is refused or, where the id is not checked, paid as well.
- Cannot see: It compares the ids of one file; an id used in an earlier batch is not seen.
- What to change: Give every payment an id of its own and keep it the same when the batch is sent again, so that a provider can refuse a payment it has already made.
- Points of the pages: none.
- The tool's own choice: asking for an id of its own for each payment is a best practice of this tool, not a rule in the pages it cites; providers use the id to find a payment and to refuse one sent twice, and no cited page sets the rule.

## payment-possible-duplicate

- Level: warning
- Kind: best practice
- Looks at: two payments go to the same account (IBAN, account number and BIC, or wallet on a network) for the same amount in the same currency or token.
- Cannot see: It compares the account, the unit and the amount of the payments of one file; two payments of one amount to one account can be right, and a payment sent in an earlier batch is not seen.
- What to change: Check that the two payments are meant; remove one when the same payment was written twice.
- Points of the pages: none.
- The tool's own choice: looking for two payments of one amount to one account is a best practice of this tool, not a rule in the pages it cites; two such payments can be right, such as two invoices of the same amount.

## beneficiary-name-missing

- Level: error
- Kind: best practice
- Looks at: a payment with no beneficiary name, which cannot be screened against sanctions lists or matched to the account holder.
- Cannot see: It looks for a name, not for the right one; screening the name against sanctions lists is for the screening of the team.
- What to change: Give the full name of the beneficiary as the bank or the wallet provider knows it.
- Points of the pages: none.
- The tool's own choice: asking for a name on every payment is a best practice of this tool, not a rule in the pages it cites; the name is what sanctions screening and the bank of the beneficiary read, and the cited pages are about codes and accounts.

## beneficiary-name-short

- Level: warning
- Kind: best practice
- Looks at: a beneficiary name with fewer than three letters or digits, too short to screen or to match.
- Cannot see: It counts letters and digits of any script; three is the tool's own floor, and a real name can be that short.
- What to change: Write the full name of the beneficiary, not initials or a placeholder.
- Points of the pages: none.
- The tool's own choice: the least length of a name is a best practice of this tool, not a rule in the pages it cites; three letters is the tool's own floor, and a real name can be that short.

## batch-total-mismatch

- Level: error
- Kind: best practice
- Looks at: the total the batch gives for a currency or token is not the sum of its payments in that unit, or a unit with payments has no total.
- Cannot see: It compares the totals the batch gives with the sum of the payments that could be read; when the amount of a payment of a unit could not be read, the total of that unit is not compared and a note says so. A CSV file gives no totals, and then nothing is compared.
- What to change: Work out the totals again from the rows, and find the row that was added or lost before the batch is sent.
- Points of the pages: none.
- The tool's own choice: comparing the totals of a batch with its rows is a best practice of this tool, not a rule in the pages it cites; a control total is how many banks and providers catch a changed file, and no cited page sets the rule.

## wallet-address-malformed

- Level: error
- Kind: documented
- Looks at: a wallet address not in the form of its network: 0x and 40 hex digits (not the zero address) on an EVM network, 32 to 44 base58 characters on Solana, T and 33 base58 characters on Tron.
- Cannot see: It checks the form of the address only: no checksum of EIP-55 or of Base58Check, and no look-up on a chain, so a well-formed address that no one holds, or the address of a contract that cannot receive the token, passes. The range of 32 to 44 characters on Solana is the tool's reading of a 32-byte value written in base58.
- What to change: Copy the wallet address again from the beneficiary, and confirm it with a small test payment before a large one.
- Points of the pages:
  - An Ethereum address is made from the last 20 bytes of a Keccak-256 hash of the public key with 0x in front, 42 characters with 40 hex digits, and a contract account has an address of the same form. (ethereum.org: Ethereum accounts, https://ethereum.org/en/developers/docs/accounts/)
  - Every Solana account has an address of 32 bytes, either an Ed25519 public key or one derived from a program, and it is written as a base58 string. (Solana: Account Structure, https://solana.com/docs/core/accounts/account-structure)
  - A TRON address is 21 bytes that begin with the byte 0x41, and wallets and explorers show it in Base58Check as 34 characters starting with T. (TRON Developer Hub: Accounts and keys, https://developers.tron.network/docs/account)

## token-not-allowed

- Level: error
- Kind: best practice
- Looks at: a stablecoin payment in a token that is not in the list of tokens the batch may pay in (USDC and USDT unless --tokens sets another).
- Cannot see: It compares the symbol as written with the list; the contract of the token is not in the batch and is not checked.
- What to change: Pay in a token of the list, or give the tokens your team pays in with --tokens.
- Points of the pages: none.
- The tool's own choice: a list of tokens a batch may pay in is a best practice of this tool, not a rule in the pages it cites; the default list is the tool's own and --tokens sets yours.

## network-token-unknown

- Level: warning
- Kind: best practice
- Looks at: a stablecoin payment on a network out of the tool's table, or in a token the table does not list on that network.
- Cannot see: The table of networks and tokens is the tool's own and short; a pair out of it can be real, and a pair in it can still be the wrong contract.
- What to change: Check by hand that the issuer of the token lists a contract on the network, and how a wallet address on it is written.
- Points of the pages: none.
- The tool's own choice: the table of networks and of the tokens on each is a best practice of this tool, not a rule in the pages it cites; no cited page gives one, and a pair out of it is a question, not an error.

## fx-rate-missing

- Level: warning
- Kind: best practice
- Looks at: a bank payment in a currency other than its source currency, or the debit currency of the batch, with no FX rate.
- Cannot see: It looks for a rate, not at its value; whether the rate is the one agreed, and what the bank of the beneficiary charges, are for the team.
- What to change: Give the rate the batch was priced at in fxRate, so that the amount debited is known before the batch is sent.
- Points of the pages: none.
- The tool's own choice: asking for the rate of a converted payment is a best practice of this tool, not a rule in the pages it cites; a bank can convert at its own rate, and the batch then debits an amount no one checked.
