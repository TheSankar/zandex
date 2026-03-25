'use client';
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function Swap() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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
            <Link href="/yield-optimizer" className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-200 transition-colors font-label tracking-wider uppercase text-xs font-bold">
              <span className="material-symbols-outlined text-lg">trending_up</span>
              <span>Yield Optimizer</span>
            </Link>
            <Link href="/swap" className="flex items-center gap-3 px-4 py-3 text-[#adc6ff] border-l-4 border-[#adc6ff] bg-[#1b1b23] font-label tracking-wider uppercase text-xs font-bold">
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
               <span className="material-symbols-outlined text-primary text-sm">account_balance_wallet</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-primary font-bold tracking-widest uppercase font-headline">{isConnected ? "Connected" : "Not connected"}</span>
              <span className="text-[10px] text-on-surface-variant font-mono">{address ? `${address.slice(0,6)}...${address.slice(-4)}` : '0x0...0'}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 ml-[220px] relative flex flex-col items-center">
        {/* Top App Bar */}
        <header className="h-14 fixed top-0 right-0 w-[calc(100%-220px)] z-40 bg-[#13131b]/80 backdrop-blur-xl border-b border-gray-800/20 flex justify-between items-center px-8">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adc6ff]">sensors</span>
            <h2 className="font-headline font-bold tracking-widest text-on-surface uppercase text-sm">Swap Tokens</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-low rounded-full border border-outline-variant/20">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></div>
              <span className="text-[10px] font-headline font-bold text-on-surface-variant tracking-wider uppercase">Somnia Testnet</span>
            </div>
            <ConnectButton />
          </div>
        </header>

        {/* Swap Container */}
        <div className="w-full max-w-lg mt-28 px-4">
          <div className="mb-8 text-center">
            <h3 className="text-4xl font-headline font-bold text-on-surface tracking-tight mb-2">Liquidity Hub</h3>
            <p className="text-on-surface-variant text-sm max-w-sm mx-auto">Instant token swaps on the fastest blockchain. Zero slippage, hyper-speed execution.</p>
          </div>

          <div className="bg-[#0d0d15] border border-outline-variant/20 rounded-2xl p-6 shadow-[0_4px_40px_rgba(0,0,0,0.4),0_0_20px_rgba(173,198,255,0.03)] relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-headline font-bold text-white text-lg tracking-wide uppercase">Swap Tokens</h4>
                <button className="text-gray-400 hover:text-white transition-colors">
                  <span className="material-symbols-outlined">settings</span>
                </button>
              </div>

              {/* PAY SECTION */}
              <div className="bg-[#1b1b23] rounded-2xl p-4 mb-1">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold font-headline text-gray-500 tracking-widest uppercase">YOU PAY</span>
                  <span className="text-[10px] font-medium text-gray-500">Balance: <span className="text-on-surface">0.00 STT</span></span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <button className="flex items-center gap-2 bg-[#292932] hover:bg-[#393842] transition-colors rounded-xl px-3 py-2 border border-outline-variant/10">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-[#002e6a]">S</div>
                    <span className="font-headline font-bold text-white tracking-wider text-sm">STT</span>
                    <span className="material-symbols-outlined text-gray-400 text-sm">expand_more</span>
                  </button>
                  <input className="bg-transparent border-none text-right text-3xl font-mono text-white placeholder-gray-700 outline-none w-full p-0" placeholder="0" type="text" />
                </div>
              </div>

              {/* Swap Switch Button */}
              <div className="relative h-4 flex items-center justify-center z-20">
                <button className="bg-[#292932] rounded-full p-2.5 border-4 border-[#0d0d15] text-white hover:rotate-180 transition-transform duration-500 group">
                  <span className="material-symbols-outlined block group-hover:text-primary transition-colors">swap_vert</span>
                </button>
              </div>

              {/* RECEIVE SECTION */}
              <div className="bg-[#1b1b23] rounded-2xl p-4 mt-1 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold font-headline text-gray-500 tracking-widest uppercase">YOU RECEIVE</span>
                  <span className="text-[10px] font-medium text-gray-500">Balance: <span className="text-on-surface">0.00 PING</span></span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <button className="flex items-center gap-2 bg-[#292932] hover:bg-[#393842] transition-colors rounded-xl px-3 py-2 border border-outline-variant/10">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-[#003824]">P</div>
                    <span className="font-headline font-bold text-white tracking-wider text-sm">PING</span>
                    <span className="material-symbols-outlined text-gray-400 text-sm">expand_more</span>
                  </button>
                  <input className="bg-transparent border-none text-right text-3xl font-mono text-white placeholder-gray-700 outline-none w-full p-0" placeholder="0" readOnly type="text" />
                </div>
              </div>

              {/* Market Data Row */}
              <div className="flex justify-between items-center px-2 mb-6">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-gray-500">info</span>
                  <span className="text-xs font-mono text-gray-500">1 STT = 1.00 PING</span>
                </div>
                <span className="text-xs font-mono text-secondary font-bold tracking-tight">$0.02</span>
              </div>

              {/* Coming Soon Alert */}
              <div className="bg-tertiary/5 border border-tertiary/20 shadow-[inset_0_0_12px_rgba(255,185,95,0.05)] rounded-xl p-4 mb-4">
                <p className="text-center text-tertiary text-sm font-medium flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  Coming Soon on ZanDex
                </p>
              </div>

              {/* Primary Action Button */}
              <button className="w-full bg-primary/50 cursor-not-allowed rounded-xl py-4 flex flex-col items-center justify-center gap-0.5 border border-primary/20 backdrop-blur-sm">
                <span className="text-white font-headline font-bold tracking-widest uppercase text-sm">Swap Tokens</span>
                <span className="text-[10px] text-white/60 font-medium">(Coming Soon)</span>
              </button>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="bg-surface-container-low/40 rounded-xl p-4 border-l-2 border-primary/30">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-headline font-bold mb-1">Expected Output</p>
              <p className="font-mono text-lg text-on-surface">0.00 PING</p>
            </div>
            <div className="bg-surface-container-low/40 rounded-xl p-4 border-l-2 border-secondary/30">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-headline font-bold mb-1">Price Impact</p>
              <p className="font-mono text-lg text-secondary">&lt; 0.01%</p>
            </div>
          </div>

          <div className="mt-12 opacity-30 flex flex-col items-center gap-4 pb-20">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-outline-variant to-transparent"></div>
            <div className="flex gap-8">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">verified_user</span>
                <span className="text-[10px] font-headline tracking-widest uppercase">Audited Protocol</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">bolt</span>
                <span className="text-[10px] font-headline tracking-widest uppercase">0.1s Execution</span>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
