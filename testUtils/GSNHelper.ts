require('module-alias/register');

import * as chai from 'chai';
import BN from 'bn.js';

const truffleContract = require("@truffle/contract");

import { GsnTokenInstance, TrustedForwarderContract } from '@gen/truffle-contracts';

import { ONE, ZERO } from '@testUtils/constants';

import { ether, gWei, wei, e18, e9, e1 } from '@testUtils/units';

import {
    RelayHubInstance,
    PayTransferToMeInstance,
    StakeManagerInstance,
    TrustedForwarderInstance
} from '@gen/truffle-contracts';

import { getSnapshot, snapshotDiff, map } from '@testUtils/snapshot';

const { RelayProvider } = require('@opengsn/gsn');
const relayHubContract: any = truffleContract(require("../build/contracts/RelayHub.json"));
const stakeManagerContract: any = truffleContract(require("../build/contracts/StakeManager.json"));
const forwarderContract: any = artifacts.require("TrustedForwarder");
const gsnTokenContract: any = artifacts.require("GSNToken");
const payTransferToMeContract: any = artifacts.require("PayTransferToMe");

const RelayHubAddress = require("../build/gsn/RelayHub.json")["address"];
const StakeManagerAddress = require("../build/gsn/StakeManager.json")["address"];

const configuration = {
    relayHubAddress: RelayHubAddress,
    stakeManagerAddress: StakeManagerAddress,
    verbose: false
};

const relayProvider = new RelayProvider(web3.currentProvider, configuration);
web3.setProvider(relayProvider);

relayHubContract.setProvider(relayProvider);
stakeManagerContract.setProvider(relayProvider);

forwarderContract.setProvider(relayProvider);
gsnTokenContract.setProvider(relayProvider);
payTransferToMeContract.setProvider(relayProvider);

export class GSNHelper {
    relayHub: RelayHubInstance | null = null;
    stakeManager: StakeManagerInstance | null = null;

    relayProvider: any;

    constructor() {
    }

    public async deployAll(totalSupply: BN, payer: string, deployer: string) : Promise<[GsnTokenInstance, TrustedForwarderInstance, PayTransferToMeInstance]>{
        this.relayHub = await relayHubContract.at(RelayHubAddress);
        this.stakeManager = await stakeManagerContract.at(StakeManagerAddress);

        const gsnToken: GsnTokenInstance = await this.deployGSNToken(totalSupply, deployer);
        const forwarder: TrustedForwarderInstance = await this.deployForwarder(deployer);
        const paymaster: PayTransferToMeInstance = await this.deployPaymaster(gsnToken.address, payer, deployer);

        console.log('gsnToken.address', gsnToken.address);
        console.log('forwarder.address', forwarder.address);
        console.log('paymaster.address', paymaster.address);
        await this.fundPaymaster(paymaster, e18(1), payer);

        return [gsnToken, forwarder, paymaster];
    }



    public async deployForwarder(deployer: string) : Promise<TrustedForwarderInstance> {
        return await forwarderContract.new({from: deployer, useGSN: false});
    }

    public async deployGSNToken(totalSupply: BN, deployer: string) : Promise<GsnTokenInstance> {
        return await gsnTokenContract.new(totalSupply, {from: deployer, useGSN: false});
    }

    public async deployPaymaster(recipientAddress: string, myAddress: string, deployer: string) : Promise<PayTransferToMeInstance> {
        return await payTransferToMeContract.new(recipientAddress, myAddress, {from: deployer, useGSN: false});
    }

    public async setTrustedForwarder(
        gsnToken: GsnTokenInstance,
        forwarder: TrustedForwarderInstance,
        gsnTokenOwner: string
    )
    {
        await gsnToken.setTrustedForwarder(forwarder.address, {from: gsnTokenOwner, useGSN: false} );
    }

    public getRelayHub(): RelayHubInstance {
        return this.relayHub!;
    }

    public async fundPaymaster(paymaster: PayTransferToMeInstance, amount: BN, from: string) {
        await this.getRelayHub().depositFor(paymaster.address, {from: from, value: amount, useGSN: false });
    }
}


