// The public pages and lists the checks rest on, and the points of each that the reports show, written in this project's
// own words. A page is named by its address; a copy of its text, read before it was listed, is kept under
// research/sources. research/sources.md lists every page with a note, docs/rules-and-sources.md lists every rule with its
// points, and test/data.test.js checks the three against each other.

export const LEVELS = ['info', 'warning', 'error'];

export const NOT_A = 'not a compliance or sanctions screening and not a guarantee that a payment will arrive';

export const NOTICE = `This report is an input to a review before the batch is sent: ${NOT_A}.`;

export const SOURCES = [
  { id: 'swift-iban', title: 'Swift: International Bank Account Number (IBAN)', url: 'https://www.swift.com/standards/data-standards/iban-international-bank-account-number', file: 'research/sources/swift-iban-page.txt' },
  { id: 'swift-iban-registry', title: 'Swift: IBAN Registry (TXT)', url: 'https://www.swift.com/swift-resource/11971/download', file: 'research/sources/swift-iban-registry.txt' },
  { id: 'tcmb-iban', title: 'Central Bank of the Republic of Turkiye: Communique on the International Bank Account Number', url: 'https://tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Bottom+Menu/IBAN/Communique', file: 'research/sources/tcmb-iban-communique.txt' },
  { id: 'swift-bic', title: 'Swift: Business Identifier Code (BIC)', url: 'https://www.swift.com/standards/data-standards/bic-business-identifier-code', file: 'research/sources/swift-bic-page.txt' },
  { id: 'six-iso-4217', title: 'SIX: ISO 4217 list one, current currency and funds code list', url: 'https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml', file: 'research/sources/six-iso-4217-list-one.txt' },
  { id: 'un-m49', title: 'United Nations Statistics Division: Standard country or area codes for statistical use (M49)', url: 'https://unstats.un.org/unsd/methodology/m49/overview/', file: 'research/sources/un-m49-country-codes.txt' },
  { id: 'ethereum-accounts', title: 'ethereum.org: Ethereum accounts', url: 'https://ethereum.org/en/developers/docs/accounts/', file: 'research/sources/ethereum-org-accounts.txt' },
  { id: 'solana-accounts', title: 'Solana: Account Structure', url: 'https://solana.com/docs/core/accounts/account-structure', file: 'research/sources/solana-account-structure.txt' },
  { id: 'tron-accounts', title: 'TRON Developer Hub: Accounts and keys', url: 'https://developers.tron.network/docs/account', file: 'research/sources/tron-accounts-and-keys.txt' }
];

// Points: id -> { source, text }.
export const POINTS = {
  'iban-authority': { source: 'swift-iban', text: 'ISO named Swift the registration authority for the national formats of the IBAN, and the registry Swift publishes holds the format of each country whose IBAN follows ISO 13616.' },
  'iban-lengths': { source: 'swift-iban-registry', text: 'For every country it covers, the registry gives the two letters an IBAN starts with, its structure, its length in electronic form and an example; an IBAN of Norway has 15 characters and one of Saint Lucia 32.' },
  'iban-territories': { source: 'swift-iban-registry', text: 'Some prefixes of the registry stand for other territories as well: Aland banks under FI, the Isle of Man, Jersey and Guernsey under GB, and the French overseas departments and territories under FR.' },
  'iban-mod97': { source: 'tcmb-iban', text: 'To check the two check digits, the communique moves the first four characters to the end, turns every letter into a number from 10 for A to 35 for Z, and asks that the result divided by 97 leave 1, the MOD 97-10 of ISO 7064.' },
  'iban-reject': { source: 'tcmb-iban', text: 'The communique lets a bank return or reject a transfer order whose IBAN fails that check.' },
  'bic-structure': { source: 'swift-bic', text: 'ISO 9362 defines the BIC as eight characters, four letters or digits for the party, two letters for a country code of ISO 3166-1 and two letters or digits after them, with a branch code of three more characters that may be added.' },
  'iso4217-codes': { source: 'six-iso-4217', text: 'List one of ISO 4217, kept by SIX as the maintenance agency, names for each country or entity its currency with an alphabetic code of three letters, a numeric code and a minor unit.' },
  'iso4217-minor': { source: 'six-iso-4217', text: 'The minor unit of the list is the number of decimal places a currency is counted in: 0 for the Japanese yen, 2 for the euro, 3 for the Kuwaiti dinar, and N.A. for codes such as gold that have no fraction.' },
  'm49-alpha2': { source: 'un-m49', text: 'The M49 table of the UN Statistics Division gives each country or area it lists a number of three digits and its ISO codes of two and of three letters.' },
  'evm-address': { source: 'ethereum-accounts', text: 'An Ethereum address is made from the last 20 bytes of a Keccak-256 hash of the public key with 0x in front, 42 characters with 40 hex digits, and a contract account has an address of the same form.' },
  'solana-address': { source: 'solana-accounts', text: 'Every Solana account has an address of 32 bytes, either an Ed25519 public key or one derived from a program, and it is written as a base58 string.' },
  'tron-address': { source: 'tron-accounts', text: 'A TRON address is 21 bytes that begin with the byte 0x41, and wallets and explorers show it in Base58Check as 34 characters starting with T.' }
};

export const source = (id) => SOURCES.find((s) => s.id === id);
export const pointPage = (id) => source(POINTS[id].source);
