const bnbcli = require('../helpers/bnbcli')

const KEY_NAME = "key"
const PASSWORD = ""

bnbcli.ptyProcess.on('data', function(data) {
  process.stdout.write(data);

  if(data.includes("Enter a passphrase")) {
    // process.stdout.write('Setting password to '+PASSWORD);
    bnbcli.ptyProcess.write(PASSWORD+'\r');
  }

  if(data.includes("Repeat the passphrase")) {
    // process.stdout.write('Confirming password to '+PASSWORD);
    bnbcli.ptyProcess.write(PASSWORD+'\r');
  }

  if(data.includes("**Important**")) {
    // process.stdout.write(data);

    const tmpData = data.replace(/\s\s+/g, ' ').replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').split(' ');
    const publicKey = tmpData[6]
    const privateKey = tmpData[7]
    const seedPhrase = tmpData.slice(33, 57).join(' ')
    console.log(publicKey)
    console.log(privateKey)
    console.log(seedPhrase)

    bnbcli.ptyProcess.write('exit\r');
  }

  if(data.includes("override the existing name")) {
    process.stdout.write('Overwriting key');
    bnbcli.ptyProcess.write('y\r');
  }
});

bnbcli.ptyProcess.write('cd ' + bnbcli.PATH + '\r');
bnbcli.ptyProcess.write('./' + bnbcli.FILE + ' keys add ' + KEY_NAME + '\r');
