// Arc Network Chain config for wagmi/viem
import { defineChain } from 'viem'

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
      webSocket: ['wss://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
})

export const ARC_CHAIN_ID = 5042002

export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as `0x${string}`

export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`

export const ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_ROUTER_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`

export const EXPLORER_URL = 'https://testnet.arcscan.app'

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

export const FAUCET_URL = 'https://faucet.circle.com'
