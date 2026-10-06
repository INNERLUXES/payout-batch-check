# Inputs

The tool takes one path: the payout batch, a CSV file with a header row or a JSON file. There is no configuration file
of the tool itself, no environment variable and no standard input; the options are on the command line. The tool never
asks for a private key, a seed, an API key or the address of a bank, a chain or a provider, and needs none.

```
payout-batch-check <batch.csv|batch.json> [--format text|markdown|json|sarif] [--json] [--min-severity <level>]
                   [--fail-on <level>] [--tokens <list>] [--max-amount <limit>] [--explain] [--list-checks]
```

| Option | Meaning |
| --- | --- |
| `--format <name>` | `text` (default), `markdown`, `json` or `sarif` |
| `--json` | the same as `--format json` |
| `--min-severity <level>` | the lowest level shown: `info` (default), `warning` or `error` |
| `--fail-on <level>` | the lowest level that fails the run: `info`, `warning` or `error` (default) |
| `--tokens <list>` | the tokens a stablecoin payment may pay in, separated by commas, such as `USDC,USDT,EURC`; symbols of 2 to 12 letters and digits, in any case, at most 50, each once. The default is `USDC,USDT` |
| `--max-amount <limit>` | the largest amount of one payment: a plain decimal for every payment, such as `50000`, or `<unit>=<amount>` for one currency or token, such as `EUR=25000` or `USDC=10000`. It may be given once for every payment and once for each unit; the limit of a unit comes before the one for every payment. Without it, `amount-above-max` does not run |
| `--explain` | add the points of the pages behind each finding to the text, markdown and JSON reports |
| `--list-checks` | list the checks with their level and kind, in text, markdown or JSON, and exit |
| `--help`, `--version` | the usage, the version |

Every option that takes a value takes it once, except `--max-amount`, which takes one value for every payment and one
for each unit. A value may not start with `--`. `-` (standard input) and an address such as `https://...` are refused. A
folder is refused: name the file. Two paths are a usage error.

## The format of the file

A file whose name ends in `.csv` is read as CSV, and one whose name ends in `.json` as JSON, in any case. A file with
another name is read as JSON when its first character that is not a space is `{` or `[`, and as CSV otherwise. The file
is UTF-8, with or without a byte order mark, or UTF-16 with a byte order mark, with LF, CRLF or CR line ends.

## A CSV batch

The first row is the header: the names of the columns, in any order, with spaces around a name left out. Each row after
it is one payment. Fields are separated by commas (RFC 4180); a field that holds a comma, a quote or a line end is put
in double quotes, with a quote inside it written twice. Every row has as many fields as the header. An empty field is a
field that is not given. Empty lines at the end of the file are allowed, and an empty line inside the table is not.

The columns are the fields of a payment below, and two columns for the batch:

| Column | Read as |
| --- | --- |
| `batchId` | the id of the batch, the same on every row that gives it |
| `debitCurrency` | the currency the batch is paid from, the same on every row that gives it |

A row that gives another `batchId` or `debitCurrency` than the first row that gives one is `field-invalid`. A column
whose name is not one of these is `field-unknown`, reported once at the header; a column named twice is
`field-duplicate`, and the second is left out; a column with no name is `field-invalid`. A CSV batch gives no totals, so
`batch-total-mismatch` has nothing to compare and a note says so.

```
paymentId,beneficiaryName,beneficiaryCountry,rail,iban,bic,currency,amount,network,token,walletAddress,debitCurrency
G-001,Harbor Example Supplies GmbH,DE,bank,DE89370400440532013000,EXMPDEFFXXX,EUR,1500.00,,,,EUR
G-009,Lumen Example Pte Ltd,SG,stablecoin,,,,750.00,ethereum,USDC,0x1111111111111111111111111111111111111111,EUR
```

## A JSON batch

The file is one JSON object, read strictly (RFC 8259): no comments, no trailing commas, and a key written twice in one
object stops the reader (`batch-unreadable`). Every key is read with its line, and a key that is not in the lists below
is `field-unknown`.

| Field | Needed | Read as |
| --- | --- | --- |
| `batch` | no | an object; see below |
| `payments` | yes | a list of payments, at least one |
| `notes` | no | text, not read by any check |

The batch:

| Field | Needed | Read as |
| --- | --- | --- |
| `id` | no | the id of the batch, text or a number |
| `debitCurrency` | no | the currency the batch is paid from, a code of ISO 4217; a bank payment in another currency with no `sourceCurrency` is converted from it |
| `totals` | no | an object with a total for each currency or token, such as `{"EUR": "1500.00", "USDC": "750.00"}`; each total is a plain decimal, as a number or as text. Without it, `batch-total-mismatch` has nothing to compare |
| `notes` | no | text |

```json
{
  "batch": { "id": "PAYOUT-EXAMPLE", "debitCurrency": "EUR", "totals": { "EUR": "1500.00" } },
  "payments": [
    { "paymentId": "P-001", "beneficiaryName": "Harbor Example Supplies GmbH", "beneficiaryCountry": "DE", "rail": "bank", "iban": "DE89370400440532013000", "bic": "EXMPDEFFXXX", "currency": "EUR", "amount": "1500.00" }
  ]
}
```

## A payment

The same fields in both formats. A field the rail of the payment does not take is `field-invalid`.

| Field | Needed | Read as |
| --- | --- | --- |
| `paymentId` | yes | the id of the payment, text or a number; two payments of one id (compared without case and outer spaces) are `payment-id-duplicate` |
| `beneficiaryName` | yes | the name of the beneficiary as the bank or the wallet provider knows it; missing is `beneficiary-name-missing`, fewer than three letters or digits is `beneficiary-name-short` |
| `beneficiaryCountry` | yes | the country of the beneficiary, two capital letters of ISO 3166-1, such as GB |
| `rail` | yes | `bank` or `stablecoin`, in any case |
| `iban` | bank | the IBAN, in electronic form or in groups of four; small letters are read as capitals |
| `accountNumber` | bank | the account number, text or a number, for a country with no IBAN; a bank payment gives an `iban` or an `accountNumber` |
| `bic` | bank, with an account number | the BIC of the bank of the beneficiary, 8 or 11 characters in capitals; a payment to an IBAN may leave it out |
| `currency` | bank | the currency of the payment, a code of ISO 4217 in capitals |
| `amount` | yes | the amount, a plain decimal number above 0 such as 1500.00, as a number or as text: no sign, exponent, currency sign or thousands separator. A bank payment is in its `currency`, a stablecoin payment in its `token` |
| `network` | stablecoin | the network, by the name or an alias of the table below, in any case |
| `token` | stablecoin | the symbol of the token, such as USDC, in any case |
| `walletAddress` | stablecoin | the address of the wallet of the beneficiary on the network |
| `purposeCode` | no | the purpose of the payment, text, not read by any check |
| `fxRate` | no | the rate the payment was priced at, a plain decimal above 0 |
| `sourceCurrency` | no | the currency the payment is paid from, when it is not the `debitCurrency` of the batch |
| `notes` | no | text, not read by any check |

What each rail needs and takes:

| Rail | Needs | Takes no |
| --- | --- | --- |
| `bank` | `currency`, `amount`, an `iban` or an `accountNumber`, and a `bic` with an `accountNumber` | `network`, `token`, `walletAddress` |
| `stablecoin` | `network`, `token`, `walletAddress`, `amount` | `iban`, `accountNumber`, `bic`, `currency` |

## The networks

| Network | Aliases | Address | Tokens the tool's table lists on it |
| --- | --- | --- | --- |
| `ethereum` | eth, ethereum-mainnet, erc20 | 0x and 40 hex digits | USDC, USDT, EURC |
| `polygon` | polygon-pos, matic | 0x and 40 hex digits | USDC, USDT |
| `arbitrum` | arbitrum-one | 0x and 40 hex digits | USDC, USDT |
| `base` | base-mainnet | 0x and 40 hex digits | USDC, EURC |
| `optimism` | op-mainnet | 0x and 40 hex digits | USDC |
| `solana` | sol, solana-mainnet, spl | 32 to 44 base58 characters | USDC, USDT, EURC |
| `tron` | trx, tron-mainnet, trc20 | T and 33 base58 characters | USDT |

The forms of the addresses come from the saved pages of ethereum.org, Solana and TRON. The tokens on each network are
the tool's own table: no saved page gives one, so a pair out of it is a warning (`network-token-unknown`), and a network
out of the table is the same warning and its addresses are not judged.

## The tables the checks read

- The IBAN formats of 89 countries, with their lengths and the territories under a prefix, from the saved copy of the
  IBAN registry of Swift (src/banking.js).
- The currency codes of ISO 4217 with their minor units, from the saved copy of list one of SIX (src/currencies.js).
- The two-letter country codes of the UN M49 table, with the prefixes of the IBAN registry (src/countries.js).
