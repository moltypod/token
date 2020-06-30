# ERC20Paymaster

![CI](https://github.com/bruce-eljovist/ERC20Paymaster/workflows/CI/badge.svg)

[GSN V2](https://github.com/opengsn/gsn) paymaster implementation for ERC20.


## GSNToken
Example ERC20 implementaion Using [GSN V2](https://github.com/opengsn/gsn) and [Openzepplien library](https://github.com/OpenZeppelin/openzeppelin-contracts).

## Usage
GSNToken is designed to be used in multiple DApps as a currency. So each DApp provides its own paymaster to pay the fee in ETH only for transactions transferred to themselves.

For example, in the **Casino DApp**, it is required to receive GSNToken from the user. Casino DApp would want to pay Ether fee only when transferring to the app itself. And, in order to prevent draining the paymaster balance, transferring amount is required to be bigger than 1e18. In this case, the ERC20Paymaster contract’s parameter for deployment is below.

```
GSNToken address, Casino DApp address, 1e18
```

In another **Lottery DApp** example, the amount is required to bigger than 1e19 and transfer to the  Lottery DApp. In such a case, the ERC20Paymaster contract’s parameter for deployment is below.

```
GSNToken address, Lottery DApp address, 1e19
```


## install
```console
$ yarn
```

## test
```console
$ yarn totaltest
```