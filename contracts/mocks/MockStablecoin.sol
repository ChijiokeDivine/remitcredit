// SPDX-License-Identifier: MIT
// contracts/mocks/MockStablecoin.sol
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Simple 6-decimal mintable stablecoin stand-in (mirrors USDC's
///         decimals) for testnet demos — both as the "remittance" asset on
///         the source chain and as the loan currency on Creditcoin. Not for
///         mainnet use; swap `loanToken` in RemittanceMicroLoan for a real
///         asset there.
contract MockStablecoin is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;

    constructor(address initialOwner) ERC20("Mock USD", "mUSD") Ownable(initialOwner) {}

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
