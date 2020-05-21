require('module-alias/register');

import * as chai from 'chai';
import BN from 'bn.js';
import ChaiSetup from '@testUtils/chaiSetup';
import { Blockchain } from '@testUtils/blockchain';
import { getWeb3 } from '@testUtils/web3Helper';

import { GsnTokenContract, GsnTokenInstance } from '@gen/truffle-contracts';

import { ONE, ZERO } from '@testUtils/constants';
import Web3 from 'web3';

import { ether, gWei, wei, e18, e9, e1 } from '@testUtils/units';

import { expectRevert } from '@openzeppelin/test-helpers';

const web3: Web3 = getWeb3();
const blockchain = new Blockchain(web3.currentProvider);

ChaiSetup.configure();

const { expect } = chai;

const gsnTokenContract: GsnTokenContract = artifacts.require("GSNToken");

contract("GSNToken", ([deployer, user1, user2]) => {
    const totalSupply = e18(1000000);

    let gsnToken: GsnTokenInstance;

    before(async () => {
        gsnToken = await gsnTokenContract.new(1000000);
    });

    it("t1", async () => {
        console.log("totalSupply", await gsnToken.totalSupply());
        // console.log("asdf");
    });
});
