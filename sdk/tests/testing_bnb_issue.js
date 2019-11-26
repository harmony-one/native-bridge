const bnbcli = require('../helpers/bnbcli')
const TOKEN_NAME = "TEST TOKEN"
const TOTAL_SUPPLY = "100000000000000"
const SYMBOL = 'TST'
const KEY_NAME = 'key'
const PASSWORD = ""

bnbcli.ptyProcess.on('data', function(data) {
  process.stdout.write(data);

  if(data.includes("Committed")) {

    let index = data.indexOf('Issued '+SYMBOL)
    data.substr(index+7, 7)

    bnbcli.ptyProcess.write('exit\r');
  }

  if(data.includes('Password to sign with')) {
    bnbcli.ptyProcess.write(PASSWORD+'\r');
  }
});

bnbcli.ptyProcess.write('cd ' + bnbcli.PATH + '\r');
bnbcli.ptyProcess.write('./' + bnbcli.FILE + ' token issue --token-name "' + TOKEN_NAME + '" --total-supply ' + TOTAL_SUPPLY + ' --symbol ' + SYMBOL + ' --mintable --from ' + KEY_NAME + ' --chain-id=Binance-Chain-Nile --node=data-seed-pre-2-s1.binance.org:80 --trust-node\r');
