---
title: Send
summary: Send USDC to any @username, linked X handle, or 0x wallet address on Arc Mainnet.
group: Features
order: 4
---

The **Send** page (`/send`) lets you transfer USDC on Arc Mainnet without manually handling long hex addresses.

## How to send USDC

1. Open **Send** from the sidebar (desktop) or bottom tab bar (mobile).
2. Choose a recipient mode: **EasyZpay `@username`**, **X Handle**, or **Wallet Address**.
3. Type the recipient identifier. EasyZpay resolves it and displays the destination `0x` address.
4. Enter the USDC amount and an optional short memo.
5. Click **Continue** to review the confirmation summary.
6. Approve USDC spending if prompted (for the `ArcPayRouter` contract), then confirm the transfer in your wallet.

## What happens on-chain

Web transfers route through the `ArcPayRouter` smart contract (`sendPayment`), which transfers USDC directly from your wallet to the recipient's wallet and emits an indexable `PaymentSent` event with your memo.

> [!WARNING]
> Blockchain transactions cannot be reversed. Always verify the resolved `0x` address, the USDC amount, and that your wallet is connected to **Arc Mainnet** before signing.

## If an X handle is not linked

If you look up an X handle that has not linked a wallet in EasyZpay yet, the Send page shows a notice and lets you copy an invite link instead of broadcasting a transfer.
