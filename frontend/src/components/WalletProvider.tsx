'use client'

import React from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider, createConfig } from '@privy-io/wagmi'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { http } from 'wagmi'
import { arcTestnet, sonicTestnet, monadTestnet, unichainSepolia, inkTestnet } from '@/lib/constants'
import { sepolia, arbitrumSepolia, baseSepolia, lineaSepolia, optimismSepolia } from 'wagmi/chains'

// ── 1. Create Wagmi Configuration using Privy's wrapper
const config = createConfig({
  chains: [
    arcTestnet, 
    sepolia, 
    arbitrumSepolia, 
    baseSepolia, 
    lineaSepolia, 
    optimismSepolia, 
    sonicTestnet, 
    monadTestnet, 
    unichainSepolia, 
    inkTestnet
  ],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
    [sepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [baseSepolia.id]: http(),
    [lineaSepolia.id]: http(),
    [optimismSepolia.id]: http(),
    [sonicTestnet.id]: http(),
    [monadTestnet.id]: http(),
    [unichainSepolia.id]: http(),
    [inkTestnet.id]: http(),
  },
  ssr: false,
})

// ── 2. Create TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 4_000,
    },
    mutations: {
      retry: false,
    },
  },
})

// ── Error boundary (non-fatal errors wrapper)
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
    if (error.message.includes('connector') || error.message.includes('session')) {
      console.warn('[EasyZpay] Privy/Wagmi wallet connector warning (non-fatal):', error.message)
    } else {
      console.error('[EasyZpay] Unexpected provider error:', error)
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

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''

  return (
    <WalletErrorBoundary>
      <PrivyProvider
        appId={appId}
        config={{
          loginMethods: ['google', 'wallet', 'email'],
          appearance: {
            theme: activeTheme,
            accentColor: '#1035f6', // Match our royal blue accent
            showWalletLoginFirst: false,
          },
          embeddedWallets: {
            ethereum: {
              createOnLogin: 'users-without-wallets',
            },
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={config} reconnectOnMount={true}>
            {children}
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </WalletErrorBoundary>
  )
}
