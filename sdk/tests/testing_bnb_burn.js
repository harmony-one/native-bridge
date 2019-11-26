const bnbcli = require('../helpers/bnbcli')

const AMOUNT = "100000000000000000"
const SYMBOL = 'ANT-B90'
const KEY_NAME = 'key'

bnbcli.ptyProcess.on('data', function(data) {
  process.stdout.write(data);
});

bnbcli.ptyProcess.write('cd ' +bnbcli.PATH+'\r');
bnbcli.ptyProcess.write('./' +bnbcli.FILE+' token burn --amount '+AMOUNT+' --symbol '+SYMBOL+' --from '+KEY_NAME+' --chain-id=Binance-Chain-Nile --node=data-seed-pre-2-s1.binance.org:80 --trust-node\r');
bnbcli.ptyProcess.write('exit\r');
