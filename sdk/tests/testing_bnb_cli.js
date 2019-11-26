const bnbcli = require('../helpers/bnbcli')

bnbcli.ptyProcess.on('data', function(data) {
  process.stdout.write(data);
});

bnbcli.ptyProcess.write('cd ' + bnbcli.PATH + '\r');
bnbcli.ptyProcess.write('./' + bnbcli.FILE + ' status -n https://seed-pre-s3.binance.org:443\r');
bnbcli.ptyProcess.write('exit\r');
