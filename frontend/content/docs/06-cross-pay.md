---
title: Cross Pay
summary: Bridge native USDC between Arc Mainnet and six supported EVM networks using Circle CCTP.
group: Features
order: 6
---

**Cross Pay** (`/cross-pay`) uses **Circle's Cross-Chain Transfer Protocol (CCTP V2)** to burn native USDC on a source chain and mint native USDC on your destination chain.

## Supported mainnet networks

In production, EasyZpay configures CCTP V2 across these seven networks:

* **Arc Mainnet** (Chain ID `5042`, CCTP Domain `26`)
* **Base** (Chain ID `8453`, CCTP Domain `6`)
* **Ethereum** (Chain ID `1`, CCTP Domain `0`)
* **Arbitrum One** (Chain ID `42161`, CCTP Domain `3`)
* **OP Mainnet** (Chain ID `10`, CCTP Domain `2`)
* **Polygon PoS** (Chain ID `137`, CCTP Domain `7`)
* **Avalanche** (Chain ID `43114`, CCTP Domain `1`)

## How a Cross Pay transfer works

1. Open **Cross Pay** (`/cross-pay`) and connect your wallet.
2. Select your **From** chain (for example, Base) and **To** chain (for example, Arc Mainnet).
3. Enter the USDC amount and review your balances across chains.
4. **Approve & Burn:** Approve USDC spending for Circle's `TokenMessenger` on the source chain, then confirm the burn transaction (`depositForBurn`).
5. **Attestation:** EasyZpay polls Circle's attestation API until the burn is verified.
6. **Mint on destination:** Switch to the destination chain when prompted (or use **Manual Claim** with your source transaction hash) to call `receiveMessage` on `MessageTransmitter` and mint your USDC.

> [!WARNING]
> You need a small amount of native gas on the **source** chain to burn USDC, and on the **destination** chain to claim/mint it (on Arc Mainnet, gas is paid in USDC). Keep your source transaction hash until the destination mint completes.
