export type XBotAction = 'TIP' | 'PAY' | 'SEND' | 'BOUNTY'

export interface ParsedXIntent {
  action: XBotAction
  grossAmount: number
  recipientUsername: string
  memo?: string
}

export interface XPaymentResult {
  success: boolean
  txHash?: string
  explorerUrl?: string
  grossAmount: string
  netAmount: string
  feeAmount: string
  recipientAddress?: string
  error?: string
}

export interface XMentionItem {
  id: string
  text: string
  authorId?: string
  authorUsername?: string
  createdAt?: string
  conversationId?: string
}
