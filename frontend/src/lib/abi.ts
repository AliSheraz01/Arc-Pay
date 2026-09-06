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

// ABI for CCTP TokenMessenger (depositForBurn)
export const TOKEN_MESSENGER_ABI = [
  {
    name: 'depositForBurn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' }
    ],
    outputs: [{ name: '_nonce', type: 'uint64' }]
  },
  {
    name: 'DepositForBurn',
    type: 'event',
    inputs: [
      { name: 'nonce', type: 'uint64', indexed: true },
      { name: 'burnToken', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'depositor', type: 'address', indexed: true },
      { name: 'mintRecipient', type: 'bytes32', indexed: false },
      { name: 'destinationDomain', type: 'uint32', indexed: false },
      { name: 'destinationTokenMessenger', type: 'bytes32', indexed: false },
      { name: 'destinationCaller', type: 'bytes32', indexed: false }
    ]
  }
] as const

// ABI for CCTP MessageTransmitter
export const MESSAGE_TRANSMITTER_ABI = [
  {
    name: 'receiveMessage',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' }
    ],
    outputs: [{ name: 'success', type: 'bool' }]
  },
  {
    name: 'MessageSent',
    type: 'event',
    inputs: [
      { name: 'message', type: 'bytes', indexed: false }
    ]
  }
] as const

// ABI for ArcPayScheduler
export const SCHEDULER_ABI = [
  {
    name: 'createSchedule',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'id', type: 'string' },
      { name: '_to', type: 'address[]' },
      { name: '_amounts', type: 'uint256[]' },
      { name: '_memos', type: 'string[]' },
      { name: '_nextRun', type: 'uint256' },
      { name: '_interval', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'executeSchedule',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'id', type: 'string' }],
    outputs: [],
  },
  {
    name: 'cancelSchedule',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'id', type: 'string' }],
    outputs: [],
  }
] as const

// ABI for BountyEscrow — holds bounty prize USDC in escrow, releases to winner
export const BOUNTY_ESCROW_ABI = [
  {
    name: 'depositBounty',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bountyId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'releasePrize',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bountyId', type: 'bytes32' },
      { name: 'winner', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'getBounty',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'bountyId', type: 'bytes32' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'funded', type: 'bool' },
      { name: 'paid', type: 'bool' },
    ],
  },
  {
    name: 'BountyFunded',
    type: 'event',
    inputs: [
      { name: 'bountyId', type: 'bytes32', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'PrizeReleased',
    type: 'event',
    inputs: [
      { name: 'bountyId', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const
