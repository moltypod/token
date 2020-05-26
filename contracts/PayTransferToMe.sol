// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import { BasePaymaster } from "@opengsn/gsn/contracts/BasePaymaster.sol";
import { GSNTypes } from "@opengsn/gsn/contracts/utils/GSNTypes.sol";
import { GSNToken } from "./GSNToken.sol";
import { GsnUtils } from "@opengsn/gsn/contracts/utils/GsnUtils.sol";

contract PayTransferToMe is BasePaymaster {
    event RecipientPreCall();
    event FuncInfo(bytes4 methodSig, bytes4 selector, address to, uint amount);

    event RecipientPostCall(bool success, uint actualCharge, bytes32 preRetVal);

    GSNToken gsnToken;
    bytes4 gsnTokenTransferSelector;
    address public me;

    constructor(GSNToken _gsnToken, address _me) public {
        gsnToken = _gsnToken;
        me = _me;
        gsnTokenTransferSelector = _gsnToken.transfer.selector;
    }

    function acceptRelayedCall(
        GSNTypes.RelayRequest calldata relayRequest,
        bytes calldata approvalData,
        uint256 maxPossibleCharge
    )
    external
    override
    virtual
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

        return "";
    }

    function preRelayedCall(
        bytes calldata context
    )
    external
    override
    virtual
    relayHubOnly
    returns (bytes32) {
        (context);
        emit RecipientPreCall();

        return bytes32(uint(123456));
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
    virtual
    relayHubOnly
    {
        (context, gasUseWithoutPost, gasData);
        emit RecipientPostCall(success, gasUseWithoutPost, preRetVal);
    }
}