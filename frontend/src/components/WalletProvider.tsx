'use client'

import '@rainbow-me/rainbowkit/styles.css'
import { RainbowKitProvider, darkTheme, lightTheme, connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  injectedWallet,
  rabbyWallet,
  trustWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { WagmiProvider, createConfig, createStorage, http } from 'wagmi'
import { sepolia, baseSepolia } from 'wagmi/chains'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { arcTestnet } from '@/lib/constants'
import React, { useMemo } from 'react'

// Solana Imports
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import '@solana/wallet-adapter-react-ui/styles.css'

// ── Safe localStorage wrapper
const safeStorage = createStorage({
  storage: {
    getItem: (key: string) => {
      try {
        return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
      } catch {
        return null
      }
    },
    setItem: (key: string, value: string) => {
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
      } catch { /* ignore */ }
    },
    removeItem: (key: string) => {
      try {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key)
      } catch { /* ignore */ }
    },
  },
})

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? ''

// ── Define wallet list
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [
        injectedWallet as any,
        metaMaskWallet as any,
        rabbyWallet as any,
        coinbaseWallet as any,
        trustWallet as any,
      ],
    },
    ...(PROJECT_ID
      ? [{
          groupName: 'More',
          wallets: [walletConnectWallet as any],
        }]
      : []),
  ],
  {
    appName: 'EasyZpay',
    projectId: PROJECT_ID || 'easyzpay_demo',
  }
)

// ── Wagmi config
const config = createConfig({
  chains: [arcTestnet, sepolia, baseSepolia],
  connectors,
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: false,
  storage: safeStorage,
})

// ── QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      throwOnError: false,
      staleTime: 4_000,
    },
    mutations: {
      retry: false,
      throwOnError: false,
    },
  },
})

class WalletErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: false }
  }

  componentDidCatch(error: Error) {
    console.warn('[EasyZpay] Wallet error:', error.message)
  }

  render() {
    return this.props.children
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [activeTheme, setActiveTheme] = React.useState<'dark' | 'light'>('light')

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const getInitialTheme = () => {
      const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null
      if (savedTheme) return savedTheme
      const attr = document.documentElement.getAttribute('data-theme')
      return attr === 'dark' ? 'dark' : 'light'
    }
    setActiveTheme(getInitialTheme())

    const observer = new MutationObserver(() => {
      const attr = document.documentElement.getAttribute('data-theme')
      setActiveTheme(attr === 'dark' ? 'dark' : 'light')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const solanaEndpoint = useMemo(() => clusterApiUrl('devnet'), [])
  const solanaWallets = useMemo(() => [], [])

  return (
    <WalletErrorBoundary>
      <ConnectionProvider endpoint={solanaEndpoint}>
        <SolanaWalletProvider wallets={solanaWallets} autoConnect>
          <WalletModalProvider>
            <WagmiProvider config={config} reconnectOnMount={true}>
              <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                  theme={
                    activeTheme === 'dark'
                      ? darkTheme({
                          accentColor: '#1035f6',
                          accentColorForeground: 'white',
                          borderRadius: 'large',
                          fontStack: 'system',
                          overlayBlur: 'small',
                        })
                      : lightTheme({
                          accentColor: '#1035f6',
                          accentColorForeground: 'white',
                          borderRadius: 'large',
                          fontStack: 'system',
                          overlayBlur: 'small',
                        })
                  }
                  locale="en-US"
                >
                  {children}
                </RainbowKitProvider>
              </QueryClientProvider>
            </WagmiProvider>
          </WalletModalProvider>
        </SolanaWalletProvider>
      </ConnectionProvider>
    </WalletErrorBoundary>
  )
}
