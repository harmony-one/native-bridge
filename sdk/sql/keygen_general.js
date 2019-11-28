const bech32 = require('bech32');
const crypto = require('crypto');
const sha256 = require('sha256');
const bip39 = require('bip39');
const assert = require('assert');

function encrypt(text, password) {
  var cipher = crypto.createCipher('aes-256-ctr', password)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}

assert(process.env.ISTESTNET != null, "Environment variable ISTESTNET not set!");
assert(process.env.PRIVATE_KEY != null, "Environment variable PRIVATE_KEY is not set!");
assert(process.env.ENCRYPTION_KEY != null, "Environment variable ENCRYPTION_KEY is not set!");

assert(process.env.ADDRESS != null, "Environment variable ADDRESS is not set!");

const address = process.env.ADDRESS
// aka `encr_key` in schema
const dbPassword = bip39.generateMnemonic()
const encryptionKey = process.env.ENCRYPTION_KEY + ':' + dbPassword
// aka `private_key` in schema
const encPK = encrypt(process.env.PRIVATE_KEY, encryptionKey)

console.log("%s,%s,%s", address, encPK, dbPassword);

