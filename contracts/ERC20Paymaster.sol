// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import { BasePaymaster } from "@opengsn/gsn/contracts/BasePaymaster.sol";
import { GSNTypes } from "@opengsn/gsn/contracts/utils/GSNTypes.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { GsnUtils } from "@opengsn/gsn/contracts/utils/GsnUtils.sol";

contract ERC20Paymaster is BasePaymaster {
    function versionPaymaster() external view override virtual returns (string memory){
        return "1.0.0";
    }

    event PreRelayed();
    event PostRelayed(bool success, uint actualCharge, bytes32 preRetVal);

    IERC20 token;
    bytes4 transferSelector;
    address public target;
    uint256 minAmount;

    constructor(IERC20 _token, address _target, uint256 _minAmount) public {
        token = _token;
        target = _target;
        transferSelector = token.transfer.selector;
        minAmount = _minAmount;
    }

    function acceptRelayedCall(
        GSNTypes.RelayRequest calldata relayRequest,
        bytes calldata signature,
        bytes calldata approvalData,
        uint256 maxPossibleCharge
    )
    external
    override
    view
    returns (bytes memory) {
        (relayRequest, approvalData, maxPossibleCharge);

        require(
            relayRequest.target == address(token),
            "ERC20Paymaster.acceptRelayedCall: recipient should be token"
        );

        bytes4 methodSig = GsnUtils.getMethodSig(relayRequest.encodedFunction);
        require(
            transferSelector == methodSig,
            "ERC20Paymaster.acceptRelayedCall: method should be transfer"
        );

        address to = GsnUtils.getAddressParam(relayRequest.encodedFunction, 0);
        require(
            target == to,
            "ERC20Paymaster.acceptRelayedCall: Transfer to anyone is not allowed"
        );
        uint256 amount = GsnUtils.getParam(relayRequest.encodedFunction, 1);
        require(
            amount >= minAmount,
            "ERC20Paymaster.acceptRelayedCall: transfer amount should bigger than minAmount"
        );

        return "";
    }

    function preRelayedCall(
        bytes calldata context
    )
    external
    override
    relayHubOnly
    returns (bytes32) {
        (context);
        emit PreRelayed();

        return bytes32(uint(0));
    }

    function postRelayedCall(
        bytes calldata context,
        bool success,
        bytes32 preRetVal,
        uint256 gasUseWithoutPost,
        GSNTypes.GasData calldata gasData
    )
    external
    override
    relayHubOnly
    {
        (context, gasUseWithoutPost, gasData);
        emit PostRelayed(success, gasUseWithoutPost, preRetVal);
    }
}