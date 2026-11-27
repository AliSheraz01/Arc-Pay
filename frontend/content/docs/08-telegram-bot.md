---
title: Telegram bot
summary: Pair your account, send USDC in Telegram, manage spending limits, and understand bot confirmations and errors.
group: Telegram
order: 8
---

With the EasyZpay Telegram bot, you can send USDC on Arc Mainnet using natural commands in chat without signing every transfer in a browser extension.

## 1. Link your Telegram account

1. Open **Chat to Pay** (`/chat-to-pay`), select the **Telegram** tab, and connect your wallet.
2. Set your **Daily Spending Limit** (defaults to `50.0` USDC) and **Expiry** (defaults to `7` days).
3. Click **Connect Telegram** to generate a one-time pairing code (`ARC-XXXX`) and deep link.
4. Open `@EasyzpayBot` in Telegram and tap **Start**, or send `PAIR ARC-XXXX`.

## 2. Commands you can use

* `Pay 5 USDC to @ali` or `Send 10 to 0x...` — Starts a payment confirmation.
* `/panel` — Shows your linked address, daily limit, spent amount, and remaining allowance.
* `/history` — Lists your recent Arc Mainnet transactions.
* `/help` — Shows payment examples and commands.
* `/disconnect` — Unlinks your Telegram chat and revokes the active session.

## 3. Confirmation flow & allowances

Before showing a confirmation prompt, the bot checks:

1. **Your session status and expiry** in the database.
2. **Your remaining daily allowance** (`spendingLimit - spentAmount`).
3. **Real on-chain USDC balance** on Arc Mainnet using the USDC ERC-20 contract (6 decimals).

If your balance or allowance is too low, the bot stops immediately and shows your current balance and how to top up instead of showing a **Confirm** button.

When checks pass, you see **Confirm** and **Cancel** buttons (valid for 2 minutes). Tapping **Confirm** claims the request atomically so a double-tap cannot send the same payment twice, and the server relayer broadcasts the transfer on Arc Mainnet.

## 4. What error messages mean

* **Insufficient USDC balance:** The relayer/sender balance on Arc Mainnet is lower than the amount you requested. Top up USDC and try again.
* **Daily spending allowance exceeded:** Your request exceeds the cap you configured during pairing. Adjust your limit at `/chat-to-pay`.
* **Network or relayer is busy:** Arc RPC or the relayer had a temporary issue. Use the **Retry** button or try again shortly.
* **Invalid recipient address / Username not registered:** Double-check the `@username` or `0x` address.
