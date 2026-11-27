---
title: Security and safety
summary: How to verify recipients, avoid phishing, protect your keys, and understand how EasyZpay handles web and bot payments.
group: Reference
order: 11
---

## Always verify the recipient and network

1. **Check the resolved `0x` address:** When paying a `@username` or X handle, inspect the resolved `0x` address shown before you confirm.
2. **Confirm the network:** Make sure your wallet is on **Arc Mainnet** (Chain ID `5042`) for standard EasyZpay transfers, or on the exact source/destination chain you intend when using Cross Pay.
3. **Start small:** When sending to a new recipient for the first time, test with a small amount of USDC.

## Avoid phishing

* Only access the app at **`https://easyzpay.xyz`**. Bookmark the URL instead of clicking unverified links.
* EasyZpay will **never** ask for your seed phrase, recovery phrase, or private key in Telegram, on X, or in email.

> [!WARNING]
> Never share your wallet seed phrase or private key with anyone, including anyone claiming to be EasyZpay or Arc support.

## How web wallets and Telegram bot funds work

* **Web app (`/send`, `/bounties`, `/cross-pay`):** You connect your own wallet (or Privy embedded wallet) and sign every approval and contract transaction directly in your wallet UI.
* **Telegram bot (`@EasyzpayBot`):** When you pair Telegram at `/chat-to-pay`, EasyZpay stores your pairing session, daily spending cap, and expiry window in its database. When you tap **Confirm** on a payment in Telegram, the server relayer (`ChatToPayRelayer`) checks your session cap and on-chain USDC balance, then broadcasts the `USDC.transfer` transaction on Arc Mainnet from the relayer account. You can revoke your Telegram session anytime with `/disconnect` or from `/chat-to-pay`.

## Risk note

Using blockchain networks and smart contracts involves technical and market risks, including irreversible transactions, smart-contract bugs, and network or RPC downtime. Nothing in this documentation is legal, tax, or financial advice. Only transact with funds you are comfortable managing.
