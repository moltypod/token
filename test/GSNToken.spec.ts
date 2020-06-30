require('module-alias/register');

import * as chai from 'chai';
import BN from 'bn.js';
import ChaiSetup from '@testUtils/chaiSetup';
import { getWeb3 } from '@testUtils/web3Helper';

import {
    GsnTokenInstance,
    TrustedForwarderInstance,
    PayTransferToMeInstance,
    IPaymasterInstance
} from '@gen/truffle-contracts';

import Web3 from 'web3';

import { e18 } from '@testUtils/units';

import { expectRevert } from '@openzeppelin/test-helpers';

import { GSNHelper } from '@testUtils/GSNHelper';

const web3: Web3 = getWeb3();

ChaiSetup.configure();

const { expect } = chai;

import {
    initialzeBehaviour,
    transferWithGSN,
    transferWithoutGSN,
    approveWithGSN,
    approveWithoutGSN,
    transferFromWithGSN,
    transferFromWithoutGSN,
    gasPrice,
    gas
} from './GSNToken.behaviour';

contract("GSNToken", ([deployer, user1, user2]) => {
    const totalSupply = e18(1000000);
    const minAmount = e18(0.1);

    let gsnHelper: GSNHelper;

    let gsnToken: GsnTokenInstance;
    let forwarder: TrustedForwarderInstance;
    let payTransferToMe: PayTransferToMeInstance;
    let defaultPaymaster: IPaymasterInstance;

    before(async () => {
        [gsnHelper, gsnToken, forwarder, payTransferToMe, defaultPaymaster] =
            await initialzeBehaviour(totalSupply, minAmount, deployer, user1, user2);
    });

    // describe("gsn 사용하지 않는 경우, 기존과 같이 동작", async () => {
    describe("without GSN, it should work as before", async () => {
        it("transfer should work as before", async () => {
            await transferWithoutGSN(gsnToken, deployer, user1, e18(10));
        });

        it("approve should work as before", async () => {
            await approveWithoutGSN(gsnToken, deployer, user1, e18(10));
        });

        it("transferFrom should work as before", async () => {
            await transferFromWithoutGSN(gsnToken, user1, deployer, user2, e18(5), gas.transferFrom.noGSN);
        });
    });

    describe("with GSN and default paymaster, it should work in no gas fee.", async () => {
        it("transfer should work", async () => {
            await transferWithGSN(gsnToken, deployer, user1, e18(10), defaultPaymaster.address, forwarder.address);
        });

        it("approve should work", async () => {
            await approveWithGSN(gsnToken, deployer, user1, e18(10), defaultPaymaster.address, forwarder.address);
        });

        it("transferFrom should work", async () => {
            await transferFromWithGSN(gsnToken, user1, deployer, user2, e18(5), defaultPaymaster.address, forwarder.address);
        });

        it("undesignated forwarder from the client-side should work.", async () => {
            await transferWithGSN(gsnToken, deployer, user1, e18(1), defaultPaymaster.address, null);
        });
    });

    describe("general error cases", async () => {
        it("undesignated paymaster from the client-side should NOT work", async () => {
            await expectRevert(transferWithGSN(
                gsnToken,
                deployer,
                user1,
                e18(1),
                null,
                forwarder.address
            ), "expected null not to be null");
        });

        it("wrong forwarder address from the client-side should NOT work", async () => {
            await expectRevert(transferWithGSN(
                gsnToken,
                deployer,
                user1,
                e18(1),
                defaultPaymaster.address,
                user2
            ), "Error: The Forwarder address configured but is not trusted by the Recipient contract");
        });

        it("another forwarder address from the client-side should NOT work", async () => {
            await expectRevert(transferWithGSN(
                gsnToken,
                deployer,
                user1,
                e18(1),
                defaultPaymaster.address,
                await gsnHelper.getDefaultForwarderAddress()
            ), "Error: The Forwarder address configured but is not trusted by the Recipient contract");
        });
    });

    describe("PayTransferToMe test", async () => {
        describe("transfer test", async () => {
            async function subject(
                _gsnToken: GsnTokenInstance,
                _forwarder: TrustedForwarderInstance,
                _to: string,
                amount: BN
            )
            {
                await transferWithGSN(
                    _gsnToken,
                    deployer,
                    _to,
                    amount,
                    payTransferToMe.address,
                    _forwarder.address
                );
            }

            it("transfer shoudl work, when user1 == PayTransferToMe.me && gsnToken && amount > minAmount", async () => {
                await subject(gsnToken, forwarder, user1, e18(1));
            });

            it("transfer should NOT work, when user2 != PayTransferToMe.me", async () => {
                await expectRevert(
                    subject(gsnToken, forwarder, user2, e18(1)),
                    "PayTransferToMe.acceptRelayedCall: Transfer to anyone is not allowed"
                );
            });

            it("transfer should NOT work, when recipient != gsnToken", async () => {
                const gsnToken2 = await gsnHelper.deployGSNToken(totalSupply, deployer, forwarder.address);
                await expectRevert(
                    subject(gsnToken2, forwarder, user1, e18(1)),
                    "PayTransferToMe.acceptRelayedCall: recipient should be GSNToken"
                );
            });

            it("transfer should NOT work, when amount < minAmount", async () => {
                await expectRevert(
                    subject(gsnToken, forwarder, user1, e18(0.01)),
                    "PayTransferToMe.acceptRelayedCall: transfer amount should bigger than minAmount"
                );
            });
        });

        describe("other operations except transfer should NOT work", async () => {
            const txData = gsnHelper.getGsnTxData(deployer, gasPrice, payTransferToMe.address, forwarder.address);

            it("arrove should NOT work", async () => {
                await expectRevert(
                    gsnToken.approve(user2, e18(1), txData),
                    "PayTransferToMe.acceptRelayedCall: method should be transfer"
                );
            });

            it("transferFrom should NOT work", async () => {
                await expectRevert(
                    gsnToken.transferFrom(user1, user2, e18(1), txData),
                    "PayTransferToMe.acceptRelayedCall: method should be transfer"
                );
            });
        });

        describe("paymaster balance in relayHub is not enough, transfer should NOT work", async () => {
            before(async () => {
                await gsnHelper.withdrawAll(payTransferToMe, deployer);
            });

            after(async () => {
                await gsnHelper.fundPaymaster(payTransferToMe, e18(1), deployer);
            });

            it("test", async () => {
                await expectRevert(
                    transferWithGSN(
                        gsnToken,
                        deployer,
                        user1,
                        e18(10),
                        payTransferToMe.address,
                        forwarder.address
                    ),
                    "Paymaster balance too low"
                );
            });
        });
    });
});
