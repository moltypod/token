require('module-alias/register');

import * as chai from 'chai';

import BN from 'bn.js';
import ChaiSetup from '@testUtils/chaiSetup';

import { ONE, ZERO, ZERO_ADDRESS } from '@testUtils/constants';
import { e18, e1, negative, positive } from '@testUtils/units';

import { getContractLogs } from '@testUtils/printLogs';

import { ErrorRange } from '@testUtils/errorRange';

import { getWeb3 } from '@testUtils/web3Helper';
import Web3 from 'web3';

const web3: Web3 = getWeb3();

ChaiSetup.configure();
const { expect } = chai;

import { GSNHelper } from '@testUtils/GSNHelper';

import {
    GsnTokenInstance,
    TrustedForwarderInstance,
    Erc20PaymasterInstance,
    RelayHubInstance,
    IPaymasterInstance
} from '@gen/truffle-contracts';

export const gasPrice = 20000000000;

const defaultPaymasterAdded = 160000;
const erc20PaymasterAdded = 140000;

const transferGas = 37365;
const approveGas = 30182;
const transferFromGas = 47081;

import { Account, Snap, getSnapshot, snapshotDiff, Snapshot, getValue } from '@testUtils/snapshot';

export const gas = {
    "transfer": {
        "noGSN":  new ErrorRange(transferGas * gasPrice),
        "DefaultPaymaster": new ErrorRange((transferGas + defaultPaymasterAdded) * gasPrice),
        "ERC20Paymaster": new ErrorRange((transferGas + erc20PaymasterAdded) * gasPrice)
    },
    "approve": {
        "noGSN":  new ErrorRange(approveGas * gasPrice),
        "DefaultPaymaster": new ErrorRange((approveGas + defaultPaymasterAdded) * gasPrice),
        "ERC20Paymaster": new ErrorRange((approveGas + erc20PaymasterAdded) * gasPrice)
    },
    "transferFrom": {
        "noGSN":  new ErrorRange(transferFromGas * gasPrice),
        "DefaultPaymaster": new ErrorRange((transferFromGas + defaultPaymasterAdded) * gasPrice),
        "ERC20Paymaster": new ErrorRange((transferFromGas + erc20PaymasterAdded) * gasPrice)
    }
}

let gsnHelper: GSNHelper;

let relayHub: RelayHubInstance;
let gsnToken: GsnTokenInstance;
let forwarder: TrustedForwarderInstance;
let erc20Paymaster: Erc20PaymasterInstance;
let defaultPaymaster: IPaymasterInstance;

let relayManagerAddress: string;
let relayWorkerAddress: string;

let deployer: string;
let user1: string;
let user2: string;

export async function initialzeBehaviour(
    _totalSupply: BN, _minAmount: BN, _deployer: string, _user1: string, _user2: string
) : Promise<[GSNHelper, GsnTokenInstance, TrustedForwarderInstance, Erc20PaymasterInstance, IPaymasterInstance]>
{
    deployer = _deployer;
    user1 = _user1;
    user2 = _user2;

    gsnHelper = new GSNHelper();
    [gsnToken, forwarder, erc20Paymaster] = await gsnHelper.deployAll(_totalSupply, _user1, _deployer, _minAmount);
    relayHub = gsnHelper.getRelayHub();
    defaultPaymaster = await gsnHelper.getDefaultPaymaster();
    await setRelayAddress();
    await initialOperations();

    defaultPaymaster = await gsnHelper.getDefaultPaymaster();

    return [gsnHelper, gsnToken, forwarder, erc20Paymaster, defaultPaymaster];
}

function getTargetAccounts(): Account[] {
    return [
        { name: "RelayHub", address: relayHub.address },
        { name: "ERC20Paymaster", address: erc20Paymaster.address },
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

export async function transferWithGSN(
    _gsnToken: GsnTokenInstance,
    _from: string,
    _to: string,
    _transferAmount: BN,
    _paymasterAddress: string | null,
    _forwarderAddress: string | null
)
{
    const txData = gsnHelper.getGsnTxData(_from, gasPrice, _paymasterAddress, _forwarderAddress);
    const g = (_paymasterAddress == erc20Paymaster.address)
        ? gas.transfer.ERC20Paymaster : gas.transfer.DefaultPaymaster;

    await gsnEtherDiffCheck(
        async () => await transfer(_gsnToken, _from, _to, _transferAmount, txData),
        _from,
        _paymasterAddress,
        g
    );

}

export async function transferWithoutGSN(
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
        _transferAmount.neg());
    expect(getValue(gsnTokenDiff, genAccountMatch(_to))).to.be.bignumber.equal(
        positive(_transferAmount));
}

export async function approveWithGSN(
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
    const g = (_paymasterAddress == erc20Paymaster.address)
        ? gas.approve.ERC20Paymaster : gas.approve.DefaultPaymaster;

    await gsnEtherDiffCheck(async () => await tx, _from, _paymasterAddress, g);
}

export async function approveWithoutGSN(
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

export async function transferFromWithGSN(
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
    const g = (_paymasterAddress == erc20Paymaster.address)
        ? gas.transferFrom.ERC20Paymaster : gas.transferFrom.DefaultPaymaster;

    await gsnEtherDiffCheck(async () => await tx, _from, _paymasterAddress, g);
}

export async function transferFromWithoutGSN(
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
        _amount.neg());
    expect(getValue(gsnTokenDiff, genAccountMatch(_recipient))).to.be.bignumber.equal(
        positive(_amount));
}
