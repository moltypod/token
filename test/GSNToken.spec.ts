require('module-alias/register');

import * as chai from 'chai';
import BN from 'bn.js';
import ChaiSetup from '@testUtils/chaiSetup';
import { getWeb3 } from '@testUtils/web3Helper';

import {
    GsnTokenInstance,
    TrustedForwarderInstance,
    Erc20PaymasterInstance,
    Erc777PaymasterInstance,
    IPaymasterInstance
} from '@gen/truffle-contracts';

import Web3 from 'web3';

import { e18 } from '@testUtils/units';

import { expectRevert, singletons } from '@openzeppelin/test-helpers';

import { GSNHelper } from '@testUtils/GSNHelper';

const web3: Web3 = getWeb3();

ChaiSetup.configure();

const { expect } = chai;

import {
    initialzeBehaviour,
    transferWithGSN,
    transferWithoutGSN,
    sendWithGSN,
    sendWithoutGSN,
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
    let erc20Paymaster: Erc20PaymasterInstance;
    let erc777Paymaster: Erc777PaymasterInstance;
    let defaultPaymaster: IPaymasterInstance;

    before(async () => {
        [gsnHelper, gsnToken, forwarder, erc20Paymaster, erc777Paymaster, defaultPaymaster] =
            await initialzeBehaviour(totalSupply, minAmount, deployer, user1, user2);
        await gsnHelper.fundPaymaster(erc20Paymaster, e18(1), deployer);
        await gsnHelper.fundPaymaster(erc777Paymaster, e18(1), deployer);
    });

    describe("without GSN, it should work as before", async () => {
        describe("ERC20", async () => {
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

        describe("ERC777", async () => {
            it("send should work as before", async () => {
                await sendWithoutGSN(gsnToken, deployer, user1, e18(10));
            });
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

    describe("ERC20Paymaster test", async () => {
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
                    erc20Paymaster.address,
                    _forwarder.address
                );
            }

            it("transfer should work, when user1 == ERC20Paymaster.tokenReceiver && gsnToken && amount > minAmount", async () => {
                await subject(gsnToken, forwarder, user1, e18(1));
            });

            it("transfer should NOT work, when user2 != ERC20Paymaster.tokenReceiver", async () => {
                await expectRevert(
                    subject(gsnToken, forwarder, user2, e18(1)),
                    "ERC20Paymaster.acceptRelayedCall: transfer to anyone is not allowed"
                );
            });

            it("transfer should NOT work, when RelayRecipient != target", async () => {
                const gsnToken2 = await gsnHelper.deployGSNToken(totalSupply, deployer, forwarder.address);
                await expectRevert(
                    subject(gsnToken2, forwarder, user1, e18(1)),
                    "ERC20Paymaster.acceptRelayedCall: RelayRecipient should be token"
                );
            });

            it("transfer should NOT work, when amount < minAmount", async () => {
                await expectRevert(
                    subject(gsnToken, forwarder, user1, e18(0.01)),
                    "ERC20Paymaster.acceptRelayedCall: amount should bigger than minAmount"
                );
            });
        });

        describe("other operations except transfer should NOT work", async () => {
            it("arrove should NOT work", async () => {
                const txData = gsnHelper.getGsnTxData(deployer, gasPrice, erc20Paymaster.address, forwarder.address);

                await expectRevert(
                    gsnToken.approve(user2, e18(1), txData),
                    "ERC20Paymaster.acceptRelayedCall: method should be transfer"
                );
            });

            it("transferFrom should NOT work", async () => {
                const txData = gsnHelper.getGsnTxData(deployer, gasPrice, erc20Paymaster.address, forwarder.address);

                await expectRevert(
                    gsnToken.transferFrom(user1, user2, e18(1), txData),
                    "ERC20Paymaster.acceptRelayedCall: method should be transfer"
                );
            });
        });

        describe("paymaster balance in relayHub is not enough, transfer should NOT work", async () => {
            before(async () => {
                await gsnHelper.withdrawAll(erc20Paymaster, deployer);
            });

            after(async () => {
                await gsnHelper.fundPaymaster(erc20Paymaster, e18(1), deployer);
            });

            it("test", async () => {
                await expectRevert(
                    transferWithGSN(
                        gsnToken,
                        deployer,
                        user1,
                        e18(10),
                        erc20Paymaster.address,
                        forwarder.address
                    ),
                    "Paymaster balance too low"
                );
            });
        });
    });

    describe("ERC777Paymaster test", async () => {
        describe("send test", async () => {
            async function subject(
                _gsnToken: GsnTokenInstance,
                _forwarder: TrustedForwarderInstance,
                _to: string,
                amount: BN
            )
            {
                await sendWithGSN(
                    _gsnToken,
                    deployer,
                    _to,
                    amount,
                    erc777Paymaster.address,
                    _forwarder.address
                );
            }

            it("send should work, when user1 == ERC777Paymaster.tokenReceiver && gsnToken && amount > minAmount", async () => {
                await subject(gsnToken, forwarder, user1, e18(1));
            });

            it("send should NOT work, when user2 != ERC777Paymaster.tokenReceiver", async () => {
                await expectRevert(
                    subject(gsnToken, forwarder, user2, e18(1)),
                    "ERC777Paymaster.acceptRelayedCall: send to anyone is not allowed"
                );
            });

            it("send should NOT work, when RelayRecipient != target", async () => {
                const gsnToken2 = await gsnHelper.deployGSNToken(totalSupply, deployer, forwarder.address);
                await expectRevert(
                    subject(gsnToken2, forwarder, user1, e18(1)),
                    "ERC777Paymaster.acceptRelayedCall: RelayRecipient should be token"
                );
            });

            it("send should NOT work, when amount < minAmount", async () => {
                await expectRevert(
                    subject(gsnToken, forwarder, user1, e18(0.01)),
                    "ERC777Paymaster.acceptRelayedCall: amount should bigger than minAmount"
                );
            });
        });

        describe("other operations except send should NOT work", async () => {
            it("should NOT work", async () => {
                const txData = gsnHelper.getGsnTxData(deployer, gasPrice, erc777Paymaster.address, forwarder.address);

                await expectRevert(
                    gsnToken.approve(user2, e18(1), txData),
                    "ERC777Paymaster.acceptRelayedCall: method should be send"
                );
            });
        });
    });
});
