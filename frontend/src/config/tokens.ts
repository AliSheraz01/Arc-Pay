// Official USDC Configuration for Arc and Supported Chains
export interface TokenConfig {
  address: `0x${string}`
  symbol: string
  name: string
  decimals: number
}

// Arc Mainnet uses precompile / token address 0x3600000000000000000000000000000000000000
export const ARC_USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000') as `0x${string}`

export const TOKENS: Record<number, TokenConfig> = {
  // Arc Mainnet
  5042: {
    address: ARC_USDC_ADDRESS,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  // Arc Testnet
  5042002: {
    address: '0x3600000000000000000000000000000000000000',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  // Base Mainnet
  8453: {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  // Ethereum Mainnet
  1: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  // Arbitrum One
  42161: {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  // OP Mainnet
  10: {
    address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  // Polygon PoS
  137: {
    address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  // Avalanche C-Chain
  43114: {
    address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  // Base Sepolia
  84532: {
    address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  // Ethereum Sepolia
  11155111: {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
}

export function getUsdcConfig(chainId: number): TokenConfig {
  return TOKENS[chainId] || TOKENS[5042]
}
