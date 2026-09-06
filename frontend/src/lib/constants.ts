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

export const ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_ROUTER_ADDRESS ?? '0xD4431A72585a78356dC1B8b0F92120705DFc5454') as `0x${string}`

export const BULK_ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_BULK_ROUTER_ADDRESS ?? '0xB1a346132F5eC1Ad7CC8A84DE33A2763d13110B4') as `0x${string}`

export const SCHEDULER_ADDRESS = (process.env.NEXT_PUBLIC_SCHEDULER_ADDRESS ?? '0xb10F4e8646dEf105B1083540F13AB1ef73968fa1') as `0x${string}`

export const EXPLORER_URL = 'https://testnet.arcscan.app'

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''

export const FAUCET_URL = 'https://faucet.circle.com'

export const NETWORK_MODE = process.env.NEXT_PUBLIC_NETWORK_MODE ?? 'testnet'

// Official Circle CCTP V2 Contract Configurations per Chain
export interface CctpChainConfig {
  chainId: number
  domain: number
  name: string
  usdc: `0x${string}`
  tokenMessenger: `0x${string}`
  messageTransmitter: `0x${string}`
  decimals: number
  rpcUrl: string
  explorerUrl: string
  color: string
}

export const CCTP_V2_CONFIGS: Record<number, CctpChainConfig> = {
  // Arc Testnet
  5042002: {
    chainId: 5042002,
    domain: 5042002,
    name: 'Arc Testnet',
    usdc: '0x3600000000000000000000000000000000000000',
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    decimals: 18,
    rpcUrl: 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://testnet.arcscan.app',
    color: '#6b5bff'
  },
  // Base Sepolia
  84532: {
    chainId: 84532,
    domain: 6,
    name: 'Base Sepolia',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    decimals: 6,
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    color: '#0052ff'
  },
  // Ethereum Sepolia
  11155111: {
    chainId: 11155111,
    domain: 0,
    name: 'Ethereum Sepolia',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    decimals: 6,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    color: '#8fa3c9'
  },
  // Arbitrum Sepolia
  421614: {
    chainId: 421614,
    domain: 3,
    name: 'Arbitrum Sepolia',
    usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitter: '0xaCF1ceeF359C5826AB12B263FBEb2fcd1bFA84A1',
    decimals: 6,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    color: '#28a0f0'
  },
  // OP Sepolia
  11155420: {
    chainId: 11155420,
    domain: 2,
    name: 'Optimism Sepolia',
    usdc: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    decimals: 6,
    rpcUrl: 'https://sepolia.optimism.io',
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    color: '#ff3e3e'
  }
}

export function getCctpDomain(chainId: number): number {
  const cfg = CCTP_V2_CONFIGS[chainId]
  return cfg ? cfg.domain : 0
}

export function getCctpConfig(chainId: number): CctpChainConfig {
  return CCTP_V2_CONFIGS[chainId] || CCTP_V2_CONFIGS[5042002]
}

// Helper: Convert EVM Address (0x...) to bytes32 format for CCTP V2 mintRecipient
export function addressToBytes32(address: string): `0x${string}` {
  const clean = address.replace('0x', '').toLowerCase().padStart(64, '0')
  return `0x${clean}` as `0x${string}`
}

