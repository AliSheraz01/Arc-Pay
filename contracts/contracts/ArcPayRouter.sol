// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract ArcPayRouter is Ownable, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;

    event PaymentSent(address indexed from, address indexed to, uint256 amount, string memo);

    constructor(address _usdcToken) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = IERC20(_usdcToken);
    }

    function sendPayment(address _to, uint256 _amount, string calldata _memo) external whenNotPaused {
        require(_to != address(0), "Cannot send to zero address");
        require(_amount > 0, "Amount must be greater than 0");

        // Transfer USDC from sender to the recipient directly
        // Note: Sender must have approved this contract to spend their USDC
        usdcToken.safeTransferFrom(msg.sender, _to, _amount);

        emit PaymentSent(msg.sender, _to, _amount, _memo);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
