---
title: Bounties
summary: Post USDC bounties held in on-chain escrow, review submissions, and release rewards on Arc Mainnet.
group: Features
order: 9
---

The **Bounties** page (`/bounties`) lets creators fund tasks with USDC held in the `BountyEscrow` smart contract and pay out winners on Arc Mainnet.

## For bounty creators

1. Open **Bounties** (`/bounties`) and click to create a new bounty.
2. Enter the title, description, category, difficulty, requirements, USDC prize amount, and optional deadline.
3. **Approve & Deposit:** Approve USDC spending for `BountyEscrow`, then call `depositBounty` to lock the prize in the escrow contract.
4. **Select a winner:** Review submitted links and work, then click to release the prize (`releasePrize`). The escrow contract transfers the locked USDC directly to the winner's address.

## Cancelling or refunding a bounty

* **Before a winner is chosen:** The creator can cancel the bounty (`cancelBounty`) and receive a full refund of the locked USDC from escrow.
* **After deadline expiration:** If a deadline was set and has passed without a winner selected, `refundExpiredBounty` returns the locked USDC to the creator.

## For contributors

1. Browse **Active** or **Featured** bounties on `/bounties`.
2. Open a bounty to read its requirements and checklist.
3. Submit your solution description and repository or demo link before the deadline.

> [!NOTE]
> Once `releasePrize` is confirmed on-chain, the USDC payout moves directly from the `BountyEscrow` contract to the winning address and cannot be reversed.
