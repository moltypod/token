// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import { ERC777 } from "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import { Context } from "@openzeppelin/contracts/GSN/Context.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { BaseRelayRecipient } from "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import { IKnowForwarderAddress } from "@opengsn/gsn/contracts/interfaces/IKnowForwarderAddress.sol";

contract GSNToken is Context, ERC777, BaseRelayRecipient, IKnowForwarderAddress {
    constructor(
        uint256 _totalSupply,
        address _trustedForwarder
    )
        public
        ERC777("GSNToken", "GSNT", new address[](0))
    {
        _mint(msg.sender, _totalSupply, "", "");
        setTrustedForwarder(_trustedForwarder);
    }

    function versionRecipient() external view override virtual returns (string memory){
        return "1.0.0";
    }

    function setTrustedForwarder(address _trustedForwarder) internal {
        trustedForwarder = _trustedForwarder;
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

