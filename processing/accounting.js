/*
  GET all the client_accounts
  Add all the DB values + count

  Get all the transactions from Eth

  Get all the transactions from Binance

  node processing/accounting.js processing/export.csv

  where export.csv is generated from etherscan here:
  https://etherscan.io/address/0x799a4202c12ca952cb311598a024c80ed371a41e

*/

if (!process.argv || process.argv.length < 3) {
  console.error('missing argument for export.csv');
  process.exit(1);
}
const exportFile = process.argv[2]

const KEY = 'witness canyon foot sing song tray task defense float bottom town obvious faint globe door tonight alpha battle purse jazz flag author choose whisper';

const HMY_UUID = "Harmony_One"
const HMY_ERC = "0x799a4202c12ca952cb311598a024c80ed371a41e"

const db = require('./helpers/db.js').db
const bnb = require('./helpers/bnb.js')
const eth = require('./helpers/eth.js')
const models = require('../sdk/models')
const config = require('./config')

const async = require('async')

const csv = require('csv-parser');
const fs = require('fs');

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(config.provider));

const ETH_FUND_ACCT_ADDRESS = process.env.ETH_FUND_ACCT_ADDRESS.toLowerCase()
const ETH_FOUNDATION_ACCT_ADDRESS = process.env.ETH_FOUNDATION_ACCT_ADDRESS.toLowerCase()

const BNB_FUND_ACCT_ADDRESS = process.env.BNB_FUND_ACCT_ADDRESS.toLowerCase()
const BNB_FOUNDATION_ACCT_ADDRESS = process.env.BNB_FOUNDATION_ACCT_ADDRESS.toLowerCase()

function readERC20TxnsPromise(srcOnly) {
  return new Promise((resolve, reject) => {
    const ret = {}
    fs.createReadStream(exportFile)
      .pipe(csv())
      .on('data', (row) => {
        if (srcOnly && row.From !== ETH_FOUNDATION_ACCT_ADDRESS) {
          return;
        }

        // if row.From == ETH_FOUNDATION_ACCT_ADDRESS, direction = b2e.
        // for filtering e2b, we need to use web3 js to get the txn input data to decode 'To' info
        ret[row.Txhash] = row;
      })
      .on('end', () => {
        console.log(`${Object.keys(ret).length} b2e swap txns read from ${exportFile}`);
        resolve(ret);
      })
      .on('error', (error) => {
        console.error('Error reading CSV file', error);
        reject(error);
      });
  });
}

function readERC20Txns(srcOnly, callback) {
  const ret = {}
  return fs.createReadStream(exportFile)
    .pipe(csv())
    .on('data', (row) => {
      if (srcOnly && row.From !== ETH_FOUNDATION_ACCT_ADDRESS) {
        return;
      }

      // if row.From == ETH_FOUNDATION_ACCT_ADDRESS, direction = b2e.
      // for filtering e2b, we need to use web3 js to get the txn input data to decode 'To' info
      ret[row.Txhash] = row;
    })
    .on('end', () => {
      console.log(`${Object.keys(ret).length} b2e swap txns read from ${exportFile}`);
      callback(null, ret);
      return
    })
    .on('error', (error) => {
      console.error('Error reading CSV file', error);
      callback(error);
    });
}

matchBinanceEthereumTxns();

function matchBinanceEthereumTxns() {
  console.log('======== START ==========');
  const readERCSortedByTxValue = readERC20TxnsPromise(true)
    .catch((err) => {
      console.error(`matchBinanceEthereumTxns: readERC20Txns failed`, err);
      return;
    })
    .then((exportTxns) => {
      console.log(`${Object.keys(exportTxns).length} erc20 txns from ${ETH_FOUNDATION_ACCT_ADDRESS} read.`);

      let amount = 0
      const promises = []
      for (let i = 0; i < Object.keys(exportTxns).length; i++) {
        const txHash = Object.keys(exportTxns)[i]
        promises.push(eth.getTransactionEvent(txHash))
      }

      return Promise.all(promises).then(txnEvents => {
        txnEvents.forEach(([txHash, txnDetail], i) => {
          if (!txnDetail) {
            // this means the txn failed and got reverted
            // console.log(`Reverted Txn: ${txHash}`);
            return;
          }

          // { name: 'Transfer', events: [
          //   { name: '_from', type: 'address', value: ... },
          //   { name: '_to', type: 'address', value: ... },
          //   { name: '_value', type: 'uint256', value: ... }
          // ]}
          const txValue = parseFloat(web3.utils.fromWei(txnDetail.events[2].value, 'ether'))
          // console.log(`${Object.keys(exportTxns)[i]}\t${txValue}`);
          amount += txValue
          exportTxns[txHash].value = txValue
        });

        // sort exportTxns
        const sortedKeys = Object.keys(exportTxns).sort((hash1, hash2) => {
          const value1 = exportTxns[hash1].value
          const value2 = exportTxns[hash2].value
          return value1 < value2 ? -1 : (value1 > value2 ? 1 : 0)
        });

        const ret = {};
        sortedKeys.forEach((txHash, i) => {
          ret[txHash] = exportTxns[txHash]
        });

        console.log(`Total erc20 from ${ETH_FOUNDATION_ACCT_ADDRESS}: ${amount} ONE`);
        return ret;
      });
    });

  const readBEP2SortedByValue = getBEP2TxnsOfAccountPromise(BNB_FOUNDATION_ACCT_ADDRESS, true)
    .then((bep2TxnsFromFounation) => {
      console.log(`${Object.keys(bep2TxnsFromFounation).length} bep2 txns to ${BNB_FOUNDATION_ACCT_ADDRESS} read.`);

      // sort exportTxns
      const sortedKeys = Object.keys(bep2TxnsFromFounation).sort((hash1, hash2) => {
        const value1 = parseFloat(bep2TxnsFromFounation[hash1].value)
        const value2 = parseFloat(bep2TxnsFromFounation[hash2].value)
        return value1 < value2 ? -1 : (value1 > value2 ? 1 : 0)
      });

      const ret = {}
      let amount = 0.0;
      sortedKeys.forEach((txHash, i) => {
        const tx = bep2TxnsFromFounation[txHash]
        tx.value = parseFloat(tx.value)
        // console.log(`${txHash}\t${tx.value}`);
        amount += tx.value
        ret[txHash] = tx
      })

      console.log(`Total bep2 to ${ETH_FOUNDATION_ACCT_ADDRESS}: ${amount} ONE`);
      return ret;
    })
    .catch((err) => {
      console.error(`matchBinanceEthereumTxns: getBEP2TxnsOfAccount failed`, err);
      return;
    })

  return Promise.all([readERCSortedByTxValue, readBEP2SortedByValue]).then(res => {
    console.log('======== FINISHED FETCH ==========');
    const [ercTxnsSorted, bep2TxnsSorted] = res;

    let i = 0, j = 0
    while (i < Object.keys(ercTxnsSorted).length && j < Object.keys(bep2TxnsSorted).length) {
      const ercHash = Object.keys(ercTxnsSorted)[i]
      const ercValue = ercTxnsSorted[ercHash].value

      const bepHash = Object.keys(bep2TxnsSorted)[j]
      const bepValue = bep2TxnsSorted[bepHash].value

      if (ercValue === bepValue) {
        i++;
        j++;
      } else if (ercValue > bepValue) {
        console.log(`BEP txn ${bepHash} value ${bepValue}`);
        j++
      } else {
        console.log(`ERC txn ${ercHash} value ${ercValue}`);
        i++
      }
    }

    console.log('======== END ==========');
    return;
  });
}

function getERC20TxnsOfAccount(address, isDst, callback) {
  const getTxnEventPromises = []
  fs.createReadStream(exportFile)
    .pipe(csv())
    .on('data', (row) => {
      getTxnEventPromises.push(
        eth.getTransactionEvent(row.Txhash)
      );
    })
    .on('end', () => {
      console.log(`Total ${getTxnEventPromises.length} txns read from ${exportFile}`);

      const ret = {}
      return Promise.all(getTxnEventPromises).then(txnEvents => {
        txnEvents.forEach(([txHash, txnDetail]) => {
          if (!txnDetail) {
            // this means the txn failed and got reverted
            // console.log(`Reverted Txn: ${txHash}`);
            return;
          }

          // { name: 'Transfer', events: [
          //   { name: '_from', type: 'address', value: ... },
          //   { name: '_to', type: 'address', value: ... },
          //   { name: '_value', type: 'uint256', value: ... }
          // ]}
          const from = txnDetail.events[0].value
          const to = txnDetail.events[1].value
          const txValue = parseFloat(web3.utils.fromWei(txnDetail.events[2].value, 'ether'))

          if ((isDst ? to : from) === address) {
            ret[txHash] = txnDetail;
          }
        });

        callback(null, ret);
        return;
      });
    })
    .on('error', (error) => {
      console.error('Error reading CSV file', error);
      callback(error);
      return;
    });
}

function readSwapTransactionsFromDb(direction, deposit, callback) {
  const ret = {}
  return getSwapsDataFromDb(direction, (swaps, err) => {
    if (err) {
      console.error(`getSwapsInDb error`, error);
      callback(null, error);
      return;
    }

    for (let i in swaps) {
      const swap = swaps[i]
      if (swap.direction === direction) {
        const txHash = deposit
          ? swaps[i].deposit_transaction_hash
          : swaps[i].transfer_transaction_hash;
        ret[txHash] = swaps[i];
      }
    }
    console.log(`${Object.keys(ret).length} swap txns read from db`);
    callback(ret);
    return;
  });
}

function getAllClientBnbAccounts(callback) {
  db.many('select address, key_name, seed_phrase as mnemonic, password, encr_key from client_bnb_accounts;')
    .then((keys) => {
      const decryptedKeys = {};
      keys.forEach((key) => {
        if (key.encr_key) {
          const dbPassword = key.encr_key
          const password = KEY + ':' + dbPassword
          key.password_decrypted = models.decrypt(key.password, password)
          key.mnemonic = models.decrypt(key.mnemonic, password)
        } else {
          console.log(`missing encrypted key ${key}`);
        }
        decryptedKeys[key.address] = key
      });
      callback(null, decryptedKeys)
    })
    .catch(callback)
}

// findERC20TxnsForFoundationForE2B();

function findERC20TxnsForFoundationForE2B() {
  console.log('======== START ==========');
  console.log(`Finding ERC20 Transactions`);
  const account = ETH_FOUNDATION_ACCT_ADDRESS
  const isDst = true
  return getERC20TxnsOfAccount(account, isDst, (err, toFoundationAccountTxns) => {
    if (err) {
      console.error(`findERC20TxnsForFoundationForE2B: getERC20TxnsOfAccount(${account}, ${isDst ? 'true' : 'false'}) failed`, err);
      return;
    }

    console.log(`${JSON.stringify(toFoundationAccountTxns, null, 2)}\n`);

    console.log(`Found ${Object.keys(toFoundationAccountTxns).length} ERC20 txns ${isDst ? 'to' : 'from'} the ETH foundation account for E2B`);
    console.log('======== END ==========');
    return toFoundationAccountTxns;
  });
}

// findMissingERC20Txns()

function findMissingERC20Txns() {
  console.log('======== START ==========');
  return readSwapTransactionsFromDb('BinanceToEthereum', false /* deposit */, (swapTxns, err) => {
    if (err) {
      console.error(`findMissingERC20Txns: readSwapTransactionsFromDb failed`, err);
      return;
    }
    // console.log(swapTxns);
    return readERC20Txns(true, (err, exportTxns) => {
      if (err) {
        console.error(`findMissingERC20Txns: readERC20Txns failed`, err);
        return;
      }

      const missing = {};
      for (let exportTxnHash in exportTxns) {
        if (exportTxnHash in swapTxns) continue;
        missing[exportTxnHash] = exportTxns[exportTxnHash]
      }

      console.log(`missing ${Object.keys(missing).length} erc20 transactions`);

      let amount = 0
      const promises = []
      for (let txHash in missing) {
        promises.push(eth.getTransactionEvent(txHash))
      }

      return Promise.all(promises).then(txnEvents => {
        txnEvents.forEach(([txHash, txnDetail], i) => {
          if (!txnDetail) {
            // this means the txn failed and got reverted
            // console.log(`Reverted Txn: ${txHash}`);
            return;
          }

          // { name: 'Transfer', events: [
          //   { name: '_from', type: 'address', value: ... },
          //   { name: '_to', type: 'address', value: ... },
          //   { name: '_value', type: 'uint256', value: ... }
          // ]}
          const txValue = parseFloat(web3.utils.fromWei(txnDetail.events[2].value, 'ether'))
          console.log(`- txn ${Object.keys(missing)[i]}: ${txValue}`);
          amount += txValue
        });

        console.log(`Total missing amount: ${amount} ONE`);
        console.log('======== END ==========');

        return amount;
      });
    });
  });
}

// processUnemptiedClientBnbAccounts();

function processUnemptiedClientBnbAccounts() {
  return getAllClientBnbAccounts((err, decryptedKeys) => {
    if (err) {
      console.error(`processUnemptiedClientBnbAccounts: getAllClientBnbAccounts failed`, err);
      return;
    }

    // console.log(decryptedKeys);

    getBalancesBNB(Object.keys(decryptedKeys), (err, accountsBalances) => {
      accountsBalances.forEach(([address, balances]) => {
        console.log(address, balances);
      })
    })

    // Object.keys(decryptedKeys).forEach((clientBNBAccountAddress, i) => {
    //   const key = decryptedKeys[clientBNBAccountAddress]
    //   // key { address, key_name, mnemonic, password, encr_key, password_decrypted, mnemonic }
    //   getBalancesBNB(Object.keys(decryptedKeys))
    // })
  })
}

// findMissingBEP2Txns()

function findMissingBEP2Txns() {
  console.log('======== START ==========');
  return readSwapTransactionsFromDb('EthereumToBinance', false /* deposit */, (swapTxns, err) => {
    if (err) {
      console.error(`findMissingBEP2Txns: readSwapTransactionsFromDb failed`, err);
      return;
    }

    const account = BNB_FOUNDATION_ACCT_ADDRESS
    const isDst = true

    return getBEP2TxnsOfAccount(account, isDst, (err, fetchedTxns) => {
      if (err) {
        console.error(`findBEP2TxnsForFoundationForB2E: getBEP2TxnsOfAccount(${account}, ${isDst ? 'true' : 'false'}) failed`, err);
        return;
      }

      const missing = {};
      for (let txHash in fetchedTxns) {
        if (txHash in swapTxns) continue;
        missing[txHash] = fetchedTxns[txHash]
      }

      console.log(`missing ${Object.keys(missing).length} bep2 transactions`);

      let amount = 0;
      missing.keys.forEach((txn, i) => {
        amount += parseFloat(txn.value);
        console.log(`- txn ${Object.keys(missing)[i]}: ${txValue}`);
      });

      console.log(`Total missing amount: ${amount} ONE`);
      console.log('======== END ==========');
      return amount;
    });
  });
}

// findBEP2TxnsForFoundationForB2E();

function findBEP2TxnsForFoundationForB2E() {
  console.log('======== START ==========');
  console.log(`Finding BEP2 Transactions `);
  const account = BNB_FOUNDATION_ACCT_ADDRESS
  const isDst = true
  return getBEP2TxnsOfAccount(account, isDst, (err, res) => {
    if (err) {
      console.error(`findBEP2TxnsForFoundationForB2E: getBEP2TxnsOfAccount(${account}, ${isDst ? 'true' : 'false'}) failed`, err);
      return;
    }

    // console.log(`${JSON.stringify(res.tx, null, 2)}\n`);
    console.log(`Found ${Object.keys(res).length} BEP2 txns ${isDst ? 'to' : 'from'} the ETH foundation account for B2E`);
    console.log('======== END ==========');
    return res.tx;
  });
}

function getBEP2TxnsOfAccount(address, isDst, callback) {
  const symbol = 'ONE-5F9';
  const startTime = (new Date('10-01-2019')).getTime(); // time in milliseconds time for 10-01-2019
  const endTime = (new Date()).getTime();               // current time in milliseconds
  const side = isDst ? 'RECEIVE' : 'SEND';
  const limit = 1000;
  return bnb.getTransactionsForAddress(address, symbol, side, startTime, endTime, limit, (err, res) => {
    if (err) {
      callback(err)
      return;
    }

    // console.log(res.data);
    if (!res.data || !res.data.tx) {
      callback('Failed http request to get transactions for ' +
        `address ${address}, symbol ${symbol}, side ${side}, startTime ${startTime}, endTime ${endTime}`)
      return;
    }

    const ret = {}
    let totalAmount = 0.0;
    res.data.tx.forEach((tx, i) => {
      // console.log(i, tx.Hash);
      totalAmount += parseFloat(tx.value)
      ret[tx.txHash] = tx;
    })

    // // console.log('txns:\n', JSON.stringify(res.data.tx, null, 2));
    // console.log('total:', JSON.stringify(res.data.total, null, 2));
    // console.log('total amount:', totalAmount);

    callback(null, ret);
    return;
  })
}

function getBEP2TxnsOfAccountPromise(address, isDst) {
  const symbol = 'ONE-5F9';
  const startTime = (new Date('10-01-2019')).getTime(); // time in milliseconds time for 10-01-2019
  const endTime = (new Date()).getTime();               // current time in milliseconds
  const side = isDst ? 'RECEIVE' : 'SEND';
  const limit = 1000;
  return bnb.getTransactionsForAddressPromise(address, symbol, side, startTime, endTime, limit)
    .then((res) => {
      // console.log(res.data);
      if (!res.data || !res.data.tx) {
        throw Error('Failed http request to get transactions for ' +
          `address ${address}, symbol ${symbol}, side ${side}, startTime ${startTime}, endTime ${endTime}`)
      }

      const ret = {}
      let totalAmount = 0.0;
      res.data.tx.forEach((tx, i) => {
        // console.log(i, tx.Hash);
        totalAmount += parseFloat(tx.value)
        ret[tx.txHash] = tx;
      })

      // console.log('txns:\n', JSON.stringify(res.data.tx, null, 2));
      // console.log('total:', JSON.stringify(res.data.total, null, 2));
      // console.log('total amount:', totalAmount);

      return ret;
    })
}

// run()
function run() {
  getClientAddresses((clients) => {
    const clientAddresses = clients.map((client) => {
      return client.eth_address
    })

    // console.log(clients)

    // //ADDING THE OLD ACCOUNT FOR TRANSFERS DONE BEFORE
    // clientAddresses.push("0x91E8E1e174D93a8E50c10C3F49B9c5b3C0022966")

    getBalancesForAddresses(clientAddresses, (err, erc20Balances) => {
      if(err) {
        return error(err)
      }

      const sum = erc20Balances.reduce((accumulator, currentValue) => {
        return parseFloat(currentValue) + accumulator
      }, 0)

      console.log("SUM FROM BALANCES OF ADDRESSES")
      console.log(sum)
    })

    getTransactionsForAddresses(clientAddresses, (err, ERC20transaction) => {
      if(err) {
        return error(err)
      }

      const erc20Totals = ERC20transaction.reduce((accumulator, currentValue) => {
        return parseFloat(currentValue.amount) + accumulator
      }, 0)


      console.log("SUM FROM TRANSACTIONS OF ADDRESSES")
      console.log(erc20Totals)
      console.log(ERC20transaction.length)

      getSwapsInDb((dbSwaps) => {

        console.log("SUM FROM DB")
        console.log(dbSwaps)

        const clientBNBAddresses = clients.map((client) => {
          return client.bnb_address
        })

        // too many calls. API throttles me.
        // getBalancesBNB(clientBNBAddresses, (err, bnbAddressesBalances) => {
        //   if(err) {
        //     return error(err)
        //   }
        //   // console.log(bnbAddressesBalances)
        //
        //   const hmyBalances = bnbAddressesBalances.map((bnbAddressBalance) => {
        //
        //     let hmyBalance = bnbAddressBalance.filter((balance) => {
        //       return balance.symbol === 'hmy-585'
        //     }).map((balance) => {
        //       return balance.free
        //     })
        //
        //     return hmyBalance[0]
        //   })
        //
        //   const bnbTotals = hmyBalances.reduce((accumulator, currentValue) => {
        //     return parseFloat(currentValue) + accumulator
        //   }, 0)
        //
        //   console.log(bnbTotals)
        //   console.log(hmyBalances.length)
        // })
      })
    })
  })
}

function getClientAddresses(callback) {
  db.manyOrNone('select ca.uuid, ca.bnb_address, cea.address as eth_address from client_accounts ca left join client_eth_accounts cea on ca.client_eth_account_uuid = cea.uuid')
    .then(callback)
    .catch(error)
}

function getSwapsInDb(callback) {
  db.oneOrNone('select sum(amount::numeric), count(*) from swaps where token_uuid = $1 and deposit_transaction_hash is not null and client_account_uuid is not null;', [HMY_UUID])
    .then(callback)
    .catch(error)
}

function getSwapsDataFromDb(direction, callback) {
  db.manyOrNone('select * from swaps where token_uuid = $1 and direction = $2;', [HMY_UUID, direction])
    .then(swaps => {
      callback(swaps);
      return;
    })
    .catch(error => {
      callback(null, error);
      return;
    })
}

function getTransactionsForAddresses(clientAddresses, callback) {
  eth.getTransactionsForAddress(HMY_ERC, clientAddresses, callback)
}

function getBalancesForAddresses(addresses, callback) {
  async.map(addresses, (address, callbackInner) => {
    eth.getERC20Balance(address, HMY_ERC, callbackInner)
  }, (err, balances) => {
    if(err) {
      console.error(err)
    }

    callback(err, balances)
  })
}

function getBalancesBNB(addresses, callback) {
  async.map(addresses, (address, callbackInner) => {
    bnb.getBalance(address, callbackInner)
  }, (err, accountsBalances) => {
    if(err) {
      console.error(err);
    }
    callback(err, accountsBalances);
  })
}

function error(err) {
  console.error(err)
  return
}
