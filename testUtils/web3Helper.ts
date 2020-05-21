// const Web3 = require('web3');
import Web3 from 'web3';
import BN from 'bn.js';
import { DEFAULT_GAS, ZERO_ADDRESS } from './constants';


// use globally injected web3 to find the currentProvider and wrap with web3 v1.0
export const getWeb3 = () => {
  // const myWeb3: Web3 = new Web3();
  // myWeb3.setProvider(provider);
  const myWeb3 : Web3 = web3;

  return myWeb3;
};

// assumes passed-in web3 is v1.0 and creates a function to receive contract name
export const getContractInstance = (artifact: any, contractAddress: string = artifact.address) => {
  const web3 = getWeb3();
  return new web3.eth.Contract(artifact.abi, contractAddress);
};

export const getGasUsageInEth: (_: any) => Promise<BN> = async txHash => {
  const web3 = getWeb3();
  const txReceipt = await web3.eth.getTransactionReceipt(txHash);
    const txn = await web3.eth.getTransaction(txHash);
    const { gasPrice } = txn;
    const { gasUsed } = txReceipt;

    return new BN(gasPrice).mul(new BN(gasUsed));
};

export const txnFrom = (from: string) => {
  return { from, gas: DEFAULT_GAS };
};

export const blankTxn = async (from: string) => {
  const web3 = getWeb3();
  await web3.eth.sendTransaction({
    from,
    to: ZERO_ADDRESS,
    value: '1',
  });
};
