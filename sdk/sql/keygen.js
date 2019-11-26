const bnbsdk = require('@binance-chain/javascript-sdk');
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

// https://github.com/binance-chain/javascript-sdk/issues/163
function bech32EncodedPubKey(pubKeyHex) {
  const aminoPrefix = 'eb5ae98721';
  compressedPubKey = compressed = bnbsdk.crypto.getPublicKey(pubKeyHex).encodeCompressed('hex');
  return bech32.encode('bnbp', bech32.toWords(Buffer.from(aminoPrefix + compressedPubKey, 'hex')));
}

assert(process.env.ISTESTNET != null, "Environment variable ISTESTNET not set!");
assert(process.env.BNB_PRIVATE_KEY != null, "Environment variable BNB_PRIVATE_KEY is not set!");
assert(process.env.BNB_ENCRYPTION_KEY != null, "Environment variable BNB_ENCRYPTION_KEY is not set!");

var publicKey = bnbsdk.crypto.getPublicKeyFromPrivateKey(process.env.BNB_PRIVATE_KEY);
publicKey = bech32EncodedPubKey(publicKey);
const address = bnbsdk.crypto.getAddressFromPrivateKey(process.env.BNB_PRIVATE_KEY, process.env.ISTESTNET == 1 ? "tbnb" : "bnb");
// aka `encr_key` in schema
const dbPassword = bip39.generateMnemonic()
const encryptionKey = process.env.BNB_ENCRYPTION_KEY + ':' + dbPassword
// aka `private_key` in schema
const encPK = encrypt(process.env.BNB_PRIVATE_KEY, encryptionKey)

console.log("%s,%s,%s,%s", publicKey, address, encPK, dbPassword);
