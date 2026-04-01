import { http } from 'wagmi';

// Somnia Testnet (Shannon) Chain Configuration
export const somniaTestnet = {
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://dream-rpc.somnia.network'] },
    public: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://dream-rpc.somnia.network'] }
  },
  blockExplorers: {
    default: { name: 'Shannon Explorer', url: process.env.NEXT_PUBLIC_EXPLORER || 'https://shannon-explorer.somnia.network' },
  },
} as const;

// Contract Addresses
export const CONTRACTS = {
  VAULT_A: (process.env.NEXT_PUBLIC_VAULT_A || "0x0d0597b6002D2f41374808F4Aeb956473871BbA9") as `0x${string}`,
  VAULT_B: (process.env.NEXT_PUBLIC_VAULT_B || "0x26970E37E9bB4172c1b89c2DE5A9E350f6d1Eec0") as `0x${string}`,
  SOMSIGNAL_VAULT: (process.env.NEXT_PUBLIC_SOMSIGNAL_VAULT || "0xbD38693e6043A9Ca8b0f7Aa4b1E6411BAeb6a830") as `0x${string}`,
  REACTIVE_ROUTER: (process.env.NEXT_PUBLIC_REACTIVE_ROUTER || "0xe455508ADefDe737e9D6279d39a3778EAddc5987") as `0x${string}`,
} as const;

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 50312;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://dream-rpc.somnia.network';
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER || 'https://shannon-explorer.somnia.network';
