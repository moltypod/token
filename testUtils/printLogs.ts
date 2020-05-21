import BN from "bn.js";

export async function printTxLog(prefix:string, tx: Promise<Truffle.TransactionResponse>) {
    const response = await tx;
    const logs = response.logs;

    console.log(prefix + "------------");
    for (let i=0; i < logs.length; i++) {

        const l = logs[i];
        let msg = l.event;
        for (let k=0; k < l.args.__length__; k++) {
            let arg = l.args[k.toString()];
            msg += " " + arg.toString();
        }
        console.log("[", msg, "]");
    }
}

export async function getContractLogs(contract: any, eventName: string, fromBlock: number | BN) {
    const abi: any[] = contract.abi;
    const address: string = contract.address;

    const logs = await web3.eth.getPastLogs({
        fromBlock: fromBlock,
        address: address
    });

    const eventABI = abi.filter(x => x.type == 'event' && x.name == eventName);

    const decodeLogs = [];
    for(let i=0; i < eventABI.length; i++) {
        const eAbi = eventABI[i];
        const inputs: any[] = eAbi.inputs;
        const eventSignature = `${eventName}(${inputs.map(input => input.type).join(',')})`
        const eventTopic = web3.utils.sha3(eventSignature);

        for(let i=0; i < logs.length; i++) {
            const log = logs[i];
            const l = {};
            if (log.topics.length > 0 && log.topics[0] == eventTopic) {
                const l = {
                    logIndex: log.logIndex,
                    event: eventName,
                    args: web3.eth.abi.decodeLog(eAbi.inputs, log.data, log.topics.slice(1))
                }
                decodeLogs.push(l);
            }
        }
    }

    return decodeLogs;
}


export async function printContractLogs(contractEventPair: [any, any][], fromBlock: number ) {
    let logs: any[] = [];

    for (let i=0; i < contractEventPair.length; i++) {
        let pair = contractEventPair[i];
        let l: any[] = await getContractLogs(pair[0], pair[1], fromBlock);
        logs = logs.concat(l);
    }

    logs = logs.sort((x,y) => x.logIndex - y.logIndex);
    console.log(logs);
}
