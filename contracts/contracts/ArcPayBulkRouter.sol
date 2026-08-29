// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ArcPayBulkRouter {
    IERC20 public usdc;

    event PaymentSent(address indexed from, address indexed to, uint256 amount, string memo);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function sendBulkPayment(address[] calldata _to, uint256[] calldata _amounts, string[] calldata _memos) external {
        require(_to.length == _amounts.length && _amounts.length == _memos.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _to.length; i++) {
            require(_amounts[i] > 0, "Amount must be greater than 0");
            
            // Transfer USDC from sender to recipient
            // Note: Sender must have approved this contract for the sum of all amounts
            require(usdc.transferFrom(msg.sender, _to[i], _amounts[i]), "Transfer failed");

            // Emit the same event format so indexer catches it
            emit PaymentSent(msg.sender, _to[i], _amounts[i], _memos[i]);
        }
    }
}
