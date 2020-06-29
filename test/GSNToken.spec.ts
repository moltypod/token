require('module-alias/register');
import * as chai from 'chai';
import BN from 'bn.js';
import ChaiSetup from '@testUtils/chaiSetup';
import { Blockchain } from '@testUtils/blockchain';
import { getWeb3 } from '@testUtils/web3Helper';

import { GsnTokenInstance, TrustedForwarderInstance, PayTransferToMeInstance, RelayHubInstance, IPaymasterInstance } from '@gen/truffle-contracts';

import { ONE, ZERO, ZERO_ADDRESS } from '@testUtils/constants';
import Web3 from 'web3';

import { ether, gWei, wei, weiToEther, e18, e9, e1, toE18, negative, positive } from '@testUtils/units';

import { expectRevert } from '@openzeppelin/test-helpers';

import { GSNHelper } from '@testUtils/GSNHelper';

const web3: Web3 = getWeb3();
// const blockchain = new Blockchain(web3.currentProvider);

ChaiSetup.configure();

const { expect } = chai;

import { Account, Snap, getSnapshot, snapshotDiff, Snapshot, getValue } from '@testUtils/snapshot';
import { printContractLogs, getContractLogs } from '@testUtils/printLogs';

import { ErrorRange } from '@testUtils/errorRange';
import { getHeapSnapshot } from 'v8';
import { DEFAULT_MAX_VERSION } from 'tls';

contract("GSNToken", ([deployer, user1, user2]) => {
    const totalSupply = e18(1000000);

    let gsnHelper: GSNHelper;

    let relayHub: RelayHubInstance;
    let gsnToken: GsnTokenInstance;
    let forwarder: TrustedForwarderInstance;
    let payTransferToMe: PayTransferToMeInstance;
    let defaultPaymaster: IPaymasterInstance;

    let relayManagerAddress: string;
    let relayWorkerAddress: string;

    function getTargetAccounts(): Account[] {
        return [
            { name: "RelayHub", address: relayHub.address },
            { name: "PayTransferToMe", address: payTransferToMe.address },
            { name: "DefaultPaymaster", address: defaultPaymaster.address },
            { name: "Forwarder", address: forwarder.address },
            { name: "gsnToken", address: gsnToken.address },
            { name: "deployer", address: deployer },
            { name: "user1", address: user1 },
            { name: "user2", address: user2 },
            { name: "relayManager", address: relayManagerAddress },
            { name: "relayWorker", address: relayWorkerAddress }
        ];
    }

    async function getEthBalanceSnapshot() {
        return getSnapshot(
            getTargetAccounts(),
            async(_acc) => new BN(await web3.eth.getBalance(_acc.address))
        );
    }

    async function getGSNTokenBalanceSnapshot(_gsnToken: GsnTokenInstance) {
        return getSnapshot(getTargetAccounts(), async(_acc) => _gsnToken.balanceOf(_acc.address));
    }

    async function getRelayHubBalanceSnapshot() {
        return getSnapshot(getTargetAccounts(), async(_acc) => relayHub.balanceOf(_acc.address));
    }

    async function getGSNTOkenAllowanceSnapshot(_gsnToken: GsnTokenInstance, _owner: string) {
        return getSnapshot(
            getTargetAccounts(),
            async(_acc) => _gsnToken.allowance(_owner, _acc.address)
        );
    }

    function bnDiff(_v1: BN, _v2: BN): string {
        return _v2.sub(_v1).toString();
    }

    function notZero(_v: BN) : boolean {
        return _v != ZERO;
    }

    function genAccountMatch(_name: string) {
        function intAccountMatch(_account: Account): boolean {
            return _account.address == _name;
        }
        return intAccountMatch;
    }

    async function setRelayAddress() {
        const logs = await getContractLogs(relayHub, "RelayWorkersAdded", ZERO);
        expect(logs.length).to.be.eq(1);

        const log = logs[0];
        relayManagerAddress = log.args['relayManager'];

        expect(log.args['workersCount']).to.be.eq('1');
        relayWorkerAddress= log.args['newRelayWorkers'][0];
    }

    async function initialOperations() {
        let promiseList = [];

        promiseList.push( gsnToken.transfer(user1, e18(1), { from: deployer, useGSN: false }) );
        promiseList.push( gsnToken.transfer(user2, e18(1), { from: deployer, useGSN: false }) );

        promiseList.push( gsnToken.approve(user1, e1(1), { from: deployer, useGSN: false }) );
        promiseList.push( gsnToken.approve(user2, e1(1), { from: deployer, useGSN: false }) );

        promiseList.push( gsnToken.approve(deployer, e1(1), { from: user1, useGSN: false }) );
        promiseList.push( gsnToken.approve(user2, e1(1), { from: user1, useGSN: false }) );

        promiseList.push( gsnToken.approve(deployer, e1(1), { from: user2, useGSN: false }) );
        promiseList.push( gsnToken.approve(user1, e1(1), { from: user2, useGSN: false }) );

        await Promise.all(promiseList);
    }

    before(async () => {
        gsnHelper = new GSNHelper();
        [gsnToken, forwarder, payTransferToMe] = await gsnHelper.deployAll(totalSupply, user1, deployer);
        relayHub = gsnHelper.getRelayHub();
        defaultPaymaster = await gsnHelper.getDefaultPaymaster();
        await setRelayAddress();
        await initialOperations();
    });

    beforeEach(async () => {
    });

    afterEach(async () => {
    });

    const gasPrice = 20000000000;

    const defaultPaymasterAdded = 140000;
    // const payTransferToMeAdded = 179606;
    const payTransferToMeAdded = 140000;

    const transferGas = 37365;
    const approveGas = 30182;
    const transferFromGas = 47081;

    const gas = {
        "transfer": {
            "noGSN":  new ErrorRange(transferGas * gasPrice),
            "DefaultPaymaster": new ErrorRange((transferGas + defaultPaymasterAdded) * gasPrice),
            "PayTransferToMe": new ErrorRange((transferGas + payTransferToMeAdded) * gasPrice)
        },
        "approve": {
            "noGSN":  new ErrorRange(approveGas * gasPrice),
            "DefaultPaymaster": new ErrorRange((approveGas + defaultPaymasterAdded) * gasPrice),
            "PayTransferToMe": new ErrorRange((approveGas + payTransferToMeAdded) * gasPrice)
        },
        "transferFrom": {
            "noGSN":  new ErrorRange(transferFromGas * gasPrice),
            "DefaultPaymaster": new ErrorRange((transferFromGas + defaultPaymasterAdded) * gasPrice),
            "PayTransferToMe": new ErrorRange((transferFromGas + payTransferToMeAdded) * gasPrice)
        }
    }

    async function gsnEtherDiffCheck(
        tx: () => Promise<any>,
        _from: string,
        _paymasterAddress: string | null,
        _gas: ErrorRange
    )
    {
        const beforeEther = await getEthBalanceSnapshot();
        const beforeRelayHubBalance = await getRelayHubBalanceSnapshot();

        await tx();

        const afterEther = await getEthBalanceSnapshot();
        const afterRelayHubBalance = await getRelayHubBalanceSnapshot();

        const etherDiff = snapshotDiff(beforeEther, afterEther, bnDiff, notZero);

        expect(
            getValue(etherDiff, genAccountMatch(_from))
        ).is.to.null;

        const relayHubBalanceDiff = snapshotDiff(beforeRelayHubBalance, afterRelayHubBalance, bnDiff, notZero);

        expect(_paymasterAddress).is.not.null;
        expect(
            getValue(relayHubBalanceDiff, genAccountMatch(_paymasterAddress!))
        ).to.be.bignumber.gte(_gas.negMin).lte(_gas.negMax);
    }

    async function noGSNEtherDiffCheck(tx: () => Promise<any>, _from: string, _gas: ErrorRange) {
        const beforeEther = await getEthBalanceSnapshot();
        const beforeRelayHubBalance = await getRelayHubBalanceSnapshot();

        await tx();

        const afterEther = await getEthBalanceSnapshot();
        const afterRelayHubBalance = await getRelayHubBalanceSnapshot();

        const etherDiff = snapshotDiff(beforeEther, afterEther, bnDiff, notZero);

        expect(etherDiff.length).to.be.equal(1);
        expect(etherDiff[0].account.address).to.be.equal(_from);

        expect(
            etherDiff[0].value
        ).to.be.bignumber.gte(_gas.negMin).lte(_gas.negMax);

        const relayHubBalanceDiff = snapshotDiff(beforeRelayHubBalance, afterRelayHubBalance, bnDiff, notZero);
        expect(relayHubBalanceDiff.length).to.be.equal(0);
    }

    async function transferWithGSN(
        _gsnToken: GsnTokenInstance,
        _from: string,
        _to: string,
        _transferAmount: BN,
        _paymasterAddress: string | null,
        _forwarderAddress: string | null
    )
    {
        const txData = gsnHelper.getGsnTxData(_from, gasPrice, _paymasterAddress, _forwarderAddress);
        const g = (_paymasterAddress == payTransferToMe.address)
            ? gas.transfer.PayTransferToMe : gas.transfer.DefaultPaymaster;

        await gsnEtherDiffCheck(
            async () => await transfer(_gsnToken, _from, _to, _transferAmount, txData),
            _from,
            _paymasterAddress,
            g
        );

    }

    async function transferWithoutGSN(
        _gsnToken: GsnTokenInstance,
        _from: string,
        _to: string,
        _transferAmount: BN
    )
    {
        const data = { from: _from, useGSN: false, gasPrice: gasPrice };
        const tx = transfer(_gsnToken, _from, _to, _transferAmount, data);
        await noGSNEtherDiffCheck(
            async () => await tx,
            _from,
            gas.transfer.noGSN
        );
    }

    async function transfer(
        _gsnToken: GsnTokenInstance,
        _from: string,
        _to: string,
        _transferAmount: BN,
        _data: Truffle.TransactionDetails
    )
    {
        const beforeGSNToken = await getGSNTokenBalanceSnapshot(_gsnToken);

        await _gsnToken.transfer(_to, _transferAmount, _data);

        const afterGSNToken = await getGSNTokenBalanceSnapshot(_gsnToken);
        const gsnTokenDiff = snapshotDiff(beforeGSNToken, afterGSNToken, bnDiff, notZero);

        expect(gsnTokenDiff.length).to.be.equal(2);
        expect(getValue(gsnTokenDiff, genAccountMatch(_from))).to.be.bignumber.equal(
            negative(_transferAmount));
        expect(getValue(gsnTokenDiff, genAccountMatch(_to))).to.be.bignumber.equal(
            positive(_transferAmount));
    }

    async function approveWithGSN(
        _gsnToken: GsnTokenInstance,
        _from: string,
        _spender: string,
        _amount: BN,
        _paymasterAddress: string | null,
        _forwarderAddress: string | null
    )
    {
        const txData = gsnHelper.getGsnTxData(_from, gasPrice, _paymasterAddress, _forwarderAddress);
        const tx = approve(_gsnToken, _spender, _amount, txData);
        const g = (_paymasterAddress == payTransferToMe.address)
            ? gas.approve.PayTransferToMe : gas.approve.DefaultPaymaster;

        await gsnEtherDiffCheck(async () => await tx, _from, _paymasterAddress, g);
    }

    async function approveWithoutGSN(
        _gsnToken: GsnTokenInstance,
        _from: string,
        _spender: string,
        _amount: BN
    )
    {
        const data = { from: _from, useGSN: false, gasPrice: gasPrice};
        const tx = approve(_gsnToken, _spender, _amount, data);

        await noGSNEtherDiffCheck(async () => await tx, _from, gas.approve.noGSN);
    }

    async function approve(
        _gsnToken: GsnTokenInstance,
        _spender: string,
        _amount: BN,
        _data: Truffle.TransactionDetails
    )
    {
        await _gsnToken.approve(_spender, _amount, _data);

        const from = _data.from!;
        expect(await _gsnToken.allowance(from, _spender)).to.be.bignumber.eq(_amount);
    }

    async function transferFromWithGSN(
        _gsnToken: GsnTokenInstance,
        _from: string,
        _spender: string,
        _recipient: string,
        _amount: BN,
        _paymasterAddress: string | null,
        _forwarderAddress: string | null
    )
    {
       const txData = gsnHelper.getGsnTxData(_from, gasPrice, _paymasterAddress, _forwarderAddress);
       const tx = transferFrom(_gsnToken, _spender, _recipient, _amount, txData);
       const g = (_paymasterAddress == payTransferToMe.address)
           ? gas.transferFrom.PayTransferToMe : gas.transferFrom.DefaultPaymaster;

       await gsnEtherDiffCheck(async () => await tx, _from, _paymasterAddress, g);
    }

    async function transferFromWithoutGSN(
        _gsnToken: GsnTokenInstance,
        _from: string,
        _spender: string,
        _recipient: string,
        _amount: BN,
        _gas: ErrorRange
    )
    {
        const data = { from: _from, useGSN: false, gasPrice: gasPrice };
        const tx = transferFrom(_gsnToken, _spender, _recipient, _amount, data);

        await noGSNEtherDiffCheck(async () => await tx, _from, gas.transferFrom.noGSN);
    }

    async function transferFrom(
        _gsnToken: GsnTokenInstance,
        _spender: string,
        _recipient: string,
        _amount: BN,
        _data: Truffle.TransactionDetails
    )
    {
        const from = _data.from!;
        const beforeAllowance = await getGSNTOkenAllowanceSnapshot(_gsnToken, _spender);
        const beforeGSNToken = await getGSNTokenBalanceSnapshot(_gsnToken);

        await _gsnToken.transferFrom(_spender, _recipient, _amount, _data);

        const afterAllowance = await getGSNTOkenAllowanceSnapshot(_gsnToken, _spender);
        const afterGSNToken = await getGSNTokenBalanceSnapshot(_gsnToken);

        const allowanceDiff = snapshotDiff(beforeAllowance, afterAllowance, bnDiff, notZero);
        expect(allowanceDiff.length).to.be.equal(1);
        expect(allowanceDiff[0].account.address).to.be.equal(from);
        expect(allowanceDiff[0].value).to.be.bignumber.equal(negative(_amount));

        const gsnTokenDiff = snapshotDiff(beforeGSNToken, afterGSNToken, bnDiff, notZero);

        expect(gsnTokenDiff.length).to.be.equal(2);
        expect(getValue(gsnTokenDiff, genAccountMatch(_spender))).to.be.bignumber.equal(
            negative(_amount));
        expect(getValue(gsnTokenDiff, genAccountMatch(_recipient))).to.be.bignumber.equal(
            positive(_amount));
    }

    describe.skip("gsn 사용하지 않는 경우, 기존과 같이 동작", async () => {
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
        let paymasterAddress = "";

        before(async () => {
            paymasterAddress = defaultPaymaster.address;
        });

        it("transfer 정상동작", async () => {
            await transferWithGSN(gsnToken, deployer, user1, e18(10), paymasterAddress, forwarder.address);
        });

        it.skip("approve 정상동작", async () => {
            await approveWithGSN(gsnToken, deployer, user1, e18(10), paymasterAddress, forwarder.address);
        });

        it.skip("transferFrom 정상동작", async () => {
            await transferFromWithGSN(gsnToken, user1, deployer, user2, e18(5), paymasterAddress, forwarder.address);
        });
    });

    describe.skip("relayHub 관련 실패 케이스 검증", async () => {
        it("paymaster가 설정되어 있지 않은 경우", async () => {
            await expectRevert(transferWithGSN(
                gsnToken,
                deployer,
                user1,
                e18(100),
                null,
                forwarder.address
            ), "Error: Cannot create instance of IPaymaster;");
        });

        it.skip("forwarder가 없는 경우", async () => {
        });

        it.skip("forwarder가 잘못된 주소를 가진 경우", async () => {
        });
    });

    describe.skip("PayTransferToMe 검증", async () => {
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
