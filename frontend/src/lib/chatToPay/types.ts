export interface SessionParams {
  smartAccountAddress: string
  ownerAddress: string
  sessionPublicKey: string
  sessionPrivateKeyEncrypted: string
  spendingLimit: string
  validUntil: string
}

export interface PairingResult {
  pairingToken: string
  expiresAt: string
  whatsappDeepLink: string
}

export interface PaymentIntentParsed {
  action: 'PAY' | 'SEND' | 'TRANSFER'
  amount: string
  asset: 'USDC'
  recipientInput: string
  recipientType: 'USERNAME' | 'WALLET'
  resolvedAddress: string
}

export interface RelayerExecutionResult {
  success: boolean
  txHash?: string
  explorerUrl?: string
  userOpHash?: string
  error?: string
  remainingAllowance?: string
}

export interface WhatsAppIncomingMessage {
  from: string
  text: string
  id?: string
  timestamp?: number
}
