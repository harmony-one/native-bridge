const Web3 = require('web3');
const config = require('../config')

var web3 = new Web3(new Web3.providers.HttpProvider(config.provider));

const contractAddress = '0xD379255277e87E3636708A71F7A845A86f8c591d'
const accountAddress = '0x05C6651BF91B37184fE340F61dD76D41034e9922'
const depositAddress = '0x05C6651BF91B37184fE340F61dD76D41034e9922'

function getTransactions(contractAddress, accountAddress, depositAddress, callback) {

  let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

  myContract.getPastEvents('Transfer', {
    fromBlock: 0,
    toBlock: 'latest',
    filter: { _to: depositAddress, _from: accountAddress }
  })
  .then((events) => {
    let returnEvents = events.filter((event) => {
      if(event.returnValues._from.toUpperCase() == accountAddress.toUpperCase() && event.returnValues._to.toUpperCase() == depositAddress.toUpperCase()) {
        let amount = parseFloat(web3.utils.fromWei(event.returnValues._value, 'ether'))
        console.log(amount)
        return true
      }
    })

    callback(null, returnEvents)
  })
  .catch(callback);

}


getTransactions(contractAddress, accountAddress, depositAddress, (err, result) => {
  if(err) {
    console.log("ERR")
    console.error(err)
    return
  }

  console.log(result)
})
