const data = "NAME:	TYPE:	ADDRESS:						PUBKEY: \
test_key	local	bnb179gx6cx4df697jxtsp6shus0l0z5arem7tjnnl	bnbp1addwnpepqd9fgen2uatn7ladra55l8tf4lwk5dlux8vpzkskvy5d4ely3zslgqxccsa \
**Important** write this seed phrase in a safe place. \
It is the only way to recover your account if you ever forget your password. \
 \
clip original stereo fancy write avocado message beach real cousin tomato short trash razor chef sniff raven coffee sail safe faith car ankle elbow"
console.log('length', data.split(' ').length);

const line = "wealth bomb cause wasp pink flip delay crumble tape gather recycle sunset hello silent course poverty dutch tree quality farm void green amount mouse";
console.log('line', line.split(' ').length);

const tmpData = data.split('\n');
console.log(tmpData, tmpData.length);

var os = require('os');
var pty = require('node-pty');

var shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

var ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.env.HOME,
  env: process.env
});

const password = 'password'

let running = false
ptyProcess.on('data', function (data) {
  if (data.indexOf("parse_git_branch") != -1) {
    return;
  }

  process.stdout.write(':::::' + data);

  if (data.includes("Enter a passphrase")) {
    process.stdout.write('\nSetting password to ' + password + '\n');
    ptyProcess.write(password + '\r');
  }

  if (data.includes("Repeat the passphrase")) {
    process.stdout.write('\nConfirming password to ' + password + '\n');
    ptyProcess.write(password + '\r');
  }
});

ptyProcess.on('exit', function (exitCode, signal) {
  running = false
});

const name = "key1"
ptyProcess.write('cd /Users/dennis.won/bnbbridge/cli/node-binary/\r');
ptyProcess.write('./bnbcli keys add ' + name + '\r');
ptyProcess.write('exit\r');
running = true

setTimeout(function () {
  console.log('timeout ' + running ? 'running' : 'exited')
  if (running) {
    ptyProcess.kill()
  }
}, 5000)
