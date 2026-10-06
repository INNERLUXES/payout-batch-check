# Sources

The public pages and lists the documented checks of this tool are based on, each with a short note in this project's
own words on what the page says and which checks lean on it. Nothing here is a copy of a page: read the page itself for
its exact wording. A plain text copy of each page, taken when it was read, is kept in [research/sources](sources) so
that a point can be checked against the page it came from, and the copies are the pages' own words, not this project's.
src/data.js holds the pages and the points the reports show, and test/data.test.js checks that every page in src/data.js
is listed here and has its copy, that no point quotes its page at length, that the table of IBAN formats of
src/banking.js, the table of currencies of src/currencies.js and the country codes of src/countries.js are the ones of
the saved copies, and that every example IBAN of the copy of the registry passes the checksum.

The tool reads a payout batch and runs nothing; its result is an input to a review before the batch is sent: not a
compliance or sanctions screening and not a guarantee that a payment will arrive. These notes say what the pages say so
a reader can follow a finding back to its source. The pages were chosen with web addresses that hold no number that
reads like a year, and each was read in a form its site serves as text where there was one: the text of the article of
the two Swift pages in a browser, the registry of Swift in its .txt form, list one of ISO 4217 as the XML file of SIX,
the English table of the UN page from its HTML, the communique of the Central Bank of the Republic of Turkiye from its
HTML, the source of the page in its repository for ethereum.org, and the markdown the site serves for the Solana and
TRON pages.

Where a check rests on a statement the pages do not make, it is a best practice of this tool, its message says so, and
the note for the check in [docs/rules-and-sources.md](../docs/rules-and-sources.md) names the choice. No page gives a
rule that an amount is above 0, that a payment id is used once, that two payments of one amount to one account are
suspect, that a payment carries a beneficiary name of some length, that the totals of a batch match its rows, that the
country of an IBAN or a BIC matches the beneficiary, that a converted payment carries its rate, which tokens a batch may
pay in or which tokens exist on which network; those checks are best practices of this tool.

## How the facts were checked, and what could not be read

- ISO keeps ISO 3166-1 on its Online Browsing Platform, which shows the codes only after its terms of use are accepted.
  The tool takes the two-letter codes from the table of the UN Statistics Division instead, whose column "ISO-alpha2
  Code" gives the code of each country or area it lists. The UN table lists 248 of them and no code for Taiwan (TW),
  which ISO 3166-1 assigns; docs/limits.md says so, and a payment to TW is reported for a look by hand. The prefixes of
  the IBAN registry, which Swift writes as ISO 3166 codes, are accepted as well, which adds XK (Kosovo).
- The registry of Swift does not describe the MOD 97-10 check in its .txt form. The check is taken from the communique of
  the Central Bank of the Republic of Turkiye, a national central bank, which describes it step by step with the
  conversion table of letters and an example; every example IBAN of the registry passes it (test/data.test.js).
- The Swift pages are served to a browser and refused to other clients; they were read in a browser, as text.

## What the copies leave out

Each copy is the text of the page as it was read, with a two-line header that names its address and how it was read,
and with these lines left out, so that no copy holds a date, a number that reads like a year, a word this project keeps
out of every file or personal contact details, and every copy is plain ASCII (decision 1 in docs/decisions):

- Swift, IBAN Registry (TXT): the registry is a table of data elements with one column for each country; the copy keeps
  one line for each country with the data elements Name of country, IBAN prefix country code (ISO 3166), SEPA country,
  IBAN structure, IBAN length, IBAN electronic format example, BBAN structure, BBAN length and Country code includes
  other countries/territories, in that order. It leaves out the Effective date of each format (a date), the data
  elements on the position and pattern of the bank and branch identifiers, the domestic account number, bank and branch
  examples, the print format example, the SEPA country also includes element, and the contact details of the national
  bodies (names, addresses, telephone numbers and email addresses of people). In the last data element, the part
  "(French part)" after MF is kept.
- Swift, IBAN and BIC pages: the text of the article only; the links to related content and the sign-up line at the end
  are left out, and the curly quotes around "business party identifier" are written as ASCII.
- SIX, ISO 4217 list one: the XML file is kept as one line for each entry with its six fields; the date of publication
  of the list, an attribute of its root element, is left out, the Fund field is written as yes or no from the IsFund
  attribute, and the letters with accents of the names of entities (such as ALAND ISLANDS and CURACAO) are written
  without their accents.
- UN Statistics Division, M49: the English table only, with its columns Country or Area, M49 Code, ISO-alpha2 Code and
  ISO-alpha3 Code; the columns of regions, sub-regions and the groups of countries, the tables in the other languages,
  the menus of the site and its footer, which holds a year, are left out, and the name Cote d'Ivoire is written without
  its accent.
- Central Bank of the Republic of Turkiye, Communique: the text from the title of the communique to the end of its
  Appendix no. 3. Left out are the number of the communique and the line of its publication in the Official Gazette,
  the paragraphs that name a law, an amendment or a date of entry into force (Article 2, point a and point e of Article
  3, the heading and the first, fourth and fifth paragraphs of Article 7, the Provisional Article 1, Article 9 and the
  footnote of amendments), each of which holds a date or a year, and the paragraph that lists the letters with accents an
  IBAN of Turkiye may not hold. The menus and the footer of the site are left out too. The article that lets a bank
  return or reject a transfer order with an invalid IBAN, and both appendices on the check digits, are kept whole.
- ethereum.org, Ethereum accounts: the two lines of log output of an example, which hold a date.
- TRON Developer Hub, Accounts and keys: the front matter of the markdown, which holds the date of the last change and a
  pointer to an index of the documentation for automated readers, and an emoji before the word Prerequisites.
- Every copy: curly quotes and dashes are written as ASCII quotes and hyphens.

## IBAN

### Swift: International Bank Account Number (IBAN)

https://www.swift.com/standards/data-standards/iban-international-bank-account-number

Copy: research/sources/swift-iban-page.txt

What the IBAN is and who keeps its formats: ISO 13616 sets the structure of a national IBAN format, ISO designated Swift
as the registration authority for those formats, and Swift publishes the registry with the format of each country that
follows the standard, as a PDF and as a .txt file. `iban-length` leans on it.

### Swift: IBAN Registry (TXT)

https://www.swift.com/swift-resource/11971/download

Copy: research/sources/swift-iban-registry.txt

The registry in its .txt form, linked from the page above: for 89 countries the prefix, whether the country is in SEPA,
the structure and the length of the IBAN and of the account part, an example IBAN in electronic form, and the other
countries or territories a prefix covers (Aland under FI, the Isle of Man, Jersey and Guernsey under GB, the French
overseas departments and territories under FR). The table of src/banking.js is copied from it. `iban-length` and
`iban-country-mismatch` lean on it, `bic-country-mismatch` uses the territories it lists, and the example IBANs of the
tests and the examples come from it.

### Central Bank of the Republic of Turkiye: Communique on the International Bank Account Number

https://tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Bottom+Menu/IBAN/Communique

Copy: research/sources/tcmb-iban-communique.txt

How banks in Turkiye build, show and check an IBAN under ISO 13616: the structure of an IBAN of Turkiye, the electronic
form with no spaces and the printed form in groups of four, the calculation of the check digits and their validation
with MOD 97-10 of ISO 7064 (move the first four characters to the end, turn letters into the numbers 10 to 35, and the
remainder of dividing by 97 must be 1), and the rule that a bank may return or reject a transfer order whose IBAN fails
the check. `iban-checksum` leans on it.

## BIC

### Swift: Business Identifier Code (BIC)

https://www.swift.com/standards/data-standards/bic-business-identifier-code

Copy: research/sources/swift-bic-page.txt

What the BIC of ISO 9362 is and how it is written: an 8-character business party identifier of a party prefix of four
letters or digits, a country code of ISO 3166-1 in two letters and a party suffix of two letters or digits, with an
optional branch identifier of three characters; Swift issues BICs as the registration authority. `bic-format` and
`bic-country-mismatch` lean on it.

## Currencies

### SIX: ISO 4217 list one, current currency and funds code list

https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml

Copy: research/sources/six-iso-4217-list-one.txt

List one of ISO 4217 as SIX, the maintenance agency of the standard, publishes it (linked from
https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html): for
each country or entity its currency, the alphabetic code, the numeric code and the minor unit, the number of decimal
places of the currency (0 for the yen, 2 for the euro, 3 for the Kuwaiti dinar, N.A. for gold and the other codes with
no minor unit), and whether the code is a fund. The table of src/currencies.js is copied from it. `currency-unknown` and
`amount-decimals` lean on it.

## Countries

### United Nations Statistics Division: Standard country or area codes for statistical use (M49)

https://unstats.un.org/unsd/methodology/m49/overview/

Copy: research/sources/un-m49-country-codes.txt

The table of the countries and areas the UN Statistics Division uses for statistics, each with its M49 number and its
ISO alpha-2 and alpha-3 codes. The country codes of src/countries.js are its alpha-2 codes. `country-invalid` leans on
it, and `bic-format` uses it for the country letters of a BIC.

## Wallet addresses

### ethereum.org: Ethereum accounts

https://ethereum.org/en/developers/docs/accounts/

Copy: research/sources/ethereum-org-accounts.txt

How an Ethereum account is made: an address from the last 20 bytes of the Keccak-256 hash of the public key with 0x in
front, 42 characters with 40 hex digits, and contract accounts with addresses of the same form. `wallet-address-malformed`
leans on it for every EVM network of the table.

### Solana: Account Structure

https://solana.com/docs/core/accounts/account-structure

Copy: research/sources/solana-account-structure.txt

The fields of a Solana account and its address: a 32-byte value, an Ed25519 public key or an address derived from a
program, written as a base58 string. `wallet-address-malformed` leans on it; the range of 32 to 44 characters is the
tool's reading of 32 bytes in base58.

### TRON Developer Hub: Accounts and keys

https://developers.tron.network/docs/account

Copy: research/sources/tron-accounts-and-keys.txt

The two forms of a TRON address: 21 bytes that begin with the byte 0x41, written in hex as 42 characters or in
Base58Check as 34 characters starting with T, the form wallets and explorers show. `wallet-address-malformed` leans on
it.
