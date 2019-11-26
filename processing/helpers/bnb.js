const BnbApiClient = require('@binance-chain/javascript-sdk');
const axios = require('axios');
const config = require('../config')

const os = require('os');
const promiseSeries = require('promise.series')

const pty = require('node-pty');
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
const httpClient = axios.create({ baseURL: config.api });
console.log('binance sdk base url: ', config.api);

const bnb = {
  spawnProcess() {
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 8000,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env
    });
    return ptyProcess
  },

  test(callback) {
    const ptyProcess = bnb.spawnProcess()

    ptyProcess.on('data', function (data) {
      callback(data)
    });

    ptyProcess.write('cd ' + config.filePath + '\r');
    ptyProcess.write('./' + config.fileName + ' status -n ' + config.nodeHTTPS + '\r');
    ptyProcess.write('exit\r');
  },

  validateAddress(address) {
    const addressValid = BnbApiClient.crypto.checkAddress(address, config.prefix);
    return addressValid
  },

  getFees(callback) {
    const url = `${config.api}api/v1/fees`;
    return callbackPromise(url, callback)
  },

  createKey(name, password, callback) {
    const ptyProcess = bnb.spawnProcess()

    let buildResponse = ""

    ptyProcess.on('data', function (data) {
      // hack for dennis.won local environment
      if (data.indexOf("parse_git_branch") != -1) {
        return;
      }

      if (data.includes("Enter a passphrase")) {
        // process.stdout.write('Setting password to '+password);
        ptyProcess.write(password + '\r');
      }

      if (data.includes("Repeat the passphrase")) {
        // process.stdout.write('Confirming password to '+password);
        ptyProcess.write(password + '\r');
      }

      if (os.platform() !== 'win32') {
        buildResponse = buildResponse + data

        // indicates bnbcli finish data
        // NOTE: for ubuntu, use length 24 instead of 46 for length check.
        if (data.split(' ').length == 46) {
          process.stdout.write(data)

          const tmpData = buildResponse.split('\n');

          let publicKey = ''
          let address = ''
          let seedPhrase = ''

          for (var i = 0; i < tmpData.length; i++) {
            if (tmpData[i].indexOf("NAME:") >= 0 && tmpData[i].indexOf("TYPE:") >= 0 && tmpData[i].indexOf("ADDRESS:") >= 0 && tmpData[i].indexOf("PUBKEY:") >= 0) {

              let arr = tmpData[i + 1].split('\t').filter(Boolean)
              address = arr[2].replace('\r', '')
              publicKey = arr[3].replace('\r', '')
            }

            if (tmpData[i].split(" ").length == 24) {
              seedPhrase = tmpData[i].replace('\r', '')
            }
          }

          ptyProcess.write('exit\r');

          callback(null, {
            address,
            publicKey,
            seedPhrase
          })
        }
      } else {
        if (data.includes("**Important**")) {
          // process.stdout.write(data);
          const tmpData = data.replace(/\s\s+/g, ' ').replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').split(' ');
          const address = tmpData[6]
          const publicKey = tmpData[7]
          const seedPhrase = tmpData.slice(33, 57).join(' ')

          ptyProcess.write('exit\r');
          callback(null, {
            address,
            publicKey,
            seedPhrase
          })
        }
      }

      if (data.includes("override the existing name")) {
        // ptyProcess.write('n\r');
        // ptyProcess.write('exit\r');
        // callback('Symbol already exists')
        ptyProcess.write('y\r');
      }
    });

    ptyProcess.write('cd ' + config.filePath + '\r');
    ptyProcess.write('./' + config.fileName + ' keys add ' + name + '\r');
  },

  issue(tokenName, totalSupply, symbol, mintable, keyName, password, callback) {
    const ptyProcess = bnb.spawnProcess()

    ptyProcess.on('data', function (data) {
      process.stdout.write(data);

      if (data.includes("Issued ")) {

        let index = data.indexOf('Issued ' + symbol)
        let uniqueSymbol = data.substr(index + 7, (symbol.length + 4))

        callback(null, { uniqueSymbol })
        ptyProcess.write('exit\r');
      }

      if (data.includes("ERROR:")) {
        callback(data)
        ptyProcess.write('exit\r');
      }

      if (data.includes('Password to sign with')) {
        ptyProcess.write(password + "\r");
      }
    });

    const mintableString = mintable === true ? ' --mintable' : ''

    ptyProcess.write('cd ' + config.filePath + '\r');
    ptyProcess.write('./' + config.fileName + ' token issue --token-name "' + tokenName + '" --total-supply ' + totalSupply + ' --symbol ' + symbol + '' + mintableString + ' --from ' + keyName + ' --chain-id=' + config.chainID + ' --node=' + config.nodeData + ' --trust-node\r');
  },

  mint(amount, symbol, keyName, callback) {
    const ptyProcess = bnb.spawnProcess()

    ptyProcess.on('data', function (data) {
      // process.stdout.write(data);
      callback(null, data)
      ptyProcess.write('exit\r');
    });

    ptyProcess.write('cd ' + config.filePath + '\r');
    ptyProcess.write('./' + config.fileName + ' token mint --amount ' + amount + ' --symbol ' + symbol + ' --from ' + keyName + ' --chain-id=' + config.chainID + ' --node=' + config.nodeData + ' --trust-node\r');
  },

  burn(amount, symbol, keyName, callback) {
    const ptyProcess = bnb.spawnProcess()

    ptyProcess.on('data', function (data) {
      // process.stdout.write(data);
      callback(null, data)
      ptyProcess.write('exit\r');
    });

    ptyProcess.write('cd ' + config.filePath + '\r');
    ptyProcess.write('./' + config.fileName + ' token burn --amount ' + amount + ' --symbol ' + symbol + ' --from ' + keyName + ' --chain-id=' + config.chainID + ' --node=' + config.nodeData + ' --trust-node\r');
  },

  transfer(mnemonic, publicTo, amount, asset, message, callback) {
    const bnbClient = new BnbApiClient(config.api);
    bnbClient.chooseNetwork(config.network);

    mnemonic = mnemonic.replace(/(\r\n|\n|\r)/gm, "");

    const privateFrom = BnbApiClient.crypto.getPrivateKeyFromMnemonic(mnemonic);
    const publicFrom = BnbApiClient.crypto.getAddressFromPrivateKey(privateFrom, config.prefix);

    const sequenceURL = `${config.api}api/v1/account/${publicFrom}/sequence`;

    // console.log('private key', privateFrom, 'publicFrom', publicFrom);
    // console.log('mnemonic, publicTo, amount, asset, message', mnemonic, publicTo, amount, asset, message);
    // console.log('sequenceURL', sequenceURL);

    return callbackSequencePromise(bnbClient, privateFrom, sequenceURL, (bnbClient, sequence) => {
      // console.log('transfer httpClientgetsequenceURL bnbClient.transfer',
      //   publicFrom, publicTo, amount, asset, message, sequence);
      return bnbClient.transfer(publicFrom, publicTo, amount, asset, message, sequence)
    }, callback);
  },

  transferWithPrivateKey(privateFrom, publicTo, amount, asset, message, callback) {
    const bnbClient = new BnbApiClient(config.api);
    bnbClient.chooseNetwork(config.network);

    const publicFrom = BnbApiClient.crypto.getAddressFromPrivateKey(privateFrom, config.prefix);

    const sequenceURL = `https://dex.binance.org/api/v1/account/${publicFrom}/sequence`;

    // console.log('##########################################');
    // console.log(privateFrom, publicFrom, publicTo, amount, asset, message);
    // console.log('##########################################');
    // console.log('sequenceURL', sequenceURL);
    // console.log('##########################################');

    return callbackSequencePromise(bnbClient, privateFrom, sequenceURL, (bnbClient, sequence) => {
      // console.log('transfer httpClientgetsequenceURL bnbClient.transfer',
      //   publicFrom, publicTo, amount, asset, message, sequence);
      return bnbClient.transfer(publicFrom, publicTo, amount, asset, message, sequence)
    }, callback);
  },

  freeze(amount, symbol, keyName, callback) {
    const ptyProcess = bnb.spawnProcess()

    ptyProcess.on('data', function (data) {
      // process.stdout.write(data);
      callback(null, data)
      ptyProcess.write('exit\r');
    });

    ptyProcess.write('cd ' + config.filePath + '\r');
    ptyProcess.write('./' + config.fileName + ' token freeze --amount ' + amount + ' --symbol ' + symbol + ' --from ' + keyName + ' --chain-id=' + config.chainID + ' --node=' + config.nodeData + ' --trust-node\r');
  },

  unfreeze(amount, symbol, keyName, callback) {
    const ptyProcess = bnb.spawnProcess()

    ptyProcess.on('data', function (data) {
      // process.stdout.write(data);
      callback(null, data)
      ptyProcess.write('exit\r');
    });

    ptyProcess.write('cd ' + config.filePath + '\r');
    ptyProcess.write('./' + config.fileName + ' token unfreeze --amount ' + amount + ' --symbol ' + symbol + ' --from ' + keyName + ' --chain-id=' + config.chainID + ' --node=' + config.nodeData + ' --trust-node\r');
  },

  getBalance(address, callback) {
    const bnbClient = new BnbApiClient(config.api);
    bnbClient.chooseNetwork(config.network);
    bnbClient.getBalance(address).then((balances) => {
      // console.log(address, balances);
      if (callback) {
        callback(null, [address, balances])
      }
      return [address, balances]
    });
  },

  submitListProposal(symbol, keyName, password, initPrice, title, description, expireTime, votingPeriod, deposit, callback) {
    const ptyProcess = bnb.spawnProcess()

    ptyProcess.on('data', function (data) {
      process.stdout.write(data);

      if (data.includes('Password to sign with')) {
        ptyProcess.write(password + "\r");
      } else if (data.includes("ERROR:")) {
        callback(data)
        ptyProcess.write('exit\r');
      } else if (data.includes('TxHash')) {
        try {
          //
          // console.log("/******************/")
          // console.log(data)
          // console.log(data.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''))
          // console.log("/******************/")
          //
          // const responseJson = JSON.parse(data.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''))

          let removedJunk = data.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')

          const index = removedJunk.indexOf('"TxHash":')
          const hash = removedJunk.substring(index + 10, index + 74).trim()

          callback(null, hash)
          ptyProcess.write('exit\r');
        } catch (err) {
          callback(err)
          ptyProcess.write('exit\r');
        }
      }
    });

    ptyProcess.write('cd ' + config.filePath + '\r');
    ptyProcess.write('./' + config.fileName + ' gov submit-list-proposal --from ' + keyName + ' --base-asset-symbol ' + symbol + ' --quote-asset-symbol BNB --init-price ' + initPrice + ' --title "' + title + '" --description "' + description + '" --expire-time ' + expireTime + ' --voting-period ' + votingPeriod + ' --deposit ' + deposit + ':BNB --chain-id=' + config.chainID + ' --node=' + config.nodeData + ' --trust-node --json\r');
  },

  submitDeposit(proposalId, amount, keyName, callback) {
    const ptyProcess = bnb.spawnProcess()

    ptyProcess.on('data', function (data) {
      process.stdout.write(data);

      if (data.includes('Password to sign with')) {
        ptyProcess.write(password + "\r");
      }

      if (data.includes("Issued ")) {
        let index = data.indexOf('Issued ' + symbol)
        let uniqueSymbol = data.substr(index + 7, (symbol.length + 4))

        callback(null, data)
        ptyProcess.write('exit\r');
      }
    });

    ptyProcess.write('cd ' + config.filePath + '\r');
    ptyProcess.write('./' + config.fileName + ' gov deposit --from ' + keyName + '--proposal-id ' + proposalId + ' --deposit ' + amount + '：BNB --chain-id=' + config.chainID + ' --node=' + config.nodeData + ' --trust-node --json\r');
  },

  list(symbol, keyName, password, initPrice, proposalId, callback) {
    const ptyProcess = bnb.spawnProcess()

    ptyProcess.on('data', function (data) {
      process.stdout.write(data);

      if (data.includes('Password to sign with')) {
        ptyProcess.write(password + "\r");
      }

      if (data.includes("TxHash")) {
        try {
          const responseJson = JSON.parse(data.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''))

          callback(null, responseJson.TxHash)
          ptyProcess.write('exit\r');
        } catch (err) {
          callback(err)
          ptyProcess.write('exit\r');
        }
      }
    });

    ptyProcess.write('cd ' + config.filePath + '\r');
    ptyProcess.write('./' + config.fileName + ' dex list -s ' + symbol + ' --quote-asset-symbol BNB --from ' + keyName + ' --init-price ' + initPrice + ' --proposal-id ' + proposalId + ' --chain-id=' + config.chainID + ' --node=' + config.nodeData + ' --trust-node --json\r');
  },

  getListProposal(proposalId, callback) {
    const ptyProcess = bnb.spawnProcess()

    let buildResponse = ""

    ptyProcess.on('data', function (data) {

      // process.stdout.write(data);

      if (data.includes("ERROR:")) {
        callback(data)
        ptyProcess.write('exit\r');
      } else {

        if (os.platform() !== 'win32') {

          if (!data.includes("root@") && !data.includes("./bnbcli") && !data.includes("/0.5.8.1/linux/")) {
            buildResponse = buildResponse + data

            try {
              tmpData = buildResponse.replace(/\s\s+/g, ' ')
              const responseJson = JSON.parse(tmpData)

              callback(null, responseJson)
              ptyProcess.write('exit\r');
            } catch (err) {
              // console.log("THIS ERRORED")
              // console.log(buildResponse)
              //ignore for now, we need to build more
            }
          }
        } else {
          if (data.includes("gov/TextProposal")) {
            try {
              let tmpData = data.replace(/\s\s+/g, ' ').replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

              if (tmpData.includes(' PS ')) {
                let index = tmpData.indexOf(' PS ')
                tmpData = tmpData.substring(0, index).trim()
              }

              // console.log(tmpData)
              const responseJson = JSON.parse(tmpData)

              callback(null, responseJson)
              ptyProcess.write('exit\r');
            } catch (err) {
              callback(err)
              ptyProcess.write('exit\r');
            }
          }
        }
      }
    });

    ptyProcess.write('cd ' + config.filePath + '\r');
    ptyProcess.write('./' + config.fileName + ' gov query-proposal --proposal-id ' + proposalId + ' --chain-id=' + config.chainID + ' --node=' + config.nodeData + ' --trust-node\r');
  },

  getListProposals(address, symbol, callback) {
    const ptyProcess = bnb.spawnProcess()

    ptyProcess.on('data', function (data) {

      process.stdout.write(data);

      if (data.includes("ERROR:")) {
        callback(data)
        ptyProcess.write('exit\r');
      } else if (data.includes(symbol)) {
        const responseObj = data.trim().split(' ')

        let proposalId = null
        if (responseObj.length > 0) {
          proposalId = responseObj[0]

          callback(null, proposalId)
          ptyProcess.write('exit\r');
          return
        }

        callback('Unable to process')
        ptyProcess.write('exit\r');
      }
    });

    ptyProcess.write('cd ' + config.filePath + '\r');
    ptyProcess.write('./' + config.fileName + ' gov query-proposals --depositer ' + address + ' --chain-id=' + config.chainID + ' --node=' + config.nodeData + ' --trust-node\r');
  },

  vote() {

  },

  createAccountWithKeystore(password) {
    const bnbClient = new BnbApiClient(config.api);
    bnbClient.chooseNetwork(config.network);
    const result = bnbclient.createAccountWithKeystore(password)
    return result
  },

  createAccountWithMneomnic() {
    const bnbClient = new BnbApiClient(config.api);
    bnbClient.chooseNetwork(config.network);
    const result = bnbClient.createAccountWithMneomnic()
    return result
  },

  generateKeyStore(privateKey, password) {
    const result = BnbApiClient.crypto.generateKeyStore(privateKey, password);
    return result
  },

  getTx(txHash, callback) {
    const bnbClient = new BnbApiClient(config.api);
    bnbClient.chooseNetwork(config.network);
    const url = `${config.api}api/v1/tx/${txHash}?format=json`;
    return callbackPromise(url, callback)
  },

  getTransactionsForAddress(address, symbol, side, startTime, endTime, limit, callback) {
    const bnbClient = new BnbApiClient(config.api);
    bnbClient.chooseNetwork(config.network);
    // https://docs.binance.org/api-reference/dex-api/paths.html#apiv1transactions
    let url = `${config.api}api/v1/transactions?address=${address}&txType=TRANSFER&txAsset=${symbol}` +
      `&side=${side}&startTime=${startTime}&endTime=${endTime}`;
    if (limit && limit > 0) {
      url += `&limit=${limit}`
    }
    return callbackPromise(url, callback)
  },

}

function callbackPromise(url, callback) {
  const ret = httpClient.get(url)

  if (!callback) {
    return ret;
  }

  ret.then((res) => {
    callback(null, res)
  }).catch((error) => {
    callback(error)
  });

  return ret
}

function callbackSequencePromise(bnbClient, privateFrom, sequenceURL, callbackInner, callback) {
  return promiseSeries([
    () => bnbClient.initChain(),
    () => bnbClient.setPrivateKey(privateFrom),
  ]).then(() => {
    return httpClient.get(sequenceURL).then((res) => {
      const sequence = res.data.sequence || 0
      return callbackInner(sequence)
    }).then((result) => {
      if (!callback) {
        return results;
      }

      if (result.status === 200) {
        callback(null, result)
      } else {
        callback(result)
      }
    }).catch((error) => {
      if (!callback) {
        throw error
      }
      callback(error)
    });
  });
}

module.exports = bnb
