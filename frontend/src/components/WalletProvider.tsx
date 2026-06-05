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
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { arcTestnet } from '@/lib/constants'
import React from 'react'

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

// ── Define wallet list — MetaMask / injected first so it works without WalletConnect
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [
        injectedWallet,
        metaMaskWallet,
        rabbyWallet,
        coinbaseWallet,
        trustWallet,
      ],
    },
    ...(PROJECT_ID
      ? [{
          groupName: 'More',
          wallets: [walletConnectWallet],
        }]
      : []),
  ],
  {
    appName: 'ArcPay',
    projectId: PROJECT_ID || 'arcpay_demo',
  }
)

// ── Wagmi config with explicit connectors (no getDefaultConfig)
const config = createConfig({
  chains: [arcTestnet],
  connectors,
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
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

// ── Error boundary
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
    if (
      error.message.includes('not found') ||
      error.message.includes('connector') ||
      error.message.includes('MetaMask') ||
      error.message.includes('WalletConnect') ||
      error.message.includes('session')
    ) {
      console.warn('[ArcPay] Wallet connector error (non-fatal):', error.message)
    } else {
      console.error('[ArcPay] Unexpected error:', error)
    }
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

  return (
    <WalletErrorBoundary>
      <WagmiProvider config={config} reconnectOnMount={true}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={
              activeTheme === 'dark'
                ? darkTheme({
                    accentColor: '#1035f6', // Match our royal blue accent
                    accentColorForeground: 'white',
                    borderRadius: 'large',
                    fontStack: 'system',
                    overlayBlur: 'small',
                  })
                : lightTheme({
                    accentColor: '#1035f6', // Match our royal blue accent
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
    </WalletErrorBoundary>
  )
}
