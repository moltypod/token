require('module-alias/register');

import * as chai from 'chai';
import BN from 'bn.js';
import ChaiSetup from '@testUtils/chaiSetup';
import { getWeb3 } from '@testUtils/web3Helper';

import { GsnTokenInstance, TrustedForwarderInstance, PayTransferToMeInstance, RelayHubInstance, IPaymasterInstance } from '@gen/truffle-contracts';

import Web3 from 'web3';

import { e18 } from '@testUtils/units';

import { expectRevert } from '@openzeppelin/test-helpers';

import { GSNHelper } from '@testUtils/GSNHelper';

const web3: Web3 = getWeb3();
// const blockchain = new Blockchain(web3.currentProvider);

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

    let gsnHelper: GSNHelper;

    let gsnToken: GsnTokenInstance;
    let forwarder: TrustedForwarderInstance;
    let payTransferToMe: PayTransferToMeInstance;
    let defaultPaymaster: IPaymasterInstance;


    before(async () => {
        [gsnHelper, gsnToken, forwarder, payTransferToMe, defaultPaymaster] =
            await initialzeBehaviour(totalSupply, deployer, user1, user2);
    });

    beforeEach(async () => {
    });

    afterEach(async () => {
    });


    describe("gsn 사용하지 않는 경우, 기존과 같이 동작", async () => {
        it("transfer 정상동작", async () => {
            await transferWithoutGSN(gsnToken, deployer, user1, e18(10));
        });

        it("approve 정상동작", async () => {
            await approveWithoutGSN(gsnToken, deployer, user1, e18(10));
        });

        it("transferFrom 정상동작", async () => {
            await transferFromWithoutGSN(gsnToken, user1, deployer, user2, e18(5), gas.transferFrom.noGSN);
        });
    });

    describe("gsn 사용하는 경우 정상 동작. (default paymaster)", async () => {
        it("transfer 정상동작", async () => {
            await transferWithGSN(gsnToken, deployer, user1, e18(10), defaultPaymaster.address, forwarder.address);
        });

        it("approve 정상동작", async () => {
            await approveWithGSN(gsnToken, deployer, user1, e18(10), defaultPaymaster.address, forwarder.address);
        });

        it("transferFrom 정상동작", async () => {
            await transferFromWithGSN(gsnToken, user1, deployer, user2, e18(5), defaultPaymaster.address, forwarder.address);
        });

        it("forwarder를 지정하지 않는 경우", async () => {
            await transferWithGSN(gsnToken, deployer, user1, e18(1), defaultPaymaster.address, null);
        });
    });

    describe("relayHub 관련 실패 케이스 검증", async () => {
        it("paymaster가 설정되어 있지 않은 경우", async () => {
            await expectRevert(transferWithGSN(
                gsnToken,
                deployer,
                user1,
                e18(1),
                null,
                forwarder.address
            ), "expected null not to be null");
        });

        it("forwarder가 잘못된 주소를 가진 경우", async () => {
            await expectRevert(transferWithGSN(
                gsnToken,
                deployer,
                user1,
                e18(1),
                defaultPaymaster.address,
                user2
            ), "Error: The Forwarder address configured but is not trusted by the Recipient contract");
        });

        it("forwarder가 다른 forwarder 주소를 가진 경우", async () => {
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

    describe("PayTransferToMe 검증", async () => {
        describe("transfer 검증", async () => {
            async function subject(_gsnToken: GsnTokenInstance, _forwarder: TrustedForwarderInstance, _to: string) {
                await transferWithGSN(
                    _gsnToken,
                    deployer,
                    _to,
                    e18(10),
                    payTransferToMe.address,
                    _forwarder.address
                );
            }

            it("transfer 정상동작, user1 == PayTransferToMe.me && gsnToken 일 경우", async () => {
                await subject(gsnToken, forwarder, user1);
            });

            it("transfer 실패, user2 != PayTransferToMe.me", async () => {
                await expectRevert(
                    subject(gsnToken, forwarder, user2),
                    "PayTransferToMe.acceptRelayedCall: Transfer to anyone is not allowed"
                );
            });

            it("transfer 실패, gsnToken이 다를경우", async () => {
                const gsnToken2 = await gsnHelper.deployGSNToken(totalSupply, deployer, forwarder.address);
                await expectRevert(
                    subject(gsnToken2, forwarder, user1),
                    "PayTransferToMe.acceptRelayedCall: recipient should be GSNToken"
                );
            });
        });

        describe("transfer외 다른 동작 실패", async () => {
            it("arrove && transferFrom 실패", async () => {
                const txData = gsnHelper.getGsnTxData(deployer, gasPrice, payTransferToMe.address, forwarder.address);
                await expectRevert(
                    gsnToken.approve(user2, e18(1), txData),
                    "PayTransferToMe.acceptRelayedCall: method should be transfer"
                );
                await expectRevert(
                    gsnToken.transferFrom(user1, user2, e18(1), txData),
                    "PayTransferToMe.acceptRelayedCall: method should be transfer"
                );
            });
        });

        describe("paymaster balance가 relayHub에 부족한 경우", async () => {
            before(async () => {
                await gsnHelper.withdrawAll(payTransferToMe, deployer);
            });

            after(async () => {
                await gsnHelper.fundPaymaster(payTransferToMe, e18(1), deployer);
            });

            it("실패", async () => {
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
