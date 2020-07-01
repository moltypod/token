// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import { BasePaymaster } from "@opengsn/gsn/contracts/BasePaymaster.sol";
import { GSNTypes } from "@opengsn/gsn/contracts/utils/GSNTypes.sol";
import { IERC777 } from "@openzeppelin/contracts/token/ERC777/IERC777.sol";
import { GsnUtils } from "@opengsn/gsn/contracts/utils/GsnUtils.sol";

contract ERC777Paymaster is BasePaymaster {
    IERC777 token;
    bytes4 sendSelector;
    address public tokenReceiver;
    uint256 minAmount;

    event PreRelayed();
    event PostRelayed(bool success, uint actualCharge, bytes32 preRetVal);

    constructor(IERC777 _token, address _tokenReceiver, uint256 _minAmount) public {
        token = _token;
        tokenReceiver = _tokenReceiver;
        sendSelector = token.send.selector;
        minAmount = _minAmount;
    }

    function versionPaymaster() external view override virtual returns (string memory){
        return "1.0.0";
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
        //    function send(address recipient, uint256 amount, bytes calldata data) external;
        (approvalData, maxPossibleCharge);

        require(
            relayRequest.target == address(token),
            "ERC777Paymaster.acceptRelayedCall: RelayRecipient should be token"
        );

        bytes4 methodSig = GsnUtils.getMethodSig(relayRequest.encodedFunction);
        require(
            sendSelector == methodSig,
            "ERC777Paymaster.acceptRelayedCall: method should be send"
        );

        address to = GsnUtils.getAddressParam(relayRequest.encodedFunction, 0);
        require(
            tokenReceiver == to,
            "ERC777Paymaster.acceptRelayedCall: send to anyone is not allowed"
        );
        uint256 amount = GsnUtils.getParam(relayRequest.encodedFunction, 1);
        require(
            amount >= minAmount,
            "ERC777Paymaster.acceptRelayedCall: amount should bigger than minAmount"
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