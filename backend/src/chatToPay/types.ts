export interface SessionParams {
  smartAccountAddress: string;
  ownerAddress: string;
  sessionPublicKey: string;
  sessionPrivateKeyEncrypted: string;
  spendingLimit: string; // Human readable USDC, e.g. "50.0"
  validUntil: string; // ISO Date string
}

export interface PairingResult {
  pairingToken: string;
  expiresAt: string;
  whatsappDeepLink: string;
}

export interface PaymentIntentParsed {
  action: 'PAY' | 'SEND' | 'TRANSFER';
  amount: string; // e.g. "5.0"
  asset: 'USDC';
  recipientInput: string; // e.g. "@alisheraz" or "0x..."
  recipientType: 'USERNAME' | 'WALLET';
  resolvedAddress: string;
}

export interface RelayerExecutionResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  userOpHash?: string;
  error?: string;
  remainingAllowance?: string;
}

export interface WhatsAppIncomingMessage {
  from: string; // Sender phone ID, e.g. "1234567890" or "+1234567890"
  text: string; // Message body
  id?: string;
  timestamp?: number;
}
