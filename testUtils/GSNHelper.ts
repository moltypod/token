require('module-alias/register');

import BN from 'bn.js';

const truffleContract = require("@truffle/contract");

import { GsnTokenInstance, IPaymasterInstance } from '@gen/truffle-contracts';

import { e18 } from '@testUtils/units';

import {
    RelayHubInstance,
    Erc20PaymasterInstance,
    StakeManagerInstance,
    TrustedForwarderInstance
} from '@gen/truffle-contracts';

const { RelayProvider } = require('@opengsn/gsn');
const relayHubContract: any = truffleContract(require("../build/contracts/RelayHub.json"));
const stakeManagerContract: any = truffleContract(require("../build/contracts/StakeManager.json"));
const iPaymasterContract: any =  truffleContract(require("../build/contracts/IPaymaster.json"));
const forwarderContract: any = artifacts.require("TrustedForwarder");
const gsnTokenContract: any = artifacts.require("GSNToken");
const erc20PaymasterContract: any = artifacts.require("ERC20Paymaster");

const RelayHubAddress = require("../build/gsn/RelayHub.json")["address"];
const StakeManagerAddress = require("../build/gsn/StakeManager.json")["address"];
const PaymasterAddress = require("../build/gsn/Paymaster.json")["address"];

const configuration = {
    relayHubAddress: RelayHubAddress,
    stakeManagerAddress: StakeManagerAddress,
    paymasterAddress: PaymasterAddress,
    verbose: false
};

const prevProvider = web3.currentProvider;
const relayProvider = new RelayProvider(web3.currentProvider, configuration);
web3.setProvider(relayProvider);

relayHubContract.setProvider(relayProvider);
stakeManagerContract.setProvider(relayProvider);

forwarderContract.setProvider(relayProvider);
gsnTokenContract.setProvider(relayProvider);
erc20PaymasterContract.setProvider(relayProvider);


const gsnTestEnv = require('@opengsn/gsn/dist/GsnTestEnvironment').default


iPaymasterContract.setProvider(relayProvider);
export class GSNHelper {
    relayHub: RelayHubInstance | null = null;
    stakeManager: StakeManagerInstance | null = null;
    relayProvider: any;

    constructor() {
    }

    public async deployAll(_totalSupply: BN, _payer: string, _deployer: string, _minAmount: BN)
        : Promise<[GsnTokenInstance, TrustedForwarderInstance, Erc20PaymasterInstance]>
    {
        this.relayHub = await relayHubContract.at(RelayHubAddress);
        this.stakeManager = await stakeManagerContract.at(StakeManagerAddress);

        const newForwarder: TrustedForwarderInstance = await this.deployForwarder(_deployer);

        const forwarder = newForwarder;

        const gsnToken: GsnTokenInstance =
            await this.deployGSNToken(_totalSupply, _deployer, forwarder.address);

        const paymaster: Erc20PaymasterInstance =
            await erc20PaymasterContract.new(
                gsnToken.address, _payer, _minAmount, {from: _deployer, useGSN: false}
            );
        await paymaster.setRelayHub(this.getRelayHub().address, { from: _deployer, useGSN: false });

        await this.getRelayHub().depositFor(paymaster.address, {from: _payer, value: e18(1), useGSN: false });

        return [gsnToken, forwarder, paymaster];
    }

    public async getDefaultForwarderAddress(): Promise<string> {
        const gsnInstance = await gsnTestEnv.startGsn('localhost');
        return gsnInstance.deploymentResult.forwarderAddress;
    }

    public async getDefaultPaymaster(): Promise<IPaymasterInstance> {
        const paymasterAddress = require("../build/gsn/Paymaster.json")["address"];
        const paymaster: IPaymasterInstance = await iPaymasterContract.at(paymasterAddress);

        return paymaster;
    }

    public async deployForwarder(_deployer: string) : Promise<TrustedForwarderInstance> {
        return await forwarderContract.new({from: _deployer, useGSN: false});
    }

    public async deployGSNToken(_totalSupply: BN, _deployer: string, _forwarderAddress: string) : Promise<GsnTokenInstance> {
        const gsnToken: GsnTokenInstance =
            await gsnTokenContract.new(_totalSupply, _forwarderAddress, {from: _deployer, useGSN: false});

        return gsnToken;
    }

    public getRelayHub(): RelayHubInstance {
        return this.relayHub!;
    }

    public async fundPaymaster(_paymaster: Erc20PaymasterInstance, _amount: BN, _from: string) {
        await this.getRelayHub().depositFor(_paymaster.address, {from: _from, value: _amount, useGSN: false });
    }

    public async withdrawAll(_paymaster: Erc20PaymasterInstance, _from: string) {
        const balance = await this.getRelayHub().balanceOf(_paymaster.address);
        await _paymaster.withdrawRelayHubDepositTo(balance, _from, {from: _from, useGSN: false});
    }

    public getGsnTxData(
        _from: string,
        _gasPrice: number,
        _paymasterAddress: string | null,
        _forwarderAddress: string | null
    ) : Truffle.TransactionDetails
    {
        const gasPriceHex = '0x' + _gasPrice.toString(16);
        let txData: any = {
            from: _from,
            useGSN: true,
            gasPrice: gasPriceHex,
            forceGasPrice: gasPriceHex,
            gas: 1000000
        }
        if (_paymasterAddress != null)
            txData['paymaster'] = _paymasterAddress;
        if (_forwarderAddress != null)
            txData['forwarder'] = _forwarderAddress;

        return txData;
    }
}


