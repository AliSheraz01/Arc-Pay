import { ParsedXIntent, XBotAction } from './types'

/**
 * Robust natural language intent parser for X mentions.
 * Supports:
 * - @easyzpay tip 0.07 USDC to @alisheraz
 * - @easyzpay tip @bob 0.07 usdc
 * - @easyzpay pay 10 to @bob
 * - @easyzpay send 2.5 @carol
 * - @easyzpay bounty 20 USDC for @developer
 */
export function parseXPaymentIntent(text: string): ParsedXIntent | null {
  if (!text) return null

  const cleaned = text.trim()

  // Variation 1: <action> <amount> [usdc] [to|for] @<recipient> [memo]
  const regex1 = /(?:^|\s)(tip|pay|send|bounty)\s+([\d.]+)\s*(?:USDC)?\s+(?:to\s+|for\s+)?@?([A-Za-z0-9_]{1,15})(?:\s+(.*))?$/i

  // Variation 2: <action> [to|for]? @<recipient> <amount> [usdc] [memo]
  const regex2 = /(?:^|\s)(tip|pay|send|bounty)\s+(?:to\s+|for\s+)?@?([A-Za-z0-9_]{1,15})\s+([\d.]+)\s*(?:USDC)?(?:\s+(.*))?$/i

  let match = cleaned.match(regex1)
  let rawAction = ''
  let rawAmount = 0
  let recipientUsername = ''
  let memo: string | undefined

  if (match) {
    rawAction = match[1].toUpperCase()
    rawAmount = parseFloat(match[2])
    recipientUsername = match[3].replace(/^@/, '').toLowerCase()
    memo = match[4]?.trim()
  } else {
    match = cleaned.match(regex2)
    if (match) {
      rawAction = match[1].toUpperCase()
      recipientUsername = match[2].replace(/^@/, '').toLowerCase()
      rawAmount = parseFloat(match[3])
      memo = match[4]?.trim()
    } else {
      return null
    }
  }

  let action: XBotAction = 'TIP'
  if (rawAction === 'PAY') action = 'PAY'
  if (rawAction === 'SEND') action = 'SEND'
  if (rawAction === 'BOUNTY') action = 'BOUNTY'

  // Cap sanity check: Minimum 0.01 USDC, Maximum 50.00 USDC per tweet
  if (isNaN(rawAmount) || rawAmount <= 0) {
    return {
      action,
      grossAmount: 0,
      recipientUsername,
      memo,
      isValidAmount: false,
      validationError: 'Invalid payment amount specified.',
    }
  }

  if (rawAmount < 0.01) {
    return {
      action,
      grossAmount: rawAmount,
      recipientUsername,
      memo,
      isValidAmount: false,
      validationError: 'Minimum payment amount is 0.01 USDC.',
    }
  }

  if (rawAmount > 50.0) {
    return {
      action,
      grossAmount: rawAmount,
      recipientUsername,
      memo,
      isValidAmount: false,
      validationError: 'Maximum payment amount is 50.00 USDC per tweet for Agent Vault security.',
    }
  }

  return {
    action,
    grossAmount: rawAmount,
    recipientUsername,
    memo,
    isValidAmount: true,
  }
}
