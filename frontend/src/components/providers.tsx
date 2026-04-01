'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider, http } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

import { somniaTestnet, RPC_URL } from '@/config/chain';

export const config = getDefaultConfig({
  appName: 'ZanDex Yield Optimizer',
  projectId: '1fdfbd889980d2850970bdef1fbeaaf9', // public fallback id for WC
  chains: [somniaTestnet],
  transports: {
    [somniaTestnet.id]: http(RPC_URL),
  },
  ssr: true,
});


const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: '#3b82f6',
          accentColorForeground: 'white',
          borderRadius: 'medium',
        })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
