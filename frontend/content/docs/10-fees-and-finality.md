---
title: Fees, limits and finality
summary: How USDC gas works on Arc Network, EasyZpay contract fees, relayer sponsorship, and settlement speed.
group: Reference
order: 10
---

## Gas fees in USDC

Arc Network is Circle's EVM-compatible Layer 1 where **USDC is the native gas token**, not ETH. Every on-chain action you sign in your browser wallet (sending USDC, registering a username, funding a bounty, or claiming a CCTP transfer on Arc) pays network gas directly in USDC.

## EasyZpay protocol fees

Based on our deployed smart contracts (`ArcPayUsernameRegistry`, `ArcPayRouter`, and `BountyEscrow`):

* **Username registration:** Free from EasyZpay (no protocol fee; you pay only Arc network gas).
* **Web Send (`ArcPayRouter`):** Transfers the exact USDC amount from your wallet to the recipient with no protocol fee deducted by the router contract.
* **Bounties (`BountyEscrow`):** Locks and releases the exact USDC prize amount with no protocol fee deducted by the escrow contract.

## Gasless Telegram relayer

When you confirm a payment inside the **Telegram bot**, you do not sign a gas transaction in a browser wallet. Instead, EasyZpay's server relayer (`ChatToPayRelayer`) submits the USDC transfer on Arc Mainnet and pays the network gas on your behalf.

Telegram payments are constrained by the **daily spending limit** (default `50.0` USDC) and **session expiry** (default `7` days) that you choose when pairing.

## Finality

Arc Network provides **deterministic finality in under one second**, meaning once a transaction is confirmed on Arc Mainnet, it is final and cannot be reorganized.
