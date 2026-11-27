---
title: FAQ and troubleshooting
summary: Solutions for insufficient balance, wrong network, pending transactions, and username lookup errors.
group: Reference
order: 12
---

## Insufficient USDC balance

**In the web app:** Remember that Arc Mainnet uses USDC for gas. If you try to send your entire USDC balance, the transaction may fail because a small amount of USDC is needed for gas. Leave a fraction of a USDC for gas, or bridge/receive more USDC first.

**In the Telegram bot:** The bot checks the on-chain USDC balance before showing **Confirm**. If your balance is lower than the amount requested, top up USDC on Arc Mainnet and try again.

## Wrong network

If buttons are disabled or EasyZpay shows a network warning, open the **Network** selector in the sidebar (or your wallet extension) and switch to **Arc Mainnet** (Chain ID `5042`).

## Pending or stuck Cross Pay transfer

If a Cross Pay transfer burned USDC on the source chain but has not minted on the destination chain:

1. Copy your **source transaction hash** from your wallet or block explorer.
2. Open **Cross Pay** (`/cross-pay`) and click **Manual Claim**.
3. Switch your wallet to the destination chain and submit the claim once Circle's attestation is ready.

## Username not found

* Check spelling and omit spaces (`a–z`, `0–9`, `_` only, 3–30 characters).
* Ask the recipient to confirm they registered their `@username` in **Settings** on Arc Mainnet.

## X handle not linked

X handles only resolve in **Send** (`/send`) if that person has connected their X account and wallet inside EasyZpay. If they have not linked it yet, ask them for their `@username` or `0x` address.
