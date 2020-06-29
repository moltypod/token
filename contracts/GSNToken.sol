// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Context } from "@openzeppelin/contracts/GSN/Context.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { BaseRelayRecipient } from "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import { IKnowForwarderAddress } from "@opengsn/gsn/contracts/interfaces/IKnowForwarderAddress.sol";

contract GSNToken is Ownable, BaseRelayRecipient, IKnowForwarderAddress, ERC20("GSNToken", "GSNT") {
    function versionRecipient() external view override virtual returns (string memory){
        return "1.0.0";
    }

    event newForwarder(address indexed newForwarder);

    constructor(uint256 _totalSupply) public {
        _mint(msg.sender, _totalSupply);
    }

    function setTrustedForwarder(address _trustedForwarder) external onlyOwner {
        trustedForwarder = _trustedForwarder;
        emit newForwarder(_trustedForwarder);
    }

    function ttt() external {

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

    function getTrustedForwarder() public view override returns(address) {
        return trustedForwarder;
    }
}

