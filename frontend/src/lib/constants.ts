// Arc Network Chain config for wagmi/viem
import { defineChain } from 'viem'

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  testnet: true,
})

export const sonicTestnet = defineChain({
  id: 57054,
  name: 'Sonic Testnet',
  nativeCurrency: { name: 'S', symbol: 'S', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.soniclabs.com'] } },
  testnet: true,
})

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MONAD', symbol: 'MONAD', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
  testnet: true,
})

export const unichainSepolia = defineChain({
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.unichain.org'] } },
  testnet: true,
})

export const inkTestnet = defineChain({
  id: 763373,
  name: 'Ink Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc-gel-sepolia.inkonchain.com'] } },
  testnet: true,
})


export const ARC_CHAIN_ID = 5042002

export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as `0x${string}`

export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? '0x994a7D6A2764A3Bf4Db80337e58256d265982E05') as `0x${string}`

export const ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_ROUTER_ADDRESS ?? '0x71157874BBD90389A429714815454C64FE061F1c') as `0x${string}`

export const BULK_ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_BULK_ROUTER_ADDRESS ?? '0xB1a346132F5eC1Ad7CC8A84DE33A2763d13110B4') as `0x${string}`

export const EXPLORER_URL = 'https://testnet.arcscan.app'

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

export const FAUCET_URL = 'https://faucet.circle.com'

// CCTP Configurations
export const CCTP_TOKEN_MESSENGER = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`

export function getCctpDomain(chainId: number): number {
  switch (chainId) {
    case 11155111: return 0 // Sepolia
    case 11155420: return 2 // OP Sepolia
    case 421614: return 3 // Arbitrum Sepolia
    case 84532: return 6 // Base Sepolia
    default: return 0 // Default or unsupported domains
  }
}
