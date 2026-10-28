import { db } from '@/lib/db'
import { XApiClient } from './xClient'
import { XBotAgentWallet } from './agentWallet'
import { parseXPaymentIntent } from './intentParser'
import { socialAccountsStore } from '@/app/api/resolve/[identifier]/route'
import { createPublicClient, http } from 'viem'
import { ACTIVE_CHAIN, REGISTRY_ADDRESS } from '@/lib/constants'
import { REGISTRY_ABI } from '@/lib/abi'

const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(),
})

export class XBotWorker {
  private xClient: XApiClient
  private agentWallet: XBotAgentWallet
  private static isRunning = false

  constructor() {
    this.xClient = new XApiClient()
    this.agentWallet = new XBotAgentWallet()
  }

  /**
   * Safe DB migration check: Ensures tables exist in Turso libSQL
   */
  async ensureTables(): Promise<void> {
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "XBotTransaction" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "tweetId" TEXT NOT NULL,
          "senderXId" TEXT NOT NULL,
          "senderUsername" TEXT,
          "senderAddress" TEXT,
          "recipientUsername" TEXT NOT NULL,
          "recipientAddress" TEXT NOT NULL,
          "grossAmount" TEXT NOT NULL,
          "netAmount" TEXT NOT NULL,
          "feeAmount" TEXT NOT NULL,
          "txHash" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
          "action" TEXT NOT NULL DEFAULT 'TIP',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)
      await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "XBotTransaction_tweetId_key" ON "XBotTransaction"("tweetId");`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "XBotTransaction_recipientUsername_idx" ON "XBotTransaction"("recipientUsername");`)

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SyncState" (
          "key" TEXT NOT NULL PRIMARY KEY,
          "value" TEXT NOT NULL
        );
      `)
    } catch (err: any) {
      console.warn('[XBotWorker] ensureTables note:', err.message)
    }
  }

  /**
   * Resolves an X username or on-chain handle to an Arc EVM Address
   */
  async resolveRecipientAddress(username: string): Promise<string | null> {
    const cleanUser = username.toLowerCase().replace(/^@/, '')

    // 1. Check in-memory / connected social accounts store
    for (const acc of socialAccountsStore.values()) {
      if (acc.username.toLowerCase() === cleanUser) {
        return acc.address
      }
    }

    // 2. Check Turso Database SocialAccount table
    try {
      const dbAcc = await db.socialAccount.findFirst({
        where: {
          username: cleanUser,
        },
        include: { user: true },
      })
      if (dbAcc?.user?.address) {
        return dbAcc.user.address
      }
    } catch {
      // Table query fallback
    }

    // 3. Check Arc On-chain Username Registry contract
    try {
      const onChainAddr = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'resolveUsername',
        args: [cleanUser],
      }) as string

      if (onChainAddr && onChainAddr !== '0x0000000000000000000000000000000000000000') {
        return onChainAddr
      }
    } catch {
      // Username not found on-chain
    }

    return null
  }

  /**
   * Processes all new mentions since last sync
   */
  async processMentions(): Promise<{ processed: number; errors: number }> {
    if (XBotWorker.isRunning) {
      return { processed: 0, errors: 0 }
    }
    XBotWorker.isRunning = true

    let processedCount = 0
    let errorCount = 0

    try {
      await this.ensureTables()

      // 1. Fetch last synced mention ID from Turso DB
      let lastId: string | undefined = undefined
      try {
        const syncRecord = await db.syncState.findUnique({
          where: { key: 'X_LAST_MENTION_ID' },
        })
        lastId = syncRecord?.value
      } catch {
        // First run
      }

      // 2. Query X API v2 for new mentions
      const mentions = await this.xClient.fetchMentions(lastId)
      if (!mentions || mentions.length === 0) {
        return { processed: 0, errors: 0 }
      }

      // Mentions arrive newest first; process oldest first
      const chronological = [...mentions].reverse()

      for (const mention of chronological) {
        try {
          // Idempotency: Check if already processed
          const existing = await db.xBotTransaction.findUnique({
            where: { tweetId: mention.id },
          })
          if (existing) {
            continue
          }

          // Parse intent (e.g. "@easyzpay tip 0.07 USDC to @alisheraz")
          const intent = parseXPaymentIntent(mention.text)
          if (!intent) {
            // Mention did not contain a recognizable payment command, ignore safely
            continue
          }

          if (intent.isValidAmount === false) {
            await this.xClient.reply(
              mention.id,
              `⚠️ ${intent.validationError || 'Invalid payment amount specified.'}`
            )
            continue
          }

          // Self-transfer / Bot-transfer guard
          const botHandle = 'easyzpay'
          const authorUser = mention.authorUsername?.toLowerCase()
          const recipientUser = intent.recipientUsername.toLowerCase()

          if (recipientUser === botHandle || (authorUser && recipientUser === authorUser)) {
            await this.xClient.reply(
              mention.id,
              `⚠️ Self-transfers and bot tips are not permitted. Please mention another user to send USDC (e.g. "@easyzpay tip ${intent.grossAmount} USDC to @friend").`
            )
            continue
          }

          // 1. Resolve Sender's Linked EasyPay Account for Isolated Vault Execution
          let senderUserAddress: string | null = null
          if (mention.authorId) {
            try {
              const senderSocial = await db.socialAccount.findFirst({
                where: {
                  provider: 'x',
                  OR: [
                    { providerUserId: mention.authorId },
                    ...(mention.authorUsername ? [{ username: mention.authorUsername.toLowerCase() }] : []),
                  ],
                },
                include: { user: true },
              })
              if (senderSocial?.user?.address) {
                senderUserAddress = senderSocial.user.address
              }
            } catch (dbErr) {
              console.warn('[XWorker] Failed to query sender social account:', dbErr)
            }
          }

          if (!senderUserAddress) {
            await this.xClient.reply(
              mention.id,
              `⚠️ You haven't linked your EasyPay wallet yet! Connect your 𝕏 account and fund your isolated Agent Vault at https://easyzpay.xyz/chat-to-pay?tab=x`
            )
            continue
          }

          // 2. Resolve Recipient Address on Arc Network
          const recipientAddress = await this.resolveRecipientAddress(intent.recipientUsername)

          if (!recipientAddress) {
            // Recipient has not linked their wallet yet
            await this.xClient.reply(
              mention.id,
              `🎁 @${intent.recipientUsername}, someone tried to send you ${intent.grossAmount} USDC on Arc Network!\n\nLink your wallet to claim future tips instantly at https://easyzpay.xyz/profile`
            )
            continue
          }

          // 3. Execute directly from Sender's Isolated Agent Vault on Arc Network
          const result = await this.agentWallet.executePaymentFromUserVault(
            senderUserAddress,
            recipientAddress,
            intent.grossAmount
          )

          if (result.success && result.txHash) {
            // Record in Turso DB
            await db.xBotTransaction.create({
              data: {
                tweetId: mention.id,
                senderXId: mention.authorId || 'unknown',
                recipientUsername: intent.recipientUsername,
                recipientAddress,
                grossAmount: result.grossAmount,
                netAmount: result.netAmount,
                feeAmount: result.feeAmount,
                txHash: result.txHash,
                action: intent.action,
                status: 'CONFIRMED',
              },
            })

            // Post ArcScan confirmation reply on X
            await this.xClient.reply(
              mention.id,
              `⚡ Sent ${result.netAmount} USDC to @${intent.recipientUsername}!\n` +
              `🛡️ 1% Protocol Fee: ${result.feeAmount} USDC\n` +
              `🔗 ArcScan: ${result.explorerUrl}`
            )

            processedCount++
          } else {
            errorCount++
            await this.xClient.reply(
              mention.id,
              `⚠️ Transaction failed on Arc Network: ${result.error || 'Execution halted'}. Please try again later.`
            )
          }

          // Update Sync Pointer in DB
          await db.syncState.upsert({
            where: { key: 'X_LAST_MENTION_ID' },
            update: { value: mention.id },
            create: { key: 'X_LAST_MENTION_ID', value: mention.id },
          }).catch(() => null)

        } catch (itemErr: any) {
          console.error(`[XBotWorker] Error processing tweet ${mention.id}:`, itemErr)
          errorCount++
        }
      }

      return { processed: processedCount, errors: errorCount }
    } catch (err: any) {
      console.error('[XBotWorker] Polling loop error:', err)
      return { processed: processedCount, errors: errorCount + 1 }
    } finally {
      XBotWorker.isRunning = false
    }
  }
}
