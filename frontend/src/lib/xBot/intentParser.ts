import { ParsedXIntent, XBotAction } from './types'

/**
 * Natural language intent parser for X mentions.
 * Examples supported:
 * - @EasyPayBot tip 5 USDC to @alisheraz
 * - @EasyPayBot pay 10 to @bob
 * - @EasyPayBot send 2.5 @carol
 * - @EasyPayBot bounty 20 USDC for @developer
 */
export function parseXPaymentIntent(text: string): ParsedXIntent | null {
  if (!text) return null

  const cleaned = text.trim()

  // Match: (tip|pay|send|bounty) <amount> [USDC] (to|for)? @<recipient> [memo]
  const regex = /(?:^|\s)(tip|pay|send|bounty)\s+([\d.]+)\s*(?:USDC)?\s+(?:to\s+|for\s+)?@?([A-Za-z0-9_]{1,15})(?:\s+(.*))?$/i
  const match = cleaned.match(regex)

  if (!match) return null

  const rawAction = match[1].toUpperCase()
  const rawAmount = parseFloat(match[2])
  const recipientUsername = match[3].replace(/^@/, '').toLowerCase()
  const memo = match[4]?.trim()

  if (isNaN(rawAmount) || rawAmount <= 0) {
    return null
  }

  // Cap sanity check: Minimum 0.10 USDC, Maximum 50.00 USDC per tweet
  if (rawAmount < 0.1 || rawAmount > 50.0) {
    return null
  }

  let action: XBotAction = 'TIP'
  if (rawAction === 'PAY') action = 'PAY'
  if (rawAction === 'SEND') action = 'SEND'
  if (rawAction === 'BOUNTY') action = 'BOUNTY'

  return {
    action,
    grossAmount: rawAmount,
    recipientUsername,
    memo,
  }
}
