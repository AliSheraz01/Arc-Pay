---
title: Network details
summary: Arc Mainnet RPC, Chain ID 5042, block explorer, wallet setup steps, and USDC decimal behavior.
group: Reference
order: 13
---

EasyZpay runs natively on **Arc Mainnet**, Circle's EVM-compatible Layer 1 where USDC is the native gas token and transactions settle with deterministic finality in under one second.

## Arc Mainnet parameters

```text
Network Name: Arc Mainnet
Chain ID:     5042
Currency:     USDC
RPC URL:      https://rpc.mainnet.arc.io
Explorer:     https://explorer.arc.io
```

For official core contract addresses (including USDC, CCTP, and Gateway), see [Arc's official documentation](https://docs.arc.io).

## Add Arc Mainnet to your wallet

1. Open EasyZpay and click **Connect Wallet**.
2. Click the **Network** card at the bottom of the sidebar and select **Arc Mainnet**.
3. Approve the network prompt in your wallet.

To add it manually in MetaMask or another EVM wallet, open **Settings → Networks → Add Network** and paste the parameters above.

> [!NOTE]
> **USDC decimals on Arc:** Native USDC used for gas on Arc uses **18 decimals**, while the USDC ERC-20 interface (`balanceOf`, `transfer`, and `ArcPayRouter`) uses **6 decimals**. EasyZpay handles ERC-20 6-decimal formatting automatically for transfers, bounties, and balances.
