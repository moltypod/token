import Web3 from 'web3';
import { getWeb3 } from './web3Helper';

const web3: Web3 = getWeb3();
import BN from 'bn.js';

export function ether(amount: number): BN {
  const weiString = web3.utils.toWei(amount.toString(), 'ether');
  return new BN(weiString);
}

export function gWei(amount: number): BN {
  const weiString = web3.utils.toWei(amount.toString(), 'gwei');
  return new BN(weiString);
}

export function wei(amount: number): BN {
  const weiString = web3.utils.toWei(amount.toString(), 'wei');
  return new BN(weiString);
}

export function e18(amount: number): BN {
  return ether(amount);
}

export function e9(amount: number): BN {
  return gWei(amount);
}

export function e1(amount: number): BN {
  return wei(amount);
}

