const bnbcli = require('../helpers/bnbcli')

const INIT_PRICE = '100000000000000000'
const PROPOSAL_ID = '15'
const SYMBOL = 'ANT-B90'
const KEY_NAME = 'key'

const PASSWORD = ""

bnbcli.ptyProcess.on('data', function(data) {
  process.stdout.write(data);

  if(data.includes('Password to sign with')) {
    bnbcli.ptyProcess.write(PASSWORD+'\r');
  }
});

bnbcli.ptyProcess.write('cd ' + bnbcli.PATH + '\r');
bnbcli.ptyProcess.write('./' + bnbcli.FILE + ' dex list -s ' + SYMBOL+' --quote-asset-symbol BNB --from '+KEY_NAME+' --init-price '+INIT_PRICE+' --proposal-id '+PROPOSAL_ID+' --chain-id=Binance-Chain-Nile --node=data-seed-pre-2-s1.binance.org:80 --trust-node --json\r');
