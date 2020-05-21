const promisify = require('tiny-promisify');

export class Blockchain {
    private web3Provider: any;
    private snapshotIds: number[] = [];

    constructor(_web3Provider: any) {
        this.web3Provider = _web3Provider;
    }

    public async saveSnapshotAsync(): Promise<void> {
        const response = await this.sendJSONRpcRequestAsync('evm_snapshot', []);
        this.snapshotIds.push(parseInt(response.result, 16));
    }

    public async revertAsync(): Promise<void> {
        if (this.snapshotIds.length == 0) {
            throw new Error('snapshotIds length == 0');
        }
        await this.sendJSONRpcRequestAsync('evm_revert', [this.snapshotIds.pop()]);
    }

    public async increaseTimeAsync(
        duration: BN,
    ): Promise<any> {
        await this.sendJSONRpcRequestAsync('evm_increaseTime', [duration.toNumber()]);
    }

    public async mineBlockAsync(): Promise<any> {
        await this.sendJSONRpcRequestAsync('evm_mine', []);
    }

    public async advanceBlockAsync(n: number): Promise<any> {
        let promiseList: Promise<any>[] = [];

        for(let i=0; i < n; i++) {
            promiseList.push(this.mineBlockAsync());
        }

        await Promise.all(promiseList);
    }

    private async sendJSONRpcRequestAsync(
        method: string,
        params: any[],
    ): Promise<any> {
        return promisify(this.web3Provider.send, {
            context: this.web3Provider,
    })({
        jsonrpc: '2.0',
        method,
        params,
        id: new Date().getTime(),
    });
    }
}

