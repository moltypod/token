// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import { BasePaymaster } from "@opengsn/gsn/contracts/BasePaymaster.sol";
import { GSNTypes } from "@opengsn/gsn/contracts/utils/GSNTypes.sol";
import { GSNToken } from "./GSNToken.sol";

contract PayTransferToMe is BasePaymaster {
    event RecipientPreCall();
    event FuncInfo(bytes4 selector, address to, uint amount);

    event RecipientPostCall(bool success, uint actualCharge, bytes32 preRetVal);

    GSNToken gsnToken;
    address me;

    constructor(GSNToken _gsnToken, address _me) public {
        gsnToken = _gsnToken;
        me = _me;
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
        /*
        체크해야 할 것
        1. RelayRequest.target이 GSNToken contract address 인지?
        2. RelayRequest.encodedFunction이 transfer 인지? 그리고 to가 자신인지?
        3. RelayRequest.relayData.
        */
        // return relayRequest.encodedFunction;
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

        // (bytes4 selector, address to, uint amount) = abi.decode(context, (bytes4, address, uint));
        // emit FuncInfo(selector, to, amount);
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