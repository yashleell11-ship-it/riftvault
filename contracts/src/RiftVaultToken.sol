// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title RiftVaultToken (RVLT)
/// @notice Utility token for RiftVault platform — not a security, no yield guarantees.
contract RiftVaultToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18; // 100M RVLT

    constructor() ERC20("RiftVault Token", "RVLT") {
        // Initial mint to deployer for airdrop / liquidity seeding
        _mint(msg.sender, 10_000_000 * 1e18); // 10M
    }

    /// @notice Mint additional tokens, up to MAX_SUPPLY. Only callable by owner.
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "RVLT: cap exceeded");
        _mint(to, amount);
    }
}
