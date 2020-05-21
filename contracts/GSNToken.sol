// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Context } from "@openzeppelin/contracts/GSN/Context.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { BaseRelayRecipient } from "@opengsn/gsn/contracts/BaseRelayRecipient.sol";

contract GSNToken is BaseRelayRecipient, ERC20("GSNToken", "GSNT") {
    constructor(uint256 _totalSupply) public {
        _mint(msg.sender, _totalSupply);
    }

    function _msgSender() 
        internal 
        override(Context, BaseRelayRecipient) 
        virtual 
        view 
        returns (address payable) 
    {
        return BaseRelayRecipient._msgSender();
    }
}

