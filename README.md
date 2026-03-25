# ⚡ ZanDex — Reactive Yield Optimizer on Somnia

> The first yield optimizer where the blockchain rebalances itself — no bots, no servers, pure Somnia Reactivity.

![ZanDex Dashboard](https://img.shields.io/badge/Network-Somnia%20Testnet-blue?style=flat-square)
![Chain ID](https://img.shields.io/badge/Chain%20ID-50312-green?style=flat-square)
![Hackathon](https://img.shields.io/badge/Somnia%20Reactivity-Mini%20Hackathon-purple?style=flat-square)

---

## What is ZanDex?

ZanDex is a DeFi yield optimizer built natively on Somnia testnet. Two yield vaults compete for the highest APY. When the rate difference exceeds 2%, **Somnia Reactivity automatically rebalances user funds to the better vault — with zero human intervention, zero bots, zero backend.**

---

## How It Works

```
Vault APY changes → RateUpdated event emits
        ↓
Somnia Reactivity detects event on-chain
        ↓
ReactiveRouter.onEvent() fires automatically
        ↓
Compares Vault Alpha vs Vault Beta APY
        ↓
Diff > 2% → rebalanceTo() called on-chain
        ↓
Active vault switches atomically
        ↓
Dashboard updates live via WebSocket
```

No bot. No server. No polling. **The chain reacts to itself.**

---

## Live Demo

🌐 **[zandex.vercel.app](https://zan-dex.vercel.app/)**

📹 **[Demo Video](https://www.loom.com/share/f94f090f31fb42309772c2087425b8ad)**

---

## Smart Contracts (Somnia Testnet)

| Contract | Address |
|---|---|
| MockVaultA | `0x0d0597b6002D2f41374808F4Aeb956473871BbA9` |
| MockVaultB | `0x26970E37E9bB4172c1b89c2DE5A9E350f6d1Eec0` |
| SomSignalVault | `0xbD38693e6043A9Ca8b0f7Aa4b1E6411BAeb6a830` |
| ReactiveRouter | `0xe455508ADefDe737e9D6279d39a3778EAddc5987` |

🔍 Explorer: [shannon-explorer.somnia.network](https://shannon-explorer.somnia.network)

---

## Features

- ⚡ **Reactive Rebalancing** — Somnia Native Reactivity triggers on-chain rebalance automatically
- 📊 **Live APY Chart** — Real-time vault APY comparison via Somnia Data Streams WebSocket
- 💰 **Deposit STT** — Deposit native STT into the yield optimizer
- 🎯 **Simulate Market** — Trigger rate changes to see rebalancing in action
- 👜 **Portfolio** — Live wallet balances (STT, PING, PONG) from Somnia testnet
- 📡 **Event Stream** — Live feed of rebalance and rate update events with tx links

---

## Tech Stack

| Layer | Tech |
|---|---|
| Contracts | Solidity 0.8.20 + Hardhat |
| Chain | Somnia Testnet (Chain ID: 50312) |
| Reactivity | Somnia Native Reactivity SDK |
| Frontend | Next.js + Tailwind CSS |
| Web3 | wagmi + viem |
| Charts | recharts |
| Icons | lucide-react |

---

## Somnia Reactivity Integration

ZanDex uses **both modes** of Somnia Reactivity:

**On-chain (Solidity):**
```solidity
// ReactiveRouter fires automatically when VaultA or VaultB emits RateUpdated
function onEvent(uint256, address, uint256, uint256, uint256, uint256, bytes calldata)
    external onlyReactive {
    uint256 apyA = IVault(vaultA).currentAPY();
    uint256 apyB = IVault(vaultB).currentAPY();
    if (apyB > apyA + THRESHOLD) {
        vault.rebalanceTo(vaultB, apyB - apyA);
    }
}
```

**Off-chain (WebSocket):**
```typescript
// Dashboard subscribes to live events via Somnia Data Streams
useWatchContractEvent({
  address: SOMSIGNAL_VAULT,
  eventName: 'Rebalanced',
  onLogs: (logs) => updateEventFeed(logs)
})
```

---

## Run Locally

```bash
# Clone
git clone https://github.com/TheSankar/zandex
cd zandex

# Install
npm install

# Set env
cp .env.example .env.local
# Add your values to .env.local

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

```
NEXT_PUBLIC_CHAIN_ID=50312
NEXT_PUBLIC_RPC_URL=https://dream-rpc.somnia.network
NEXT_PUBLIC_EXPLORER=https://shannon-explorer.somnia.network
NEXT_PUBLIC_VAULT_A=0x0d0597b6002D2f41374808F4Aeb956473871BbA9
NEXT_PUBLIC_VAULT_B=0x26970E37E9bB4172c1b89c2DE5A9E350f6d1Eec0
NEXT_PUBLIC_SOMSIGNAL_VAULT=0xbD38693e6043A9Ca8b0f7Aa4b1E6411BAeb6a830
NEXT_PUBLIC_REACTIVE_ROUTER=0xe455508ADefDe737e9D6279d39a3778EAddc5987
```

---

## Mainnet Vision

On mainnet, mock vaults are replaced with real Somnia lending protocols and liquidity pools. The ReactiveRouter contract requires **zero changes** — just point it at real vault addresses. This is how yield optimizers should work on high-throughput chains.

```
Testnet: MockVaultA / MockVaultB (simulated APY)
           ↓
Mainnet: Somnia Lending Protocol / Somnia AMM Liquidity Pool (real yield)
```

---

## Built For

**Somnia Reactivity Mini Hackathon** — [dorahacks.io/hackathon/somnia-reactivity](https://dorahacks.io/hackathon/somnia-reactivity/buidl)

---

Built by [@TheSankarg](https://x.com/TheSankarg)
