// Centralized Contract Configuration
import { REGISTRY_ABI, ROUTER_ABI, BOUNTY_ESCROW_ABI, USDC_ABI, TOKEN_MESSENGER_ABI, MESSAGE_TRANSMITTER_ABI } from '@/lib/abi'

export interface NetworkContracts {
  registryAddress: `0x${string}`
  routerAddress: `0x${string}`
  bountyEscrowAddress: `0x${string}`
  usdcAddress: `0x${string}`
  cctpTokenMessenger?: `0x${string}`
  cctpMessageTransmitter?: `0x${string}`
}

// Arc Mainnet Contracts (Configurable via ENV — defaults now match
// contracts/deployments.mainnet.json so the app never silently falls back
// to a nonexistent address)
export const MAINNET_CONTRACTS: NetworkContracts = {
  registryAddress: (process.env.NEXT_PUBLIC_USERNAME_REGISTRY || '0x0D09b1348455540a6394c9d1Bf2F7C2b0cC40E6D') as `0x${string}`,
  routerAddress: (process.env.NEXT_PUBLIC_PAYMENT_ROUTER || '0x1C1F89F6Cc9b65eddE36D9F7fbd0222D53A158d6') as `0x${string}`,
  bountyEscrowAddress: (process.env.NEXT_PUBLIC_BOUNTY_ESCROW || '0x7BF7557F1BBAfB44865B5Ce8661806352774737E') as `0x${string}`,
  usdcAddress: (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000') as `0x${string}`,
  // Official Circle CCTP V2 on Arc Mainnet
  cctpTokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
  cctpMessageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
}

// Arc Testnet Contracts (Preserved for development)
export const TESTNET_CONTRACTS: NetworkContracts = {
  registryAddress: (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || '0x7182B6A65522dbb7ae88507F296Bdd65cdc1FFdB') as `0x${string}`,
  routerAddress: (process.env.NEXT_PUBLIC_ROUTER_ADDRESS || '0xD4431A72585a78356dC1B8b0F92120705DFc5454') as `0x${string}`,
  bountyEscrowAddress: (process.env.NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS || '0xD04B51102621E1825E317471d7D6A0e183C9CC71') as `0x${string}`,
  usdcAddress: '0x3600000000000000000000000000000000000000',
  cctpTokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
  cctpMessageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
}

export const CONTRACT_ABIS = {
  registry: REGISTRY_ABI,
  router: ROUTER_ABI,
  bountyEscrow: BOUNTY_ESCROW_ABI,
  usdc: USDC_ABI,
  cctpTokenMessenger: TOKEN_MESSENGER_ABI,
  cctpMessageTransmitter: MESSAGE_TRANSMITTER_ABI,
}
