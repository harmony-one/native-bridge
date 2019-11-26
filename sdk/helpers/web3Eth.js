const Eth = require("web3-eth");
const Utils = require("web3-utils");

const Web3 = require('web3');
const client = require('node-rest-client-promise').Client();
const INFURA_KEY = "981292667b474eb593bfce7d7cffe047";
const ETHERSCAN_API_KEY = "4NG65VFPEV6ITUIBXDIREEMPU8GRDN6MGU";
const web3 = new Web3('wss://mainnet.infura.io/ws/v3/' + INFURA_KEY);
const CONTRACT_ADDRESS = "0x799a4202c12ca952cb311598a024c80ed371a41e";
const etherescan_url = `http://api.etherscan.io/api?module=contract&action=getabi&address=${CONTRACT_ADDRESS}&apikey=${ETHERSCAN_API_KEY}`

const config = require('../config')

async function getERC20TransactionsByAddress(
  tokenContractAddress,
  tokenDecimals,
  address,
  fromBlock
) {
  // initialize the ethereum client
  const eth = new Eth(config.provider);

  const currentBlockNumber = await eth.getBlockNumber();
  // if no block to start looking from is provided, look at tx from the last day
  // 86400s in a day / eth block time 10s ~ 8640 blocks a day, ~ 360 blocks an hour
  if (!fromBlock) fromBlock = currentBlockNumber - 360 * 3;

  const contract = new eth.Contract(config.erc20ABI, tokenContractAddress);
  const transferEvents = await contract.getPastEvents("Transfer", {
    fromBlock,
    filter: {
      isError: 0,
      txreceipt_status: 1
    },
    topics: [
      Utils.sha3("Transfer(address,address,uint256)"),
      null,
      Utils.padLeft(address, 64)
    ]
  });

  return transferEvents
    .sort((evOne, evTwo) => evOne.blockNumber - evTwo.blockNumber)
    .map(({ blockNumber, transactionHash, returnValues }) => {
      return {
        transactionHash,
        confirmations: currentBlockNumber - blockNumber,
        amount: returnValues._value * Math.pow(10, -tokenDecimals)
      };
    });
}

async function getContractAbi() {
  const etherescan_response = await client.getPromise(etherescan_url)
  const CONTRACT_ABI = JSON.parse(etherescan_response.data.result);
  return CONTRACT_ABI;
}

async function transferQuery() {
  const contract = new web3.eth.Contract(config.erc20ABI, CONTRACT_ADDRESS);

  const START_BLOCK = 8863218;
  contract.getPastEvents("Transfer",
    {
      fromBlock: START_BLOCK,
      toBlock: 'latest',
    })
    .then(events => console.log(events))
    .catch((err) => console.error(err));
}

// transferQuery();

const address = '0xABe6B2b84A55d56Fd13EF2062e47F5e40a18392C';
const events = getERC20TransactionsByAddress(CONTRACT_ADDRESS, 0, address);
