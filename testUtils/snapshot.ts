import BN from "bn.js";
import { ZERO } from './constants';

export type Account = {
    name: string,
    address: string
}

export type Snap = {
    account: Account,
    value: any
}

export type Snapshot = Snap[];

export async function getSnapshot(accounts: Account[], func: (account: Account) => Promise<any>): Promise<Snapshot> {
    const promiseList = accounts.map(async account => await func(account));
    const values: any[] = await Promise.all(promiseList);

    return values.map((v:any, i: number) => {
        return{ account: accounts[i], value: v };
    });
}

export function snapshotDiff(
    s1: Snapshot,
    s2: Snapshot,
    diffFunc: (v1: any, v2: any) => any,
    diffCheck: (v: any) => boolean
)
    : Snapshot
{
    let results: Snapshot = [];
    for(let i=0; i < s1.length; i++) {
        for(let k=0; k < s2.length; k++) {
            if (s1[i].account.address == s2[k].account.address) {
                const diff = diffFunc(s1[i].value, s2[i].value);
                if (diffCheck(diff)) {
                    results.push({ account: s1[i].account, value: diff });
                }
            }
        }
    }
    return results;
}

export function map(s: Snapshot, toFunc: (snap: Snap) => Snap): Snapshot {
    return s.map((snap: Snap) => {
        return { account: snap.account, value: toFunc(snap.value) };
    });
}


