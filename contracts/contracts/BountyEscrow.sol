// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BountyEscrow
/// @notice Production-grade on-chain escrow contract for EasyZPay Bounties on Arc Mainnet.
/// Holds bounty funds securely in escrow and manages payout/refund state transitions.
contract BountyEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;

    enum BountyStatus {
        None,
        Funded,
        Completed,
        Cancelled
    }

    struct Bounty {
        address creator;
        uint256 amount;
        uint256 deadline;
        BountyStatus status;
        address winner;
    }

    /// @notice Bounties stored by bountyId (keccak256 hash of off-chain UUID)
    mapping(bytes32 => Bounty) public bounties;

    event BountyCreated(bytes32 indexed bountyId, address indexed creator, uint256 amount, uint256 deadline);
    event BountyFunded(bytes32 indexed bountyId, address indexed creator, uint256 amount, uint256 deadline);
    event WinnerSelected(bytes32 indexed bountyId, address indexed winner, uint256 amount);
    event RewardReleased(bytes32 indexed bountyId, address indexed winner, uint256 amount);
    event BountyCancelled(bytes32 indexed bountyId, address indexed creator, uint256 refundAmount);
    event BountyRefunded(bytes32 indexed bountyId, address indexed creator, uint256 amount);

    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = IERC20(_usdcToken);
    }

    /// @notice Creator deposits the prize into escrow
    /// @param bountyId  keccak256 hash of the off-chain bounty UUID
    /// @param amount    Prize amount in smallest USDC units (6 decimals)
    /// @param deadline  Unix timestamp of the bounty expiration deadline (0 if open-ended)
    function depositBounty(bytes32 bountyId, uint256 amount, uint256 deadline) external nonReentrant {
        require(bountyId != bytes32(0), "Invalid bounty ID");
        require(amount > 0, "Amount must be > 0");
        require(bounties[bountyId].status == BountyStatus.None, "Bounty already exists or funded");

        if (deadline > 0) {
            require(deadline > block.timestamp, "Deadline must be in the future");
        }

        bounties[bountyId] = Bounty({
            creator: msg.sender,
            amount: amount,
            deadline: deadline,
            status: BountyStatus.Funded,
            winner: address(0)
        });

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        emit BountyCreated(bountyId, msg.sender, amount, deadline);
        emit BountyFunded(bountyId, msg.sender, amount, deadline);
    }

    /// @notice Creator selects the winning contributor and releases the prize from escrow
    /// @param bountyId  keccak256 hash of the bounty UUID
    /// @param winner    Winner's wallet address
    function releasePrize(bytes32 bountyId, address winner) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        require(b.status == BountyStatus.Funded, "Bounty is not in funded status");
        require(b.creator == msg.sender, "Only bounty creator can release prize");
        require(winner != address(0), "Invalid winner address");
        require(winner != address(this), "Cannot release to contract");

        uint256 payoutAmount = b.amount;
        b.status = BountyStatus.Completed;
        b.winner = winner;

        usdcToken.safeTransfer(winner, payoutAmount);

        emit WinnerSelected(bountyId, winner, payoutAmount);
        emit RewardReleased(bountyId, winner, payoutAmount);
    }

    /// @notice Creator cancels the bounty and receives a refund if no winner has been selected
    /// @param bountyId  keccak256 hash of the bounty UUID
    function cancelBounty(bytes32 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        require(b.status == BountyStatus.Funded, "Bounty cannot be cancelled");
        require(b.creator == msg.sender, "Only creator can cancel bounty");

        uint256 refundAmount = b.amount;
        b.status = BountyStatus.Cancelled;

        usdcToken.safeTransfer(msg.sender, refundAmount);

        emit BountyCancelled(bountyId, msg.sender, refundAmount);
    }

    /// @notice Refund bounty to creator if the deadline has passed without a winner
    /// @param bountyId  keccak256 hash of the bounty UUID
    function refundExpiredBounty(bytes32 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        require(b.status == BountyStatus.Funded, "Bounty not funded");
        require(b.deadline > 0 && block.timestamp > b.deadline, "Bounty has not expired yet");

        uint256 refundAmount = b.amount;
        address creator = b.creator;
        b.status = BountyStatus.Cancelled;

        usdcToken.safeTransfer(creator, refundAmount);

        emit BountyRefunded(bountyId, creator, refundAmount);
    }

    /// @notice Get full bounty details
    function getBounty(bytes32 bountyId)
        external
        view
        returns (
            address creator,
            uint256 amount,
            uint256 deadline,
            BountyStatus status,
            address winner
        )
    {
        Bounty storage b = bounties[bountyId];
        return (b.creator, b.amount, b.deadline, b.status, b.winner);
    }
}
