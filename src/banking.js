// The account and bank identifiers of a bank payment: the IBAN of ISO 13616 with the national formats of the IBAN
// registry that Swift publishes as its registration authority, and the BIC of ISO 9362.
//
// IBAN_FORMATS holds, for each country of the saved copy of the registry (research/sources/swift-iban-registry.txt), the
// prefix, the length of an IBAN in electronic form and the other countries or territories the prefix covers, as the
// registry lists them. test/data.test.js checks every entry against the copy, and checks the example IBAN of every
// country of the copy with the checksum below. A prefix out of the table is not given a length: only the checksum of
// such an IBAN is checked.
//
// The checksum is the MOD 97-10 of ISO 7064 as the Central Bank of the Republic of Turkiye describes its validation
// (research/sources/tcmb-iban-communique.txt): the first four characters are moved to the end, each letter becomes the
// two digits 10 to 35, and the remainder of the number divided by 97 must be 1. The number is worked through digit by
// digit, so an IBAN of any length is never turned into a floating point number.

// [prefix, length, the codes the prefix also covers]
const REGISTRY = [
  ['AD', 24, ''],
  ['AE', 23, ''],
  ['AL', 28, ''],
  ['AT', 20, ''],
  ['AZ', 28, ''],
  ['BA', 20, ''],
  ['BE', 16, ''],
  ['BG', 22, ''],
  ['BH', 22, ''],
  ['BI', 27, ''],
  ['BR', 29, ''],
  ['BY', 28, ''],
  ['CH', 21, ''],
  ['CR', 22, ''],
  ['CY', 28, ''],
  ['CZ', 24, ''],
  ['DE', 22, ''],
  ['DJ', 27, ''],
  ['DK', 18, ''],
  ['DO', 28, ''],
  ['EE', 20, ''],
  ['EG', 29, ''],
  ['ES', 24, ''],
  ['FI', 18, 'AX'],
  ['FK', 18, ''],
  ['FO', 18, ''],
  ['FR', 27, 'GF GP MQ RE PF TF YT NC BL MF PM WF'],
  ['GB', 22, 'IM JE GG'],
  ['GE', 22, ''],
  ['GI', 23, ''],
  ['GL', 18, ''],
  ['GR', 27, ''],
  ['GT', 28, ''],
  ['HN', 28, ''],
  ['HR', 21, ''],
  ['HU', 28, ''],
  ['IE', 22, ''],
  ['IL', 23, ''],
  ['IQ', 23, ''],
  ['IS', 26, ''],
  ['IT', 27, ''],
  ['JO', 30, ''],
  ['KW', 30, ''],
  ['KZ', 20, ''],
  ['LB', 28, ''],
  ['LC', 32, ''],
  ['LI', 21, ''],
  ['LT', 20, ''],
  ['LU', 20, ''],
  ['LV', 21, ''],
  ['LY', 25, ''],
  ['MC', 27, ''],
  ['MD', 24, ''],
  ['ME', 22, ''],
  ['MK', 19, ''],
  ['MN', 20, ''],
  ['MR', 27, ''],
  ['MT', 31, ''],
  ['MU', 30, ''],
  ['NI', 28, ''],
  ['NL', 18, ''],
  ['NO', 15, ''],
  ['OM', 23, ''],
  ['PK', 24, ''],
  ['PL', 28, ''],
  ['PS', 29, ''],
  ['PT', 25, ''],
  ['QA', 29, ''],
  ['RO', 24, ''],
  ['RS', 22, ''],
  ['RU', 33, ''],
  ['SA', 24, ''],
  ['SC', 31, ''],
  ['SD', 18, ''],
  ['SE', 24, ''],
  ['SI', 19, ''],
  ['SK', 24, ''],
  ['SM', 27, ''],
  ['SO', 23, ''],
  ['ST', 25, ''],
  ['SV', 28, ''],
  ['TL', 23, ''],
  ['TN', 24, ''],
  ['TR', 26, ''],
  ['UA', 29, ''],
  ['VA', 22, ''],
  ['VG', 24, ''],
  ['XK', 20, ''],
  ['YE', 30, '']
];

export const IBAN_FORMATS = REGISTRY.map(([code, length, includes]) => ({ code, length, includes: includes ? includes.split(' ') : [] }));

// The format of a prefix in the registry, or null.
export const ibanFormat = (code) => IBAN_FORMATS.find((f) => f.code === code) ?? null;

// Whether a country or territory is covered by a prefix: the prefix itself or one the registry lists under it.
export const coveredBy = (code, country) => code === country || (ibanFormat(code)?.includes.includes(country) ?? false);

// An IBAN in electronic form: spaces left out (the registry prints IBANs in groups of four) and letters in capitals.
export const electronicIban = (text) => text.replace(/[ \t]+/g, '').toUpperCase();

const IBAN_SHAPE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;

// What is wrong with the form of an IBAN in electronic form, or null: two letters, two check digits and up to 30
// letters and digits.
export function ibanShapeProblem(iban) {
  if (/[^A-Z0-9]/.test(iban)) return 'holds a character that is not a letter or a digit';
  if (!/^[A-Z]{2}/.test(iban)) return 'does not start with two letters of a country';
  if (!/^[A-Z]{2}[0-9]{2}/.test(iban)) return 'has no two check digits after its country letters';
  if (iban.length > 34) return `has ${iban.length} characters, more than the 34 an IBAN can have`;
  if (!IBAN_SHAPE.test(iban)) return 'has no account part after its check digits';
  return null;
}

// The remainder of MOD 97-10 for an IBAN of the right shape: 1 when the check digits are right.
export function ibanRemainder(iban) {
  const moved = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let r = 0;
  for (const c of moved) {
    const code = c.charCodeAt(0);
    const digits = code >= 65 ? String(code - 55) : c;
    for (const d of digits) r = (r * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return r;
}

const BIC_SHAPE = /^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/;

// What is wrong with the form of a BIC as written, or null: a party prefix of four letters or digits, two letters of a
// country, a suffix of two letters or digits, and an optional branch code of three. The country letters are checked
// against the country codes by the caller.
export function bicShapeProblem(text) {
  if (text.length !== 8 && text.length !== 11) return `has ${text.length} characters, not 8 or 11`;
  if (/[a-z]/.test(text)) return 'holds a small letter; a BIC is written in capitals';
  if (/[^A-Z0-9]/.test(text)) return 'holds a character that is not a letter or a digit';
  if (!BIC_SHAPE.test(text)) return `has "${text.slice(4, 6)}" in the place of the country code, which must be two letters`;
  return null;
}
