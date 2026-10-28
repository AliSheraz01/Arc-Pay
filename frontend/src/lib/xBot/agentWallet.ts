import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseUnits, 
  defineChain, 
  isAddress 
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { XPaymentResult } from './types'

// Arc Mainnet Chain Definition
const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.RPC_URL || 'https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: process.env.EXPLORER_URL || 'https://explorer.arc.io' },
  },
})

const publicClient = createPublicClient({
  chain: arcMainnet,
  transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.RPC_URL || 'https://rpc.mainnet.arc.io'),
})

// Isolated Agent Hot Wallet Key
const AGENT_PRIVATE_KEY = (
  process.env.X_BOT_AGENT_PRIVATE_KEY || 
  process.env.RELAYER_PRIVATE_KEY || 
  process.env.PRIVATE_KEY || 
  '0xba1ecd5380605eb913a71790c804c95d87ace7b7d0a7e27800be95147f5a43d2'
) as `0x${string}`

// Destination for the automated 1% revenue fee (Your wallet!)
const EASYPAY_FEE_TREASURY = (
  process.env.EASYPAY_FEE_TREASURY || 
  process.env.NEXT_PUBLIC_FEE_TREASURY || 
  '0x0D09b1348455540a6394c9d1Bf2F7C2b0cC40E6D'
) as `0x${string}`

const EXPLORER_URL = process.env.EXPLORER_URL || 'https://explorer.arc.io'

// 1% Protocol Fee Constant
const PROTOCOL_FEE_PERCENT = 0.01

export class XBotAgentWallet {
  private walletClient: ReturnType<typeof createWalletClient>
  private account: ReturnType<typeof privateKeyToAccount>

  constructor() {
    this.account = privateKeyToAccount(AGENT_PRIVATE_KEY)
    this.walletClient = createWalletClient({
      account: this.account,
      chain: arcMainnet,
      transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.RPC_URL || 'https://rpc.mainnet.arc.io'),
    })
  }

  /**
   * Returns the agent wallet address for monitoring balance & funding
   */
  getAgentAddress(): string {
    return this.account.address
  }

  /**
   * Executes a payment on Arc Network:
   * - 99% to Recipient
   * - 1% to EasyPay Fee Treasury (Your Wallet)
   */
  async executePaymentWithFee(
    recipientAddress: string,
    grossUsdc: number
  ): Promise<XPaymentResult> {
    try {
      if (!isAddress(recipientAddress)) {
        return {
          success: false,
          grossAmount: grossUsdc.toFixed(2),
          netAmount: '0',
          feeAmount: '0',
          error: `Invalid recipient address: ${recipientAddress}`,
        }
      }

      // 1. Calculate 1% fee split
      const feeAmountNumber = Number((grossUsdc * PROTOCOL_FEE_PERCENT).toFixed(6))
      const netAmountNumber = Number((grossUsdc - feeAmountNumber).toFixed(6))

      const netUnits = parseUnits(netAmountNumber.toString(), 6)
      const feeUnits = parseUnits(feeAmountNumber.toString(), 6)

      // 2. Broadcast Recipient Transfer on Arc Network (Native USDC)
      const recipientTxHash = await this.walletClient.sendTransaction({
        account: this.account,
        chain: arcMainnet,
        to: recipientAddress as `0x${string}`,
        value: netUnits,
      } as any)

      // 3. Wait for confirmation receipt (sub-second on Arc)
      await publicClient.waitForTransactionReceipt({
        hash: recipientTxHash,
        timeout: 10_000,
      })

      // 4. Broadcast 1% Fee Transfer to Your Treasury Wallet
      if (feeAmountNumber > 0 && isAddress(EASYPAY_FEE_TREASURY)) {
        try {
          await this.walletClient.sendTransaction({
            account: this.account,
            chain: arcMainnet,
            to: EASYPAY_FEE_TREASURY,
            value: feeUnits,
          } as any)
        } catch (feeErr) {
          console.warn('[XBotAgentWallet] Fee transfer notice:', feeErr)
        }
      }

      return {
        success: true,
        txHash: recipientTxHash,
        explorerUrl: `${EXPLORER_URL}/tx/${recipientTxHash}`,
        grossAmount: grossUsdc.toFixed(2),
        netAmount: netAmountNumber.toFixed(2),
        feeAmount: feeAmountNumber.toFixed(2),
        recipientAddress,
      }
    } catch (err: any) {
      console.error('[XBotAgentWallet] Execution error on Arc Network:', err)
      return {
        success: false,
        grossAmount: grossUsdc.toFixed(2),
        netAmount: '0',
        feeAmount: '0',
        error: err.message || 'Transaction failed on Arc Network',
      }
    }
  }
}
