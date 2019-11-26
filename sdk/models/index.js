const db = require('../helpers/db.js').db;
const config = require('../config');
const bnb = require('../helpers/bnb.js');
const eth = require('../helpers/eth.js');
const emailer = require('../helpers/emailer.js');
const async = require('async');
const generator = require('generate-password');
const crypto = require('crypto');
const sha256 = require('sha256');
const bip39 = require('bip39');
const algorithm = 'aes-256-ctr';

const KEY = 'witness canyon foot sing song tray task defense float bottom town obvious faint globe door tonight alpha battle purse jazz flag author choose whisper';

const BNB_FUND_ACCT_PRIVATE_KEY = process.env.BNB_FUND_ACCT_PRIVATE_KEY
const BNB_FOUNDATION_ACCT_ADDRESS = process.env.BNB_FOUNDATION_ACCT_ADDRESS
const BNB_FOUNDATION_ACCT_PRIVATE_KEY = process.env.BNB_FOUNDATION_ACCT_PRIVATE_KEY
const BNB_GAS_FEE = 0.000375 // in BNB

const ETH_FUND_ACCT_ADDRESS = process.env.ETH_FUND_ACCT_ADDRESS
const ETH_FUND_ACCT_PRIVATE_KEY = process.env.ETH_FUND_ACCT_PRIVATE_KEY
const ETH_FOUNDATION_ACCT_ADDRESS = process.env.ETH_FOUNDATION_ACCT_ADDRESS
const ETH_GAS_FEE = 0.0005 // in ETH

const models = {

  encrypt(text, password){
    var cipher = crypto.createCipher(algorithm,password)
    var crypted = cipher.update(text,'utf8','hex')
    crypted += cipher.final('hex');
    return crypted;
  },

  decrypt(text, password){
    var decipher = crypto.createDecipher(algorithm,password)
    var dec = decipher.update(text,'hex','utf8')
    dec += decipher.final('utf8');
    return dec;
  },

  decryptPayload(req, res, next, callback) {
    const m = req.body.m;
    const e = req.body.e;
    const t = req.body.t;
    const s = req.body.s;
    const u = req.body.u;
    const p = req.body.p;

    if (!m || !e || !t || !s || !u || !p) {
      res.status(501)
      res.body = { 'status': 501, 'success': false, 'message': 'Invalid payload' }
      return next(null, req, res, next)
    }

    const mnemonic = m.hexDecode()
    const encrypted = e.hexDecode()
    const time = t
    const signature = s

    const sig = {
      e: e,
      m: m,
      u: u,
      p: p,
      t: t
    }
    const seed = JSON.stringify(sig)
    const compareSignature = sha256(seed)

    if (compareSignature !== signature) {
      res.status(501)
      res.body = { 'status': 501, 'success': false, 'message': 'Signature mismatch' }
      return next(null, req, res, next)
    }

    const payload = decrypt(encrypted, mnemonic)

    var data = null
    try {
      data = JSON.parse(payload)
      callback(data)
    } catch (ex) {
      res.status(501)
      res.body = { 'status': 501, 'success': false, 'message': ex }
      return next(null, req, res, next)
    }
  },

  decryptCall(req, res, next) {
    models.decryptPayload(req, res, next, (data) => {
      res.status(200)
      res.body = { 'status': 200, 'success': true, 'result': data }
      return next(null, req, res, next)
    })
  },

  /**
   *  Creates a new BNB account for the token (privateKey)
   *  Creates a new Eth account for the token (privateKey)
   *  Inserts the BNB/Eth pairing into the DB with the Token details
   */
  createToken(req, res, next) {

    models.decryptPayload(req, res, next, (data) => {

      let result = models.validateCreateToken(data)

      if(result !== true) {
        res.status(400)
        res.body = { 'status': 400, 'success': false, 'result': result }
        return next(null, req, res, next)
      }

      models.insertToken(data, (err, response) => {
        if(err || !response) {
          console.error(err)
          res.status(500)
          res.body = { 'status': 500, 'success': false, 'result': err }
          return next(null, req, res, next)
        } else {
          const uuid = response.uuid

          async.parallel([
            (callback) => { models.processBNBAccount(data, callback) },
            (callback) => { models.processEthAccount(data, callback) }
          ], (err, data) => {
            if(err) {
              console.error(err)
              res.status(500)
              res.body = { 'status': 500, 'success': false, 'result': 'Unable to process request' }
              return next(null, req, res, next)
            }
            let bnbUUID = data[0]
            let ethUUID = data[1]

            models.updateTokenAddresses(uuid, bnbUUID, ethUUID, (err, updateResponse) => {
              models.getTokenInfo(uuid, (err, getResponse) => {
                if(err) {
                  console.error(err)
                  res.status(500)
                  res.body = { 'status': 500, 'success': false, 'result': 'Unable to retrieve token information' }
                  return next(null, req, res, next)
                }

                res.status(205)
                res.body = { 'status': 200, 'success': true, 'result': getResponse }
                return next(null, req, res, next)
              })
            })
          })

        }
      })


    })
  },

  validateCreateToken(body, response) {
    const {
      name,
      symbol,
      total_supply,
      erc20_address
    } = body
    if(!name) {
      return 'name is required'
    }
    if(!symbol) {
      return 'symbol is required'
    }
    if(!total_supply) {
      return 'total_supply is required'
    }
    if(!erc20_address) {
      return 'erc20_address is required'
    }

    return true
  },

  insertToken(body, callback) {
    let {
      name,
      symbol,
      total_supply,
      erc20_address,
      mintable
    } = body

    total_supply = total_supply*100000000 // multiply by 8 deceimals of binance
    total_supply = total_supply.toFixed(0)

    db.oneOrNone('insert into tokens (uuid, name, symbol, total_supply, erc20_address, mintable, eth_to_bnb_enabled, bnb_to_eth_enabled, created) values (md5(random()::text || clock_timestamp()::text)::uuid, $1, $2, $3, $4, $5, true, true, timezone(\'utc\', now())) returning uuid', [name, symbol, total_supply, erc20_address, mintable])
    .then((response) => {
      callback(null, response)
    })
    .catch(callback)
  },

  genPassword() {
    return generator.generate({
      length: 20,
      numbers: true,
      symbols: false,
      uppercase: true,
      strict: true
    })
  },

  processBNBAccount(body, callback) {
    const { symbol } = body
    const keyName = config.keyPrepend+symbol+'_key_bnb'
    const password = models.genPassword()

    bnb.createKey(keyName, password, (err, keyData) => {
      if(err) {
        console.error(err)
        callback(err)
      }

      models.insertBNBAccount(keyName, password, keyData, callback)
    })
  },

  insertBNBAccount(keyName, keyPassword, keyData, callback) {
    db.oneOrNone('insert into bnb_accounts (uuid, public_key, address, seed_phrase, key_name, password, encr_key, created) values (md5(random()::text || clock_timestamp()::text)::uuid, $1, $2, $3, $4, $5, $6, timezone(\'utc\', now())) returning uuid;', [keyData.publicKey, keyData.address, aes256seed, keyName, aes256password, dbPassword])
    .then((response) => {
      callback(null, response)
    })
    .catch(callback)
  },

  processEthAccount(body, callback) {
    eth.createAccount((err, account) => {
      if(err) {
        console.error(err)
        return callback(err)
      }

      models.insertEthAccount(account, callback)
    })
  },

  insertEthAccount(account, callback) {
    const dbPassword = bip39.generateMnemonic()
    const password = KEY+':'+dbPassword
    const aes256private = models.encrypt(account.privateKey, password)

    db.oneOrNone('insert into eth_accounts (uuid, private_key, address, encr_key, created) values (md5(random()::text || clock_timestamp()::text)::uuid, $1, $2, $3, timezone(\'utc\', now())) returning uuid;',
      [aes256private, account.address, dbPassword])
    .then((response) => {
      callback(null, response)
    })
    .catch(callback)
  },

  updateTokenAddresses(uuid, bnbUUID, ethUUID, callback) {
    db.none('update tokens set bnb_account_uuid=$1, eth_account_uuid=$2 where uuid=$3;', [bnbUUID.uuid, ethUUID.uuid, uuid])
    .then(callback)
    .catch(callback)
  },

  getTokenInfo(uuid, callback) {
    db.oneOrNone('select tok.uuid, tok.name, tok.symbol, tok.unique_symbol, tok.total_supply, tok.erc20_address, tok.mintable, tok.fee_per_swap, tok.minimum_swap_amount, bnb.address as bnb_address from tokens tok left join bnb_accounts bnb on bnb.uuid = tok.bnb_account_uuid where tok.uuid = $1;',[uuid])
    .then((token) => {
      callback(null, token)
    })
    .catch(callback)
  },

  /**
   *  Checks whether the account has been funded with the BNB tokens.
   *  Once true
   *  Issues a new token on BNB chain
   *  Mints new tokens on BNB chain
   *  Transfers the funds from our BNB account to their BNB account
   */
  finalizeToken(req, res, next) {
    models.decryptPayload(req, res, next, (data) => {

      let result = models.validateFinalize(data)

      if(result !== true) {
        res.status(400)
        res.body = { 'status': 400, 'success': false, 'result': result }
        return next(null, req, res, next)
      }

      let { uuid } = data

      models.getTokenInfo(uuid, (err, tokenInfo) => {
        if(err) {
          console.error(err)
          res.status(500)
          res.body = { 'status': 500, 'success': false, 'result': 'Unable to retrieve token information' }
          return next(null, req, res, next)
        }

        models.validateBalances(tokenInfo, (err, code, balanceValidation) => {
          if(err) {
            console.error(err)
            res.status(code)
            res.body = { 'status': code, 'success': false, 'result': err }
            return next(null, req, res, next)
          }

          models.getKey(tokenInfo.bnb_address, (err, key) => {
            if(err || !key) {
              console.error(err)
              res.status(500)
              res.body = { 'status': 500, 'success': false, 'result': 'Unable to retrieve key' }
              return next(null, req, res, next)
            }

            bnb.issue(tokenInfo.name, tokenInfo.total_supply, tokenInfo.symbol, tokenInfo.mintable, key.key_name, key.password_decrypted, (err, issueResult) => {
              if(err) {
                console.error(err)
                res.status(500)
                res.body = { 'status': 500, 'success': false, 'result': err }
                return next(null, req, res, next)
              }

              models.updateUniqueSymbol(uuid, issueResult.uniqueSymbol, (err, result) => {
                if(err) {
                  console.error(err)
                  res.status(500)
                  res.body = { 'status': 500, 'success': false, 'result': err }
                  return next(null, req, res, next)
                }

                res.status(205)
                res.body = { 'status': 200, 'success': true, 'result': 'Token Issued' }
                return next(null, req, res, next)
              })
            })
          })
        })
      })
    })
  },

  validateFinalize(body) {
    let { uuid } = body

    if(!uuid) {
      return 'uuid is required'
    }

    return true
  },

  validateBalances(getResponse, callback) {

    bnb.getFees((err, feesData) => {
      if(err) {
        console.error(err)
        return callback(err, 500)
      }

      const fees = feesData.data
      const reducer = (accumulator, currentValue) => accumulator + currentValue.fee;
      let totalRequired = fees.filter((fee) => {
        return ['issueMsg'].includes(fee.msg_type)
      })
      .reduce(reducer, 0)

      bnb.getBalance(getResponse.bnb_address, (err, [address, balances]) => {
        if(err) {
          console.error(err)
          return callback(err, 500)
        }

        let accountBalance = 0
        if(balances.length > 0) {
          let bal = balances.filter((balance) => {
            return balance.symbol == 'BNB'
          }).map((balance) => {
            return balance.free
          })

          if(bal.length > 0) {
            bal = bal[0]
            accountBalance = bal * 100000000
          } else {
            return callback('Unable to get balances.', 500)
          }
        }

        if(accountBalance < totalRequired) {
          return callback('Insufficient funds.', 400, {
            accountBalance,
            totalRequired
          })
        } else {
          return callback(null, 200, {
            accountBalance,
            totalRequired
          })
        }
      })
    })
  },

  getKey(address, callback) {
    db.oneOrNone('select key_name, seed_phrase as mnemonic, password, encr_key from bnb_accounts where address = $1;', [address])
    .then((key) => {
      if(key.encr_key) {
        const dbPassword = key.encr_key
        const password = KEY+':'+dbPassword
        key.password_decrypted = models.decrypt(key.password, password)
        key.mnemonic = models.decrypt(key.mnemonic, password)
      }
      callback(null, key)
    })
    .catch(callback)
  },

  getClientBnbKey(address, callback) {
    db.oneOrNone('select key_name, seed_phrase as mnemonic, password, encr_key from client_bnb_accounts where address = $1;', [address])
      .then((key) => {
        if (key.encr_key) {
          const dbPassword = key.encr_key
          const password = KEY + ':' + dbPassword
          key.password_decrypted = models.decrypt(key.password, password)
          key.mnemonic = models.decrypt(key.mnemonic, password)
        }
        callback(null, key)
      })
      .catch(callback)
  },

  getClientEthKey(address, callback) {
    db.oneOrNone('select private_key, encr_key from client_eth_accounts where address = $1;', [address])
      .then((key) => {
        if (key.encr_key) {
          const dbPassword = key.encr_key
          const password = KEY + ':' + dbPassword
          key.private_key_decrypted = models.decrypt(key.private_key, password)
        } else {
          key.private_key_decrypted = key.private_key
        }
        callback(null, key)
      })
      .catch(callback)
  },

  updateUniqueSymbol(uuid, uniqueSymbol, callback) {
    db.none('update tokens set unique_symbol=$1, processed=true where uuid=$2;', [uniqueSymbol, uuid])
    .then(callback)
    .catch(callback)
  },

  /**
   *  Returns a list of tokens
   */
  getTokens(req, res, next) {
    db.manyOrNone('select tok.uuid, tok.name, tok.symbol, tok.unique_symbol, tok.total_supply, tok.minimum_swap_amount, tok.fee_per_swap, tok.listed, tok.listing_proposed, tok.listing_proposal_uuid, tok.erc20_address, tok.process_date, tok.eth_to_bnb_enabled, tok.bnb_to_eth_enabled, eth.address as eth_address from tokens tok left join eth_accounts eth on eth.uuid = tok.eth_account_uuid where processed is true;')
    .then((tokens) => {
      if (!tokens) {
        res.status(404)
        res.body = { 'status': 404, 'success': false, 'result': 'No tokens defined' }
        return next(null, req, res, next)
      } else {
        res.status(205)
        res.body = { 'status': 200, 'success': true, 'result': tokens }
        return next(null, req, res, next)
      }
    })
    .catch((err) => {
      console.error(err)
      res.status(500)
      res.body = { 'status': 500, 'success': false, 'result': err }
      return next(null, req, res, next)
    })
  },

  /**
   *  Returns a specific token details. Deposit addresses
   */
  getToken(req, res, next) {
    db.oneOrNone('select tok.uuid, tok.name, tok.symbol, tok.total_supply, tok.minimum_swap_amount, tok.fee_per_swap, tok.erc20_address, tok.process_date, eth.address as eth_address from tokens tok left join eth_accounts eth on eth.uuid = tok.eth_account_uuid where tok.uuid = $1 and processed is true;',[req.params.uuid])
    .then((token) => {
      if (!token) {
        res.status(404)
        res.body = { 'status': 404, 'success': false, 'result': 'No token defined' }
        return next(null, req, res, next)
      } else {
        res.status(205)
        res.body = { 'status': 200, 'success': true, 'result': token }
        return next(null, req, res, next)
      }
    })
    .catch((err) => {
      console.error(err)
      res.status(500)
      res.body = { 'status': 500, 'success': false, 'result': err }
      return next(null, req, res, next)
    })
  },

  /**
  * Returns the fees associated with the action
  */
  getFees(req, res, next) {
    bnb.getFees((err, feesData) => {
      if(err) {
        console.error(err)
        res.status(500)
        res.body = { 'status': 500, 'success': false, 'result': err }
        return next(null, req, res, next)
      }

      const data = feesData.data
      let fees = data.filter((fee) => {
        return ['issueMsg', 'dexList', 'submit_proposal'].includes(fee.msg_type)
      })

      fees.push({ msg_type: 'list_proposal_deposit', fee: config.list_proposal_deposit })

      res.status(205)
      res.body = { 'status': 200, 'success': true, 'result': fees }
      return next(null, req, res, next)
    })
  },

  /**
  * Returns the swaps
  */
  getSwaps(req, res, next) {
    // console.log(req.query)
    db.manyOrNone(
      'SELECT swap.uuid, swap.token_uuid, swap.eth_address, swap.bnb_address, swap.amount, swap.deposit_transaction_hash, swap.transfer_transaction_hash, swap.processed, swap.created, swap.client_account_uuid, swap.direction FROM swaps swap WHERE swap.token_uuid = \'Harmony_One\' ORDER BY swap.created DESC LIMIT $1 OFFSET $2;',
      [req.query.limit ? req.query.limit : 1000,
        req.query.offset ? req.query.offset : 0]
    ).then((swaps) => {
        if (!swaps) {
          res.status(404)
          res.body = { 'status': 404, 'success': false, 'result': 'No swaps retreived' }
          return next(null, req, res, next)
        } else {
          res.status(205)
          res.body = { 'status': 200, 'success': true, 'result': swaps }
          return next(null, req, res, next)
        }
      })
      .catch((err) => {
        console.error(err)
        res.status(500)
        res.body = { 'status': 500, 'success': false, 'result': err }
        return next(null, req, res, next)
      })
  },

  /**
  * check to see if the BNB address for that token exists.
  * If so, we return the eth address
  * If not, we create a new address then return it.
  */
  swapToken(req, res, next) {
    models.decryptPayload(req, res, next, (data) => {
      let result = models.validateSwap(data)

      if(result !== true) {
        res.status(400)
        res.body = { 'status': 400, 'success': false, 'result': result }
        return next(null, req, res, next)
      }

      const {
        direction
      } = data

      if(direction === 'EthereumToBinance') {
        models.swapEthereumToBinance(req, res, next, data)
      } else {
        models.swapBinanceToEthereum(req, res, next, data)
      }
    })
  },

  validateSwap(body) {
    const {
      direction,
      bnb_address,
      eth_address
    } = body

    if(!direction) {
      return 'direction is required'
    }

    if(direction === 'EthereumToBinance') {
      if(!bnb_address) {
        return 'bnb_address is required'
      }

      // binance sdk having issue with validateAddreses api
      // if(!bnb.validateAddress(bnb_address)) {
      //   return 'bnb_address is invalid'
      // }
    } else {
      if(!eth_address) {
        return 'eth_address is required'
      }

      // if(!eth.validateAddress(eth_address)) {
      //   return 'eth_address is invalid'
      // }
    }

    return true
  },

  swapEthereumToBinance(req, res, next, data) {
    const {
      bnb_address
    } = data

    models.getClientAccountForBnbAddress(bnb_address, (err, clientAccount) => {
      if(err) {
        console.error(err)
        res.status(500)
        res.body = { 'status': 500, 'success': false, 'result': err }
        return next(null, req, res, next)
      }

      if(clientAccount) {
        res.status(205)
        res.body = { 'status': 200, 'success': true, 'result': clientAccount }
        return next(null, req, res, next)
      } else {
        eth.createAccount((err, account) => {
          if(err) {
            console.error(err)
            res.status(500)
            res.body = { 'status': 500, 'success': false, 'result': err }
            return next(null, req, res, next)
          }

          models.insertClientEthAccount(bnb_address, account, (err, clientAccount) => {
            if(err) {
              console.error(err)
              res.status(500)
              res.body = { 'status': 500, 'success': false, 'result': err }
              return next(null, req, res, next)
            }

            res.status(205)
            res.body = { 'status': 200, 'success': true, 'result': clientAccount }
            return next(null, req, res, next)
          })
        })
      }
    })
  },

  getClientAccountForBnbAddress(bnbAddress, callback) {
    db.oneOrNone('select ca.uuid, ca.bnb_address, cea.address as eth_address from client_accounts_bnb ca left join client_eth_accounts cea on cea.uuid = ca.client_eth_account_uuid where ca.bnb_address = $1;', [bnbAddress])
    .then((response) => {
      callback(null, response)
    })
    .catch(callback)
  },

  insertClientEthAccount(bnbAddress, ethAccount, callback) {
    const dbPassword = bip39.generateMnemonic()
    const password = KEY+':'+dbPassword
    const aes256private = models.encrypt(ethAccount.privateKey, password)

    db.oneOrNone('insert into client_eth_accounts(uuid, private_key, address, encr_key, created) values (md5(random()::text || clock_timestamp()::text)::uuid, $1, $2, $3, timezone(\'utc\', now())) returning uuid, address;', [aes256private, ethAccount.address, dbPassword])
    .then((returnedEthAccount) => {
      db.oneOrNone('insert into client_accounts_bnb(uuid, bnb_address, client_eth_account_uuid, created) values (md5(random()::text || clock_timestamp()::text)::uuid, $1, $2, timezone(\'utc\', now())) returning uuid, bnb_address;', [bnbAddress, returnedEthAccount.uuid])
      .then((clientAccount) => {
        const returnObj = {
          uuid: clientAccount.uuid,
          bnb_address: clientAccount.bnb_address,
          eth_address: returnedEthAccount.address
        }
        callback(null, returnObj)
      })
      .catch(callback)
    })
    .catch(callback)
  },

  swapBinanceToEthereum(req, res, next, data) {
    const {
      eth_address
    } = data

    models.getClientAccountForEthAddress(eth_address, (err, clientAccount) => {
      if(err) {
        console.error(err)
        res.status(500)
        res.body = { 'status': 500, 'success': false, 'result': err }
        return next(null, req, res, next)
      }

      if(clientAccount) {
        // console.log('clientAccount', clientAccount);
        res.status(205)
        res.body = { 'status': 200, 'success': true, 'result': clientAccount }
        return next(null, req, res, next)
      } else {

        const keyName = eth_address+'_key_eth'
        const password = models.genPassword()

        bnb.createKey(keyName, password, (err, keyData) => {
          if(err) {
            res.status(500)
            res.body = { 'status': 500, 'success': false, 'result': err }
            return next(null, req, res, next)
          }

          models.insertClientBnbAccount(eth_address, keyName, password, keyData, (err, clientAccount) => {
            if(err) {
              console.error(err)
              res.status(500)
              res.body = { 'status': 500, 'success': false, 'result': err }
              return next(null, req, res, next)
            }

            console.log("inserted client bnb account", clientAccount)

            res.status(205)
            res.body = { 'status': 200, 'success': true, 'result': clientAccount }
            return next(null, req, res, next)
          })
        })
      }
    })

  },

  getClientAccountForEthAddress(ethAddress, callback) {
    db.oneOrNone('select ca.uuid, ca.eth_address, cba.address as bnb_address from client_accounts_eth ca left join client_bnb_accounts cba on cba.uuid = ca.client_bnb_account_uuid where ca.eth_address = $1;', [ethAddress])
    .then((response) => {
      callback(null, response)
    })
    .catch(callback)
  },

  insertClientBnbAccount(ethAddress, keyName, keyPassword, keyData, callback) {
    const dbPassword = bip39.generateMnemonic()
    const password = KEY+':'+dbPassword
    const aes256seed = models.encrypt(keyData.seedPhrase, password)
    const aes256password = models.encrypt(keyPassword, password)

    db.oneOrNone('insert into client_bnb_accounts(uuid, public_key, address, seed_phrase, key_name, password, encr_key, created) values (md5(random()::text || clock_timestamp()::text)::uuid, $1, $2, $3, $4, $5, $6, timezone(\'utc\', now())) returning uuid, address;',
      [keyData.publicKey, keyData.address, aes256seed, keyName, aes256password, dbPassword])
    .then((returnedBnbAccount) => {
      db.oneOrNone('insert into client_accounts_eth(uuid, eth_address, client_bnb_account_uuid, created) values (md5(random()::text || clock_timestamp()::text)::uuid, $1, $2, timezone(\'utc\', now())) returning uuid, eth_address;',
        [ethAddress, returnedBnbAccount.uuid])
      .then((clientAccount) => {
        const returnObj = {
          uuid: clientAccount.uuid,
          eth_address: clientAccount.eth_address,
          bnb_address: returnedBnbAccount.address
        }
        callback(null, returnObj)
      })
      .catch(callback)
    })
    .catch(callback)
  },

  /**
  * Take the token with the eth address, check to see if a transfer was done.
  * Validate that against the swaps that have been recorded previously.
  * Insert all new deposits into swaps.
  * Return all new deposits.
  */
  finalizeSwap(req, res, next) {
    models.decryptPayload(req, res, next, (data) => {
      let result = models.validateFinalizeSwap(data)

      if(result !== true) {
        res.status(400)
        res.body = { 'status': 400, 'success': false, 'result': result }
        return next(null, req, res, next)
      }

      const {
        direction
      } = data

      if(direction === 'EthereumToBinance') {
        models.finalizeSwapEthereumToBinance(req, res, next, data)
      } else {
        models.finalizeSwapBinanceToEthereum(req, res, next, data)
      }
    })
  },

  finalizeSwapEthereumToBinance(req, res, next, data) {

    const {
      uuid,
      token_uuid,
      direction
    } = data

    models.getClientAccountForUuidE2B(uuid, (err, clientAccount) => {
      if(err) {
        console.error(`[Error] getClientAccountForUuidE2B error`, err)
        res.status(500)
        res.body = { 'status': 500, 'success': false, 'result': err }
        return next(null, req, res, next)
      }

      if(!clientAccount) {
        console.error(`[Error] getClientAccountForUuidE2B clientAccount nil`)

        res.status(400)
        res.body = { 'status': 400, 'success': false, 'result': 'Unable to find swap details' }
        return next(null, req, res, next)
      }

      models.getTokenInfoForSwap(token_uuid, (err, tokenInfo) => {
        if(err) {
          console.error(err)
          res.status(500)
          res.body = { 'status': 500, 'success': false, 'result': err }
          return next(null, req, res, next)
        }

        if(!tokenInfo) {
          res.status(400)
          res.body = { 'status': 400, 'success': false, 'result': 'Unable to find token details' }
          return next(null, req, res, next)
        }

        async.parallel([
          (callback) => { eth.getTransactionsForAddress(tokenInfo.erc20_address, clientAccount.eth_address, callback) },
          (callback) => { models.getTransactionHashs(token_uuid, uuid, callback) }
        ], (err, data) => {
          if(err) {
            res.status(500)
            res.body = { 'status': 500, 'success': false, 'result': 'Unable to process request: ' + err }
            return next(null, req, res, next)
          }

          const ethTransactions = data[0]
          const swaps = data[1]

          console.log(ethTransactions);

          if(!ethTransactions || ethTransactions.length === 0) {
            res.status(400)
            res.body = { 'status': 400, 'success': false, 'result': 'Unable to find a deposit' }
            return next(null, req, res, next)
          }

          let newTransactions = ethTransactions.filter((ethTransaction) => {
            if(!ethTransaction || ethTransaction.amount <= 0) {
              return false
            }

            const thisTransaction = swaps.filter((swap) => {
              return swap.deposit_transaction_hash === ethTransaction.transactionHash &&
                swap.transfer_transaction_hash  // for passing through previously failed swaps
            })

            if(thisTransaction.length > 0) {
              return false
            } else {
              return true
            }
          })

          if(newTransactions.length === 0) {
            res.status(400)
            res.body = { 'status': 400, 'success': false, 'result': 'Unable to find any new deposits' }
            return next(null, req, res, next)
          }

          // choose only 1 at a time, because we have seen binance sdk txn failing when multiple txns are sent in parallel
          newTransactions = newTransactions.slice(0, 1)

          models.insertSwaps(newTransactions, clientAccount, token_uuid, direction, (err, newSwaps) => {
            if(err) {
              console.error(err)
              res.status(500)
              res.body = { 'status': 500, 'success': false, 'result': err }
              return next(null, req, res, next)
            }

            models.proccessSwapsE2B(newSwaps, tokenInfo, (err, result) => {
              if(err) {
                console.error(err)
                res.status(500)
                res.body = { 'status': 500, 'success': false, 'result': err }
                return next(null, req, res, next)
              }

              res.status(205)
              res.body = { 'status': 200, 'success': true, 'result': newSwaps }
              return next(null, req, res, next)
            })
          })
        })
      })
    })
  },

  proccessSwapsE2B(swaps, tokenInfo, callback) {

    models.getKey(tokenInfo.bnb_address, (err, key) => {
      if(err || !key) {
        const cbError = err || 'Unable to retrieve key'
        console.error([Error]  + cbError)
        return callback(cbError)
      }

      async.map(swaps, (swap, callbackInner) => {
        models.processSwapE2B(swap, tokenInfo, key, callbackInner)
      }, (err, swapResults) => {
        if (err) {
          return callback(err)
        }

        callback(err, swapResults)
      })
    })
  },

  processSwapE2B(swap, tokenInfo, key, callback) {

    async.series([
      (callback) => { models.sendBep2Txn(swap, tokenInfo, callback) },
      (callback) => { models.transferToERC20Foundation(swap, tokenInfo, callback) }
    ], (err, [sendBep2TxnHash, transferToERC20FoundationHash]) => {
        console.log(`processSwapE2B: [${sendBep2TxnHash}, ${transferToERC20FoundationHash}]`);

        // bep2 transaction failed. this is a hard failure.
        // Note that this overall callback will only be executed sendBep2Txn finishes
        // whether the silent failure cases (sending erc20 deposits to the central eth account) occurs or not
        // so err will only be errors from sendBep2Txn if not null
        // (unless a clear code bug causes the error for transferToERC20Foundation)
        if (!sendBep2TxnHash) {
          const cbError = err || 'sendBep2TxnHash is nil'
          console.error(cbError)
          return callback(cbError);
        }
        callback(null, sendBep2TxnHash);
      })

  },

  sendBep2Txn(swap, tokenInfo, callback) {
    const message = `Bnbridge ERC20-BEP2 One swap. erc20 deposit ${swap.deposit_transaction_hash}`
    bnb.transferWithPrivateKey(BNB_FOUNDATION_ACCT_PRIVATE_KEY,
      swap.bnb_address, swap.amount,
      tokenInfo.unique_symbol,
      message, (err, swapResult) => {
        if (err) {
          console.error('[Error] bnb transferWithPrivateKey', err)

          return models.revertUpdateWithDepositTransactionHash(swap.uuid, (revertErr) => {
            if (revertErr) {
              console.error(revertErr)
            }

            let text = "BNBridge encountered an error processing a swap."

            text += '\n\n*********************************************************'
            text += '\nDirection: Ethereum To Binance'
            text += '\nToken: ' + tokenInfo.name + ' (' + tokenInfo.symbol + ')'
            text += '\nDeposit Hash: ' + swap.deposit_transaction_hash
            text += '\nFrom: ' + swap.eth_address
            text += '\nTo: ' + swap.bnb_address
            text += '\nAmount: ' + swap.amount + ' ' + tokenInfo.symbol
            text += '\n\nError Received: ' + err
            text += '\n*********************************************************\n'

            emailer.sendMail('BNBridge Error', text)
            console.error(text, err);

            return callback(err)
          })
        }

        if (swapResult && swapResult.result && swapResult.result.length > 0) {
          let resultHash = swapResult.result[0].hash
          console.log('Successfully transferred to client bnb account: ' + swap.bnb_address + ' resultHash: ' + resultHash);

          models.updateWithTransferTransactionHash(swap.uuid, resultHash, (err) => {
            if (err) {
              return callback(err)
            }

            callback(null, resultHash)
          })
        } else {
          return callback('processSwapE2B: Swap result is not defined')
        }
      });
  },

  transferToERC20Foundation(swap, tokenInfo, callback) {
    console.log('transferToERC20Foundation for swap', swap);

    console.log('1. look for the client account from db matching the bnb account that made the swap.');
    models.getClientAccountForBnbAddress(swap.bnb_address, (err, clientAccount) => {
      if (err || !clientAccount) {
        const cbError = err || `Unable to retrieve client account for swap bnb address ${swap.bnb_address}`
        console.error('[Error] ' + cbError);
        return callback(cbError);
      }

      console.log('2. get encrypted key for the retrieved client eth account ' + clientAccount.eth_address);
      models.getClientEthKey(clientAccount.eth_address, (err, key) => {
        if (err || !key) {
          const cbError = err || 'getClientEthKey: Unable to retrieve key'
          console.error('[Error] ' + cbError)
          return callback(cbError)
        }

        console.log('3. transfer gas from eth funding account to the client eth acccount', clientAccount.eth_address);
        // 1. first, send from eth source account to the eth client acccount since it needs eth to fund ONE transaction
        const message = `funding eth gas. erc20 deposit: ${swap.deposit_transaction_hash}`
        const earlyRet = true
        eth.fundEthForGasFee(
          ETH_FUND_ACCT_PRIVATE_KEY,
          ETH_FUND_ACCT_ADDRESS,
          clientAccount.eth_address,
          ETH_GAS_FEE, message,
          earlyRet, (err, txResult1) => {
            if (err) {
              let text = "BNBridge encountered an error processing a swap.\n" +
                "Failed to fund gas for transferring deposits to the foundation account."

              text += '\n\n*********************************************************'
              text += '\nDirection: Ethereum To Binance (funding gas)'
              text += '\nToken: ' + tokenInfo.name + ' (' + tokenInfo.symbol + ')'
              text += '\nDeposit Hash: ' + swap.deposit_transaction_hash
              text += '\nFrom: ' + swap.eth_address
              text += '\nTo: ' + swap.bnb_address
              text += '\nAmount: ' + swap.amount + ' ' + tokenInfo.symbol
              text += '\n\nError Received: ' + err
              text += '\n*********************************************************\n'

              emailer.sendMail('BNBridge Error', text)
              console.error(text, err);

              // erc20 transfer to foundation account flow is a silent falure.
              // on failures, only notify the error and exit early.
              return callback(null, txResult1)
            }

            console.log('Successfully funded client eth account: ' + clientAccount.eth_address + ' resultHash: ' + txResult1);

            console.log('4. Transfer the BNBridge Swap eth deposit to the foundation account');
            // 2. then, now that eth account is funded, send the deposit to the foundation account
            eth.sendErc20Transaction(
              tokenInfo.erc20_address,
              key.private_key_decrypted.substring(2), // need to strip out '0x' in front
              clientAccount.eth_address,
              ETH_FOUNDATION_ACCT_ADDRESS,
              swap.amount, true /* earlyRet */, (err, txResult2) => {
                if (err) {
                  let text = "BNBridge encountered an error processing a swap.\n" +
                    "Failed to send erc 20 deposit to the foundation account."

                  text += '\n\n*********************************************************'
                  text += '\nDirection: Ethereum To Binance (sending to foundation)'
                  text += '\nToken: ' + tokenInfo.name + ' (' + tokenInfo.symbol + ')'
                  text += '\nDeposit Hash: ' + swap.deposit_transaction_hash
                  text += '\nFrom: ' + swap.eth_address
                  text += '\nTo: ' + swap.bnb_address
                  text += '\nAmount: ' + swap.amount + ' ' + tokenInfo.symbol
                  text += '\n\nError Received: ' + err
                  text += '\n*********************************************************\n'

                  emailer.sendMail('BNBridge Error', text)
                  console.error(text, err);

                  // erc20 transfer to foundation account flow is a silent falure.
                  // on failures, only notify the error and exit early.
                  return callback(null, txResult2)
                }

                console.log('Successfully transferred client eth deposit to foundation account. TxHash:', txResult2);
                return callback(null, txResult2)
              })

          })
      })
    })
  },

  finalizeSwapBinanceToEthereum(req, res, next, data) {

    const {
      uuid,
      token_uuid,
      direction
    } = data

    models.getClientAccountForUuidB2E(uuid, (err, clientAccount) => {
      if (err) {
        console.error(err)
        res.status(500)
        res.body = { 'status': 500, 'success': false, 'result': err }
        return next(null, req, res, next)
      }

      if (!clientAccount) {
        res.status(400)
        res.body = { 'status': 400, 'success': false, 'result': 'Unable to find swap details' }
        return next(null, req, res, next)
      }

      models.getTokenInfoForSwap(token_uuid, (err, tokenInfo) => {
        if (err) {
          console.error(err)
          res.status(500)
          res.body = { 'status': 500, 'success': false, 'result': err }
          return next(null, req, res, next)
        }

        if (!tokenInfo) {
          res.status(400)
          res.body = { 'status': 400, 'success': false, 'result': 'Unable to find token details' }
          return next(null, req, res, next)
        }

        const startTime = (new Date('10-01-2019')).getTime(); // time in milliseconds time for 10-01-2019
        const endTime = (new Date()).getTime();               // current time in milliseconds
        const side = 'RECEIVE'  // or 'SEND'

        async.parallel([
          (callback) => { bnb.getTransactionsForAddress(clientAccount.bnb_address,
            tokenInfo.unique_symbol, side, startTime, endTime, null /* limit. defaults to 25 recent txns */, callback) },
          (callback) => { models.getTransactionHashs(token_uuid, uuid, callback) }
        ], (err, info) => {
          if (err) {
            console.error(err)
            res.status(500)
            res.body = { 'status': 500, 'success': false, 'result': 'Unable to process request: ' + err }
            return next(null, req, res, next)
          }

          if (!info[0].data || !info[0].data.tx) {
            res.status(400)
            res.body = { 'status': 400, 'success': false, 'result': 'Unable to find a deposit' }
            return next(null, req, res, next)
          }

          const bnbTransactions = info[0].data.tx
          const swaps = info[1]

          if (!bnbTransactions || bnbTransactions.length === 0) {
            res.status(400)
            res.body = { 'status': 400, 'success': false, 'result': 'Unable to find a deposit' }
            return next(null, req, res, next)
          }

          let newTransactions = bnbTransactions.filter((bnbTransaction) => {
            if (!bnbTransaction || bnbTransaction.value <= 0) {
              return false
            }

            const thisTransaction = swaps.filter((swap) => {
              return swap.deposit_transaction_hash === bnbTransaction.txHash
            })

            if (thisTransaction.length > 0) {
              return false
            } else {
              return true
            }
          })

          if (newTransactions.length === 0) {
            res.status(400)
            res.body = { 'status': 400, 'success': false, 'result': 'Unable to find any new deposits' }
            return next(null, req, res, next)
          }

          // choose only 1 at a time, because we have seen binance sdk txn failing when multiple txns are sent in parallel
          newTransactions = newTransactions.slice(0, 1)

          models.insertSwaps(newTransactions, clientAccount, token_uuid, direction, (err, newSwaps) => {
            if (err) {
              console.error(err)
              res.status(500)
              res.body = { 'status': 500, 'success': false, 'result': err }
              return next(null, req, res, next)
            }

            models.proccessSwapsB2E(newSwaps, tokenInfo, (err, result) => {
              if (err) {
                console.error(err)
                res.status(500)
                res.body = { 'status': 500, 'success': false, 'result': err }
                return next(null, req, res, next)
              }

              res.status(205)
              res.body = { 'status': 200, 'success': true, 'result': newSwaps }
              return next(null, req, res, next)
            })
          })
        })
      })
    })
  },

  proccessSwapsB2E(swaps, tokenInfo, callback) {

    models.getEthAccount(tokenInfo.eth_address, (err, address) => {
      if(err || !address) {
        console.error(err)
        return callback(err)
      }

      async.map(swaps, (swap, callbackInner) => {
        models.processSwapB2E(swap, tokenInfo, address, callbackInner)
      }, (err, swapResults) => {
        if (err) {
          return callback(err)
        }

        callback(err, swapResults)
      })
    })
  },

  processSwapB2E(swap, tokenInfo, address, callback) {
    async.series([
      (callback) => { models.sendErc20Txn(swap, tokenInfo, address, callback) },
      (callback) => { models.transferToBEP2Foundation(swap, tokenInfo, callback) }
    ], (err, [sendErc20TxnHash, transferToBEP2FoundationHash]) => {
        console.log(`processSwapB2E: [${sendErc20TxnHash}, ${transferToBEP2FoundationHash}]`);
        // erc transaction failed. this is a failure.
        if (!sendErc20TxnHash) {
          const cbError = err || 'sendErc20TxnHash is nil'
          console.error(cbError)
          return callback(cbError);
        }

        callback(null, sendErc20TxnHash);
      })
  },

  sendErc20Txn(swap, tokenInfo, address, callback) {
    eth.sendErc20Transaction(
      tokenInfo.erc20_address,
      address.private_key_decrypted, // '0x' already stripped out in front
      tokenInfo.eth_address,
      swap.eth_address,
      swap.amount, false /* earlyRet */, (err, resultHash) => {
        if (err) {
          return models.revertUpdateWithDepositTransactionHash(swap.uuid, (revertErr) => {
            if (revertErr) {
              console.error(revertErr)
            }

            let text = "BNBridge encountered an error processing a swap."

            text += '\n\n*********************************************************'
            text += '\nDirection: Binance To Ethereum'
            text += '\nToken: ' + tokenInfo.name + ' (' + tokenInfo.symbol + ')'
            text += '\nDeposit Hash: ' + swap.deposit_transaction_hash
            text += '\nFrom: ' + swap.bnb_address
            text += '\nTo: ' + swap.eth_address
            text += '\nAmount: ' + swap.amount + ' ' + tokenInfo.symbol
            text += '\n\nError Received: ' + err
            text += '\n*********************************************************\n'

            emailer.sendMail('BNBridge Error', text)
            console.error(text, err);

            return callback(err)
          })
        }

        models.updateWithTransferTransactionHash(swap.uuid, resultHash, (err) => {
          if (err) {
            return callback(err)
          }

          callback(null, resultHash)
        })
      })
  },

  transferToBEP2Foundation(swap, tokenInfo, callback) {
    console.log('transferToBEP2Foundation for swap', swap);

    console.log('1. look for the client account from db matching the eth account that made the swap.');
    models.getClientAccountForEthAddress(swap.eth_address, (err, clientAccount) => {
      if (err || !clientAccount) {
        const cbError = err || `Unable to retrieve client account for swap eth address ${swap.eth_address}`
        console.error('[Error] '+ cbError);
        return callback(cbError);
      }

      console.log('2. get encrypted key for the retrieved client bnb account ' + clientAccount.bnb_address);
      models.getClientBnbKey(clientAccount.bnb_address, (err, key) => {
        if (err || !key) {
          const cbError = err || 'getClientBnbKey: Unable to retrieve key'
          console.error('[Error] ' + cbError)
          return callback(cbError)
        }

        console.log('3. transfer gas from bnb funding account to the client bnb acccount', clientAccount.bnb_address);
        // 1. first, send from bnb source account to the bnb acccount since it needs bnb to fund ONE transaction
        const message = `Bnbridge funding bnb gas. erc20 deposit ${swap.deposit_transaction_hash}`
        bnb.transferWithPrivateKey(BNB_FUND_ACCT_PRIVATE_KEY,
          clientAccount.bnb_address, BNB_GAS_FEE,
          'BNB', message, (err, txResult1) => {
            if (err) {
              let text = "BNBridge encountered an error processing a swap.\n" +
                "Failed to fund gas for transferring deposits to the foundation account."

              text += '\n\n*********************************************************'
              text += '\nDirection: Binance To Ethereum (funding gas)'
              text += '\nToken: ' + tokenInfo.name + ' (' + tokenInfo.symbol + ')'
              text += '\nDeposit Hash: ' + swap.deposit_transaction_hash
              text += '\nFrom: ' + swap.bnb_address
              text += '\nTo: ' + swap.eth_address
              text += '\nAmount: ' + swap.amount + ' ' + tokenInfo.symbol
              text += '\n\nError Received: ' + err
              text += '\n*********************************************************\n'

              emailer.sendMail('BNBridge Error', text)
              console.error(text, err);

              return callback(err)
            }

            if (txResult1 && txResult1.result && txResult1.result.length > 0) {
              let resultHash = txResult1.result[0].hash // tx hash that funded bnb account
              console.log('Successfully funded client bnb account: ' + clientAccount.bnb_address + ' resultHash: ' + resultHash);

              console.log('4. Transfer the BNBridge Swap bnb deposit to the foundation account');
              // 2. then, now that bnb account is funded, send the deposit to the foundation account
              const message = `Deposit to central bep2 One addr. erc20 deposit ${swap.deposit_transaction_hash}`
              bnb.transfer(key.mnemonic, BNB_FOUNDATION_ACCT_ADDRESS, swap.amount,
                tokenInfo.unique_symbol, message, (err, txResult2) => {

                  if (err) {
                    let text = "BNBridge encountered an error processing a swap.\n" +
                      "Failed to send bnb deposit to the foundation account."

                    text += '\n\n*********************************************************'
                    text += '\nDirection: Binance To Ethereum (sending to foundation)'
                    text += '\nToken: ' + tokenInfo.name + ' (' + tokenInfo.symbol + ')'
                    text += '\nDeposit Hash: ' + swap.deposit_transaction_hash
                    text += '\nFrom: ' + swap.bnb_address
                    text += '\nTo: ' + swap.eth_address
                    text += '\nAmount: ' + swap.amount + ' ' + tokenInfo.symbol
                    text += '\n\nError Received: ' + err
                    text += '\n*********************************************************\n'

                    emailer.sendMail('BNBridge Error', text)
                    console.error(text, err);

                    return callback(err)
                  }

                  if (txResult2 && txResult2.result && txResult2.result.length > 0) {
                    let resultHash = txResult2.result[0].hash

                    if (!resultHash) {
                      console.error('[Error] processSwapB2E: Missing tx hash for the Bnb tx made to the foundation account from client.');
                    } else {
                      console.log('Successfully transferred client bnb deposit to foundation account. TxHash:', resultHash);
                    }

                    return callback(null, resultHash)
                  } else {
                    const errMsg = 'Failed sending bnb deposit to foundation account from account ' +
                      clientAccount.bnb_address + '. Tx result is null or empty'
                    console.error('[Error] ' + errMsg);
                    return callback(errMsg)
                  }
                })
            } else {
              const errMsg = 'Failed funding Bnb gas for account ' + clientAccount.bnb_address +
                '. Tx result is null or empty'
              console.error('[Error] ' + errMsg);
              return callback(errMsg)
            }
          })
      })
    })
  },

  getEthAccount(ethAddress, callback) {
    db.oneOrNone('select * from eth_accounts where address = $1;', [ethAddress])
    .then((address) => {
      if(address.encr_key) {
        const dbPassword = address.encr_key
        const password = KEY+':'+dbPassword
        address.private_key_decrypted = models.decrypt(address.private_key, password)
      } else {
        address.private_key_decrypted = address.private_key
      }
      callback(null, address)
    })
    .catch(callback)
  },

  revertUpdateWithDepositTransactionHash(uuid, callback) {
    db.none('update swaps set deposit_transaction_hash = null where uuid = $1 and transfer_transaction_hash is null;', [uuid])
    .then(callback)
    .catch(callback)
  },

  updateWithTransferTransactionHash(uuid, hash, callback) {
    db.none('update swaps set transfer_transaction_hash = $2 where uuid = $1;', [uuid, hash])
    .then(callback)
    .catch(callback)
  },

  validateFinalizeSwap(body) {
    const {
      uuid,
      token_uuid,
      direction
    } = body

    if(!uuid) {
      return 'uuid is required'
    }

    if(!token_uuid) {
      return 'token_uuid is required'
    }

    if(!direction) {
      return 'direction is required'
    }

    return true
  },

  getClientAccountForUuidE2B(uuid, callback) {
    db.oneOrNone('select ca.uuid, ca.bnb_address, cea.address as eth_address from client_accounts_bnb ca left join client_eth_accounts cea on cea.uuid = ca.client_eth_account_uuid where ca.uuid = $1;', [uuid])
    .then((response) => {
      callback(null, response)
    })
    .catch(callback)
  },

  getClientAccountForUuidB2E(uuid, callback) {
    db.oneOrNone('select ca.uuid, ca.eth_address, cba.address as bnb_address from client_accounts_eth ca left join client_bnb_accounts cba on cba.uuid = ca.client_bnb_account_uuid where ca.uuid = $1;', [uuid])
    .then((response) => {
      callback(null, response)
    })
    .catch(callback)
  },

  getTokenInfoForSwap(tokenUuid, callback) {
    db.oneOrNone('select tok.uuid, tok.name, tok.symbol, tok.unique_symbol, tok.total_supply, tok.fee_per_swap, tok.minimum_swap_amount, tok.erc20_address, bnb.address as bnb_address, eth.address as eth_address from tokens tok left join bnb_accounts bnb on bnb.uuid = tok.bnb_account_uuid left join eth_accounts eth on eth.uuid = tok.eth_account_uuid where tok.uuid = $1;', [tokenUuid])
    .then((response) => {
      callback(null, response)
    })
    .catch(callback)
  },

  getTransactionHashs(tokenUuid, clientAccountUuid, callback) {
    db.manyOrNone('select * from swaps where token_uuid = $1 and client_account_uuid = $2;', [tokenUuid, clientAccountUuid])
    .then((response) => {
      callback(null, response)
    })
    .catch(callback)
  },

  insertSwaps(transactions, clientAccount, tokenUuid, direction, callback) {
    async.map(transactions,
      function (transaction, callbackInner) {
        if(direction === 'EthereumToBinance') {
          models.insertSwapE2B(transaction, clientAccount, tokenUuid, direction, callbackInner)
        } else {
          models.insertSwapB2E(transaction, clientAccount, tokenUuid, direction, callbackInner)
        }
      },
      function(err, result) {
        if (err) {
          console.error(err)
          return callback(err)
        }

        callback(null, result)
      }
    )
  },

  insertSwapE2B(transaction, clientAccount, tokenUuid, direction, callback) {
    db.oneOrNone('insert into swaps (uuid, token_uuid, eth_address, bnb_address, amount, client_account_uuid, deposit_transaction_hash, direction, created) values (md5(random()::text || clock_timestamp()::text)::uuid, $1, $2, $3, $4, $5, $6, $7, timezone(\'utc\', now())) returning uuid, eth_address, bnb_address, amount, deposit_transaction_hash;', [tokenUuid, transaction.from, clientAccount.bnb_address, transaction.amount, clientAccount.uuid, transaction.transactionHash, direction])
    .then((response) => {
      callback(null, response)
    })
    .catch((err) => {
      callback(err)
    })
  },

  insertSwapB2E(transaction, clientAccount, tokenUuid, direction, callback) {
    db.oneOrNone('insert into swaps (uuid, token_uuid, eth_address, bnb_address, amount, client_account_uuid, deposit_transaction_hash, direction, created) values (md5(random()::text || clock_timestamp()::text)::uuid, $1, $2, $3, $4, $5, $6, $7, timezone(\'utc\', now())) returning uuid, eth_address, bnb_address, amount, deposit_transaction_hash;', [tokenUuid, clientAccount.eth_address, transaction.fromAddr, transaction.value, clientAccount.uuid, transaction.txHash, direction])
    .then((response) => {
      callback(null, response)
    })
    .catch((err) => {
      callback(err)
    })
  },


  /**
  *  submitListProposal( token, initialPrice, expiryTime, votingPeriod )
  *  -- uses the existinge BNB account
  *  -- creates a listProposal (table)
  *  -- send the listProposal to (binance)
  *  -- returns to user with deposit address
  */
  submitListProposal(req, res, next) {
    models.decryptPayload(req, res, next, (data) => {
      let result = models.validateListProposal(data)

      if(result !== true) {
        res.status(400)
        res.body = { 'status': 400, 'success': false, 'result': result }
        return next(null, req, res, next)
      }

      const {
        token_uuid,
        initial_price,
        expiry_time,
        voting_period
      } = data

      models.getTokenInfo(token_uuid, (err, tokenInfo) => {
        if(err) {
          console.error(err)
          res.status(500)
          res.body = { 'status': 500, 'success': false, 'result': err }
          return next(null, req, res, next)
        }

        const title = 'List '+tokenInfo.unique_symbol+'/BNB'
        const description = 'List '+tokenInfo.unique_symbol+' to BNB exchange pair'

        const now = Math.floor(Date.now() / 1000)
        const votingTime = voting_period*86400
        const expiryTime = now + votingTime + (expiry_time*86400)

        models.insertListProposal(token_uuid, tokenInfo.unique_symbol, title, description, initial_price, expiryTime, votingTime, (err, insertResult) => {
          if(err) {
            console.error(err)
            res.status(500)
            res.body = { 'status': 500, 'success': false, 'result': err }
            return next(null, req, res, next)
          }

          insertResult.bnb_address = tokenInfo.bnb_address

          res.status(205)
          res.body = { 'status': 200, 'success': true, 'result': insertResult }
          return next(null, req, res, next)
        })
      })
    })
  },

  validateListProposal(body) {
    const {
      token_uuid,
      initial_price,
      expiry_time,
      voting_period
    } = body

    if(!token_uuid) {
      return 'uuid is required'
    }

    if(!initial_price) {
      return 'initial_price is required'
    }

    if(!expiry_time) {
      return 'expiry_time is required'
    }

    if(!voting_period) {
      return 'voting_period is required'
    }

    return true
  },

  insertListProposal(tokenUuuid, uniqueSymbol, title, description, initialPrice, expiryTime, votingPeriod, callback) {
    db.oneOrNone('insert into list_proposals (uuid, token_uuid, unique_symbol, title, description, initial_price, expiry_time, voting_period, created) values (md5(random()::text || clock_timestamp()::text)::uuid, $1, $2, $3, $4, $5, $6, $7, timezone(\'utc\', now())) returning uuid, token_uuid, unique_symbol, title, description, initial_price, expiry_time, voting_period;',
    [tokenUuuid, uniqueSymbol, title, description, initialPrice, expiryTime, votingPeriod])
    .then((result) => {
      callback(null, result)
    })
    .catch(callback)
  },


  /**
  *  finalizeListProposal( uuid )
  *  -- checks to see if our deposit address balance is > fee
  *  -- deposits the total fee into governance system (binance)
  *  -- marks the listProposal (table) as depositted
  *  -- returns
  */
  finalizeListProposal(req, res, next) {
    models.decryptPayload(req, res, next, (data) => {
      let result = models.validateFinalizeListProposal(data)

      if(result !== true) {
        res.status(400)
        res.body = { 'status': 400, 'success': false, 'result': result }
        return next(null, req, res, next)
      }

      const { uuid } = data

      models.getListProposalInfo(uuid, (err, proposalInfo) => {
        if(err) {
          console.error(err)
          res.status(500)
          res.body = { 'status': 500, 'success': false, 'result': err }
          return next(null, req, res, next)
        }

        models.validateProposalBalances(proposalInfo, (err, code, balanceValidation) => {
          if(err) {
            console.error(err)
            res.status(code)
            res.body = { 'status': code, 'success': false, 'result': err }
            return next(null, req, res, next)
          }

          models.getTokenInfo(proposalInfo.token_uuid, (err, tokenInfo) => {
            if(err) {
              console.error(err)
              res.status(500)
              res.body = { 'status': 500, 'success': false, 'result': 'Unable to retrieve token information' }
              return next(null, req, res, next)
            }

            models.getKey(tokenInfo.bnb_address, (err, key) => {
              if(err || !key) {
                console.error(err)
                res.status(500)
                res.body = { 'status': 500, 'success': false, 'result': 'Unable to retrieve key' }
                return next(null, req, res, next)
              }

              bnb.submitListProposal(tokenInfo.unique_symbol, key.key_name, key.password_decrypted, proposalInfo.initial_price, proposalInfo.title, proposalInfo.description, proposalInfo.expiry_time, proposalInfo.voting_period, balanceValidation.depositRequired, (err, transactionHash) => {
                if(err) {
                  console.error(err)
                  res.status(500)
                  res.body = { 'status': 500, 'success': false, 'result': err }
                  return next(null, req, res, next)
                }

                models.updateListProposal(proposalInfo.uuid, transactionHash, (err, updateResponse) => {
                  if(err) {
                    console.error(err)
                    res.status(500)
                    res.body = { 'status': 500, 'success': false, 'result': err }
                    return next(null, req, res, next)
                  }

                  models.updateTokenListProposed(tokenInfo.uuid, proposalInfo.uuid, (err, updateTokenResponse) => {
                    if(err) {
                      console.error(err)
                      res.status(500)
                      res.body = { 'status': 500, 'success': false, 'result': err }
                      return next(null, req, res, next)
                    }

                    proposalInfo.transaction_hash = transactionHash
                    res.status(205)
                    res.body = { 'status': 200, 'success': true, 'result': proposalInfo }
                    return next(null, req, res, next)
                  })
                })
              })
            })
          })
        })
      })
    })
  },

  validateFinalizeListProposal(body) {
    let { uuid } = body

    if(!uuid) {
      return 'uuid is required'
    }

    return true
  },

  getListProposalInfo(uuid, callback) {
    db.oneOrNone('select lp.*, bnb.address as bnb_address from list_proposals lp left join tokens tok on tok.uuid = lp.token_uuid left join bnb_accounts bnb on bnb.uuid = tok.bnb_account_uuid where lp.uuid = $1;', [uuid])
    .then((info) => {
      callback(null, info)
    })
    .catch(callback)
  },

  validateProposalBalances(proposalInfo, callback) {
    bnb.getFees((err, feesData) => {
      if(err) {
        console.error(err)
        return callback(err, 500)
      }

      const fees = feesData.data
      const reducer = (accumulator, currentValue) => accumulator + currentValue.fee;
      let totalRequired = fees.filter((fee) => {
        return ['submit_proposal'].includes(fee.msg_type)
      })
      .reduce(reducer, 0)

      let depositRequired = parseFloat(config.list_proposal_deposit) // 1000 on mainnet. Move to config
      totalRequired = totalRequired + depositRequired

      bnb.getBalance(proposalInfo.bnb_address, (err, [address, balances]) => {
        if(err) {
          console.error(err)
          return callback(err, 500)
        }

        let accountBalance = 0
        if(balances.length > 0) {
          let bal = balances.filter((balance) => {
            return balance.symbol == 'BNB'
          }).map((balance) => {
            return balance.free
          })

          if(bal.length > 0) {
            bal = bal[0]
            accountBalance = bal * 100000000
          } else {
            return callback('Unable to get balances.', 500)
          }
        }

        if(accountBalance < totalRequired) {
          return callback('Insufficient funds.', 400, {
            accountBalance,
            totalRequired,
            depositRequired
          })
        } else {
          return callback(null, 200, {
            accountBalance,
            totalRequired,
            depositRequired
          })
        }
      })
    })
  },

  updateListProposal(uuid, transactionHash, callback) {
    db.none('update list_proposals set transaction_hash = $2, submitted = true where uuid = $1;', [uuid, transactionHash])
    .then(callback)
    .catch(callback)
  },

  updateTokenListProposed(tokenUuid, proposalUuid, callback) {
    db.none('update tokens set listing_proposed = true, listing_proposal_uuid = $2 where uuid = $1;', [tokenUuid, proposalUuid])
    .then(callback)
    .catch(callback)
  },


  /**
  *  List( propsalId )
  *  -- we query the proposalId
  *  -- once it has been marked as proposal_status="Passed"
  *  -- we call List (binance)
  *  -- after listing, mark the listProposal (table) as listed
  *  -- we receive the 2000 BNB again.
  *  -- transfer that BNB back to the user. So we need to store the sending address of the funds. ( complications if we do multiple deposits )
  */
  list(req, res, next) {
    models.decryptPayload(req, res, next, (data) => {
      let result = models.validatelist(data)

      if(result !== true) {
        res.status(400)
        res.body = { 'status': 400, 'success': false, 'result': result }
        return next(null, req, res, next)
      }

      const {
        uuid
      } = data

      models.getListProposalInfo(uuid, (err, proposalInfo) => {
        if(err) {
          console.error(err)
          res.status(500)
          res.body = { 'status': 500, 'success': false, 'result': err }
          return next(null, req, res, next)
        }

        bnb.getListProposal(proposalInfo.proposal_id, (err, bnbProposalInfo) => {
          if(err) {
            console.error(err)
            res.status(500)
            res.body = { 'status': 500, 'success': false, 'result': err }
            return next(null, req, res, next)
          }

          if(bnbProposalInfo && bnbProposalInfo.value && bnbProposalInfo.value.proposal_status === 'Passed') {

            models.validateListBalances(proposalInfo, (err, balanceValidation) => {
              if(err) {
                console.error(err)
                res.status(code)
                res.body = { 'status': code, 'success': false, 'result': err }
                return next(null, req, res, next)
              }

              models.getKey(proposalInfo.bnb_address, (err, key) => {
                if(err || !key) {
                  console.error(err)
                  res.status(500)
                  res.body = { 'status': 500, 'success': false, 'result': 'Unable to retrieve key' }
                  return next(null, req, res, next)
                }

                bnb.list(proposalInfo.unique_symbol, key.key_name, key.password_decrypted, proposalInfo.initial_price, proposalInfo.proposal_id, (err, listResult) => {
                  if(err) {
                    console.error(err)
                    res.status(code)
                    res.body = { 'status': code, 'success': false, 'result': err }
                    return next(null, req, res, next)
                  }

                  models.updateListProposalListed(proposalInfo.uuid, (err, updateData) => {
                    if(err) {
                      console.error(err)
                      res.status(code)
                      res.body = { 'status': code, 'success': false, 'result': err }
                      return next(null, req, res, next)
                    }

                    models.updateTokenListed(proposalInfo.token_uuid, (err, updateData) => {
                      if(err) {
                        console.error(err)
                        res.status(code)
                        res.body = { 'status': code, 'success': false, 'result': err }
                        return next(null, req, res, next)
                      }

                      res.status(205)
                      res.body = { 'status': 200, 'success': true, 'result': listResult }
                      return next(null, req, res, next)
                    })
                  })
                })
              })
            })
          } else {
            res.status(400)
            res.body = { 'status': 400, 'success': false, 'result': 'List proposal has not passed yet' }
            return next(null, req, res, next)
          }
        })
      })
    })
  },

  validatelist(body) {
    const {
      uuid
    } = body

    if(!uuid) {
      return 'uuid is required'
    }

    return true
  },

  validateListBalances(proposalInfo, callback) {
    bnb.getFees((err, feesData) => {
      if(err) {
        console.error(err)
        return callback(err, 500)
      }

      const fees = feesData.data
      const reducer = (accumulator, currentValue) => accumulator + currentValue.fee;
      let totalRequired = fees.filter((fee) => {
        return ['dexList'].includes(fee.msg_type)
      })
      .reduce(reducer, 0)

      bnb.getBalance(proposalInfo.bnb_address, (err, [address, balances]) => {
        if(err) {
          console.error(err)
          return callback(err, 500)
        }

        let accountBalance = 0
        if(balances.length > 0) {
          let bal = balances.filter((balance) => {
            return balance.symbol == 'BNB'
          }).map((balance) => {
            return balance.free
          })

          if(bal.length > 0) {
            bal = bal[0]
            accountBalance = bal * 100000000
          } else {
            return callback('Unable to get balances.', 500)
          }
        }

        if(accountBalance < totalRequired) {
          return callback('Insufficient funds.', 400, {
            accountBalance,
            totalRequired
          })
        } else {
          return callback(null, 200, {
            accountBalance,
            totalRequired
          })
        }
      })
    })
  },

  updateListProposalListed(uuid, callback) {
    db.none('update list_proposals set processed = true where uuid = $1;', [uuid])
    .then(callback)
    .catch(callback)
  },

  updateTokenListed(uuid, callback) {
    db.none('update tokens set listed = true where uuid = $1;', [uuid])
    .then(callback)
    .catch(callback)
  },

  /**
  * getListProposal ()
  * returns the associated list proposal
  */
  getListProposal(req, res, next) {

    if(!req.params.uuid) {
      res.status(404)
      res.body = { 'status': 404, 'success': false, 'result': 'uuid is required' }
      return next(null, req, res, next)
    }

    db.oneOrNone('select lp.*, bnb.address as bnb_address from list_proposals lp left join tokens tok on lp.token_uuid = tok.uuid left join bnb_accounts bnb on bnb.uuid = tok.bnb_account_uuid where lp.uuid = $1;', [req.params.uuid])
    .then((listing_proposal) => {
      if (!listing_proposal) {
        res.status(404)
        res.body = { 'status': 404, 'success': false, 'result': 'No listing proposal defined' }
        return next(null, req, res, next)
      } else {

        if(listing_proposal.proposal_id == null) {
          bnb.getListProposals(listing_proposal.bnb_address, listing_proposal.unique_symbol, (err, proposalId) => {

            models.updateProposalId(listing_proposal.uuid, proposalId)

            bnb.getListProposal(proposalId, (err, proposalInfo) => {
              if(err) {
                console.error(err)
                res.status(500)
                res.body = { 'status': 500, 'success': false, 'result': err }
                return next(null, req, res, next)
              }

              listing_proposal.chain_info = proposalInfo

              res.status(205)
              res.body = { 'status': 200, 'success': true, 'result': listing_proposal }
              return next(null, req, res, next)
            })
          })
        } else {
          //get proposal
          bnb.getListProposal(listing_proposal.proposal_id, (err, proposalInfo) => {
            if(err) {
              console.error(err)
              res.status(500)
              res.body = { 'status': 500, 'success': false, 'result': err }
              return next(null, req, res, next)
            }

            listing_proposal.chain_info = proposalInfo

            res.status(205)
            res.body = { 'status': 200, 'success': true, 'result': listing_proposal }
            return next(null, req, res, next)
          })
        }
      }
    })
    .catch((err) => {
      console.error(err)
      res.status(500)
      res.body = { 'status': 500, 'success': false, 'result': err }
      return next(null, req, res, next)
    })
  },

  updateProposalId(uuid, proposal) {
    db.none('update list_proposals set proposal_id = $2 where uuid = $1', [uuid, proposal])
    .then(() => {

    })
    .catch((err) => {
      console.error(err)
    })
  },


  /**
  *  GetBnbBalances( bnb_address, token_uuid )
  *  -- Get the current balance BEP2 address, for the symbol specified
  *  -- Get pending transfers that haven't been processed yet
  */
  getBnbBalance(req, res, next) {
    models.decryptPayload(req, res, next, (data) => {
      let result = models.validateGetBnbBalances(data)

      if(result !== true) {
        res.status(400)
        res.body = { 'status': 400, 'success': false, 'result': result }
        return next(null, req, res, next)
      }

      const {
        bnb_address,
        token_uuid
      } = data

      models.getTokenInfo(token_uuid, (err, tokenInfo) => {
        if(err) {
          console.error(err)
          res.status(500)
          res.body = { 'status': 500, 'success': false, 'result': err }
          return next(null, req, res, next)
        }

        bnb.getBalance(bnb_address, (err, [address, balances]) => {
          if(err) {
            console.error(err)
            res.status(500)
            res.body = { 'status': 500, 'success': false, 'result': err }
            return next(null, req, res, next)
          }

          let balance = 0;

          let filteredBalances = balances.filter((balance) => {
            return balance.symbol === tokenInfo.unique_symbol
          })

          if(filteredBalances.length > 0) {
              balance = filteredBalances[0].free
          }

          models.getPendingBnbBalance(token_uuid, bnb_address, (err, pendingBalance) => {
            if(err) {
              console.error(err)
              res.status(500)
              res.body = { 'status': 500, 'success': false, 'result': err }
              return next(null, req, res, next)
            }

            const returnObj = {
              balance: parseFloat(balance),
              pendingBalance: parseFloat(pendingBalance.pending_balance ? pendingBalance.pending_balance : 0)
            }

            res.status(205)
            res.body = { 'status': 200, 'success': true, 'result': returnObj }
            return next(null, req, res, next)
          })
        })
      })
    })
  },

  validateGetBnbBalances(body) {
    let { bnb_address, token_uuid } = body

    if(!bnb_address) {
      return 'bnb_address is required'
    }

    if(!token_uuid) {
      return 'token_uuid is required'
    }

    if(!bnb.validateAddress(bnb_address)) {
      return 'bnb_address is invalid'
    }

    return true
  },

  getPendingBnbBalance(tokenUuid, bnbAddress, callback) {
    db.oneOrNone('select sum(swaps.amount::numeric - tok.fee_per_swap::numeric) as pending_balance from swaps left join tokens tok on tok.uuid = swaps.token_uuid where swaps.token_uuid = $1 and swaps.bnb_address = $2 and swaps.deposit_transaction_hash is not null and swaps.transfer_transaction_hash is null;', [tokenUuid, bnbAddress])
    .then((info) => {
      callback(null, info)
    })
    .catch(callback)
  },


  /**
  *  GetEthBalances( eth_address, token_uuid )
  *  -- Get the current balance ErC20 address, for the symbol specified
  *  -- Get pending transfers that haven't been processed yet
  */
  getEthBalance(req, res, next) {
    models.decryptPayload(req, res, next, (data) => {
      let result = models.validateGetEthbalances(data)

      if(result !== true) {
        res.status(400)
        res.body = { 'status': 400, 'success': false, 'result': result }
        return next(null, req, res, next)
      }

      const {
        eth_address,
        token_uuid
      } = data

      models.getTokenInfo(token_uuid, (err, tokenInfo) => {
        if(err) {
          console.error(err)
          res.status(500)
          res.body = { 'status': 500, 'success': false, 'result': err }
          return next(null, req, res, next)
        }

        eth.getERC20Balance(eth_address, tokenInfo.erc20_address, (err, balance) => {
          if(err) {
            console.error(err)
            res.status(500)
            res.body = { 'status': 500, 'success': false, 'result': err }
            return next(null, req, res, next)
          }

          const returnObj = {
            balance: parseFloat(balance),
          }

          res.status(205)
          res.body = { 'status': 200, 'success': true, 'result': returnObj }
          return next(null, req, res, next)

        })
      })
    })
  },

  validateGetEthbalances(body) {
    let { eth_address, token_uuid } = body

    if(!eth_address) {
      return 'eth_address is required'
    }

    if(!token_uuid) {
      return 'token_uuid is required'
    }

    return true
  },

  /**
    createAccountBNB()
    creates a new BNB accoutn for the user.
  */
  createAccountBNB(req, res, next) {
    const account = bnb.createAccountWithMneomnic()

    res.status(205)
    res.body = { 'status': 200, 'success': true, 'result': account }
    return next(null, req, res, next)
  },

  downloadKeystoreBNB(req, res, next) {
    models.decryptPayload(req, res, next, (data) => {
      let result = models.validateDownloadKeystoreBNB(data)

      if(result !== true) {
        res.status(400)
        res.body = { 'status': 400, 'success': false, 'result': result }
        return next(null, req, res, next)
      }

      const {
        private_key,
        password
      } = data

      const account = bnb.generateKeyStore(private_key, password)

      models.returnDownload(req, res, account)
    })
  },

  validateDownloadKeystoreBNB(body) {
    let {
      password,
      private_key
    } = body

    if(!private_key) {
      return 'private_key is required'
    }

    if(!password) {
      return 'password is required'
    }

    return true
  },

  returnDownload(req, res, keyStore) {

    var data = JSON.stringify(keyStore);
    res.setHeader('Content-disposition', 'attachment; filename= '+keyStore.id+'_keystore.json');
    res.setHeader('Content-type', 'application/json');
    // res.write(data, function (err) {
    //     res.end();
    // })
    res.send( data )
  },

  getERC20Info(req, res, next) {
    models.decryptPayload(req, res, next, (data) => {
      const {
        contract_address
      } = data

      eth.getERC20Name(contract_address, (err, name) => {
        if(err) {
          console.error(err)
          res.status(500)
          res.body = { 'status': 500, 'success': false, 'result': err }
          return next(null, req, res, next)
        }
        eth.getERC20Symbol(contract_address, (err, symbol) => {
          if(err) {
            console.error(err)
            res.status(500)
            res.body = { 'status': 500, 'success': false, 'result': err }
            return next(null, req, res, next)
          }
          eth.getERC20TotalSupply(contract_address, (err, totalSupply) => {
            if(err) {
              console.error(err)
              res.status(500)
              res.body = { 'status': 500, 'success': false, 'result': err }
              return next(null, req, res, next)
            }

            const returnObj = {
              name: name,
              symbol: symbol,
              total_supply: totalSupply,
              address: contract_address
            }

            res.status(205)
            res.body = { 'status': 200, 'success': true, 'result': returnObj }
            return next(null, req, res, next)
          })
        })
      })
    })
  },

}

String.prototype.hexEncode = function(){
    var hex, i;
    var result = "";
    for (i=0; i<this.length; i++) {
        hex = this.charCodeAt(i).toString(16);
        result += ("000"+hex).slice(-4);
    }
    return result
}
String.prototype.hexDecode = function(){
    var j;
    var hexes = this.match(/.{1,4}/g) || [];
    var back = "";
    for(j = 0; j<hexes.length; j++) {
        back += String.fromCharCode(parseInt(hexes[j], 16));
    }

    return back;
}

function decrypt(text,seed){
  var decipher = crypto.createDecipher('aes-256-cbc', seed)
  var dec = decipher.update(text,'base64','utf8')
  dec += decipher.final('utf8');
  return dec;
}

module.exports = models
