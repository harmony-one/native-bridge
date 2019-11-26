/*
  GET all the client_accounts
  Add all the DB values + count

  Get all the transactions from Eth

  Get all the transactions from Binance
*/
const db = require('./helpers/db.js').db
const config = require('./config')
const bnb = require('./helpers/bnb.js')
const eth = require('./helpers/eth.js')
const async = require('async')

const HMY_UUID = "ONE_uuid"
// const HMY_ERC = "0xD379255277e87E3636708A71F7A845A86f8c591d"
const HMY_ERC = "0x799a4202c12ca952cb311598a024c80ed371a41e"

process()

function process() {
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
  }, (err, [address, balances]) => {
    if(err) {
      console.error(err)
    }
    callback(err, balances)
  })
}



function error(err) {
  console.error(err)
  return
}
