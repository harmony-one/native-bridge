/*
  DISPERSE LARGE ACCOUNT:
  1. Get the HMY balance of the account
  2. Divide that amount by the max amount per account (3 000 000 HMY)
  3. Create an account for the number returned above
  4. Transfer max amount (3 000 000 HMY) to each account
*/

const config = require('./config')
const eth = require('./helpers/eth.js')
const fs = require('fs');

const AVG_AMOUNT = 3500000
// const ERC20_CONTRACT = '0xD379255277e87E3636708A71F7A845A86f8c591d'
const ERC20_CONTRACT = '0x799a4202c12ca952cb311598a024c80ed371a41e'
const ADDRESS = ''
const PRIVATE_KEY = ''

process()

async function process() {
  eth.getERC20Balance(ADDRESS, ERC20_CONTRACT, (err, balance) => {
    if(err) {
      return error(err)
    }

    console.log("Current Balance: ", balance)

    const accountCount = parseInt(balance / AVG_AMOUNT)

    if(accountCount < 1) {
      console.log('Nothing to do here')
      return
    }

    createAccounts(accountCount, async (err, accounts) => {
      if(err) {
        return error(err)
      }

      let transactionHashs = []
      const minimum = 3000000
      const maximum = 4000000

      let i = 0
      // for(i = 0; i < 1; i++) {
      // for(i = 0; i < 1; i++) {
        // console.log(amount+'000000000000000000')

        var amount = Math.floor(Math.random() * (maximum - minimum + 1)) + minimum
        const hash = await eth.sendErc20Transaction(ERC20_CONTRACT, PRIVATE_KEY, ADDRESS,
          accounts[i].address, false /* earlyRet */, amount+'000000000000000000')
        transactionHashs.push(hash)
      // }

      console.log("Completed Transaction")
    })
  })
}


function createAccounts(accountCount, callback) {
  let accounts = []
  let i = 0
  // for(i = 0; i < (accountCount > 2 ? 2 : accountCount); i++) {
  // for(i = 0; i < 1; i++) {
  eth.createAccount((err, result) => {
    accounts.push({
      address: result.address,
      privateKey: result.privateKey
    })

    console.log(result.privateKey+","+result.address)
  })
  // }

  fs.appendFile('/Users/dennis.won/bnbridge.exchange/accounts/harmonyAccounts.txt', formatAccounts(accounts), function (err) {
    if (err) {
      callback(err)
      return
    }

    callback(null, accounts)
  });

}

function formatAccounts(accounts) {
  return accounts.map((account) => {
    return account.privateKey+','+account.address+"\r\n"
  }).join("")
}

function error(err) {
  console.error(err)
  return
}
