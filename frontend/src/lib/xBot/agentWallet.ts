import crypto from 'crypto'
import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseUnits, 
  formatUnits,
  defineChain, 
  isAddress 
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { XPaymentResult } from './types'
import { USDC_ADDRESS } from '@/lib/constants'
import { USDC_ABI } from '@/lib/abi'

// Arc Mainnet Chain Definition
const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
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

// Central Master Relayer (Used for gas sponsorship & treasury)
const MASTER_RELAYER_KEY = (
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
const PROTOCOL_FEE_PERCENT = 0.01

/**
 * Deterministically derives an isolated Agent Vault private key and account for a specific user.
 * Each user gets a unique, mathematically distinct vault address on Arc Network.
 */
export function getUserAgentAccount(userAddress: string) {
  const masterSecret = (
    process.env.AGENT_VAULT_MASTER_SECRET || 
    process.env.CHAT_SESSION_SECRET || 
    'arc-easypay-agent-vault-salt-2026'
  )
  const derivedKey = '0x' + crypto
    .createHmac('sha256', masterSecret)
    .update(`EASYPAY_AGENT_VAULT:${userAddress.toLowerCase()}`)
    .digest('hex') as `0x${string}`

  return privateKeyToAccount(derivedKey)
}

export class XBotAgentWallet {
  private masterRelayerClient: ReturnType<typeof createWalletClient>
  private masterRelayerAccount: ReturnType<typeof privateKeyToAccount>

  constructor() {
    this.masterRelayerAccount = privateKeyToAccount(MASTER_RELAYER_KEY)
    this.masterRelayerClient = createWalletClient({
      account: this.masterRelayerAccount,
      chain: arcMainnet,
      transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.RPC_URL || 'https://rpc.mainnet.arc.io'),
    })
  }

  /**
   * Returns the master relayer / bot address
   */
  getAgentAddress(): string {
    return this.masterRelayerAccount.address
  }

  /**
   * Returns a specific user's dedicated Agent Vault address
   */
  getUserVaultAddress(userAddress: string): string {
    return getUserAgentAccount(userAddress).address
  }

  /**
   * Returns live on-chain USDC ERC-20 balance for a user's vault
   */
  async getUserVaultBalance(userAddress: string): Promise<string> {
    try {
      const vaultAccount = getUserAgentAccount(userAddress)
      const balanceRaw = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [vaultAccount.address],
      }) as bigint
      return (Number(balanceRaw) / 1e6).toFixed(2)
    } catch {
      return '0.00'
    }
  }

  /**
   * Ensures the agent vault has sufficient native gas on Arc Network.
   * If empty, the master relayer drips 0.0003 ARC gas.
   */
  private async ensureVaultGas(vaultAddress: `0x${string}`) {
    try {
      const gasBalance = await publicClient.getBalance({ address: vaultAddress })
      if (gasBalance < parseUnits('0.0001', 18)) {
        console.log(`[XBotAgentWallet] Sponsoring gas for vault ${vaultAddress}...`)
        const dripTx = await this.masterRelayerClient.sendTransaction({
          account: this.masterRelayerAccount,
          chain: arcMainnet,
          to: vaultAddress,
          value: parseUnits('0.0003', 18),
        } as any)
        await publicClient.waitForTransactionReceipt({ hash: dripTx, timeout: 10_000 })
      }
    } catch (gasErr) {
      console.warn('[XBotAgentWallet] Gas sponsorship notice:', gasErr)
    }
  }

  /**
   * Executes a payment directly from a specific user's isolated Agent Vault:
   * - 99% to Recipient
   * - 1% to EasyPay Fee Treasury (Your Wallet)
   */
  async executePaymentFromUserVault(
    senderUserAddress: string,
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

      const senderVault = getUserAgentAccount(senderUserAddress)

      // 1. Check user vault USDC balance
      const balanceRaw = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [senderVault.address],
      }) as bigint

      const availableUsdc = Number(formatUnits(balanceRaw, 6))
      if (availableUsdc < grossUsdc) {
        return {
          success: false,
          grossAmount: grossUsdc.toFixed(2),
          netAmount: '0',
          feeAmount: '0',
          error: `Insufficient Agent Vault balance. Available: $${availableUsdc.toFixed(2)} USDC`,
        }
      }

      // 2. Ensure vault has gas to execute
      await this.ensureVaultGas(senderVault.address)

      const vaultWalletClient = createWalletClient({
        account: senderVault,
        chain: arcMainnet,
        transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.RPC_URL || 'https://rpc.mainnet.arc.io'),
      })

      // 3. Calculate 1% fee split
      const feeAmountNumber = Number((grossUsdc * PROTOCOL_FEE_PERCENT).toFixed(6))
      const netAmountNumber = Number((grossUsdc - feeAmountNumber).toFixed(6))

      const netUnits = parseUnits(netAmountNumber.toString(), 6)
      const feeUnits = parseUnits(feeAmountNumber.toString(), 6)

      // 4. Broadcast Recipient Transfer from User's Vault (USDC ERC-20)
      const recipientTxHash = await vaultWalletClient.writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [recipientAddress as `0x${string}`, netUnits],
        account: senderVault,
        chain: arcMainnet,
      })

      // 5. Wait for confirmation receipt (sub-second on Arc)
      await publicClient.waitForTransactionReceipt({
        hash: recipientTxHash,
        timeout: 10_000,
      })

      // 6. Broadcast 1% Fee Transfer to Your Treasury Wallet
      if (feeAmountNumber > 0 && isAddress(EASYPAY_FEE_TREASURY)) {
        try {
          await vaultWalletClient.writeContract({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: 'transfer',
            args: [EASYPAY_FEE_TREASURY, feeUnits],
            account: senderVault,
            chain: arcMainnet,
          })
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
