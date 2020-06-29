// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import { BasePaymaster } from "@opengsn/gsn/contracts/BasePaymaster.sol";
import { GSNTypes } from "@opengsn/gsn/contracts/utils/GSNTypes.sol";
import { GSNToken } from "./GSNToken.sol";
import { GsnUtils } from "@opengsn/gsn/contracts/utils/GsnUtils.sol";

contract PayTransferToMe is BasePaymaster {
    function versionPaymaster() external view override virtual returns (string memory){
        return "1.0.0";
    }

    event PreRelayed();
    event PostRelayed(bool success, uint actualCharge, bytes32 preRetVal);

    GSNToken gsnToken;
    bytes4 gsnTokenTransferSelector;
    address public me;
    uint256 minAmount;

    constructor(GSNToken _gsnToken, address _me, uint256 _minAmount) public {
        gsnToken = _gsnToken;
        me = _me;
        gsnTokenTransferSelector = _gsnToken.transfer.selector;
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
            relayRequest.target == address(gsnToken),
            "PayTransferToMe.acceptRelayedCall: recipient should be GSNToken"
        );

        bytes4 methodSig = GsnUtils.getMethodSig(relayRequest.encodedFunction);
        require(
            gsnTokenTransferSelector == methodSig,
            "PayTransferToMe.acceptRelayedCall: method should be transfer"
        );

        address to = GsnUtils.getAddressParam(relayRequest.encodedFunction, 0);
        require(
            me == to,
            "PayTransferToMe.acceptRelayedCall: Transfer to anyone is not allowed"
        );
        uint256 amount = GsnUtils.getParam(relayRequest.encodedFunction, 1);
        require(
            amount >= minAmount,
            "PayTransferToMe.acceptRelayedCall: transfer amount should bigger than minAmount"
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