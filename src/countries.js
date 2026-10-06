// The two-letter country codes the checks know. ISO keeps ISO 3166-1 on its Online Browsing Platform, which can only be
// read after its terms of use are accepted, so the tool takes the codes from the table of the United Nations Statistics
// Division, Standard country or area codes for statistical use (M49), whose column "ISO-alpha2 Code" gives the code of
// each country or area it lists (research/sources/un-m49-country-codes.txt). The codes are kept as one string of pairs in
// the order of the alphabet. test/data.test.js checks the string against the saved copy of the table.
//
// The UN table lists no code for Taiwan (TW), which ISO 3166-1 assigns; a payment to it is reported as country-invalid
// and needs a look by hand (docs/limits.md). The prefixes of the IBAN registry, which Swift writes as ISO 3166 codes, are
// accepted too: of these only XK (Kosovo) is not in the UN table.

import { IBAN_FORMATS } from './banking.js';

const PAIRS =
  'ADAEAFAGAIALAMAOAQARASATAUAWAXAZBABBBDBEBFBGBHBIBJBLBMBNBOBQBRBSBTBVBWBYBZCACCCDCFCGCHCICKCLCMCNCOCRCUCVCWCXCYCZ' +
  'DEDJDKDMDODZECEEEGEHERESETFIFJFKFMFOFRGAGBGDGEGFGGGHGIGLGMGNGPGQGRGSGTGUGWGYHKHMHNHRHTHUIDIEILIMINIOIQIRISITJEJM' +
  'JOJPKEKGKHKIKMKNKPKRKWKYKZLALBLCLILKLRLSLTLULVLYMAMCMDMEMFMGMHMKMLMMMNMOMPMQMRMSMTMUMVMWMXMYMZNANCNENFNGNINLNONP' +
  'NRNUNZOMPAPEPFPGPHPKPLPMPNPRPSPTPWPYQARERORSRURWSASBSCSDSESGSHSISJSKSLSMSNSOSRSSSTSVSXSYSZTCTDTFTGTHTJTKTLTMTNTO' +
  'TRTTTVTZUAUGUMUSUYUZVAVCVEVGVIVNVUWFWSYEYTZAZMZW';

// The codes of the UN table, in order.
export const UN_CODES = PAIRS.match(/[A-Z]{2}/g);

// The codes the checks accept: those of the UN table and the prefixes of the IBAN registry.
export const COUNTRY_CODES = [...new Set([...UN_CODES, ...IBAN_FORMATS.map((f) => f.code)])].sort();

const KNOWN = new Set(COUNTRY_CODES);

// Whether a text is a country code the checks know, as written: two capital letters.
export const isCountry = (code) => KNOWN.has(code);
