// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ArcPayRouter
/// @notice Production-grade payment routing contract for EasyZPay on Arc Mainnet.
/// Executes USDC payments with memos and emits indexable events.
contract ArcPayRouter is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;

    event PaymentSent(
        address indexed from,
        address indexed to,
        uint256 amount,
        string memo
    );

    constructor(address _usdcToken) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = IERC20(_usdcToken);
    }

    /// @notice Send USDC payment with an attached memo string
    /// @param _to Recipient address
    /// @param _amount Amount of USDC in base units (6 decimals)
    /// @param _memo Optional payment reference / description / invoice ID
    function sendPayment(
        address _to,
        uint256 _amount,
        string calldata _memo
    ) external whenNotPaused nonReentrant {
        require(_to != address(0), "Cannot send to zero address");
        require(_to != address(this), "Cannot send to router contract");
        require(_amount > 0, "Amount must be greater than 0");

        // Transfer USDC directly from sender to the recipient
        usdcToken.safeTransferFrom(msg.sender, _to, _amount);

        emit PaymentSent(msg.sender, _to, _amount, _memo);
    }

    /// @notice Pause payments in an emergency
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume payments
    function unpause() external onlyOwner {
        _unpause();
    }
}
