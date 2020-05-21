import BN from 'bn.js';

export async function getEthBalance(account: string) {
    return new BN(await web3.eth.getBalance(account));
};

export async function ethBalanceDiff(account: string, fn: () => Promise<Truffle.TransactionResponse>) : Promise<BN> {
    const beforeBalance = new BN(await web3.eth.getBalance(account));
    const tx = await fn();
    const gasPrice = new BN(await web3.eth.getGasPrice());
    const gasUsed = new BN(tx.receipt['gasUsed']);
    const gasTotal = gasPrice.mul(gasUsed);
    return new BN(await web3.eth.getBalance(account)).sub(beforeBalance).add(gasTotal);
}

export function negative(value: BN): BN {
    return value.mul(new BN(-1));
}

