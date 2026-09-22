// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ArcPayUsernameRegistry
/// @notice Production-grade username registry for EasyZPay on Arc Mainnet.
/// Registration is 100% free for users (no protocol fee, only network gas in USDC).
contract ArcPayUsernameRegistry is Ownable, Pausable {
    mapping(string => address) private _usernameToAddress;
    mapping(address => string) private _addressToUsername;

    // Notice: owner is indexed, username is unindexed string so it is directly readable by indexers
    event UsernameRegistered(address indexed owner, string username);
    event UsernameTransferred(address indexed oldOwner, address indexed newOwner, string username);

    constructor() Ownable(msg.sender) {}

    /// @notice Register a free on-chain username for the caller's address
    /// @param _username Lowercase username with safe characters (a-z, 0-9, _)
    function registerUsername(string calldata _username) external whenNotPaused {
        bytes memory bStr = bytes(_username);
        require(bStr.length >= 3, "Username must be at least 3 characters");
        require(bStr.length <= 30, "Username too long (max 30)");
        require(_usernameToAddress[_username] == address(0), "Username already taken");
        require(bytes(_addressToUsername[msg.sender]).length == 0, "Address already has a username");

        // Validate characters: strictly a-z, 0-9, and _
        for (uint256 i = 0; i < bStr.length; i++) {
            bytes1 char = bStr[i];
            bool isValid = (char >= 0x61 && char <= 0x7A) || // a-z
                           (char >= 0x30 && char <= 0x39) || // 0-9
                           (char == 0x5F);                   // _
            require(isValid, "Username contains invalid characters (allowed: a-z, 0-9, _)");
        }

        _usernameToAddress[_username] = msg.sender;
        _addressToUsername[msg.sender] = _username;

        emit UsernameRegistered(msg.sender, _username);
    }

    /// @notice Resolve a username to its owner wallet address
    /// @param _username The username to resolve
    function resolveUsername(string calldata _username) external view returns (address) {
        return _usernameToAddress[_username];
    }

    /// @notice Get the registered username of any address
    /// @param _user The address to look up
    function usernameOf(address _user) external view returns (string memory) {
        return _addressToUsername[_user];
    }

    /// @notice Convenience function returning caller's registered username
    function getMyUsername() external view returns (string memory) {
        return _addressToUsername[msg.sender];
    }

    /// @notice Check if a username is already taken
    /// @param _username The username to query
    function isRegistered(string calldata _username) external view returns (bool) {
        return _usernameToAddress[_username] != address(0);
    }

    /// @notice Pause registry operations in case of emergency
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause registry operations
    function unpause() external onlyOwner {
        _unpause();
    }
}
