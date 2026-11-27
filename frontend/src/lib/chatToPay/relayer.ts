import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  defineChain,
  encodeFunctionData,
  isAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { db } from '@/lib/db'
import { RelayerExecutionResult } from './types'

// Arc Mainnet Chain Definition
const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.RPC_URL || 'https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
})

const publicClient = createPublicClient({
  chain: arcMainnet,
  transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.RPC_URL || 'https://rpc.mainnet.arc.io'),
})

const ARC_USDC_ADDRESS = (process.env.USDC_ADDRESS || '0x3600000000000000000000000000000000000000') as `0x${string}`
const EXPLORER_URL = process.env.EXPLORER_URL || 'https://explorer.arc.io'
const USDC_DECIMALS = 6

const RELAYER_PRIVATE_KEY =
  process.env.RELAYER_PRIVATE_KEY ||
  process.env.PRIVATE_KEY ||
  '0xba1ecd5380605eb913a71790c804c95d87ace7b7d0a7e27800be95147f5a43d2'

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

export type MappedErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'ALLOWANCE_EXCEEDED'
  | 'INVALID_ADDRESS'
  | 'NETWORK_BUSY'
  | 'UNKNOWN'

export interface MappedRelayerResult extends RelayerExecutionResult {
  errorCode?: MappedErrorCode
  retryable?: boolean
}

function getRelayerAccount() {
  if (!RELAYER_PRIVATE_KEY) {
    throw new Error('Relayer key missing')
  }
  return privateKeyToAccount(
    (RELAYER_PRIVATE_KEY.startsWith('0x') ? RELAYER_PRIVATE_KEY : `0x${RELAYER_PRIVATE_KEY}`) as `0x${string}`
  )
}

function mapErrorToUserMessage(err: unknown): { code: MappedErrorCode; message: string; retryable: boolean } {
  const raw = err instanceof Error ? err.message : String(err || '')
  const lower = raw.toLowerCase()

  if (lower.includes('exceeds balance') || lower.includes('insufficient') || lower.includes('zero gas')) {
    return {
      code: 'INSUFFICIENT_BALANCE',
      message: 'Insufficient USDC balance for this transfer.',
      retryable: false,
    }
  }
  if (lower.includes('allowance') || lower.includes('spending cap')) {
    return {
      code: 'ALLOWANCE_EXCEEDED',
      message: 'Daily spending allowance exceeded.',
      retryable: false,
    }
  }
  if (lower.includes('invalid') && lower.includes('address')) {
    return {
      code: 'INVALID_ADDRESS',
      message: 'Invalid recipient wallet address.',
      retryable: false,
    }
  }
  if (
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('nonce') ||
    lower.includes('rate') ||
    lower.includes('busy') ||
    lower.includes('fetch') ||
    lower.includes('502') ||
    lower.includes('503')
  ) {
    return {
      code: 'NETWORK_BUSY',
      message: 'Network or relayer is busy right now. Please try again.',
      retryable: true,
    }
  }
  return {
    code: 'UNKNOWN',
    message: 'Payment could not be completed. Please try again.',
    retryable: true,
  }
}

export class ChatToPayRelayer {
  /**
   * Check real on-chain USDC balance on Arc Mainnet using the exact same ERC-20 contract & decimals as transfer.
   */
  async checkUsdcBalance(amountStr: string): Promise<{
    sufficient: boolean
    balanceFormatted: string
    neededFormatted: string
    checkFailed?: boolean
  }> {
    try {
      const relayerAccount = getRelayerAccount()
      const [rawBalance, decimals] = await Promise.all([
        publicClient.readContract({
          address: ARC_USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [relayerAccount.address],
        }),
        publicClient
          .readContract({
            address: ARC_USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'decimals',
          })
          .catch(() => USDC_DECIMALS),
      ])

      const dec = Number(decimals) || USDC_DECIMALS
      const neededUnits = parseUnits(amountStr, dec)
      const balanceFormatted = parseFloat(formatUnits(rawBalance, dec)).toFixed(2)
      const neededFormatted = parseFloat(amountStr).toFixed(2)

      return {
        sufficient: rawBalance >= neededUnits,
        balanceFormatted,
        neededFormatted,
      }
    } catch (err) {
      console.error('[Relayer] Balance check error:', err)
      return {
        sufficient: false,
        balanceFormatted: '0.00',
        neededFormatted: parseFloat(amountStr).toFixed(2),
        checkFailed: true,
      }
    }
  }

  /**
   * Submits a policy-checked payment directly to Arc Mainnet RPC.
   * Never returns raw technical errors, calldata, or library versions.
   */
  async executePayment(intentId: string): Promise<MappedRelayerResult> {
    const intent = await db.chatPaymentIntent.findUnique({
      where: { id: intentId },
      include: { session: true },
    })

    if (!intent) {
      return {
        success: false,
        errorCode: 'UNKNOWN',
        error: 'Payment request was not found or expired.',
        retryable: false,
      }
    }

    const { session } = intent

    if (session.status !== 'PAIRED') {
      return {
        success: false,
        errorCode: 'UNKNOWN',
        error: 'Your Telegram session is not active. Please reconnect in EasyZpay.',
        retryable: false,
      }
    }

    if (new Date() > new Date(session.validUntil)) {
      await db.whatsAppSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      })
      return {
        success: false,
        errorCode: 'ALLOWANCE_EXCEEDED',
        error: 'Your session has expired. Please renew on easyzpay.xyz.',
        retryable: false,
      }
    }

    const transferAmount = parseFloat(intent.amount)
    const alreadySpent = parseFloat(session.spentAmount || '0')
    const spendingLimit = parseFloat(session.spendingLimit)

    if (alreadySpent + transferAmount > spendingLimit) {
      const remaining = Math.max(0, spendingLimit - alreadySpent).toFixed(2)
      return {
        success: false,
        errorCode: 'ALLOWANCE_EXCEEDED',
        error: `Daily allowance exceeded (${remaining} USDC remaining).`,
        retryable: false,
      }
    }

    if (!isAddress(intent.resolvedAddress)) {
      return {
        success: false,
        errorCode: 'INVALID_ADDRESS',
        error: 'Invalid recipient wallet address.',
        retryable: false,
      }
    }

    try {
      const relayerAccount = getRelayerAccount()

      const walletClient = createWalletClient({
        account: relayerAccount,
        chain: arcMainnet,
        transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.RPC_URL || 'https://rpc.mainnet.arc.io'),
      })

      const amountInUnits = parseUnits(intent.amount, USDC_DECIMALS)

      // Check real on-chain USDC balance before broadcasting
      const usdcBalance = await publicClient.readContract({
        address: ARC_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [relayerAccount.address],
      })

      if (usdcBalance < amountInUnits) {
        const have = parseFloat(formatUnits(usdcBalance, USDC_DECIMALS)).toFixed(2)
        return {
          success: false,
          errorCode: 'INSUFFICIENT_BALANCE',
          error: `Insufficient USDC balance (${have} USDC available, ${transferAmount.toFixed(2)} USDC needed).`,
          retryable: false,
        }
      }

      const relayerBalance = await publicClient.getBalance({ address: relayerAccount.address })
      if (relayerBalance === 0n) {
        console.error('[Relayer] Relayer account has zero gas balance.')
        return {
          success: false,
          errorCode: 'NETWORK_BUSY',
          error: 'Relayer is temporarily out of gas. Please try again shortly.',
          retryable: true,
        }
      }

      const erc20TransferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [intent.resolvedAddress as `0x${string}`, amountInUnits],
      })

      const txHash = await walletClient.sendTransaction({
        to: ARC_USDC_ADDRESS,
        data: erc20TransferData,
        value: 0n,
      } as any)

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 45000,
      })

      if (receipt.status !== 'success') {
        throw new Error(`Transaction reverted on-chain (${txHash})`)
      }

      const newSpentAmount = (alreadySpent + transferAmount).toFixed(6)
      await db.whatsAppSession.update({
        where: { id: session.id },
        data: { spentAmount: newSpentAmount },
      })

      await db.chatPaymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'EXECUTED',
          txHash: txHash,
        },
      })

      const fromAddr = (session.ownerAddress || session.smartAccountAddress).toLowerCase()
      const toAddr = intent.resolvedAddress.toLowerCase()

      try {
        await db.transaction.create({
          data: {
            txHash: txHash,
            fromAddress: fromAddr,
            toAddress: toAddr,
            amount: intent.amount,
            token: 'USDC',
            chainId: 5042,
            type: 'SEND',
            status: 'COMPLETED',
            memo: `Telegram Chat-to-Pay: ${intent.rawMessage}`,
            explorerUrl: `${EXPLORER_URL}/tx/${txHash}`,
            recipientUsername:
              intent.recipientType === 'USERNAME' ? intent.recipientInput.replace(/^@/, '') : null,
          },
        })
      } catch (txErr) {
        console.warn('[Relayer] Transaction record note:', txErr)
      }

      const remainingAllowance = (spendingLimit - (alreadySpent + transferAmount)).toFixed(2)

      return {
        success: true,
        txHash: txHash,
        explorerUrl: `${EXPLORER_URL}/tx/${txHash}`,
        remainingAllowance: remainingAllowance,
      }
    } catch (err: unknown) {
      // Log full technical error on the server only
      console.error('[Relayer] Execution error:', err)
      const mapped = mapErrorToUserMessage(err)

      await db.chatPaymentIntent
        .update({
          where: { id: intent.id },
          data: {
            status: 'FAILED',
            errorMessage: mapped.code,
          },
        })
        .catch(() => null)

      return {
        success: false,
        errorCode: mapped.code,
        error: mapped.message,
        retryable: mapped.retryable,
      }
    }
  }
}
