const BnbApiClient = require('@binance-chain/javascript-sdk');
const axios = require('axios');

const MNEMONIC = '';
// const HTTP_API = 'https://testnet-dex.binance.org';
const HTTP_API = 'https://dex.binance.org';
const ASSET = 'BNB' // 'ONE-5F9';
const AMOUNT = '0.000375' // '3.75';
const ADDRESS_TO = 'bnb1ylm46q5zh506avuuqg540tncu20up0mvlkqxh4';
const MESSAGE = 'MEMO';
const NETWORK = 'mainnet';
const PREFIX = 'bnb';

const bnbClient = new BnbApiClient(HTTP_API);
bnbClient.chooseNetwork(NETWORK)

const PRIVATE_KEY = process.env.BNB_FUND_ACCT_PRIVATE_KEY // BnbApiClient.crypto.getPrivateKeyFromMnemonic(MNEMONIC);
const ADDRESS_FROM = 'bnb18xvlduz3sv4d94ddanp5gtfdhpsmf4ts55pvz7' // BnbApiClient.crypto.getAddressFromPrivateKey(PRIVATE_KEY, PREFIX);

console.log(ADDRESS_FROM)
const httpClient = axios.create({ baseURL: HTTP_API });
const sequenceURL = `${HTTP_API}/api/v1/account/${ADDRESS_FROM}/sequence`;

console.log(sequenceURL);

bnbClient.setPrivateKey(PRIVATE_KEY);
bnbClient.initChain();

httpClient
  .get(sequenceURL)
  .then((res) => {
      const sequence = res.data.sequence || 0
      console.log(sequence)
      return bnbClient.transfer(ADDRESS_FROM, ADDRESS_TO, AMOUNT, ASSET, MESSAGE, sequence)
  })
  .then((result) => {
      console.log(result);
      if (result.status === 200) {
        console.log('success', result.result[0].hash);
      } else {
        console.error('error', result);
      }
  })
  .catch((error) => {
    console.error('error', error);
  });
