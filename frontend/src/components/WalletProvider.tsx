'use client'

import React from 'react'
import { PrivyProvider, useWallets } from '@privy-io/react-auth'
import { WagmiProvider, createConfig, useSetActiveWallet } from '@privy-io/wagmi'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { http } from 'wagmi'
import { arcMainnet, arcTestnet, ACTIVE_CHAIN, IS_PRODUCTION } from '@/lib/constants'
import { 
  base as baseMainnet, 
  mainnet as ethereumMainnet, 
  arbitrum as arbitrumMainnet, 
  optimism as optimismMainnet, 
  polygon as polygonMainnet, 
  avalanche as avalancheMainnet,
  baseSepolia,
  sepolia,
  arbitrumSepolia,
  optimismSepolia
} from 'viem/chains'

// Chains array based on environment
const supportedChains = IS_PRODUCTION
  ? ([
      arcMainnet,
      baseMainnet,
      ethereumMainnet,
      arbitrumMainnet,
      optimismMainnet,
      polygonMainnet,
      avalancheMainnet,
      arcTestnet,
    ] as const)
  : ([
      arcTestnet,
      baseSepolia,
      sepolia,
      arbitrumSepolia,
      optimismSepolia,
      arcMainnet,
    ] as const)

// ── 1. Create Wagmi Configuration
const config = createConfig({
  chains: supportedChains as any,
  transports: {
    [arcMainnet.id]: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.mainnet.arc.io'),
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
    [baseMainnet.id]: http('https://mainnet.base.org'),
    [ethereumMainnet.id]: http('https://ethereum-rpc.publicnode.com'),
    [arbitrumMainnet.id]: http('https://arb1.arbitrum.io/rpc'),
    [optimismMainnet.id]: http('https://mainnet.optimism.io'),
    [polygonMainnet.id]: http('https://polygon-rpc.com'),
    [avalancheMainnet.id]: http('https://api.avax.network/ext/bc/C/rpc'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [sepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
    [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
    [optimismSepolia.id]: http('https://sepolia.optimism.io'),
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

function PrivyWagmiSync({ children }: { children: React.ReactNode }) {
  const { wallets } = useWallets()
  const { setActiveWallet } = useSetActiveWallet()

  React.useEffect(() => {
    if (wallets.length > 0) {
      const active = wallets.find((w) => w.walletClientType === 'privy') || wallets[0]
      setActiveWallet(active).catch((err) => {
        console.warn('[Sync] Failed to set active wallet:', err)
      })
    }
  }, [wallets, setActiveWallet])

  return <>{children}</>
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

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'cmr26gea9004r0ci8prz0sph5'

  return (
    <WalletErrorBoundary>
      <PrivyProvider
        appId={appId}
        config={{
          defaultChain: ACTIVE_CHAIN as any,
          supportedChains: supportedChains as any,
          loginMethods: ['google', 'wallet', 'email'],
          appearance: {
            theme: activeTheme,
            accentColor: '#1035f6', // EasyZPay Royal Blue
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
            <PrivyWagmiSync>
              {children}
            </PrivyWagmiSync>
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </WalletErrorBoundary>
  )
}
