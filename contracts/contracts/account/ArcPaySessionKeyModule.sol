// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./UserOperation.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ArcPaySessionKeyModule
 * @notice Production-grade Session Key Module for Easyzpay ERC-4337 Smart Accounts on Arc Chain.
 * Manages delegated permissions with strict spending caps, expiry limits, and target asset restrictions.
 */
contract ArcPaySessionKeyModule {
    using ECDSA for bytes32;

    uint256 internal constant SIG_VALIDATION_FAILED = 1;

    struct Session {
        address sessionKey;     // Authorized session public key
        address token;          // Allowed token address (e.g. Arc native USDC 0x3600...)
        address target;         // Allowed contract target (e.g. USDC or Router, address(0) = any)
        uint256 spendingLimit;  // Max cumulative spending allowed (in token decimals, e.g. 6 for USDC)
        uint256 spentAmount;    // Cumulative amount spent so far
        uint48 validAfter;      // Start timestamp
        uint48 validUntil;      // Expiry timestamp
        bool isActive;          // Active status flag
    }

    // Mapping: smartAccount => sessionKey => Session
    mapping(address => mapping(address => Session)) private _sessions;

    // Events
    event SessionCreated(
        address indexed account,
        address indexed sessionKey,
        address token,
        address target,
        uint256 spendingLimit,
        uint48 validAfter,
        uint48 validUntil
    );
    event SessionRevoked(address indexed account, address indexed sessionKey);
    event SessionExecuted(
        address indexed account,
        address indexed sessionKey,
        address target,
        uint256 amount,
        uint256 remainingAllowance
    );

    /**
     * @notice Authorize a new session key with granular policy limits
     * @dev Must be called by the Smart Account itself (via owner UserOp or direct call)
     */
    function enableSession(
        address sessionKey,
        address token,
        address target,
        uint256 spendingLimit,
        uint48 validAfter,
        uint48 validUntil
    ) external {
        require(sessionKey != address(0), "Invalid session key");
        require(validUntil > validAfter, "Invalid expiry range");
        require(validUntil > block.timestamp, "Session already expired");

        _sessions[msg.sender][sessionKey] = Session({
            sessionKey: sessionKey,
            token: token,
            target: target,
            spendingLimit: spendingLimit,
            spentAmount: 0,
            validAfter: validAfter,
            validUntil: validUntil,
            isActive: true
        });

        emit SessionCreated(
            msg.sender,
            sessionKey,
            token,
            target,
            spendingLimit,
            validAfter,
            validUntil
        );
    }

    /**
     * @notice Revoke an existing session key immediately
     * @dev Callable by the Smart Account itself
     */
    function revokeSession(address sessionKey) external {
        require(_sessions[msg.sender][sessionKey].isActive, "Session not active");
        _sessions[msg.sender][sessionKey].isActive = false;

        emit SessionRevoked(msg.sender, sessionKey);
    }

    /**
     * @notice Validates a UserOperation signature and spending limits for an authorized session
     * @dev Called by the Smart Account during ERC-4337 `validateUserOp`
     * @param userOp The ERC-4337 UserOperation being verified
     * @param userOpHash Canonical hash of the UserOperation
     * @return validationData Packed ERC-4337 validation data or SIG_VALIDATION_FAILED (1)
     */
    function validateSessionUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) external returns (uint256 validationData) {
        address account = userOp.sender;
        require(msg.sender == account, "Only account can invoke validation");

        // Signature layout: abi.encode(address sessionKey, bytes sessionSig)
        (address sessionKey, bytes memory sessionSig) = abi.decode(
            userOp.signature,
            (address, bytes)
        );

        Session storage session = _sessions[account][sessionKey];

        // 1. Check session existence and active status
        if (!session.isActive) {
            return SIG_VALIDATION_FAILED;
        }

        // 2. Check time validity bounds
        if (block.timestamp < session.validAfter || block.timestamp > session.validUntil) {
            return SIG_VALIDATION_FAILED;
        }

        // 3. Verify cryptographic signature from session key
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        (address recoveredSigner, ECDSA.RecoverError err, ) = ECDSA.tryRecover(ethSignedHash, sessionSig);
        if (err != ECDSA.RecoverError.NoError || recoveredSigner != sessionKey) {
            return SIG_VALIDATION_FAILED;
        }

        // 4. Policy enforcement on calldata (spending limit & target check)
        // Expected calldata: execute(address dest, uint256 value, bytes calldata data)
        bytes4 selector = bytes4(userOp.callData[:4]);
        bytes memory callPayload = userOp.callData[4:];

        // Standard execute(address,uint256,bytes) selector = 0xb61d27f6
        if (selector == bytes4(keccak256("execute(address,uint256,bytes)"))) {
            (address dest, , bytes memory innerData) = abi.decode(
                callPayload,
                (address, uint256, bytes)
            );

            // Verify target contract if restricted
            if (session.target != address(0) && dest != session.target) {
                return SIG_VALIDATION_FAILED;
            }

            // If target is token (e.g. USDC), parse transfer(address to, uint256 amount)
            if (session.token != address(0) && dest == session.token) {
                if (innerData.length >= 68) {
                    bytes4 innerSelector;
                    assembly {
                        innerSelector := mload(add(innerData, 32))
                    }
                    // transfer(address,uint256) selector = 0xa9059cbb
                    if (innerSelector == bytes4(keccak256("transfer(address,uint256)"))) {
                        uint256 transferAmount;
                        assembly {
                            transferAmount := mload(add(innerData, 68))
                        }

                        // Enforce cumulative spending limit
                        if (session.spentAmount + transferAmount > session.spendingLimit) {
                            return SIG_VALIDATION_FAILED;
                        }

                        // Update spent amount atomically
                        session.spentAmount += transferAmount;

                        emit SessionExecuted(
                            account,
                            sessionKey,
                            dest,
                            transferAmount,
                            session.spendingLimit - session.spentAmount
                        );
                    }
                }
            }
        }

        // Return packed ERC-4337 validationData: (authorizer = 0, validUntil, validAfter)
        return _packValidationData(false, session.validUntil, session.validAfter);
    }

    /**
     * @notice Helper to pack ERC-4337 validation data
     */
    function _packValidationData(
        bool sigFailed,
        uint48 validUntil,
        uint48 validAfter
    ) internal pure returns (uint256) {
        return (sigFailed ? 1 : 0) | (uint256(validUntil) << 160) | (uint256(validAfter) << 208);
    }

    // ==========================================
    // VIEW FUNCTIONS
    // ==========================================

    function getSession(address account, address sessionKey) external view returns (Session memory) {
        return _sessions[account][sessionKey];
    }

    function getRemainingAllowance(address account, address sessionKey) external view returns (uint256) {
        Session memory s = _sessions[account][sessionKey];
        if (!s.isActive || s.spentAmount >= s.spendingLimit) {
            return 0;
        }
        return s.spendingLimit - s.spentAmount;
    }

    function isSessionValid(
        address account,
        address sessionKey,
        uint256 amount
    ) external view returns (bool) {
        Session memory s = _sessions[account][sessionKey];
        if (!s.isActive) return false;
        if (block.timestamp < s.validAfter || block.timestamp > s.validUntil) return false;
        if (s.spentAmount + amount > s.spendingLimit) return false;
        return true;
    }
}
