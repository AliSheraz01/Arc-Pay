// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract ArcPayUsernameRegistry is Ownable, Pausable {
    mapping(string => address) private usernameToAddress;
    mapping(address => string) private addressToUsername;

    event UsernameRegistered(string indexed username, address indexed userAddress);

    constructor() Ownable(msg.sender) {}

    function registerUsername(string calldata _username) external whenNotPaused {
        require(bytes(_username).length > 0, "Username cannot be empty");
        require(bytes(_username).length <= 30, "Username too long");
        require(usernameToAddress[_username] == address(0), "Username already taken");
        require(bytes(addressToUsername[msg.sender]).length == 0, "Address already has a username");

        // Simple lowercase validation (basic)
        bytes memory bStr = bytes(_username);
        for (uint i = 0; i < bStr.length; i++) {
            require(
                (bStr[i] >= 0x61 && bStr[i] <= 0x7A) || // a-z
                (bStr[i] >= 0x30 && bStr[i] <= 0x39) || // 0-9
                bStr[i] == 0x5F,                        // _
                "Invalid characters in username"
            );
        }

        usernameToAddress[_username] = msg.sender;
        addressToUsername[msg.sender] = _username;

        emit UsernameRegistered(_username, msg.sender);
    }

    function resolveUsername(string calldata _username) external view returns (address) {
        return usernameToAddress[_username];
    }

    function getMyUsername() external view returns (string memory) {
        return addressToUsername[msg.sender];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
