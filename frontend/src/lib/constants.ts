// Centralized constants bridging to src/config/
import { arcMainnet, arcTestnet, sonicTestnet, monadTestnet, unichainSepolia, inkTestnet } from '@/config/chains'
import { 
  NETWORK_MODE, 
  IS_PRODUCTION, 
  ACTIVE_CHAIN, 
  ACTIVE_CHAIN_ID, 
  CONTRACTS, 
  RPC_URL as ACTIVE_RPC_URL, 
  EXPLORER_URL as ACTIVE_EXPLORER_URL,
  getExplorerTxUrl,
  getExplorerAddressUrl
} from '@/config/network'
import { ARC_USDC_ADDRESS, getUsdcConfig } from '@/config/tokens'

export { 
  arcMainnet, 
  arcTestnet, 
  sonicTestnet, 
  monadTestnet, 
  unichainSepolia, 
  inkTestnet,
  NETWORK_MODE,
  IS_PRODUCTION,
  ACTIVE_CHAIN,
  ACTIVE_CHAIN_ID,
  CONTRACTS,
  getExplorerTxUrl,
  getExplorerAddressUrl
}

// Active Network Constants
export const ARC_CHAIN_ID = ACTIVE_CHAIN_ID

export const USDC_ADDRESS = CONTRACTS.usdcAddress
export const REGISTRY_ADDRESS = CONTRACTS.registryAddress
export const ROUTER_ADDRESS = CONTRACTS.routerAddress
export const BOUNTY_ESCROW_ADDRESS = CONTRACTS.bountyEscrowAddress
export const BULK_ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_BULK_ROUTER_ADDRESS ?? '0xB1a346132F5eC1Ad7CC8A84DE33A2763d13110B4') as `0x${string}`
export const SCHEDULER_ADDRESS = (process.env.NEXT_PUBLIC_SCHEDULER_ADDRESS ?? '0xb10F4e8646dEf105B1083540F13AB1ef73968fa1') as `0x${string}`

export const EXPLORER_URL = ACTIVE_EXPLORER_URL
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''
export const FAUCET_URL = 'https://faucet.circle.com'

// Official Circle CCTP V2 Chain Configuration Interface
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

// Official Circle CCTP V2 Mainnet Configurations
export const CCTP_V2_MAINNET_CONFIGS: Record<number, CctpChainConfig> = {
  // Arc Mainnet (Domain 26)
  5042: {
    chainId: 5042,
    domain: 26,
    name: 'Arc Mainnet',
    usdc: '0x3600000000000000000000000000000000000000',
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    decimals: 6,
    rpcUrl: 'https://rpc.mainnet.arc.io',
    explorerUrl: 'https://explorer.arc.io',
    color: '#1035f6'
  },
  // Base Mainnet (Domain 6)
  8453: {
    chainId: 8453,
    domain: 6,
    name: 'Base',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    decimals: 6,
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    color: '#0052ff'
  },
  // Ethereum Mainnet (Domain 0)
  1: {
    chainId: 1,
    domain: 0,
    name: 'Ethereum',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    decimals: 6,
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorerUrl: 'https://etherscan.io',
    color: '#627eea'
  },
  // Arbitrum One (Domain 3)
  42161: {
    chainId: 42161,
    domain: 3,
    name: 'Arbitrum One',
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    decimals: 6,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    color: '#28a0f0'
  },
  // OP Mainnet (Domain 2)
  10: {
    chainId: 10,
    domain: 2,
    name: 'OP Mainnet',
    usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    decimals: 6,
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    color: '#ff0420'
  },
  // Polygon PoS (Domain 7)
  137: {
    chainId: 137,
    domain: 7,
    name: 'Polygon PoS',
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    decimals: 6,
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    color: '#8247e5'
  },
  // Avalanche C-Chain (Domain 1)
  43114: {
    chainId: 43114,
    domain: 1,
    name: 'Avalanche',
    usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    decimals: 6,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
    color: '#e84142'
  }
}

// Testnet CCTP fallback
export const CCTP_V2_TESTNET_CONFIGS: Record<number, CctpChainConfig> = {
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
  }
}

export const CCTP_V2_CONFIGS = IS_PRODUCTION ? CCTP_V2_MAINNET_CONFIGS : CCTP_V2_TESTNET_CONFIGS

export function getCctpDomain(chainId: number): number {
  const cfg = CCTP_V2_CONFIGS[chainId]
  return cfg ? cfg.domain : 0
}

export function getCctpConfig(chainId: number): CctpChainConfig {
  const fallbackId = IS_PRODUCTION ? 5042 : 5042002
  return CCTP_V2_CONFIGS[chainId] || CCTP_V2_CONFIGS[fallbackId]
}

export function addressToBytes32(address: string): `0x${string}` {
  const clean = address.replace('0x', '').toLowerCase().padStart(64, '0')
  return `0x${clean}` as `0x${string}`
}
