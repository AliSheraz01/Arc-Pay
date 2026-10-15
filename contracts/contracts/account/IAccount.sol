// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./UserOperation.sol";

/**
 * @title IAccount
 * @notice Standard ERC-4337 Account interface
 */
interface IAccount {
    /**
     * @notice Validate user's signature and nonce
     * @dev Must return SIG_VALIDATION_FAILED (1) on validation failure, or 0 / packed validationData on success
     * @param userOp The operation that is about to be executed
     * @param userOpHash Hash of the user's request data
     * @param missingAccountFunds Missing funds on the account's deposit in the entrypoint
     * @return validationData Packed validation data (authorizer, validUntil, validAfter)
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}
