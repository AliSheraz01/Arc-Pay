// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./UserOperation.sol";

/**
 * @title IEntryPoint
 * @notice Minimal ERC-4337 EntryPoint interface for account deposits and validation
 */
interface IEntryPoint {
    function depositTo(address account) external payable;
    function getNonce(address sender, uint192 key) external view returns (uint256 nonce);
    function handleOps(UserOperation[] calldata ops, address payable beneficiary) external;
    function getSenderAddress(bytes calldata initCode) external;
}
