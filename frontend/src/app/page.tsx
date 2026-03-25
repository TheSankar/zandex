'use client';
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts';
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
  { inputs: [], name: 'totalDeposited', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

const somSignalAbi = [
  { inputs: [], name: 'totalDeposited', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getActiveVault', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'account', type: 'address' }], name: 'getUserDeposit', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

const routerEventAbi = [
  { anonymous: false, inputs: [{ indexed: false, name: 'oldVault', type: 'address' }, { indexed: false, name: 'newVault', type: 'address' }, { indexed: false, name: 'reason', type: 'string' }], name: 'Rebalance', type: 'event' }
] as const;

const vaultEventAbi = [
  { anonymous: false, inputs: [{ indexed: false, name: 'oldRate', type: 'uint256' }, { indexed: false, name: 'timestamp', type: 'uint256' }], name: 'RateUpdated', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }], name: 'Deposited', type: 'event' },
] as const;

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [events, setEvents] = useState<{msg: string, time: string, tx?: string, type: string}[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // === NATIVE STT BALANCE ===
  const { data: nativeBalance } = useBalance({
    address: address,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  // === VAULT APYs (basis points / 100) ===
  const { data: alphaApyRaw, refetch: refetchAlphaApy } = useReadContract({
    address: CONTRACTS.VAULT_A, abi: vaultAbi, functionName: 'currentAPY',
    query: { refetchInterval: 5000 },
  });
  const { data: betaApyRaw, refetch: refetchBetaApy } = useReadContract({
    address: CONTRACTS.VAULT_B, abi: vaultAbi, functionName: 'currentAPY',
    query: { refetchInterval: 5000 },
  });

  // === VAULT TOTAL DEPOSITED ===
  const { data: alphaTotalDeposited } = useReadContract({
    address: CONTRACTS.VAULT_A, abi: vaultAbi, functionName: 'totalDeposited',
    query: { refetchInterval: 5000 },
  });
  const { data: betaTotalDeposited } = useReadContract({
    address: CONTRACTS.VAULT_B, abi: vaultAbi, functionName: 'totalDeposited',
    query: { refetchInterval: 5000 },
  });

  // === SOMSIGNAL VAULT: totalDeposited (overall TVL) ===
  const { data: somSignalTotalDeposited } = useReadContract({
    address: CONTRACTS.SOMSIGNAL_VAULT, abi: somSignalAbi, functionName: 'totalDeposited',
    query: { refetchInterval: 5000 },
  });

  // === SOMSIGNAL VAULT: getActiveVault ===
  const { data: activeVaultFromSignal } = useReadContract({
    address: CONTRACTS.SOMSIGNAL_VAULT, abi: somSignalAbi, functionName: 'getActiveVault',
    query: { refetchInterval: 5000 },
  });

  // === REBALANCE EVENT WATCHER ===
  const [rebalanceCount, setRebalanceCount] = useState(0);

  useWatchContractEvent({
    address: CONTRACTS.REACTIVE_ROUTER,
    abi: routerEventAbi,
    eventName: 'Rebalance',
    onLogs: (logs) => {
      logs.forEach(log => {
        setRebalanceCount(r => r + 1);
        setEvents(prev => [{
          msg: `Rebalanced → ${log.args.newVault === CONTRACTS.VAULT_A ? 'Vault Alpha' : 'Vault Beta'}`,
          time: new Date().toLocaleTimeString(),
          tx: log.transactionHash,
          type: 'rebalance'
        }, ...prev].slice(0, 50));
      });
    }
  });

  // === SOMSIGNAL VAULT REBALANCE EVENT ===
  useWatchContractEvent({
    address: CONTRACTS.SOMSIGNAL_VAULT,
    abi: [{ anonymous: false, inputs: [{ indexed: false, name: 'newVault', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'timestamp', type: 'uint256' }], name: 'Rebalanced', type: 'event' }] as const,
    eventName: 'Rebalanced',
    onLogs: (logs) => {
      logs.forEach(log => {
        setRebalanceCount(r => r + 1);
        setEvents(prev => [{
          msg: `SomSignal Rebalanced → ${log.args.newVault === CONTRACTS.VAULT_A ? 'Alpha' : 'Beta'}`,
          time: new Date().toLocaleTimeString(),
          tx: log.transactionHash,
          type: 'rebalance'
        }, ...prev].slice(0, 50));
      });
    }
  });

  // === RATE UPDATE EVENTS on VaultA ===
  useWatchContractEvent({
    address: CONTRACTS.VAULT_A,
    abi: vaultEventAbi,
    eventName: 'RateUpdated',
    onLogs: (logs) => {
      logs.forEach(log => {
        refetchAlphaApy();
        setEvents(prev => [{
          msg: `Alpha Rate Updated: ${(Number(log.args.oldRate) / 100).toFixed(2)}% → new rate`,
          time: new Date().toLocaleTimeString(),
          tx: log.transactionHash,
          type: 'rate_update'
        }, ...prev].slice(0, 50));
      });
    }
  });

  // === RATE UPDATE EVENTS on VaultB ===
  useWatchContractEvent({
    address: CONTRACTS.VAULT_B,
    abi: vaultEventAbi,
    eventName: 'RateUpdated',
    onLogs: (logs) => {
      logs.forEach(log => {
        refetchBetaApy();
        setEvents(prev => [{
          msg: `Beta Rate Updated: ${(Number(log.args.oldRate) / 100).toFixed(2)}% → new rate`,
          time: new Date().toLocaleTimeString(),
          tx: log.transactionHash,
          type: 'rate_update'
        }, ...prev].slice(0, 50));
      });
    }
  });

  // === DERIVED VALUES ===
  const alphaApy = alphaApyRaw !== undefined ? (Number(alphaApyRaw) / 100).toFixed(2) : "—";
  const betaApy = betaApyRaw !== undefined ? (Number(betaApyRaw) / 100).toFixed(2) : "—";

  // Active vault = whichever has the better (higher) APY
  const isVaultAActive = Number(alphaApy) >= Number(betaApy);
  const isVaultBActive = Number(betaApy) > Number(alphaApy);
  const activeVaultLabel = isVaultAActive ? "Vault Alpha" : "Vault Beta";
  const currentApy = isVaultAActive ? alphaApy : betaApy;

  // TVL from SomSignal totalDeposited (real on-chain)
  const tvlStt = somSignalTotalDeposited !== undefined ? Number(formatEther(somSignalTotalDeposited as bigint)) : 0;
  const tvlDisplay = tvlStt.toFixed(4);

  // Per-vault TVL
  const alphaTvlStt = alphaTotalDeposited !== undefined ? Number(formatEther(alphaTotalDeposited as bigint)).toFixed(4) : "0.0000";
  const betaTvlStt = betaTotalDeposited !== undefined ? Number(formatEther(betaTotalDeposited as bigint)).toFixed(4) : "0.0000";

  // Native STT balance
  const sttBalance = nativeBalance ? Number(formatEther(nativeBalance.value)).toFixed(4) : "0.0000";

  // Generate dynamic chart data from current APY (higher APY = taller bars)
  const alphaApyNum = alphaApyRaw !== undefined ? Number(alphaApyRaw) / 100 : 0;
  const betaApyNum = betaApyRaw !== undefined ? Number(betaApyRaw) / 100 : 0;

  const generateChartData = (apyVal: number) => {
    const base = apyVal * 10;
    return [
      { value: base * 0.6 }, { value: base * 0.8 }, { value: base * 0.5 }, { value: base * 0.9 },
      { value: base * 0.7 }, { value: base * 0.85 }, { value: base * 0.95 }, { value: base * 1.0 }
    ];
  };

  const alphaChartData = generateChartData(alphaApyNum);
  const betaChartData = generateChartData(betaApyNum);

  if (!mounted) return <div className="bg-background text-on-background antialiased selection:bg-primary/30 min-h-screen"></div>;

  return (
    <div className="bg-background text-on-background antialiased selection:bg-primary/30 min-h-screen">
      {/* Shared NavigationDrawer */}
      <aside className="w-[220px] h-full fixed left-0 top-0 flex flex-col border-r border-outline-variant/30 bg-surface-container-lowest z-50">
        <div className="p-6 flex flex-col gap-1">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <img src="/logo.png" alt="Z3 ZanDex Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold text-[#adc6ff] tracking-tight font-headline">ZanDex</h1>
          </div>
          <nav className="space-y-1">
            <Link className="flex items-center gap-3 px-4 py-3 text-primary border-l-4 border-primary bg-surface-container/50 font-headline font-bold text-xs uppercase tracking-wider" href="/">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
              <span>Dashboard</span>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface transition-colors font-headline font-medium text-xs uppercase tracking-wider hover:bg-surface-container-low" href="/yield-optimizer">
              <span className="material-symbols-outlined text-lg">trending_up</span>
              <span>Yield Optimizer</span>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface transition-colors font-headline font-medium text-xs uppercase tracking-wider hover:bg-surface-container-low" href="/swap">
              <span className="material-symbols-outlined text-lg">swap_horiz</span>
              <span>Swap</span>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface transition-colors font-headline font-medium text-xs uppercase tracking-wider hover:bg-surface-container-low" href="/portfolio">
              <span className="material-symbols-outlined text-lg">pie_chart</span>
              <span>Portfolio</span>
            </Link>
          </nav>
        </div>
        <div className="mt-auto p-4 border-t border-outline-variant/10">
          <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-variant overflow-hidden">
              <img alt="ZanDex Logo" className="w-full h-full object-cover" src="/logo.png" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate text-on-surface">{address ? `${address.slice(0,6)}...${address.slice(-4)}` : '0x0...0'}</p>
              <p className="text-[10px] text-secondary font-mono">{isConnected ? "SOMNIA TESTNET" : "NOT CONNECTED"}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="ml-[220px] min-h-screen relative">
        {/* Shared TopAppBar */}
        <header className="h-14 fixed top-0 right-0 w-[calc(100%-220px)] z-40 bg-surface/80 backdrop-blur-xl flex justify-between items-center px-8 border-b border-outline-variant/10">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-xl">sensors</span>
            <h2 className="font-headline font-bold tracking-widest text-on-surface uppercase text-sm">DASHBOARD</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="font-mono text-[10px] text-secondary tracking-tighter">NETWORK: TESTNET-SOMNIA-1</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-low border border-outline-variant/20">
              <span className="font-mono text-xs text-on-surface font-bold">{sttBalance} STT</span>
            </div>
            <ConnectButton />
          </div>
        </header>

        {/* Page Content */}
        <section className="pt-20 px-8 pb-12 max-w-7xl mx-auto space-y-10">
          
          {/* Stats Row: Bento Grid Style */}
          <div className="grid grid-cols-4 gap-4">
            {/* TVL Card */}
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5 relative overflow-hidden group">
              <span className="material-symbols-outlined absolute top-4 right-4 text-on-surface-variant/40 group-hover:text-primary transition-colors">account_balance</span>
              <p className="font-headline text-[10px] font-bold text-on-surface-variant/60 tracking-widest mb-1">TOTAL VALUE LOCKED</p>
              <h3 className="text-3xl font-mono text-on-surface font-bold tracking-tight mb-2">{tvlDisplay} STT</h3>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-on-surface-variant/60">verified_user</span>
                <p className="text-[10px] font-headline font-bold text-on-surface-variant/60 uppercase">SECURED BY SOMNIA</p>
              </div>
            </div>
            {/* ACTIVE VAULT Card */}
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5 relative overflow-hidden">
              <span className="material-symbols-outlined absolute top-4 right-4 text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>diamond</span>
              <p className="font-headline text-[10px] font-bold text-on-surface-variant/60 tracking-widest mb-1">ACTIVE VAULT</p>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-2xl font-headline text-on-surface font-bold leading-tight">{activeVaultLabel}</h3>
                <span className="bg-primary-container/10 text-primary-container text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary-container/20">BEST APY</span>
              </div>
              <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-full rounded-full transition-all duration-700" style={{ width: isVaultAActive ? `${Math.min(100, alphaApyNum * 10)}%` : `${Math.min(100, betaApyNum * 10)}%` }}></div>
              </div>
            </div>
            {/* CURRENT APY Card */}
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5 relative overflow-hidden">
              <span className="material-symbols-outlined absolute top-4 right-4 text-secondary">trending_up</span>
              <p className="font-headline text-[10px] font-bold text-on-surface-variant/60 tracking-widest mb-1">CURRENT APY</p>
              <h3 className="text-3xl font-mono text-secondary font-bold tracking-tight mb-1">{currentApy}%</h3>
              <p className="text-[10px] font-headline font-bold text-on-surface-variant/60 uppercase tracking-wider">
                {isVaultAActive ? 'ALPHA' : 'BETA'} • LIVE ON-CHAIN
              </p>
            </div>
            {/* REBALANCES Card */}
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5 relative overflow-hidden">
              <span className="material-symbols-outlined absolute top-4 right-4 text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
              <p className="font-headline text-[10px] font-bold text-on-surface-variant/60 tracking-widest mb-1">REBALANCES</p>
              <h3 className="text-3xl font-mono text-on-surface font-bold tracking-tight mb-1">{rebalanceCount} <span className="text-tertiary">⚡</span></h3>
              <p className="text-[10px] font-headline font-bold text-on-surface-variant/60 uppercase tracking-wider">REACTIVE SMART CONTRACTS</p>
            </div>
          </div>

          {/* Middle Row: Strategy Insights */}
          <div className="grid grid-cols-3 gap-6">
            {/* Vault Alpha Card */}
            <div className={`border rounded-2xl p-6 relative flex flex-col transition-all shadow-xl ${isVaultAActive ? 'bg-surface-container border-l-4 border-l-primary border-outline-variant/10' : 'bg-surface-container-low border-outline-variant/10'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="font-headline text-[10px] font-bold text-on-surface-variant/60 tracking-[0.2em] mb-1 uppercase">VAULT ALPHA</p>
                  <h4 className="text-xs text-on-surface-variant/80 font-medium">High Frequency Arbitrage</h4>
                </div>
                {isVaultAActive ? (
                  <span className="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter border border-primary/20">ACTIVE</span>
                ) : (
                  <span className="bg-surface-container-high text-on-surface-variant/60 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter">STANDBY</span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className={`text-4xl font-mono font-bold ${isVaultAActive ? 'text-secondary' : 'text-on-surface-variant/60'}`}>{alphaApy}%</span>
                <span className="text-sm font-headline font-bold text-on-surface-variant uppercase tracking-widest">APY</span>
              </div>
              <div className="h-20 w-full mb-6 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={alphaChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                        {alphaChartData.map((e, index) => (
                          <Cell key={`c-${index}`} style={{ fill: isVaultAActive ? 'var(--color-primary)' : 'var(--color-surface-container-high)', opacity: isVaultAActive ? 1 : 0.5, filter: isVaultAActive ? 'drop-shadow(0 0 12px rgba(173,198,255,0.4))' : 'none' }} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              </div>
              <div className="mt-auto pt-4 flex justify-between items-end border-t border-outline-variant/10">
                <div>
                  <p className="text-[10px] font-headline font-bold text-on-surface-variant/40 uppercase mb-0.5">Strategy</p>
                  <p className="text-xs text-on-surface-variant font-medium">Delta Neutral</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-headline font-bold text-on-surface-variant/40 uppercase mb-0.5">TVL</p>
                  <p className="font-mono text-sm text-on-surface font-bold">{alphaTvlStt} STT</p>
                </div>
              </div>
            </div>

            {/* Vault Beta Card */}
            <div className={`border rounded-2xl p-6 relative flex flex-col transition-all shadow-xl group hover:bg-surface-container ${isVaultBActive ? 'bg-surface-container border-l-4 border-l-primary border-outline-variant/10' : 'bg-surface-container-low border-outline-variant/10'}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="font-headline text-[10px] font-bold text-on-surface-variant/60 tracking-[0.2em] mb-1 uppercase">VAULT BETA</p>
                  <h4 className="text-xs text-on-surface-variant/80 font-medium">Cross-Chain Yield Aggregator</h4>
                </div>
                {isVaultBActive ? (
                  <span className="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter border border-primary/20">ACTIVE</span>
                ) : (
                  <span className="bg-surface-container-high text-on-surface-variant/60 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter">STANDBY</span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className={`text-4xl font-mono font-bold transition-colors ${isVaultBActive ? 'text-secondary' : 'text-on-surface-variant/60 group-hover:text-on-surface'}`}>{betaApy}%</span>
                <span className="text-sm font-headline font-bold text-on-surface-variant/40 uppercase tracking-widest">APY</span>
              </div>
              <div className="h-20 w-full mb-6 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={betaChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                        {betaChartData.map((e, index) => (
                          <Cell key={`c-${index}`} style={{ fill: isVaultBActive ? 'var(--color-primary)' : 'var(--color-surface-container-high)', opacity: isVaultBActive ? 1 : 0.5, filter: isVaultBActive ? 'drop-shadow(0 0 12px rgba(173,198,255,0.4))' : 'none' }} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              </div>
              <div className="mt-auto pt-4 flex justify-between items-end border-t border-outline-variant/10">
                <div>
                  <p className="text-[10px] font-headline font-bold text-on-surface-variant/40 uppercase mb-0.5">Strategy</p>
                  <p className="text-xs text-on-surface-variant/60 font-medium">Stable-LP</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-headline font-bold text-on-surface-variant/40 uppercase mb-0.5">TVL</p>
                  <p className="font-mono text-sm text-on-surface-variant/60 font-bold">{betaTvlStt} STT</p>
                </div>
              </div>
            </div>

            {/* Event Stream Card */}
            <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl flex flex-col overflow-hidden h-full">
              <div className="p-4 bg-surface-container-high/30 flex justify-between items-center border-b border-outline-variant/10">
                <h5 className="font-headline text-[10px] font-bold text-on-surface-variant/60 tracking-[0.2em] uppercase">EVENT STREAM</h5>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                  <span className="text-[8px] font-mono text-secondary uppercase">LIVE</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                {events.length === 0 ? (
                  <div className="flex-1 p-6 flex flex-col items-center justify-center text-center opacity-60 min-h-[250px]">
                    <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4 relative">
                      <span className="material-symbols-outlined text-3xl text-outline-variant">sensors</span>
                      <div className="absolute inset-0 border-2 border-primary/20 rounded-full animate-ping scale-150 opacity-10"></div>
                    </div>
                    <p className="text-sm text-on-surface font-medium mb-1">Waiting for events...</p>
                    <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">Listening on Somnia Testnet</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {events.map((ev, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${ev.type === 'rebalance' ? 'bg-tertiary' : ev.type === 'rate_update' ? 'bg-primary' : 'bg-secondary'}`}></div>
                        <span className="text-xs text-on-surface truncate flex-1">{ev.msg}</span>
                        <span className="ml-auto text-[10px] font-mono text-on-surface-variant whitespace-nowrap">{ev.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dashboard Background Glow */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
        </section>
      </main>
    </div>
  );
}
