const config = require('../config')

const bip39 = require("bip39");

const abiDecoder = require('abi-decoder');
abiDecoder.addABI(config.erc20ABI);

// import or require Harmony class
const { Harmony } = require('@harmony-js/core');

// import or require settings
const { ChainID, ChainType } = require('@harmony-js/utils');

const URL_TESTNET = `https://api.s0.b.hmny.io`;
const URL_MAINNET = `https://api.s0.t.hmny.io`;

// 1. initialize the Harmony instance

const harmony = new Harmony(
  // rpc url
  URL_MAINNET,
  {
    // chainType set to Harmony
    chainType: ChainType.Harmony,
    // chainType set to HmyLocal
    chainId: ChainID.HmyMainnet,
  },
);

const shardID = 0, toShardID = 0

const hmy = {

  async setSharding() {
    // Harmony is a sharded blockchain, each endpoint have sharding structure,
    // However sharding structure is different between mainnet, testnet and local testnet
    // We need to get sharding info before doing cross-shard transaction
    const res = await harmony.blockchain.getShardingStructure();
    harmony.shardingStructures(res.result);
  },

  // get balance from shard 0 only
  getBalance(address, callback) {
    harmony.blockchain.getBalance({
      address: address
    })
      .then((balance) => {
        const balanceInOne = harmony.utils.hexToNumber(balance.result) / 1e18
        callback(null, balanceInOne);
      })
      .catch(callback);
  },

  async transfer(privateKey, mnemonic, to, amount, callback) {
    // either privateKey or mnemonic required
    const sender = privateKey
      ? harmony.wallet.addByPrivateKey(privateKey)
      : harmony.wallet.addByMnemonic(mnemonic);

    if (shardID != toShardID) {
      // run set sharding first, if you want to make a cross-shard transaction
      await setSharding();
    }

    // acmount converted to big
    // use Unit class as Gwei, then toWei(), which will be transformed to BN
    const amountBig = new harmony.utils.Unit((amount * 1e9).toString()).asGwei().toWei();

    const gasLimit = '210000'
    const gasPriceInGwei = '100'

    // construct transaction object with correct unit and format
    const txn = harmony.transactions.newTx({
      //  token send to
      to: to,
      // amount to send in BigNumber
      value: amountBig,
      // gas limit, you can use string
      gasLimit: gasLimit,
      // send token from shardID
      shardID: shardID,
      // send token to toShardID
      toShardID: toShardID,
      // gas Price, unit in wei, in BigNumber
      gasPrice: new harmony.utils.Unit(gasPriceInGwei).asGwei().toWei(),
    });

    // sign the transaction use wallet;
    const signedTxn = await harmony.wallet.signTransaction(txn);

    // Now you can use `Transaction.observed()` to listen events

    // Frontend received back the signedTxn and do the followings to Send transaction.
    signedTxn
      .observed()
      .on('transactionHash', (txnHash) => {
        console.log('');
        console.log('--- hash ---');
        console.log('');
        console.log(txnHash);
        console.log('');
      })
      .on('receipt', (receipt) => {
        console.log('');
        console.log('--- receipt ---');
        console.log('');
        console.log(receipt);
        console.log('');
      })
      .on('cxReceipt', (receipt) => {
        console.log('');
        console.log('--- cxReceipt ---');
        console.log('');
        console.log(receipt);
        console.log('');
      })
      .on('error', (error) => {
        console.log('');
        console.log('--- error ---');
        console.log('');
        console.log(error);
        console.log('');

        callback(error)
      });

    // send the txn, get [Transaction, transactionHash] as result

    const [sentTxn, txnHash] = await signedTxn.sendTransaction();

    // to confirm the result if it is already there

    const confiremdTxn = await sentTxn.confirm(txnHash);

    // if the transactino is cross-shard transaction
    if (!confiremdTxn.isCrossShard()) {
      if (confiremdTxn.isConfirmed()) {
        console.log('--- Result ---');
        console.log('');
        console.log('Normal transaction');
        console.log(`${txnHash} is confirmed`);
        console.log('');

        callback(null, txnHash);
      }
    }
    if (confiremdTxn.isConfirmed() && confiremdTxn.isCxConfirmed()) {
      console.log('--- Result ---');
      console.log('');
      console.log('Cross-Shard transaction');
      console.log(`${txnHash} is confirmed`);
      console.log('');

      callback(null, txnHash);
    }
  },

  async sendTransaction(privateKey, to, amount, earlyRet, callback) {
    let retry = 0;
    let callbackCalled = false;

    while (true) {
      // either privateKey or mnemonic required
      const sender = privateKey
        ? harmony.wallet.addByPrivateKey(privateKey)
        : harmony.wallet.addByMnemonic(mnemonic);

      if (shardID != toShardID) {
        // run set sharding first, if you want to make a cross-shard transaction
        await setSharding();
      }

      // acmount converted to big
      // use Unit class as Gwei, then toWei(), which will be transformed to BN
      const amountBig = new harmony.utils.Unit((amount * 1e9).toString()).asGwei().toWei();

      const gasLimit = '210000'
      const gasPriceInGwei = '100'

      // construct transaction object with correct unit and format
      const txn = harmony.transactions.newTx({
        //  token send to
        to: to,
        // amount to send in BigNumber
        value: amountBig,
        // gas limit, you can use string
        gasLimit: gasLimit,
        // send token from shardID
        shardID: shardID,
        // send token to toShardID
        toShardID: toShardID,
        // gas Price, unit in wei, in BigNumber
        gasPrice: new harmony.utils.Unit(gasPriceInGwei).asGwei().toWei(),
      });

      console.log(`Sending native ONE transaction (retry num: ${retry})`, txn);

      // sign the transaction use wallet;
      const signedTxn = await harmony.wallet.signTransaction(txn);

      // Now you can use `Transaction.observed()` to listen events

      // Frontend received back the signedTxn and do the followings to Send transaction.
      signedTxn
        .observed()
        .on('transactionHash', (txnHash) => {
          console.log('');
          console.log('--- hash ---');
          console.log('');
          console.log(txnHash);
          console.log('');
        })
        .on('receipt', (receipt) => {
          console.log('');
          console.log('--- receipt ---');
          console.log('');
          console.log(receipt);
          console.log('');
        })
        .on('cxReceipt', (receipt) => {
          console.log('');
          console.log('--- cxReceipt ---');
          console.log('');
          console.log(receipt);
          console.log('');
        })
        .on('error', (error) => {
          console.log('');
          console.log('--- error ---');
          console.log('');
          console.log(error);
          console.log('');

          callback(error)
        });

      console.log(`Attempting to send signed tx\n------------------------`);

      try {
        // send the txn, get [Transaction, transactionHash] as result
        const [sentTxn, txnHash] = await signedTxn.sendTransaction();

        // to confirm the result if it is already there
        const confiremdTxn = await sentTxn.confirm(txnHash);

        // if the transaction is cross-shard transaction
        if (!confiremdTxn.isCrossShard()) {
          if (confiremdTxn.isConfirmed()) {
            console.log('--- Result ---');
            console.log('');
            console.log('Normal transaction');
            console.log(`${txnHash} is confirmed`);
            console.log('');

            if (!callbackCalled) {
              callback(null, txnHash);
              callbackCalled = true
            }
          }
        }
        if (confiremdTxn.isConfirmed() && confiremdTxn.isCxConfirmed()) {
          console.log('--- Result ---');
          console.log('');
          console.log('Cross-Shard transaction');
          console.log(`${txnHash} is confirmed`);
          console.log('');

          if (!callbackCalled) {
            callback(null, txnHash);
            callbackCalled = true
          }
        }

        return null, txnHash
      } catch (err) {
        console.error('[Error] sendTransaction', err)
        if (retry == 2) {
          if (!callbackCalled) {
            callback(err)
            callbackCalled = true
          }
          return err, null
        } else {
          retry++;
          console.log(`Retrying native ONE tx... ${retry}`)
        }
      }
    }

  },
}

module.exports = hmy
