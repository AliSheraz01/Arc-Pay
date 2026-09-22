import { defineChain } from 'viem'
import { 
  mainnet as ethereumMainnet, 
  base as baseMainnet, 
  arbitrum as arbitrumMainnet, 
  optimism as optimismMainnet, 
  polygon as polygonMainnet, 
  avalanche as avalancheMainnet,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia
} from 'viem/chains'

// Official Arc Mainnet (Chain ID 5042)
export const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { 
    default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.mainnet.arc.io'] },
    public: { http: ['https://rpc.mainnet.arc.io'] }
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || 'https://explorer.arc.io' },
  },
  testnet: false,
})

// Arc Testnet (Chain ID 5042002)
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { 
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] }
  },
  blockExplorers: {
    default: { name: 'ArcScan Testnet', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
})

export {
  ethereumMainnet,
  baseMainnet,
  arbitrumMainnet,
  optimismMainnet,
  polygonMainnet,
  avalancheMainnet,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia
}
