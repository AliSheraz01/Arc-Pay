import { arcMainnet, arcTestnet } from './chains'
import { MAINNET_CONTRACTS, TESTNET_CONTRACTS, NetworkContracts } from './contracts'

export type NetworkMode = 'mainnet' | 'testnet'

export const NETWORK_MODE: NetworkMode = 
  (process.env.NEXT_PUBLIC_NETWORK === 'testnet' || process.env.NEXT_PUBLIC_NETWORK_MODE === 'testnet')
    ? 'testnet'
    : 'mainnet'

export const IS_PRODUCTION = NETWORK_MODE === 'mainnet'

export const ACTIVE_CHAIN = IS_PRODUCTION ? arcMainnet : arcTestnet
export const ACTIVE_CHAIN_ID = ACTIVE_CHAIN.id

export const CONTRACTS: NetworkContracts = IS_PRODUCTION ? MAINNET_CONTRACTS : TESTNET_CONTRACTS

export const RPC_URL = IS_PRODUCTION
  ? (process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.mainnet.arc.io')
  : (process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.testnet.arc.network')

export const EXPLORER_URL = IS_PRODUCTION
  ? (process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || 'https://explorer.arc.io')
  : 'https://testnet.arcscan.app'

export function getExplorerTxUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`
}

export function getExplorerAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`
}
