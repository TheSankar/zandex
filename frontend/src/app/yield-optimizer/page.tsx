'use client';
import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { useAccount, useReadContract, useWatchContractEvent, useWriteContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseEther, formatEther } from 'viem';
import Link from 'next/link';

import { CONTRACTS } from '@/config/chain';


const vaultAbi = [
  { inputs: [], name: 'apy', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'currentAPY', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalAssets', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalDeposited', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'deposit', outputs: [], stateMutability: 'payable', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'assets', type: 'uint256' }, { internalType: 'address', name: 'receiver', type: 'address' }, { internalType: 'address', name: 'owner', type: 'address' }], name: 'withdraw', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'account', type: 'address' }], name: 'getUserDeposit', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'newRate', type: 'uint256' }], name: 'updateRate', outputs: [], stateMutability: 'nonpayable', type: 'function' }
] as const;

const routerAbi = [
  { inputs: [], name: 'activeVault', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { anonymous: false, inputs: [{ indexed: false, name: 'oldVault', type: 'address' }, { indexed: false, name: 'newVault', type: 'address' }, { indexed: false, name: 'reason', type: 'string' }], name: 'Rebalance', type: 'event' }
] as const;

const somSignalAbi = [
  { inputs: [], name: 'totalDeposited', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getActiveVault', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'account', type: 'address' }], name: 'getUserDeposit', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;


const ADMIN_ADDRESS = '0x7c2664cf2ceb13f72047dc1137e3fc54ae59f8d5';

export default function YieldOptimizer() {
  const { address, isConnected } = useAccount();
  const [events, setEvents] = useState<{msg: string, time: string, tx?: string, icon?: string, bg?: string, color?: string}[]>([]);
  const [mounted, setMounted] = useState(false);
  const [depositAmt, setDepositAmt] = useState("");
  const [simAlphaApy, setSimAlphaApy] = useState("8.00");
  const [simBetaApy, setSimBetaApy] = useState("6.25");
  const [apyHistory, setApyHistory] = useState<{time: string, alpha: number, beta: number}[]>([]);
  const [lastAlpha, setLastAlpha] = useState<string | null>(null);
  const [lastBeta, setLastBeta] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const { data: alphaApyRaw, refetch: refetchAlpha } = useReadContract({ address: CONTRACTS.VAULT_A, abi: vaultAbi, functionName: 'currentAPY', chainId: 50312, query: { refetchInterval: 5000 } });
  const { data: betaApyRaw, refetch: refetchBeta } = useReadContract({ address: CONTRACTS.VAULT_B, abi: vaultAbi, functionName: 'currentAPY', chainId: 50312, query: { refetchInterval: 5000 } });
  const { data: activeVaultAddress, refetch: refetchActiveVault } = useReadContract({ address: CONTRACTS.REACTIVE_ROUTER, abi: routerAbi, functionName: 'activeVault', chainId: 50312 });
  const { data: rebalanceCountRaw, refetch: refetchRebalanceCount } = useReadContract({
    address: CONTRACTS.REACTIVE_ROUTER,
    abi: [{ inputs: [], name: 'rebalanceCount', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
    functionName: 'rebalanceCount',
    chainId: 50312,
    query: { refetchInterval: 3000 },
  });
  const rebalanceCount = Number(rebalanceCountRaw ?? 0);
  
  const { data: userBal, refetch: refetchBal } = useReadContract({ address: CONTRACTS.SOMSIGNAL_VAULT, abi: vaultAbi, functionName: 'getUserDeposit', args: [address as `0x${string}`], chainId: 50312, query: { enabled: !!address, refetchInterval: 5000 } });
  const { data: alphaTotalDeposited } = useReadContract({ address: CONTRACTS.VAULT_A, abi: vaultAbi, functionName: 'totalDeposited', chainId: 50312, query: { refetchInterval: 5000 } });
  const { data: betaTotalDeposited } = useReadContract({ address: CONTRACTS.VAULT_B, abi: vaultAbi, functionName: 'totalDeposited', chainId: 50312, query: { refetchInterval: 5000 } });
  const { data: somSignalTotalDeposited } = useReadContract({ address: CONTRACTS.SOMSIGNAL_VAULT, abi: somSignalAbi, functionName: 'totalDeposited', chainId: 50312, query: { refetchInterval: 5000 } });
  
  const { writeContractAsync: depositAsync } = useWriteContract();
  const { writeContractAsync: withdrawAsync } = useWriteContract();
  const { writeContractAsync: updateApyAsyncAlpha } = useWriteContract();
  const { writeContractAsync: updateApyAsyncBeta } = useWriteContract();

  useWatchContractEvent({
    address: CONTRACTS.REACTIVE_ROUTER,
    abi: routerAbi,
    eventName: 'Rebalance',
    onLogs: (logs) => {
      logs.forEach(log => {
        refetchRebalanceCount();
        setEvents(prev => [{
          msg: `Vault Rebalance Triggered: Pivot to ${log.args.newVault === CONTRACTS.VAULT_A ? 'Alpha' : 'Beta'}`,
          time: 'Just now',
          tx: log.transactionHash,
          icon: 'bolt', bg: 'bg-tertiary/15', color: 'text-tertiary'
        }, ...prev]);
      });
    }
  });

  const handleDeposit = async () => {
    if (!depositAmt || !address) return;
    try {
      const tx = await depositAsync({ 
        address: CONTRACTS.SOMSIGNAL_VAULT, 
        abi: vaultAbi, 
        functionName: 'deposit', 
        value: parseEther(depositAmt),
        gas: BigInt(200000)
      });
      setEvents(prev => [{ msg: `Deposit Confirmed: ${depositAmt} STT`, time: 'Just now', tx, icon: 'arrow_downward', bg: 'bg-secondary/15', color: 'text-secondary' }, ...prev]);
      setDepositAmt("");
      refetchBal();
    } catch (e) { console.error('Deposit failed', e); }
  };

  const handleWithdraw = async () => {
    if (!depositAmt || !address) return;
    try {
      const tx = await withdrawAsync({ 
        address: CONTRACTS.SOMSIGNAL_VAULT, 
        abi: vaultAbi, 
        functionName: 'withdraw', 
        args: [parseEther(depositAmt), address, address],
        gas: BigInt(200000)
      });
      setEvents(prev => [{ msg: `Withdraw Confirmed: ${depositAmt} STT`, time: 'Just now', tx, icon: 'arrow_upward', bg: 'bg-secondary/15', color: 'text-secondary' }, ...prev]);
      setDepositAmt("");
      refetchBal();
    } catch (e) { console.error('Withdraw failed', e); }
  };

  const handleUpdateRates = async () => {
    try {
      await updateApyAsyncAlpha({ 
        address: CONTRACTS.VAULT_A, 
        abi: vaultAbi, 
        functionName: 'updateRate', 
        args: [BigInt(Math.floor(Number(simAlphaApy) * 100))],
        gas: BigInt(200000)
      });
      await updateApyAsyncBeta({ 
        address: CONTRACTS.VAULT_B, 
        abi: vaultAbi, 
        functionName: 'updateRate', 
        args: [BigInt(Math.floor(Number(simBetaApy) * 100))],
        gas: BigInt(200000)
      });
      setEvents(prev => [{ msg: `Rates Update: Alpha ${simAlphaApy}%, Beta ${simBetaApy}%`, time: 'Just now', icon: 'trending_up', bg: 'bg-primary/15', color: 'text-primary' }, ...prev]);
      // Refetch on-chain data after successful rate update
      setTimeout(async () => {
        await refetchAlpha();
        await refetchBeta();
        await refetchActiveVault();
      }, 2000);
    } catch (e) { console.error('Update rates failed', e); }
  };

  const alphaApy = alphaApyRaw !== undefined ? (Number(alphaApyRaw) / 100).toFixed(2) : "8.00";
  const betaApy = betaApyRaw !== undefined ? (Number(betaApyRaw) / 100).toFixed(2) : "6.25";
  // Active vault = whichever has the better (higher) APY
  const isVaultAActive = Number(alphaApy) >= Number(betaApy);
  const isVaultBActive = Number(betaApy) > Number(alphaApy);

  const currentBalDisplay = userBal ? (Number(userBal) / 10**18).toFixed(2) : "0.00";
  const dailyYield = userBal ? ((Number(userBal) * (isVaultAActive ? Number(alphaApy) : Number(betaApy)) / 100) / 365 / 10**18).toFixed(4) : "0.00";

  const apyDiff = Math.abs(Number(simAlphaApy) - Number(simBetaApy)).toFixed(2);
  const rebalanceMsg = Number(apyDiff) > 2.0 ? "Diff >2.00% — Rebalance Expected" : `Diff ${apyDiff}% — Below threshold`;

  // Track APY history for live chart - capture data points and seed history on mount
  useEffect(() => {
    if (mounted && alphaApyRaw !== undefined && betaApyRaw !== undefined) {
      const alphaVal = Number(alphaApyRaw) / 100;
      const betaVal = Number(betaApyRaw) / 100;
      
      setApyHistory(prev => {
        // Initial seeding on first mount or when data first arrives
        if (prev.length === 0) {
          const initialPoints = [];
          const nowTime = new Date();
          for(let i=19; i>=0; i--) {
            const time = new Date(nowTime.getTime() - i * 10000); // 10s intervals
            initialPoints.push({
              time: time.toLocaleTimeString('en-GB', { hour12: false }),
              alpha: alphaVal,
              beta: betaVal
            });
          }
          return initialPoints;
        }
        
        // Append new points on update
        const lastPoint = prev[prev.length - 1];
        if (lastPoint.alpha !== alphaVal || lastPoint.beta !== betaVal) {
          const timeLabel = new Date().toLocaleTimeString('en-GB', { hour12: false });
          const next = [...prev, { time: timeLabel, alpha: alphaVal, beta: betaVal }];
          return next.slice(-30); // Keep max 30 points
        }
        return prev;
      });
    }
  }, [alphaApyRaw, betaApyRaw, mounted]);

  // Auto-poll APYs every 10 seconds to catch external updates
  useEffect(() => {
    const interval = setInterval(() => {
      refetchAlpha();
      refetchBeta();
      refetchActiveVault();
    }, 10000);
    return () => clearInterval(interval);
  }, [refetchAlpha, refetchBeta, refetchActiveVault]);

  // Derive chart data: use history if we have it, otherwise seed with current values
  const chartData = apyHistory.length >= 2 ? apyHistory : [
    { time: 'Start', alpha: Number(alphaApy), beta: Number(betaApy) },
    { time: 'Now', alpha: Number(alphaApy), beta: Number(betaApy) },
  ];

  if (!mounted) return <div className="bg-[#13131b] text-[#e4e1ed] antialiased min-h-screen border-r border-gray-800/30 font-body"></div>;

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#13131b] text-[#e4e1ed] font-body selection:bg-primary/30">
      {/* Navigation Drawer */}
      <nav className="w-[220px] h-full fixed left-0 top-0 flex flex-col bg-[#0d0d15] border-r border-gray-800/30 z-50">
        <div className="p-6 flex flex-col gap-1">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <img src="/logo.png" alt="Z3 ZanDex Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold text-[#adc6ff] tracking-tight font-headline">ZanDex</h1>
          </div>
          <div className="space-y-1">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-200 transition-colors font-label tracking-wider uppercase text-xs font-bold">
              <span className="material-symbols-outlined text-lg">dashboard</span>
              <span>Dashboard</span>
            </Link>
            <Link href="/yield-optimizer" className="flex items-center gap-3 px-4 py-3 text-[#adc6ff] border-l-4 border-[#adc6ff] bg-[#1b1b23] font-label tracking-wider uppercase text-xs font-bold">
              <span className="material-symbols-outlined text-lg border-primary">trending_up</span>
              <span>Yield Optimizer</span>
            </Link>
            <Link href="/swap" className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-200 transition-colors font-label tracking-wider uppercase text-xs font-bold">
              <span className="material-symbols-outlined text-lg">swap_horiz</span>
              <span>Swap</span>
            </Link>
            <Link href="/portfolio" className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-200 transition-colors font-label tracking-wider uppercase text-xs font-bold">
              <span className="material-symbols-outlined text-lg">pie_chart</span>
              <span>Portfolio</span>
            </Link>
          </div>
        </div>
        <div className="mt-auto p-4 border-t border-gray-800/30">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-surface-container-low">
            <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center overflow-hidden">
              <img alt="ZanDex Logo" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDm5QYbzCYpAsLytplZ4ofkDGpPCaisapimXT6BeP-YXMm3B4q2OyM7-beasq51gne90STA0Ub1ly4l50D5r82f2yziFZ0QzpSu2sb2QrBy7rAhAhFlsFmsPxggdFJoyU_vkffA5WuDWKSlKMjALlPfPu6_NZSLFDwpOjuUl-DkAlxFt0NBPqC7fIB8OtMKEwGavmAtYiDwnlaCeyWVvNDBkRK4JnmfviUi2otBgMRdvC5RjIP86CEkbBWt9gsSmYTEUjkYcLSOC7Y" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-primary font-bold tracking-widest uppercase font-headline">SOMNIA DEFI</span>
              <span className="text-[10px] text-on-surface-variant font-mono">{address ? `${address.slice(0,6)}...${address.slice(-4)}` : '0x0...0'}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 ml-[220px] relative">
        {/* Top App Bar */}
        <header className="h-14 fixed top-0 right-0 w-[calc(100%-220px)] z-40 bg-[#13131b]/80 backdrop-blur-xl border-b border-gray-800/20 flex justify-between items-center px-8">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adc6ff]">sensors</span>
            <h2 className="font-headline font-bold tracking-widest text-on-surface uppercase text-sm">YIELD OPTIMIZER</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></div>
              <span className="text-[10px] font-mono text-secondary font-bold">SOMNIA TESTNET-1</span>
            </div>
            <ConnectButton />
          </div>
        </header>

        {/* Canvas */}
        <div className="mt-14 p-8 max-w-7xl mx-auto">
          {/* Hero Section */}
          <section className="mb-6">
            <h1 className="text-4xl font-headline font-bold text-on-surface leading-tight">
              Reactive <span className="text-secondary">Yield Optimizer</span>
            </h1>
            <p className="text-on-surface-variant text-sm mt-1 max-w-2xl">
              Autonomous liquidity management on Somnia. Our reactive smart contracts automatically pivot capital to the highest performing vaults based on real-time on-chain data.
            </p>
          </section>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-5 flex flex-col">
              <span className="text-[10px] font-headline font-bold text-outline tracking-widest uppercase mb-1">TOTAL TVL</span>
              <span className="text-2xl font-mono font-bold text-on-surface">{somSignalTotalDeposited !== undefined ? Number(formatEther(somSignalTotalDeposited as bigint)).toFixed(2) : '0.00'} STT</span>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-5 flex flex-col">
              <span className="text-[10px] font-headline font-bold text-outline tracking-widest uppercase mb-1">PROTOCOL REBALANCES</span>
              <span className="text-2xl font-mono font-bold text-tertiary">{rebalanceCount} ⚡</span>
            </div>
            <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-5 flex flex-col">
              <span className="text-[10px] font-headline font-bold text-outline tracking-widest uppercase mb-1">ACTIVE STRATEGY</span>
              <span className="text-2xl font-headline font-bold text-secondary uppercase tracking-tight">{isVaultAActive ? 'Delta Alpha' : 'Beta Aggregator'}</span>
            </div>
          </div>

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN: Vault Cards */}
            <div className="flex flex-col gap-6">
              {/* Vault Alpha */}
              <div className={`p-6 rounded-xl relative overflow-hidden transition-all duration-300 ${isVaultAActive ? 'bg-surface-container border border-primary/40 shadow-[0_0_24px_rgba(173,198,255,0.06)]' : 'bg-surface-container-low border border-outline-variant/10 opacity-70'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-headline font-bold tracking-[0.2em] text-on-surface-variant uppercase">VAULT ALPHA</p>
                    <p className="text-sm text-outline mt-0.5">StableSwap Master</p>
                  </div>
                  {isVaultAActive ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 uppercase">ACTIVE</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-variant text-outline border border-outline-variant/30 uppercase">STANDBY</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className={`text-5xl font-mono font-bold ${isVaultAActive ? 'text-secondary' : 'text-outline'}`}>{alphaApy}%</span>
                  <span className={`text-xl font-headline uppercase ${isVaultAActive ? 'text-on-surface-variant' : 'text-outline-variant'}`}>APY</span>
                </div>
                {/* Sparkline Visual - Adapted for Vault Alpha */}
                 <div className="h-16 w-full mb-6 relative">
                  <svg className={`w-full h-full transition-opacity ${isVaultAActive ? 'opacity-100' : 'opacity-30'}`} viewBox="0 0 400 64" preserveAspectRatio="none">
                    <path d="M0 50 Q 50 10, 100 45 T 200 20 T 300 55 T 400 15" fill="none" stroke="#4d8eff" strokeWidth="2"></path>
                    <path d="M0 50 Q 50 10, 100 45 T 200 20 T 300 55 T 400 15 V 64 H 0 Z" fill="url(#grad1)" opacity="0.1"></path>
                    <defs>
                      <linearGradient id="grad1" x1="0%" x2="0%" y1="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#4d8eff', stopOpacity: 1 }}></stop>
                        <stop offset="100%" style={{ stopColor: '#4d8eff', stopOpacity: 0 }}></stop>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-outline-variant/10">
                  <span className="text-[10px] font-headline text-outline tracking-wider uppercase">TOTAL VALUE LOCKED</span>
                  <span className="font-mono text-sm text-on-surface">{alphaTotalDeposited !== undefined ? Number(formatEther(alphaTotalDeposited as bigint)).toFixed(4) : '0.0000'} STT</span>
                </div>
              </div>

              {/* Vault Beta */}
              <div className={`p-6 rounded-xl transition-all duration-300 ${isVaultBActive ? 'bg-surface-container border border-primary/40 shadow-[0_0_24px_rgba(173,198,255,0.06)]' : 'bg-surface-container-low border border-outline-variant/10 opacity-70'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-headline font-bold tracking-[0.2em] text-on-surface-variant uppercase">VAULT BETA</p>
                    <p className="text-sm text-outline mt-0.5">Liquidity Aggregator</p>
                  </div>
                  {isVaultBActive ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 uppercase">ACTIVE</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-variant text-outline border border-outline-variant/30 uppercase">STANDBY</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className={`text-5xl font-mono font-bold ${isVaultBActive ? 'text-secondary' : 'text-outline'}`}>{betaApy}%</span>
                  <span className={`text-xl font-headline uppercase ${isVaultBActive ? 'text-on-surface-variant' : 'text-outline-variant'}`}>APY</span>
                </div>
                {/* Sparkline Visual - Adapted for Vault Beta */}
                <div className="h-16 w-full mb-6">
                  <svg className={`w-full h-full transition-opacity ${isVaultBActive ? 'opacity-100' : 'opacity-30'}`} viewBox="0 0 400 64" preserveAspectRatio="none">
                    <path d="M0 40 Q 50 45, 100 35 T 200 42 T 300 38 T 400 45" fill="none" stroke={isVaultBActive ? "#4d8eff" : "#424754"} strokeWidth="2"></path>
                    {isVaultBActive && <path d="M0 40 Q 50 45, 100 35 T 200 42 T 300 38 T 400 45 V 64 H 0 Z" fill="url(#grad2)" opacity="0.1"></path>}
                    <defs>
                      <linearGradient id="grad2" x1="0%" x2="0%" y1="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#4d8eff', stopOpacity: 1 }}></stop>
                        <stop offset="100%" style={{ stopColor: '#4d8eff', stopOpacity: 0 }}></stop>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-outline-variant/10">
                  <span className="text-[10px] font-headline text-outline tracking-wider uppercase">TOTAL VALUE LOCKED</span>
                  <span className="font-mono text-sm text-outline-variant">{betaTotalDeposited !== undefined ? Number(formatEther(betaTotalDeposited as bigint)).toFixed(4) : '0.0000'} STT</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Chart */}
            <div className="bg-surface-container rounded-xl flex flex-col p-6 relative">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <h3 className="font-headline font-bold text-on-surface uppercase text-sm tracking-widest">Live Performance Comparison</h3>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></div>
                    <span className="text-[10px] font-bold text-secondary uppercase">LIVE</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm bg-primary"></div>
                    <span className="text-[10px] text-outline font-headline uppercase">Alpha</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm bg-secondary"></div>
                    <span className="text-[10px] text-outline font-headline uppercase">Beta</span>
                  </div>
                </div>
              </div>

              {/* Main Performance Chart using Recharts */}
              <div className="flex-1 min-h-[300px] chart-grid rounded-lg border border-outline-variant/5 relative flex items-end p-2" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '24px 24px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '0.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
                      itemStyle={{ color: '#adc6ff', fontSize: '11px', fontFamily: 'JetBrains Mono' }}
                      labelStyle={{ color: '#8c909f', fontSize: '10px', marginBottom: '4px', fontFamily: 'JetBrains Mono' }}
                      formatter={((value: any) => `${Number(value).toFixed(2)}%`) as any}
                    />
                    <Line type="monotone" dataKey="alpha" name="Vault Alpha" stroke="#adc6ff" strokeWidth={3} dot={{ r: 3, fill: '#adc6ff' }} activeDot={{ r: 5, fill: '#adc6ff' }} isAnimationActive={true} animationDuration={500} />
                    <Line type="monotone" dataKey="beta" name="Vault Beta" stroke="#4edea3" strokeWidth={3} dot={{ r: 3, fill: '#4edea3' }} activeDot={{ r: 5, fill: '#4edea3' }} isAnimationActive={true} animationDuration={500} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-8 pt-6 border-t border-outline-variant/10">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-headline text-outline tracking-wider uppercase">ALPHA APY</span>
                  <span className="font-mono text-xs text-primary font-bold">{alphaApy}%</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-headline text-outline tracking-wider uppercase">BETA APY</span>
                  <span className="font-mono text-xs text-secondary font-bold">{betaApy}%</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-headline text-outline tracking-wider uppercase">ACTIVE</span>
                  <span className="font-mono text-xs text-on-surface">{isVaultAActive ? 'Alpha' : 'Beta'}</span>
                </div>
                <div className="flex flex-col gap-1 items-end text-right">
                  <span className="text-[10px] font-headline text-outline tracking-wider uppercase">DATA POINTS</span>
                  <span className="font-mono text-xs text-on-surface">{apyHistory.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Your Position Card */}
            <div className="bg-surface-container p-6 rounded-xl">
              <h3 className="font-headline font-bold text-on-surface uppercase text-sm tracking-widest mb-4">Your Position</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-outline uppercase font-headline tracking-wider">Deposited</span>
                  <span className="font-mono text-sm text-on-surface">{currentBalDisplay} STT</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-outline uppercase font-headline tracking-wider">Active Vault</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary uppercase">{isVaultAActive ? "Vault Alpha" : "Vault Beta"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-outline uppercase font-headline tracking-wider">Est. Daily Yield</span>
                  <span className="font-mono text-sm text-secondary">+{dailyYield} STT</span>
                </div>
              </div>
              <div className="border-t border-outline-variant/10 my-6"></div>
              
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input 
                    value={depositAmt}
                    onChange={e => setDepositAmt(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 font-mono text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none text-on-surface" 
                    placeholder="0.00" 
                    type="number" 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-outline uppercase tracking-widest">STT</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleDeposit} disabled={!isConnected || !depositAmt} className="px-5 py-2.5 bg-primary-container text-on-primary-container font-headline font-bold uppercase text-xs rounded-lg hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">arrow_downward</span>
                    Deposit
                  </button>
                  <button onClick={handleWithdraw} disabled={!isConnected || !depositAmt} className="px-5 py-2.5 bg-surface-variant text-on-surface-variant font-headline font-bold uppercase text-xs rounded-lg hover:bg-surface-container-highest disabled:opacity-50 border border-outline-variant/20 transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">arrow_upward</span>
                    Withdraw
                  </button>
                </div>
              </div>
            </div>

            {/* Simulate Rate Change Card - Admin Only */}
            {address?.toLowerCase() === ADMIN_ADDRESS && (
              <div className="bg-surface-container p-6 rounded-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-headline font-bold text-on-surface uppercase text-sm tracking-widest">Simulate Rate Change</h3>
                  <span className="material-symbols-outlined text-outline cursor-help text-lg" title="Test reactivity: update the APYs to trigger a rebalance event!">info</span>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-[10px] text-outline font-headline uppercase tracking-wider flex-1">Vault Alpha APY (%)</label>
                    <input 
                      className="w-24 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1.5 font-mono text-sm text-on-surface text-right" 
                      type="number" 
                      max="1000"
                      value={simAlphaApy}
                      onChange={e => setSimAlphaApy(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-[10px] text-outline font-headline uppercase tracking-wider flex-1">Vault Beta APY (%)</label>
                    <input 
                      className="w-24 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-1.5 font-mono text-sm text-on-surface text-right" 
                      type="number" 
                      value={simBetaApy}
                      onChange={e => setSimBetaApy(e.target.value)}
                    />
                  </div>
                </div>
                <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 border transition-colors ${Number(apyDiff) > 2 ? 'bg-error/5 border-error/10 text-error' : 'bg-tertiary/5 border-tertiary/10 text-tertiary'}`}>
                  <span className={`text-lg ${Number(apyDiff) > 2 ? 'text-error' : 'text-tertiary'}`}>⚡</span>
                  <p className={`text-[10px] font-headline font-bold uppercase tracking-widest ${Number(apyDiff) > 2 ? 'text-error' : 'text-tertiary'}`}>
                    {rebalanceMsg}
                  </p>
                </div>
                <button disabled={!isConnected} onClick={handleUpdateRates} className="w-full mt-4 py-3 bg-tertiary-container disabled:opacity-50 disabled:bg-surface-variant text-on-tertiary-container disabled:text-outline font-headline font-bold uppercase text-xs rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2">
                  Update Rates ⚡
                </button>
              </div>
            )}
          </div>

          {/* Reactive Events Section */}
          <div className="bg-surface-container rounded-xl mt-6 overflow-hidden">
            <div className="p-6 border-b border-outline-variant/10">
              <h3 className="font-headline font-bold text-on-surface uppercase text-sm tracking-widest">Reactive Events</h3>
            </div>
            <div className="max-h-56 overflow-y-auto custom-scrollbar">
              {events.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-outline-variant text-4xl animate-pulse">hourglass_empty</span>
                  <p className="text-sm text-outline font-headline uppercase tracking-widest">Waiting for on-chain events...</p>
                </div>
              ) : (
                <>
                  {events.map((ev, i) => (
                    <div key={i} className="p-4 border-b border-outline-variant/5 flex items-center gap-4 hover:bg-white/5 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ev.bg || 'bg-surface-variant'}`}>
                        <span className={`material-symbols-outlined text-sm ${ev.color || 'text-on-surface'}`}>{ev.icon || 'bolt'}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-on-surface">{ev.msg}</p>
                        <p className="text-[10px] text-outline uppercase font-headline mt-0.5">{ev.time}</p>
                      </div>
                      {ev.tx && <a href={`https://shannon-explorer.somnia.network/tx/${ev.tx}`} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-primary-container hover:underline">{ev.tx.slice(0, 10)}...</a>}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

        </div>

        {/* Global Decoration Background */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px]"></div>
        </div>
      </main>
    </div>
  );
}
