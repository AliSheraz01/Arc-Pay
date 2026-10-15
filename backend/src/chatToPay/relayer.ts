import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseUnits, 
  defineChain, 
  encodeFunctionData, 
  isAddress 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { PrismaClient } from '@prisma/client';
import { RelayerExecutionResult } from './types';

// Arc Mainnet Chain Definition
const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: [process.env.RPC_URL || 'https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
});

const publicClient = createPublicClient({
  chain: arcMainnet,
  transport: http(process.env.RPC_URL || 'https://rpc.mainnet.arc.io'),
});

const ARC_USDC_ADDRESS = (process.env.USDC_ADDRESS || '0x3600000000000000000000000000000000000000') as `0x${string}`;
const EXPLORER_URL = process.env.EXPLORER_URL || 'https://explorer.arc.io';

// Relayer sponsor / bundler wallet with gas on Arc Mainnet
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY || '0xba1ecd5380605eb913a71790c804c95d87ace7b7d0a7e27800be95147f5a43d2';

export class ChatToPayRelayer {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Submits a policy-checked payment UserOperation directly to Arc Mainnet RPC
   * Strictly enforces real blockchain execution with zero mock fallbacks.
   */
  async executePayment(intentId: string): Promise<RelayerExecutionResult> {
    const intent = await this.prisma.chatPaymentIntent.findUnique({
      where: { id: intentId },
      include: { session: true },
    });

    if (!intent) {
      return { success: false, error: 'Payment intent not found in database' };
    }

    const { session } = intent;

    // 1. Policy check: Session status
    if (session.status !== 'PAIRED') {
      return { success: false, error: `Session is not active (current status: ${session.status})` };
    }

    // 2. Policy check: Expiry limit
    if (new Date() > new Date(session.validUntil)) {
      await this.prisma.whatsAppSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      });
      return { success: false, error: 'Session has reached its expiry limit. Please renew on easyzpay.xyz.' };
    }

    // 3. Policy check: Spending limit cap
    const transferAmount = parseFloat(intent.amount);
    const alreadySpent = parseFloat(session.spentAmount || '0');
    const spendingLimit = parseFloat(session.spendingLimit);

    if (alreadySpent + transferAmount > spendingLimit) {
      const remaining = Math.max(0, spendingLimit - alreadySpent).toFixed(2);
      return { 
        success: false, 
        error: `Spending cap exceeded. Remaining session allowance: ${remaining} USDC, requested: ${transferAmount} USDC.` 
      };
    }

    // 4. Validate recipient address
    if (!isAddress(intent.resolvedAddress)) {
      return { success: false, error: `Invalid recipient address: ${intent.resolvedAddress}` };
    }

    try {
      if (!RELAYER_PRIVATE_KEY) {
        throw new Error('RELAYER_PRIVATE_KEY is not configured on the server.');
      }

      const relayerAccount = privateKeyToAccount(
        (RELAYER_PRIVATE_KEY.startsWith('0x') ? RELAYER_PRIVATE_KEY : `0x${RELAYER_PRIVATE_KEY}`) as `0x${string}`
      );

      const walletClient = createWalletClient({
        account: relayerAccount,
        chain: arcMainnet,
        transport: http(process.env.RPC_URL || 'https://rpc.mainnet.arc.io'),
      });

      const amountInUnits = parseUnits(intent.amount, 6);

      // Check relayer gas balance on Arc Mainnet
      const relayerBalance = await publicClient.getBalance({ address: relayerAccount.address });
      if (relayerBalance === 0n) {
        throw new Error(`Relayer account (${relayerAccount.address}) has zero gas balance on Arc Mainnet.`);
      }

      console.log(`[Relayer] Broadcasting REAL transaction on Arc Mainnet: Transferring ${intent.amount} USDC to ${intent.resolvedAddress}...`);

      const erc20TransferData = encodeFunctionData({
        abi: [
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
        ],
        functionName: 'transfer',
        args: [intent.resolvedAddress as `0x${string}`, amountInUnits],
      });

      // Send real transaction to the Arc Mainnet RPC
      const txHash = await walletClient.sendTransaction({
        to: ARC_USDC_ADDRESS,
        data: erc20TransferData,
        value: 0n,
      } as any);

      console.log(`[Relayer] Transaction broadcasted: ${txHash}. Awaiting confirmation on Arc Mainnet...`);

      // Wait for real on-chain confirmation - validates that tx is mined and exists on explorer.arc.io
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 45000,
      });

      if (receipt.status !== 'success') {
        throw new Error(`Transaction reverted on Arc Mainnet (Block: ${receipt.blockNumber}, Tx: ${txHash})`);
      }

      console.log(`[Relayer] Transaction confirmed on Arc Mainnet! Block: ${receipt.blockNumber}, TxHash: ${txHash}`);

      // 5. Update session spent amount in database
      const newSpentAmount = (alreadySpent + transferAmount).toFixed(6);
      await this.prisma.whatsAppSession.update({
        where: { id: session.id },
        data: { spentAmount: newSpentAmount },
      });

      // 6. Update intent status in database
      await this.prisma.chatPaymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'EXECUTED',
          txHash: txHash,
        },
      });

      // 7. Record transaction in database for immediate UI and activity sync
      const fromAddr = (session.ownerAddress || session.smartAccountAddress).toLowerCase();
      const toAddr = intent.resolvedAddress.toLowerCase();

      try {
        await this.prisma.transaction.create({
          data: {
            txHash: txHash,
            fromAddress: fromAddr,
            toAddress: toAddr,
            amount: intent.amount,
            token: 'USDC',
            chainId: 5042,
            type: 'SEND',
            status: 'COMPLETED',
            memo: `WhatsApp Chat-to-Pay: ${intent.rawMessage}`,
            explorerUrl: `${EXPLORER_URL}/tx/${txHash}`,
            recipientUsername: intent.recipientType === 'USERNAME' ? intent.recipientInput.replace(/^@/, '') : null,
          },
        });
      } catch (txErr) {
        console.warn('[Relayer] Transaction record note:', txErr);
      }

      const remainingAllowance = (spendingLimit - (alreadySpent + transferAmount)).toFixed(2);

      return {
        success: true,
        txHash: txHash,
        explorerUrl: `${EXPLORER_URL}/tx/${txHash}`,
        remainingAllowance: remainingAllowance,
      };
    } catch (err: any) {
      console.error('[Relayer] Real blockchain execution error:', err);

      // Strictly record FAILED status with error reason
      await this.prisma.chatPaymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'FAILED',
          errorMessage: err.message || 'Transaction submission failed',
        },
      });

      return {
        success: false,
        error: err.message || 'Relayer failed to submit payment to Arc Chain',
      };
    }
  }
}
