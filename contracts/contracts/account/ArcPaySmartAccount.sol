// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IAccount.sol";
import "./IEntryPoint.sol";
import "./UserOperation.sol";
import "./ArcPaySessionKeyModule.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ArcPaySmartAccount
 * @notice ERC-4337 Smart Account on Arc Chain with native Session Key delegation for Chat-to-Pay.
 */
contract ArcPaySmartAccount is IAccount {
    using ECDSA for bytes32;

    uint256 internal constant SIG_VALIDATION_FAILED = 1;
    bytes1 internal constant SIG_MODE_OWNER = 0x00;
    bytes1 internal constant SIG_MODE_SESSION = 0x01;

    address public owner;
    IEntryPoint public immutable entryPoint;
    ArcPaySessionKeyModule public immutable sessionKeyModule;

    event Initialized(address indexed owner, address indexed entryPoint, address indexed sessionKeyModule);
    event Executed(address indexed dest, uint256 value, bytes data);
    event ExecutedBatch(address[] dest, uint256[] value);

    modifier onlyAuthorized() {
        require(msg.sender == address(entryPoint) || msg.sender == owner, "Unauthorized caller");
        _;
    }

    constructor(IEntryPoint _entryPoint, ArcPaySessionKeyModule _sessionKeyModule) {
        entryPoint = _entryPoint;
        sessionKeyModule = _sessionKeyModule;
    }

    /**
     * @notice Initialize account owner
     * @dev Called once during factory deployment
     */
    function initialize(address _owner) external {
        require(owner == address(0), "Already initialized");
        require(_owner != address(0), "Invalid owner");
        owner = _owner;

        emit Initialized(_owner, address(entryPoint), address(sessionKeyModule));
    }

    /**
     * @notice ERC-4337 validateUserOp function
     * @dev Supports both Owner signatures and Session Key delegations
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        require(msg.sender == address(entryPoint), "Caller must be EntryPoint");

        // Validate signature based on mode prefix: [0x00 = Owner, 0x01 = Session Key]
        if (userOp.signature.length > 0 && bytes1(userOp.signature[0]) == SIG_MODE_SESSION) {
            // Strip mode byte and forward to Session Key Module
            UserOperation memory sessionOp = userOp;
            sessionOp.signature = userOp.signature[1:];
            validationData = sessionKeyModule.validateSessionUserOp(sessionOp, userOpHash);
        } else {
            // Direct Owner validation
            bytes memory ownerSig = userOp.signature;
            if (ownerSig.length > 0 && bytes1(ownerSig[0]) == SIG_MODE_OWNER) {
                ownerSig = userOp.signature[1:];
            }

            bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
            (address signer, ECDSA.RecoverError err, ) = ECDSA.tryRecover(ethSignedHash, ownerSig);
            if (err != ECDSA.RecoverError.NoError || signer != owner) {
                return SIG_VALIDATION_FAILED;
            }
            validationData = 0; // Success, infinite validity
        }

        // Pay prefund if required by EntryPoint
        if (missingAccountFunds > 0) {
            (bool success, ) = payable(msg.sender).call{value: missingAccountFunds}("");
            require(success, "Prefund failed");
        }

        return validationData;
    }

    /**
     * @notice Execute a single transaction
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external onlyAuthorized {
        _call(dest, value, func);
        emit Executed(dest, value, func);
    }

    /**
     * @notice Execute a batch of transactions atomically
     */
    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external onlyAuthorized {
        require(
            dest.length == value.length && dest.length == func.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], value[i], func[i]);
        }

        emit ExecutedBatch(dest, value);
    }

    /**
     * @notice Enable a session key for WhatsApp Chat-to-Pay delegation
     */
    function enableSessionKey(
        address sessionKey,
        address token,
        address target,
        uint256 spendingLimit,
        uint48 validAfter,
        uint48 validUntil
    ) external onlyAuthorized {
        sessionKeyModule.enableSession(
            sessionKey,
            token,
            target,
            spendingLimit,
            validAfter,
            validUntil
        );
    }

    /**
     * @notice Revoke a session key immediately
     */
    function revokeSessionKey(address sessionKey) external onlyAuthorized {
        sessionKeyModule.revokeSession(sessionKey);
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    receive() external payable {}
}
