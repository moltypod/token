require('module-alias/register');

import * as chai from 'chai';
import BN from 'bn.js';
import ChaiSetup from '@testUtils/chaiSetup';
import { Blockchain } from '@testUtils/blockchain';
import { getWeb3 } from '@testUtils/web3Helper';

const truffleContract = require("@truffle/contract");

import { GsnTokenInstance, TrustedForwarderInstance, PayTransferToMeInstance, RelayHubInstance } from '@gen/truffle-contracts';

import { ONE, ZERO } from '@testUtils/constants';
import Web3 from 'web3';

import { ether, gWei, wei, e18, e9, e1 } from '@testUtils/units';

import { expectRevert } from '@openzeppelin/test-helpers';

import { GSNHelper } from '@testUtils/GSNHelper';

const web3: Web3 = getWeb3();
const blockchain = new Blockchain(web3.currentProvider);

ChaiSetup.configure();

const { expect } = chai;

import { Account, Snap, getSnapshot, snapshotDiff, map, Snapshot } from '@testUtils/snapshot';
import { printContractLogs, getContractLogs } from '@testUtils/printLogs';

contract("GSNToken", ([deployer, user1, user2]) => {
    const totalSupply = e18(1000000);

    let gsnHelper: GSNHelper;

    let relayHub: RelayHubInstance;
    let gsnToken: GsnTokenInstance;
    let forwarder: TrustedForwarderInstance;
    let paymaster: PayTransferToMeInstance;

    let relayManagerAddress: string;
    let relayWorkerAddress: string;

    function getTargetAccounts(): Account[] {
        return [
            { name: "RelayHub", address: relayHub.address },
            { name: "Paymaster", address: paymaster.address },
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
            async(acc) => new BN(await web3.eth.getBalance(acc.address))
        );
    }

    async function getGSNTokenBalanceSnapshot() {
        return getSnapshot(getTargetAccounts(), async(acc) => gsnToken.balanceOf(acc.address));
    }

    async function getRelayHubBalanceSnapshot() {
        return getSnapshot(getTargetAccounts(), async(acc) => relayHub.balanceOf(acc.address));
    }

    function bnDiff(v1: BN, v2: BN): string {
        return v2.sub(v1).toString();
    }

    function notZero(v: BN) : boolean {
        return v != ZERO;
    }

    async function setRelayAddress() {
        const logs = await getContractLogs(relayHub, "RelayWorkersAdded", ZERO);
        expect(logs.length).to.be.eq(1);

        const log = logs[0];
        relayManagerAddress = log.args['relayManager'];

        expect(log.args['workersCount']).to.be.eq('1');
        relayWorkerAddress= log.args['newRelayWorkers'][0];
    }

    before(async () => {
        gsnHelper = new GSNHelper();
        [gsnToken, forwarder, paymaster] = await gsnHelper.deployAll(totalSupply, user1, deployer);
        relayHub = gsnHelper.getRelayHub();

        await setRelayAddress();

        console.log("totalSupply", await gsnToken.totalSupply());
        console.log("relayhub", await gsnHelper.getRelayHub().balanceOf(paymaster.address));
    });

    beforeEach(async () => {
        await blockchain.saveSnapshotAsync();
    });

    afterEach(async () => {
        await blockchain.revertAsync();
    });

    let beforeEther: Snapshot;
    let beforeGSNToken: Snapshot;
    let beforeRelayHubBalance: Snapshot;
    beforeEach(async () => {
        beforeEther = await getEthBalanceSnapshot();
        beforeGSNToken = await getGSNTokenBalanceSnapshot();
        beforeRelayHubBalance = await getRelayHubBalanceSnapshot();
    });

    it("t1", async () => {
        // await gsnToken.transfer(user1, e18(1), { from: deployer, useGSN: false });

        // const afterEther = await getEthBalanceSnapshot();
        // const afterGSNToken = await getGSNTokenBalanceSnapshot();
        // const afterRelayHubBalance = await getRelayHubBalanceSnapshot();

        // console.log("etherdiff", snapshotDiff(beforeEther, afterEther, bnDiff, notZero));
        // console.log("gsnTokendiff", snapshotDiff(beforeGSNToken, afterGSNToken, bnDiff, notZero));
        // console.log("relayHubBalanceDiff", snapshotDiff(beforeRelayHubBalance, afterRelayHubBalance, bnDiff, notZero));
    });

    it("t2", async () => {
        await gsnHelper.setTrustedForwarder(gsnToken, forwarder, deployer);
        await gsnToken.transfer(user1, e18(1), { from: deployer, paymaster: paymaster.address, forwarder: forwarder.address });

        const afterEther = await getEthBalanceSnapshot();
        const afterGSNToken = await getGSNTokenBalanceSnapshot();
        const afterRelayHubBalance = await getRelayHubBalanceSnapshot();

        console.log("etherdiff", snapshotDiff(beforeEther, afterEther, bnDiff, notZero));
        console.log("gsnTokendiff", snapshotDiff(beforeGSNToken, afterGSNToken, bnDiff, notZero));
        console.log("relayHubBalanceDiff", snapshotDiff(beforeRelayHubBalance, afterRelayHubBalance, bnDiff, notZero));
    });


});
