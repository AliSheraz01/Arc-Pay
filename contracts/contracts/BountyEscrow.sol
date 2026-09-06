// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BountyEscrow
/// @notice Holds bounty prize funds in escrow per bountyId.
///         Only the original depositor (creator) can release funds to a winner.
contract BountyEscrow {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;

    struct Bounty {
        address creator;
        uint256 amount;
        bool funded;
        bool paid;
    }

    /// @notice Bounties stored by bountyId (bytes32 hash of the off-chain UUID)
    mapping(bytes32 => Bounty) public bounties;

    event BountyFunded(bytes32 indexed bountyId, address indexed creator, uint256 amount);
    event PrizeReleased(bytes32 indexed bountyId, address indexed winner, uint256 amount);

    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = IERC20(_usdcToken);
    }

    /// @notice Creator deposits the prize into escrow.
    ///         Must approve this contract for `amount` USDC first.
    /// @param bountyId  keccak256 of the off-chain bounty UUID string
    /// @param amount    Prize amount in USDC smallest unit (6 decimals)
    function depositBounty(bytes32 bountyId, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(!bounties[bountyId].funded, "Already funded");
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        bounties[bountyId] = Bounty({
            creator: msg.sender,
            amount: amount,
            funded: true,
            paid: false
        });
        emit BountyFunded(bountyId, msg.sender, amount);
    }

    /// @notice Creator selects a winner and releases prize from escrow to the winner.
    /// @param bountyId       Same bytes32 used in depositBounty
    /// @param winner         Winner's wallet address
    function releasePrize(bytes32 bountyId, address winner) external {
        Bounty storage b = bounties[bountyId];
        require(b.funded, "Bounty not funded");
        require(!b.paid, "Prize already released");
        require(b.creator == msg.sender, "Only bounty creator can release");
        require(winner != address(0), "Invalid winner address");
        b.paid = true;
        usdcToken.safeTransfer(winner, b.amount);
        emit PrizeReleased(bountyId, winner, b.amount);
    }

    /// @notice View bounty escrow state
    function getBounty(bytes32 bountyId)
        external
        view
        returns (address creator, uint256 amount, bool funded, bool paid)
    {
        Bounty storage b = bounties[bountyId];
        return (b.creator, b.amount, b.funded, b.paid);
    }
}
