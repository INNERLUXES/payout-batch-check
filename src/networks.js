// The networks a stablecoin payment can go out on, each with the family that decides how a wallet address on it is
// written, and the tokens the tool expects on each.
//
// The form of an address comes from the saved pages (research/sources): on an EVM network 0x and 40 hex digits, the last
// 20 bytes of a hash of the public key (ethereum.org, Ethereum accounts); on Solana a 32-byte address shown in base58
// (Solana, Account Structure), which is 32 to 44 characters long; on Tron Base58Check of 34 characters that starts with T
// (TRON Developer Hub, Accounts and keys). Only the form is checked: no checksum, and no look-up on a chain.
//
// The table of tokens on each network is the tool's own: no saved page gives one, and a pair out of it is a warning that
// asks for a look by hand, never an error. The default list of tokens a batch may pay in is the tool's own too, and
// --tokens sets another.

export const NETWORKS = [
  { id: 'ethereum', aliases: ['eth', 'ethereum-mainnet', 'erc20'], family: 'evm', title: 'Ethereum' },
  { id: 'polygon', aliases: ['polygon-pos', 'matic'], family: 'evm', title: 'Polygon PoS' },
  { id: 'arbitrum', aliases: ['arbitrum-one'], family: 'evm', title: 'Arbitrum' },
  { id: 'base', aliases: ['base-mainnet'], family: 'evm', title: 'Base' },
  { id: 'optimism', aliases: ['op-mainnet'], family: 'evm', title: 'OP Mainnet' },
  { id: 'solana', aliases: ['sol', 'solana-mainnet', 'spl'], family: 'solana', title: 'Solana' },
  { id: 'tron', aliases: ['trx', 'tron-mainnet', 'trc20'], family: 'tron', title: 'Tron' }
];

export const FAMILIES = ['evm', 'solana', 'tron'];

const norm = (text) => text.trim().toLowerCase();

// The network of the table a name stands for, by its id or an alias, in any case, or null.
export const networkOf = (text) => NETWORKS.find((n) => n.id === norm(text) || n.aliases.includes(norm(text))) ?? null;

// The tokens the tool expects on each network: the tool's own table.
export const TOKENS = [
  { symbol: 'USDC', networks: ['ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'solana'] },
  { symbol: 'USDT', networks: ['ethereum', 'polygon', 'arbitrum', 'solana', 'tron'] },
  { symbol: 'EURC', networks: ['ethereum', 'base', 'solana'] }
];

// The tokens a batch may pay in when --tokens is not given.
export const DEFAULT_TOKENS = ['USDC', 'USDT'];

// Whether the table lists a token on a network.
export const pairKnown = (symbol, network) => TOKENS.some((t) => t.symbol === symbol && t.networks.includes(network.id));

const EVM = /^0x[0-9a-fA-F]{40}$/;
const EVM_ZERO = /^0x0{40}$/;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

// What is wrong with a wallet address on a network of a family, or null when its form is right.
export function walletProblem(family, text) {
  const v = text.trim();
  if (v !== text) return 'has spaces around it';
  if (family === 'evm') {
    if (!v.startsWith('0x')) return 'does not start with 0x';
    if (v.length !== 42) return `has ${v.length - 2} characters after 0x, not 40`;
    if (!EVM.test(v)) return 'holds a character that is not a hex digit';
    if (EVM_ZERO.test(v)) return 'is the zero address, which no one can spend from';
    return null;
  }
  if (family === 'solana') {
    if (!BASE58.test(v)) return 'holds a character that base58 does not use (0, O, I, l or a sign)';
    if (v.length < 32 || v.length > 44) return `has ${v.length} characters, not 32 to 44`;
    return null;
  }
  if (!v.startsWith('T')) return 'does not start with T';
  if (!BASE58.test(v)) return 'holds a character that base58 does not use (0, O, I, l or a sign)';
  if (v.length !== 34) return `has ${v.length} characters, not 34`;
  return null;
}

// The form a family writes a wallet address in, for a message.
export const WALLET_FORMS = {
  evm: '0x followed by 40 hex digits, not the zero address',
  solana: '32 to 44 base58 characters',
  tron: 'T followed by 33 base58 characters'
};
