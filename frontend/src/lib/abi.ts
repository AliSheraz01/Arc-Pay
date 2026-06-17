// ABI for USDC ERC20 (minimal: transfer, approve, allowance, balanceOf)
export const USDC_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

// ABI for ArcPayUsernameRegistry
export const REGISTRY_ABI = [
  {
    name: 'registerUsername',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_username', type: 'string' }],
    outputs: [],
  },
  {
    name: 'resolveUsername',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_username', type: 'string' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'getMyUsername',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const

// ABI for ArcPayRouter
export const ROUTER_ABI = [
  {
    name: 'sendPayment',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_memo', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'PaymentSent',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'memo', type: 'string', indexed: false },
    ],
  },
] as const

// ABI for ArcPayBulkRouter
export const BULK_ROUTER_ABI = [
  {
    name: 'sendBulkPayment',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_to', type: 'address[]' },
      { name: '_amounts', type: 'uint256[]' },
      { name: '_memos', type: 'string[]' },
    ],
    outputs: [],
  },
  {
    name: 'PaymentSent',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'memo', type: 'string', indexed: false },
    ],
  },
] as const
