const models = require('../models')
const bnb = require('../helpers/bnb.js');
const eth = require('../helpers/eth.js')

const yargs = require('yargs');

const BNB_GAS_FEE = 0.000375 // in BNB
const BNB_FUND_ACCT_PRIVATE_KEY = process.env.BNB_FUND_ACCT_PRIVATE_KEY
const BNB_FOUNDATION_ACCT_ADDRESS = process.env.BNB_FOUNDATION_ACCT_ADDRESS

const ETH_FUND_ACCT_ADDRESS = process.env.ETH_FUND_ACCT_ADDRESS
const ETH_FUND_ACCT_PRIVATE_KEY = process.env.ETH_FUND_ACCT_PRIVATE_KEY
const ETH_FOUNDATION_ACCT_ADDRESS = process.env.ETH_FOUNDATION_ACCT_ADDRESS
const ETH_GAS_FEE = 0.0005 // in ETH
const ERC20_ADDRESS = process.env.ERC20_ADDRESS

const argv = yargs
  .command('bnb', 'backfill bnb transfer', function (yargs) {
    return yargs.options({
      'b': {
        alias: 'bnbaddress',
        demandOption: true,
        describe: 'which bnb address to backfill for',
        type: 'string'
      },
      'a': {
        alias: 'amount',
        demandOption: true,
        describe: 'how much (in float) to backfill transfer from the input address',
        type: 'number'
      },
      'f': {
        alias: 'fundBnb',
        default: false,
        describe: 'if set true, first transfer BNB fee for funding gas',
        type: 'boolean'
      }
    })
  })
  .command('eth', 'eth operation', function (yargs) {
    return yargs.options({
      'e': {
        alias: 'ethaddress',
        demandOption: true,
        describe: 'which eth address to backfill for',
        type: 'string'
      },
      'a': {
        alias: 'amount',
        demandOption: true,
        describe: 'how much (in float) to backfill transfer from the input address',
        type: 'number'
      },
      'f': {
        alias: 'fundEth',
        default: false,
        describe: 'if set true, first transfer ETH fee for funding gas',
        type: 'boolean'
      }
    })
  })
  .help()
  .alias('help', 'h')
  .argv;

const cmd = argv._[0]

if (cmd === 'bnb') {
  const bnbaddress = argv.bnbaddress
  const amount = argv.amount
  const fundBnb = argv.fundBnb

  console.log(bnbaddress, amount, fundBnb);

  models.getClientBnbKey(bnbaddress, (err, key) => {
    if (err || !key) {
      console.error('[ERROR] getClientBnbKey', err)
      return bnbaddress, null
    }

    console.log(`client ${bnbaddress}`, key);
    if (fundBnb) {
      bnb.transferWithPrivateKey(BNB_FUND_ACCT_PRIVATE_KEY, bnbaddress, BNB_GAS_FEE,
        'BNB', 'Bnb gas for re-sending to Foundation', (err, txResult1) => {
          if (err) {
            console.error('[ERROR] bnb transferWithPrivateKey', err)
            return bnbaddress, null
          }

          if (txResult1 && txResult1.result && txResult1.result.length > 0) {
            let resultHash = txResult1.result[0].hash // tx hash that funded bnb account
            console.log('Successfully funded client bnb account: ' + bnbaddress + ' resultHash: ' + resultHash);
            return bnbTransfer(bnbaddress, key, amount)
          } else {
            return bnbaddress, null
          }
        })
    } else {
      return bnbTransfer(bnbaddress, key, amount)
    }
  })
}

if (cmd === 'eth') {
  const ethaddress = argv.ethaddress
  const amount = argv.amount
  const fundEth = argv.fundEth

  models.getClientEthKey(ethaddress, (err, key) => {
    if (err || !key) {
      const cbError = err || 'getClientEthKey: Unable to retrieve key'
      console.error('[Error] ' + cbError)
      return
    }

    console.log(`client ${ethaddress}`, key);

    if (fundEth) {
      const message = `backfill: funding eth gas`
      eth.fundEthForGasFee(
        ETH_FUND_ACCT_PRIVATE_KEY,
        ETH_FUND_ACCT_ADDRESS,
        ethaddress,
        ETH_GAS_FEE, message,
        false, (err, txResult1) => {
          if (err || !txResult1) {
            console.error(`Failed to fund eth for gas fee (${ETH_GAS_FEE} eth) ' +
              'for account ${ethaddress} (pk: ${ETH_FUND_ACCT_PRIVATE_KEY})`, err);
            return
          }

          let resultHash = txResult1  // tx hash that funded client eth account
          console.log('Successfully funded client eth account: ' + key.eth_address + ' resultHash: ' + resultHash);

          console.log('4. Transfer the BNBridge Swap eth deposit to the foundation account');
          // 2. then, now that eth account is funded, send the deposit to the foundation account
          return ethTransfer(ethaddress, key, amount)
        })
    } else {
      return ethTransfer(ethaddress, key, amount)
    }
  })
}

function bnbTransfer(bnbaddress, key, amount) {
  bnb.transfer(key.mnemonic, BNB_FOUNDATION_ACCT_ADDRESS, amount, 'ONE-5F9',
    'Re-sending BNBridge Swap bnb deposit to the foundation account', (err, txResult2) => {

      if (err) {
        console.error(`[ERROR] bnb transfer to client ${bnbaddress}`, err)
        return bnbaddress, null
      }

      if (txResult2 && txResult2.result && txResult2.result.length > 0) {
        const txhash = txResult2.result[0].hash
        console.log(`bnb transfer to client ${bnbaddress} txhash: ${txhash} amount: ${amount}`)
        return bnbaddress, txhash
      } else {
        console.error(`bnb transfer to client ${bnbaddress} amount: ${amount}`, err)
        return bnbaddress, null
      }
    })
}

function ethTransfer(ethaddress, key, amount) {
  eth.sendErc20Transaction(
    ERC20_ADDRESS,
    key.private_key_decrypted.substring(2), // need to strip out '0x' in front
    ethaddress,
    ETH_FOUNDATION_ACCT_ADDRESS,
    amount, false, (err, txResult2) => {
      if (err || !txResult2) {
        console.error(`Failed to sending erc20 for re-preocessing ' +
          'for account ${ethaddress} (pk: ${key.private_key_decrypted.substring(2)})`, err);
        return
      }

      const resultHash = txResult2

      // eth tx to foundation failed. not a hard failure, but we already got notified.
      if (!resultHash) {
        console.error('[Error] Missing tx hash for the Eth tx made to the foundation account from client.');
      } else {
        console.log('Successfully transferred client eth deposit to foundation account. TxHash:', resultHash);
      }

      return ethaddress, resultHash
    }
  )
}
