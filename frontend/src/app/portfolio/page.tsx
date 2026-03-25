'use client';
import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useBalance, useWatchContractEvent } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatEther } from 'viem';
import Link from 'next/link';

const CONTRACTS = {
  VAULT_A: "0x0d0597b6002D2f41374808F4Aeb956473871BbA9",
  VAULT_B: "0x26970E37E9bB4172c1b89c2DE5A9E350f6d1Eec0",
  SOMSIGNAL_VAULT: "0xbD38693e6043A9Ca8b0f7Aa4b1E6411BAeb6a830",
  REACTIVE_ROUTER: "0xe455508ADefDe737e9D6279d39a3778EAddc5987"
} as const;

const vaultAbi = [
  { inputs: [], name: 'currentAPY', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'account', type: 'address' }], name: 'getUserDeposit', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalDeposited', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

const eventAbi = [
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }], name: 'Deposited', type: 'event' },
  { anonymous: false, inputs: [{ indexed: false, name: 'newVault', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'timestamp', type: 'uint256' }], name: 'Rebalanced', type: 'event' },
  { anonymous: false, inputs: [{ indexed: false, name: 'oldRate', type: 'uint256' }, { indexed: false, name: 'timestamp', type: 'uint256' }], name: 'RateUpdated', type: 'event' },
] as const;

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [txs, setTxs] = useState<{type: string, amount: string, vault: string, time: string, hash: string}[]>([]);

  useEffect(() => { setMounted(true); }, []);

  // Shared refetch to keep data fresh
  const { data: userBal, refetch: refetchUserBal } = useReadContract({ address: CONTRACTS.SOMSIGNAL_VAULT, abi: vaultAbi, functionName: 'getUserDeposit', args: [address as `0x${string}`], query: { enabled: !!address, refetchInterval: 5000 } });
  const { data: alphaApyRaw } = useReadContract({ address: CONTRACTS.VAULT_A, abi: vaultAbi, functionName: 'currentAPY', query: { refetchInterval: 5000 } });
  const { data: betaApyRaw } = useReadContract({ address: CONTRACTS.VAULT_B, abi: vaultAbi, functionName: 'currentAPY', query: { refetchInterval: 5000 } });
  const { data: nativeBalance } = useBalance({ address: address, query: { enabled: !!address, refetchInterval: 5000 } });
  const { data: somSignalTotalDeposited } = useReadContract({ address: CONTRACTS.SOMSIGNAL_VAULT, abi: vaultAbi, functionName: 'totalDeposited', query: { refetchInterval: 5000 } });

  // === EVENT WATCHERS ===
  useWatchContractEvent({
    address: CONTRACTS.SOMSIGNAL_VAULT,
    abi: eventAbi,
    eventName: 'Deposited',
    onLogs: (logs) => {
      logs.forEach(log => {
        if (log.args.user?.toLowerCase() === address?.toLowerCase()) {
          refetchUserBal();
          setTxs(prev => [{
            type: 'Deposit',
            amount: `${formatEther(log.args.amount as bigint)} STT`,
            vault: 'SomSignal Vault',
            time: new Date().toLocaleTimeString(),
            hash: log.transactionHash
          }, ...prev].slice(0, 10));
        }
      });
    }
  });

  useWatchContractEvent({
    address: CONTRACTS.SOMSIGNAL_VAULT,
    abi: eventAbi,
    eventName: 'Rebalanced',
    onLogs: (logs) => {
      logs.forEach(log => {
        setTxs(prev => [{
          type: 'Rebalance',
          amount: `${formatEther(log.args.amount as bigint)} STT`,
          vault: log.args.newVault === CONTRACTS.VAULT_A ? 'Vault Alpha' : 'Vault Beta',
          time: new Date().toLocaleTimeString(),
          hash: log.transactionHash
        }, ...prev].slice(0, 10));
      });
    }
  });

  useWatchContractEvent({
    address: CONTRACTS.VAULT_A,
    abi: eventAbi,
    eventName: 'RateUpdated',
    onLogs: (logs) => {
      logs.forEach(log => {
        setTxs(prev => [{
          type: 'Rate Update',
          amount: '--',
          vault: 'Vault Alpha',
          time: new Date().toLocaleTimeString(),
          hash: log.transactionHash
        }, ...prev].slice(0, 10));
      });
    }
  });

  useWatchContractEvent({
    address: CONTRACTS.VAULT_B,
    abi: eventAbi,
    eventName: 'RateUpdated',
    onLogs: (logs) => {
      logs.forEach(log => {
        setTxs(prev => [{
          type: 'Rate Update',
          amount: '--',
          vault: 'Vault Beta',
          time: new Date().toLocaleTimeString(),
          hash: log.transactionHash
        }, ...prev].slice(0, 10));
      });
    }
  });

  const alphaApy = alphaApyRaw !== undefined ? (Number(alphaApyRaw) / 100).toFixed(2) : "—";
  const betaApy = betaApyRaw !== undefined ? (Number(betaApyRaw) / 100).toFixed(2) : "—";
  const isVaultAActive = Number(alphaApy) >= Number(betaApy);
  const currentApy = isVaultAActive ? alphaApy : betaApy;
  const activeVaultLabel = isVaultAActive ? 'Vault Alpha' : 'Vault Beta';
  const userBalNum = userBal ? Number(userBal) / 10**18 : 0;
  const currentBalDisplay = userBalNum.toFixed(4);
  const estDailyYield = ((userBalNum * Number(currentApy) / 100) / 365).toFixed(4);
  const sttBalance = nativeBalance ? Number(formatEther(nativeBalance.value)).toFixed(4) : '0.0000';
  const totalTvl = somSignalTotalDeposited !== undefined ? Number(formatEther(somSignalTotalDeposited as bigint)).toFixed(4) : '0.0000';

  if (!mounted) return <div className="bg-[#13131b] text-[#e4e1ed] antialiased min-h-screen border-r border-gray-800/30 font-body"></div>;

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#13131b] text-[#e4e1ed] font-body selection:bg-[#adc6ff]/30">
      {/* Navigation Drawer */}
      <aside className="w-[220px] h-full fixed left-0 top-0 flex flex-col bg-[#0d0d15] border-r border-[#8c909f]/20 z-50">
        <div className="p-6 flex flex-col gap-1">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <img src="/logo.png" alt="Z3 ZanDex Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold text-[#adc6ff] tracking-tight font-headline">ZanDex</h1>
          </div>
          <nav className="space-y-1">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 text-[#8c909f] hover:text-[#c2c6d6] transition-all duration-200 ease-out group">
              <span className="material-symbols-outlined text-[20px]">dashboard</span>
              <span className="font-headline tracking-wider uppercase text-xs font-bold">Dashboard</span>
            </Link>
            <Link href="/yield-optimizer" className="flex items-center gap-3 px-4 py-3 text-[#8c909f] hover:text-[#c2c6d6] transition-all duration-200 ease-out">
              <span className="material-symbols-outlined text-[20px]">trending_up</span>
              <span className="font-headline tracking-wider uppercase text-xs font-bold">Yield Optimizer</span>
            </Link>
            <Link href="/swap" className="flex items-center gap-3 px-4 py-3 text-[#8c909f] hover:text-[#c2c6d6] transition-all duration-200 ease-out">
              <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
              <span className="font-headline tracking-wider uppercase text-xs font-bold">Swap</span>
            </Link>
            <Link href="/portfolio" className="flex items-center gap-3 px-4 py-3 text-[#adc6ff] border-l-4 border-[#adc6ff] bg-[#1b1b23] group">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>pie_chart</span>
              <span className="font-headline tracking-wider uppercase text-xs font-bold">Portfolio</span>
            </Link>
          </nav>
        </div>
        <div className="mt-auto p-4 bg-[#0d0d15]/50 m-4 rounded-xl border border-[#8c909f]/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#34343d] flex items-center justify-center overflow-hidden">
               <span className="material-symbols-outlined text-[#adc6ff] text-sm">account_balance_wallet</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold font-headline truncate">{address ? `${address.slice(0,6)}...${address.slice(-4)}` : '0x0...0'}</p>
              <p className="text-[10px] text-[#8c909f] uppercase font-bold tracking-widest">{isConnected ? "Connected" : "Disconnected"}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-[220px] relative z-10 min-h-screen pb-12">
        {/* Top App Bar */}
        <header className="h-14 fixed top-0 right-0 w-[calc(100%-220px)] z-40 bg-[#13131b]/80 backdrop-blur-xl border-b border-[#8c909f]/10 flex justify-between items-center px-8">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-[#adc6ff]">sensors</span>
            <h2 className="font-headline font-bold tracking-widest text-[#adc6ff] uppercase text-sm">PORTFOLIO</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded-full bg-[#00a572]/10 border border-[#00a572]/20 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00a572] animate-pulse"></div>
              <span className="text-[10px] font-mono text-[#00a572] font-bold">SOMNIA TESTNET</span>
            </div>
            <ConnectButton />
          </div>
        </header>

        <div className="pt-20 px-8">
          {/* Hero Row */}
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold font-headline text-[#e4e1ed]">Portfolio Overview</h1>
              <p className="text-sm text-[#8c909f] mt-1 max-w-md">Manage your assets and yield positions across the Somnia ecosystem with real-time analytics.</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 border border-[#8c909f] text-[#e4e1ed] text-xs px-4 py-2 rounded-lg hover:bg-[#1f1f27] transition-colors uppercase font-bold tracking-wider font-headline">
                <span className="material-symbols-outlined text-sm">file_download</span>
                EXPORT CSV
              </button>
              <button className="flex items-center gap-2 bg-[#4d8eff] text-[#00285d] text-xs px-4 py-2 rounded-lg hover:brightness-110 transition-all shadow-lg shadow-[#4d8eff]/10 uppercase font-bold tracking-wider font-headline">
                <span className="material-symbols-outlined text-sm">add</span>
                ADD LIQUIDITY
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-[#1b1b23] p-6 rounded-xl border border-[#8c909f]/5 relative overflow-hidden group">
              <div className="absolute top-4 right-4 text-[#8c909f]/20 group-hover:text-[#adc6ff]/20 transition-colors">
                <span className="material-symbols-outlined text-3xl">account_balance</span>
              </div>
              <p className="text-[10px] font-headline font-bold text-[#8c909f] uppercase tracking-widest mb-1">Total Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-medium text-[#e4e1ed]">{sttBalance}</span>
                <span className="text-sm font-mono text-[#8c909f]">STT</span>
              </div>
              <p className="text-[11px] text-[#8c909f]/60 mt-2">Native wallet balance on Somnia</p>
            </div>

            <div className="bg-[#1b1b23] p-6 rounded-xl border border-[#8c909f]/5 relative overflow-hidden group">
              <div className="absolute top-4 right-4 text-[#4edea3]/20 group-hover:text-[#4edea3]/40 transition-colors">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>layers</span>
              </div>
              <p className="text-[10px] font-headline font-bold text-[#8c909f] uppercase tracking-widest mb-1">ZanDex Position</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-medium text-[#4edea3]">{currentBalDisplay}</span>
                <span className="text-sm font-mono text-[#4edea3]/70">STT</span>
              </div>
              <p className="text-[11px] text-[#8c909f]/60 mt-2">Deposited in SomSignal Vault</p>
            </div>

            <div className="bg-[#1b1b23] p-6 rounded-xl border border-[#8c909f]/5 relative overflow-hidden group">
              <div className="absolute top-4 right-4 text-[#ffb95f]/20 group-hover:text-[#ffb95f]/40 transition-colors">
                <span className="material-symbols-outlined text-3xl">bolt</span>
              </div>
              <p className="text-[10px] font-headline font-bold text-[#8c909f] uppercase tracking-widest mb-1">Est. Daily Yield</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-medium text-[#4edea3]">{estDailyYield}</span>
                <span className="text-sm font-mono text-[#4edea3]/70">STT</span>
              </div>
              <p className="text-[11px] text-[#8c909f]/60 mt-2">Based on {activeVaultLabel} at {currentApy}% APY</p>
            </div>
          </div>

          {/* Middle Row */}
          <div className="grid grid-cols-2 gap-6">
            {/* Token Balances Card */}
            <div className="bg-[#1f1f27] p-6 rounded-xl border border-[#8c909f]/10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-headline font-bold text-[#e4e1ed]">Token Balances</h3>
                  <p className="text-xs text-[#8c909f]">Somnia Testnet Assets</p>
                </div>
                <button className="p-2 rounded-lg hover:bg-[#292932] text-[#8c909f] transition-colors">
                  <span className="material-symbols-outlined text-sm">filter_list</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#8c909f]/20">
                      <th className="pb-3 text-[10px] font-headline font-bold text-[#8c909f] uppercase tracking-widest">Asset</th>
                      <th className="pb-3 text-[10px] font-headline font-bold text-[#8c909f] uppercase tracking-widest text-right">Balance</th>
                      <th className="pb-3 text-[10px] font-headline font-bold text-[#8c909f] uppercase tracking-widest text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#8c909f]/10">
                    <tr className="group">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#adc6ff]/20 flex items-center justify-center font-bold text-[#adc6ff] text-xs">S</div>
                          <div>
                            <p className="text-sm font-medium text-[#e4e1ed]">Somnia Token (STT)</p>
                            <p className="text-[10px] text-[#8c909f]">Native Asset</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <p className="text-sm font-mono text-[#e4e1ed]">{sttBalance} STT</p>
                        <p className="text-[10px] font-mono text-[#8c909f]">Wallet</p>
                      </td>
                      <td className="py-4 text-right">
                        <Link href="/swap" className="text-xs font-headline font-bold text-[#4d8eff] hover:underline tracking-widest">SWAP</Link>
                      </td>
                    </tr>
                    <tr className="group">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#4edea3]/20 flex items-center justify-center font-bold text-[#4edea3] text-xs">V</div>
                          <div>
                            <p className="text-sm font-medium text-[#e4e1ed]">Vault Deposit</p>
                            <p className="text-[10px] text-[#8c909f]">SomSignal Vault</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <p className="text-sm font-mono text-[#e4e1ed]">{currentBalDisplay} STT</p>
                        <p className="text-[10px] font-mono text-[#8c909f]">Deposited</p>
                      </td>
                      <td className="py-4 text-right">
                         <Link href="/yield-optimizer" className="text-xs font-headline font-bold text-[#4d8eff] hover:underline tracking-widest">MANAGE</Link>
                      </td>
                    </tr>
                    <tr className="group">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#ffb95f]/20 flex items-center justify-center font-bold text-[#ffb95f] text-xs">T</div>
                          <div>
                            <p className="text-sm font-medium text-[#e4e1ed]">Protocol TVL</p>
                            <p className="text-[10px] text-[#8c909f]">All Deposits</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <p className="text-sm font-mono text-[#e4e1ed]">{totalTvl} STT</p>
                        <p className="text-[10px] font-mono text-[#8c909f]">Total Locked</p>
                      </td>
                      <td className="py-4 text-right">
                         <Link href="/" className="text-xs font-headline font-bold text-[#4d8eff] hover:underline tracking-widest">DASHBOARD</Link>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Your Position Card */}
            <div className="bg-[#1f1f27] p-6 rounded-xl border border-[#8c909f]/10 flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-headline font-bold text-[#e4e1ed]">Your Position</h3>
                <div className="bg-[#00a572]/10 text-[#00a572] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse border border-[#00a572]/20">
                  <div className="w-1 h-1 rounded-full bg-[#00a572]"></div>
                  LIVE APY
                </div>
              </div>
              <div className="bg-[#1b1b23] p-4 rounded-xl mb-6 border border-[#8c909f]/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#4d8eff]/10 flex items-center justify-center text-[#4d8eff]"><span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-[#8c909f] uppercase tracking-widest">Active Vault</p>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-[#e4e1ed]">Somnia Core Optimizer</h4>
                      <span className="text-[9px] bg-[#292932] text-[#8c909f] px-1.5 py-0.5 rounded border border-[#8c909f]/20 font-bold uppercase tracking-tighter">Auto-Compounding</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#8c909f]">Active Since</span>
                  <span className="text-sm font-mono text-[#e4e1ed]">Oct 24, 2023</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#8c909f]">Current APY</span>
                  <span className="text-sm font-mono text-[#00a572] font-bold">{currentApy}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#8c909f]">Health Factor</span>
                  <span className="text-sm font-mono text-[#e4e1ed]">1.84</span>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-[#8c909f] uppercase tracking-widest mb-1.5">
                    <span>APY Performance</span>
                    <span className="text-[#adc6ff]">70%</span>
                  </div>
                  <div className="h-1.5 bg-[#292932] rounded-full overflow-hidden">
                    <div className="h-full bg-[#4d8eff] w-[70%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-[#8c909f] uppercase tracking-widest mb-1.5">
                    <span>Health Factor</span>
                    <span className="text-[#4edea3]">85%</span>
                  </div>
                  <div className="h-1.5 bg-[#292932] rounded-full overflow-hidden">
                    <div className="h-full bg-[#4edea3] w-[85%]"></div>
                  </div>
                </div>
              </div>
              <Link href="/yield-optimizer" className="mt-auto w-full py-3 bg-[#4d8eff] hover:bg-[#4d8eff]/90 text-[#00285d] font-headline font-bold text-xs rounded-xl tracking-widest uppercase transition-all shadow-lg shadow-[#4d8eff]/5 text-center flex items-center justify-center">
                Manage Position
              </Link>
            </div>
          </div>

          {/* Transaction History Card */}
          <div className="mt-6 bg-[#1f1f27] p-6 rounded-xl border border-[#8c909f]/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h3 className="text-lg font-headline font-bold text-[#e4e1ed]">Recent Transactions</h3>
              <div className="flex gap-2">
                <button className="bg-[#292932] text-[#e4e1ed] text-[10px] font-bold px-3 py-1.5 rounded-lg border border-[#8c909f]/30 uppercase tracking-widest">All</button>
                <button className="text-[#8c909f] hover:text-[#e4e1ed] text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors">Deposits</button>
                <button className="text-[#8c909f] hover:text-[#e4e1ed] text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors">Rebalances</button>
                <button className="text-[#8c909f] hover:text-[#e4e1ed] text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors">Rate Updates</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#8c909f]/20">
                    <th className="pb-3 text-[10px] font-headline font-bold text-[#8c909f] uppercase tracking-widest">Type</th>
                    <th className="pb-3 text-[10px] font-headline font-bold text-[#8c909f] uppercase tracking-widest">Amount</th>
                    <th className="pb-3 text-[10px] font-headline font-bold text-[#8c909f] uppercase tracking-widest">Vault</th>
                    <th className="pb-3 text-[10px] font-headline font-bold text-[#8c909f] uppercase tracking-widest">Time</th>
                    <th className="pb-3 text-[10px] font-headline font-bold text-[#8c909f] uppercase tracking-widest text-right">TX Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#8c909f]/10">
                  {txs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#8c909f]">
                        <p className="text-sm font-medium">No recent transactions found</p>
                        <p className="text-[10px] font-mono uppercase tracking-widest mt-1">Listening for testnet events...</p>
                      </td>
                    </tr>
                  ) : (
                    txs.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-[#0d0d15]/30 transition-colors">
                        <td className="py-4">
                          <span className={`${
                            tx.type === 'Deposit' ? 'bg-[#00a572]/10 text-[#00a572] border-[#00a572]/20' : 
                            tx.type === 'Rebalance' ? 'bg-[#ffb95f]/10 text-[#ffb95f] border-[#ffb95f]/20' : 
                            'bg-[#4d8eff]/10 text-[#4d8eff] border-[#4d8eff]/20'
                          } text-[10px] font-bold px-2.5 py-1 rounded-full border`}>{tx.type}</span>
                        </td>
                        <td className="py-4">
                          <span className="font-mono text-sm text-[#e4e1ed]">{tx.amount}</span>
                        </td>
                        <td className="py-4">
                          <span className="text-sm text-[#8c909f]">{tx.vault}</span>
                        </td>
                        <td className="py-4">
                          <span className="text-xs text-[#8c909f]">{tx.time}</span>
                        </td>
                        <td className="py-4 text-right">
                          <a className="font-mono text-xs text-[#4d8eff] hover:underline truncate inline-block max-w-[120px]" 
                             href={`https://shannon-explorer.somnia.network/tx/${tx.hash}`}
                             target="_blank"
                             rel="noopener noreferrer">
                            {tx.hash.slice(0,6)}...{tx.hash.slice(-4)}
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Visual Polish: Ambient Glows */}
        <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#adc6ff]/5 blur-[120px] pointer-events-none z-0"></div>
        <div className="fixed bottom-[-10%] left-[10%] w-[30%] h-[30%] bg-[#4edea3]/5 blur-[100px] pointer-events-none z-0"></div>
      </main>
    </div>
  );
}
