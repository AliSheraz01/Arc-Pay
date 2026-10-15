// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ArcPaySmartAccount.sol";
import "./IEntryPoint.sol";
import "./ArcPaySessionKeyModule.sol";

/**
 * @title ArcPayAccountFactory
 * @notice Factory to deploy ArcPaySmartAccount proxies deterministically via CREATE2
 */
contract ArcPayAccountFactory {
    IEntryPoint public immutable entryPoint;
    ArcPaySessionKeyModule public immutable sessionKeyModule;

    event AccountCreated(address indexed account, address indexed owner, uint256 salt);

    constructor(IEntryPoint _entryPoint, ArcPaySessionKeyModule _sessionKeyModule) {
        entryPoint = _entryPoint;
        sessionKeyModule = _sessionKeyModule;
    }

    /**
     * @notice Deploy a new ArcPaySmartAccount for an owner if not already deployed
     */
    function createAccount(address owner, uint256 salt) external returns (ArcPaySmartAccount ret) {
        address addr = computeAccountAddress(owner, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return ArcPaySmartAccount(payable(addr));
        }

        bytes32 actualSalt = keccak256(abi.encode(owner, salt));
        ret = new ArcPaySmartAccount{salt: actualSalt}(entryPoint, sessionKeyModule);
        ret.initialize(owner);

        emit AccountCreated(address(ret), owner, salt);
    }

    /**
     * @notice Compute counterfactual address of the account before deployment
     */
    function computeAccountAddress(address owner, uint256 salt) public view returns (address) {
        bytes32 actualSalt = keccak256(abi.encode(owner, salt));
        bytes memory bytecode = abi.encodePacked(
            type(ArcPaySmartAccount).creationCode,
            abi.encode(entryPoint, sessionKeyModule)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                actualSalt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }
}
