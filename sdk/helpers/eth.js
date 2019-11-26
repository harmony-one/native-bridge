const config = require('../config')

const bip39 = require("bip39");
const hdkey = require("ethereumjs-wallet/hdkey");

const Tx = require('ethereumjs-tx');
const Web3 = require('web3');

const abiDecoder = require('abi-decoder');
abiDecoder.addABI(config.erc20ABI);

const CONTRACT_MANAGER = process.env.ERC20_CONTRACT_MANAGER

const ETH_TX_GAS_PRICE_GWEI = process.env.ETH_TX_GAS_PRICE_GWEI
const ETH_TX_GAS_LIMIT = process.env.ETH_TX_GAS_LIMIT

// set transactionConfirmationBlocks: https://github.com/trufflesuite/ganache-cli/issues/644
const web3 = new Web3(new Web3.providers.HttpProvider(config.provider), null, { transactionConfirmationBlocks: 1 });

const eth = {
  createAccount(callback) {
    let account = web3.eth.accounts.create()
    callback(null, account)
  },

  getSentTransactionsForAddress(contractAddress, sourceAddress, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    return myContract.getPastEvents('Transfer', {
      fromBlock: 8755198,
      toBlock: 'latest',
      filter: { _from: sourceAddress }
    }).then((events) => {
      const returnEvents = events.map((event) => {
        return {
          from: event.returnValues._from,
          to: event.returnValues._to,
          amount: parseFloat(web3.utils.fromWei(event.returnValues._value, 'ether')),
          transactionHash: event.transactionHash
        }
      })

      // console.log(returnEvents);
      if (!callback) return
      return callback(null, returnEvents)
    }).catch((err) => {
      console.error(err)
      if (!callback) return
      return callback(err)
    });
  },

  getTransaction(contractAddress, txHash, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.getTransaction(txHash)
      .then((txn) => {
        return callback(null, txn)
      })
      .catch((err) => {
        console.error(err)
        callback(err, null)
      });
  },

  getTransactionEvent(txHash) {
    return new Promise((resolve, reject) => {
      web3.eth.getTransactionReceipt(txHash)
        .then((receipt) => {
          resolve(abiDecoder.decodeLogs(receipt.logs)[0])
        })
        .catch((err) => {
          console.error(err)
          reject(err)
        });
    })
  },

  getTransactionsForAddress(contractAddress, depositAddress, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.getPastEvents('Transfer', {
      fromBlock: 8698700, // first block number to search from, since around 10/09/2019 timepoint
      toBlock: 'latest',
      filter: { _to: depositAddress }
    })
      .then((events) => {
        const returnEvents = events.map((event) => {
          return {
            from: event.returnValues._from,
            to: event.returnValues._to,
            amount: parseFloat(web3.utils.fromWei(event.returnValues._value, 'ether')),
            transactionHash: event.transactionHash
          }
        })
        return callback(null, returnEvents)
      })
      .catch((err) => {
        console.error(err)
        callback(err, null)
      });
  },

  getTransactions(contractAddress, accountAddress, depositAddress, depositAmount, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.getPastEvents('Transfer', {
      fromBlock: 0,
      toBlock: 'latest',
      filter: { _to: depositAddress, _from: accountAddress }
    })
      .then((events) => {
        let returnEvents = events.filter((event) => {
          if (event.returnValues._from.toUpperCase() == accountAddress.toUpperCase() && event.returnValues._to.toUpperCase() == depositAddress.toUpperCase()) {
            let amount = parseFloat(web3.utils.fromWei(event.returnValues._value, 'ether'))
            return depositAmount == amount
          }
        })
        callback(null, returnEvents)
      })
      .catch((err) => {
        callback(err)
      });

  },

  getERC20Balance(address, contractAddress, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.methods.balanceOf(address).call({ from: CONTRACT_MANAGER })
      .then((balance) => {
        // console.log(balance);
        const theBalance = web3.utils.fromWei(balance.toString(), 'ether')

        callback(null, theBalance)
      })
      .catch(callback)
  },

  getERC20Symbol(contractAddress, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.methods.symbol().call({ from: contractAddress })
      .then((symbol) => {
        // console.log(symbol);
        callback(null, symbol)
      })
      .catch(callback)
  },

  getERC20Name(contractAddress, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.methods.name().call({ from: contractAddress })
      .then((name) => {
        // console.log(name);
        callback(null, name)
      })
      .catch(callback)
  },

  getERC20TotalSupply(contractAddress, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.methods.totalSupply().call({ from: contractAddress })
      .then((supply) => {
        if (!supply) {
          return callback(null, null)
        }

        // console.log(supply);
        const theSupply = web3.utils.fromWei(supply.toString(), 'ether')
        callback(null, theSupply)
      })
      .catch(callback)
  },

  async sendErc20Transaction(contractAddress, privateKey, from, to, amount, earlyRet, callback) {
    let retry = 0;
    let callbackCalled = false;

    while (true) {
      const sendAmount = web3.utils.toWei(amount.toString(), 'ether')
      const consumerContract = new web3.eth.Contract(config.erc20ABI, contractAddress);
      const myData = consumerContract.methods.transfer(to, sendAmount).encodeABI();

      const gasLimit = ETH_TX_GAS_LIMIT;

      const nonce = await web3.eth.getTransactionCount(from, 'pending');
      let gasPrice = await web3.eth.getGasPrice();
      gasPrice = Math.max(ETH_TX_GAS_PRICE_GWEI * 1e9, gasPrice * 2 * (retry+1))  // speed up erc20 txn a bit

      const tx = {
        from,
        to: contractAddress,

        gasPrice: web3.utils.toHex(gasPrice),
        gasLimit: web3.utils.toHex(gasLimit),
        value: '0x0',

        chainId: 1,
        nonce: nonce,
        data: myData
      }

      console.log(`Sending ERC20 transaction (retry num: ${retry})`, tx);

      const rawTx = new Tx.Transaction(tx, { chain: 'mainnet', hardfork: 'petersburg' });
      const privKey = Buffer.from(privateKey, 'hex');
      rawTx.sign(privKey);

      const serializedTx = rawTx.serialize();
      const tx_hash = '0x' + rawTx.hash().toString('hex');

      console.log(`Attempting to send signed tx ${tx_hash}: ${serializedTx.toString('hex')}\n------------------------`);

      try {
        const receipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).
          on('transactionHash', txHash => {
            console.log('transactionHash:', txHash)
            if (earlyRet) {
              console.log('sendErc20Transaction: early returning with transactionHash', txHash)
              if (!callbackCalled) {
                callback(null, txHash)
                callbackCalled = true
              }
              return null, txHash
            }
          });

        // not early return since we await above (tx hash callback should be called before receipt is available)
        console.log('sendErc20Transaction: transaction receipt', receipt)
        if (!callbackCalled) {
          callback(null, receipt.transactionHash)
          callbackCalled = true
        }
        return null, receipt.transactionHash
      } catch (err) {
        console.error('[Error] sendErc20Transaction', err)
        if (retry == 2) {
          if (!callbackCalled) {
            callback(err)
            callbackCalled = true
          }
          return err, tx_hash
        } else {
          retry++;
          console.log(`Retrying erc20 tx... ${retry}`)
        }
      }
    }

  },

  async fundEthForGasFee(privateKey, from, to, amount, message, earlyRet, callback) {
    let retry = 0;
    let callbackCalled = false;

    while (true) {
      const sendAmount = web3.utils.toWei(amount.toString(), 'ether')

      const gasLimit = ETH_TX_GAS_LIMIT;

      const nonce = await web3.eth.getTransactionCount(from, 'pending');
      const gasPrice = await web3.eth.getGasPrice();

      const tx = {
        from,
        to,

        gasPrice: web3.utils.toHex(gasPrice),
        gasLimit: web3.utils.toHex(gasLimit),
        value: web3.utils.toHex(sendAmount),

        chainId: 1,
        nonce: nonce,
      }
      if (message) {
        tx.data = web3.utils.toHex(message);
      }

      console.log(`Sending ETH transaction (retry num: ${retry})`, tx);

      const rawTx = new Tx.Transaction(tx, { chain: 'mainnet', hardfork: 'petersburg' });
      const privKey = Buffer.from(privateKey, 'hex');
      rawTx.sign(privKey);
      const serializedTx = rawTx.serialize();
      const tx_hash = '0x' + rawTx.hash().toString('hex');

      console.log(`Attempting to send signed tx ${tx_hash}: ${serializedTx.toString('hex')}\n------------------------`);

      try {
        const receipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).
          on('transactionHash', txHash => {
            console.log('transactionHash:', txHash)
            if (earlyRet) {
              console.log('fundEthForGasFee: early returning with transactionHash', txHash)
              if (!callbackCalled) {
                callback(null, txHash)
                callbackCalled = true
              }
              return null, txHash
            }
          });

        // not early return since we await above (tx hash callback should be called before receipt is available)
        console.log('fundEthForGasFee: transaction receipt', receipt)
        if (!callbackCalled) {
          callback(null, receipt.transactionHash)
          callbackCalled = true
        }
        return null, receipt.transactionHash
      } catch (err) {
        if (retry == 2) {
          if (!callbackCalled) {
            callback(err)
            callbackCalled = true
          }
          return err, tx_hash
        } else {
          retry++;
          console.log(`Retrying funding eth gas ... ${retry}`)
        }
      }
    }

  },

  generateAddressesFromSeed(mnemonic, count) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const hdwallet = hdkey.fromMasterSeed(seed);

    const wallet_hdpath = "m/44'/60'/0'/0/";

    const accounts = [];
    for (let i = 0; i < count; i++) {
      const wallet = hdwallet.derivePath(wallet_hdpath + i).getWallet();
      const address = '0x' + wallet.getAddress().toString("hex");
      const privateKey = wallet.getPrivateKey().toString("hex");
      accounts.push({ address: address, privateKey: privateKey });
    }

    return accounts;
  }
}

if (process.env.RUN) {

  const contractAddress = '0x799a4202c12ca952cb311598a024c80ed371a41e';
  const privateKey = ''
  const from = ''
  const to = ''
  const amount = 0.01
  const address = ''

  // eth.getTransactionsForAddress(contractAddress, address, (err, events) => {
  //   console.log('returned events', JSON.stringify(events));
  // })

  // eth.fundEthForGasFee(privateKey, from, to, amount, null, (err, hash) => {
  //   if (err) {
  //     console.error(err);
  //     return;
  //   }
  //   console.log(hash);
  //   return hash;
  // })

  web3.eth.getBalance(from).then((ethBalance) => {
    console.log(`==== Eth balance: ${web3.utils.fromWei(ethBalance)} ETH`);

    eth.getERC20Balance(from, contractAddress, (err, balance) => {
      if (err) {
        console.error(err)
        return
      }
      console.log(`==== One balance: ${balance} ONE`);

      eth.sendErc20Transaction(contractAddress, privateKey, from, to, amount, false /* earlyRet */, (err, hash) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log(`==== ONE ERC20 Tx hash: ${hash}`);
        return ethBalance, balance, hash;
      })
    })
  })

}

module.exports = eth
