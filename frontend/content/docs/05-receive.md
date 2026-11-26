---
title: Receive
summary: Share your QR code, @username payment link, or custom payment request to receive USDC.
group: Features
order: 5
---

The **Receive** page (`/receive`) gives you multiple ways to collect USDC on Arc Mainnet.

## QR code and payment links

When your wallet is connected, the **Receive** page displays:

* **Scannable QR code:** Encodes your primary payment link (`/pay/@yourname` if you have a registered username, or `/send?to=0x...` if you have not registered one yet).
* **Username payment link:** `easyzpay.xyz/pay/@yourname` — anyone opening this link lands on a pre-filled payment screen addressed to you.
* **Direct wallet link and `0x` address:** Copy your raw address or direct `/send?to=...` link with one click.
* **Linked X link:** If your X account is connected in EasyZpay, you can also copy your shareable X payment link.

## Creating a payment request

Switch to the **Request** tab on `/receive` to generate a payment request with a specific USDC amount and memo:

1. Enter the requested USDC amount.
2. Add an optional memo (for example, `Design work` or `Dinner split`).
3. Click **Create Request** to generate a shareable link you can send to the payer.

> [!NOTE]
> Make sure the person paying you is sending **USDC on Arc Mainnet** (Chain ID `5042`). Funds sent on another network will not appear in your Arc Mainnet balance until bridged.
