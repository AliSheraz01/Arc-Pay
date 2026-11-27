---
title: Usernames
summary: How @username mapping works on-chain, naming rules, supported identifier types, and limitations.
group: Get started
order: 3
---

EasyZpay uses the `ArcPayUsernameRegistry` smart contract on Arc Network to map a human-readable `@username` directly to your `0x` wallet address.

## Naming rules

The registry contract enforces these rules on-chain:

* **Length:** 3 to 30 characters.
* **Allowed characters:** Lowercase letters (`a–z`), numbers (`0–9`), and underscores (`_`).
* **Uniqueness:** Each username can only be claimed once.
* **One per wallet:** Each wallet address can register one EasyZpay username.

## Supported recipient types

When sending USDC in the **Send** page (`/send`), you can enter:

1. **EasyZpay `@username`:** Resolved on-chain via `ArcPayUsernameRegistry` (for example, `@ali`).
2. **X (Twitter) handle:** Supported as a recipient lookup type in the web app (`@handle` or `x:handle`) **only if** that X user has already linked their X account and wallet in EasyZpay.
3. **Wallet address:** Any valid 42-character `0x` EVM address.

In the **Telegram bot**, you can send to an EasyZpay `@username` or a `0x` wallet address.

> [!NOTE]
> **Coming soon — X mention and DM bot:** Sending USDC directly by mentioning or DMing a bot on X is **not live yet**. Today, X handles work only as a recipient lookup inside the EasyZpay web app when the recipient has linked their X account.

## Changing your username

In the current `ArcPayUsernameRegistry` contract, once a wallet address registers a username, it **cannot be changed or overwritten** from that same wallet. Choose your `@username` carefully before registering.

> [!WARNING]
> Always verify the resolved `0x` address shown under a `@username` before confirming a payment. Usernames are first-come, first-served on-chain.
