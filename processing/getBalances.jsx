/*
  GET BALANCES:
  1. Load the file with accounts
  2. call getBalance on smart contract
  3. Add all the balances
*/

const config = require('./config')
const eth = require('./helpers/eth.js')
const fs = require('fs');
const async = require('async');

// const ERC20_CONTRACT = '0xD379255277e87E3636708A71F7A845A86f8c591d'
const ERC20_CONTRACT = '0x799a4202c12ca952cb311598a024c80ed371a41e'

loadFile()

function loadFile() {
  var text = fs.readFileSync('/Users/dennis.won/bnbridge.exchange/accounts/harmonyAccounts_final.txt','utf8')
  processFile(text)
}

function processFile(content) {

  let lines = content.split("\r\n")

  lines.map((line) => {

  })

  async.map(lines, (line, callback) => {
    if(line=="") {
      return callback(null, '0')
    }

    let address = line.split(",")[1]

    eth.getERC20Balance(address, ERC20_CONTRACT, (err, res) => {

      if(res == "0") {
        console.log(address)
      }

      callback(err, res)
    })
  }, (err, result) => {
    if(err) {
      console.error(err)
      return
    }

    console.log(result)

    let balance = result.reduce((accumulator, currentValue) => {
      return parseFloat(currentValue) + accumulator
    }, 0)

    console.log(balance)
  })

}

function error(err) {
  console.error(err)
  return
}
