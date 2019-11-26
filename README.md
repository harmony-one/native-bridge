# BNBridge

![Image of Harmony BNBridge](https://lh3.googleusercontent.com/RNB_taEMPEbGLRumeHw9Q3aNoYSAlZ9whUI41X8mfU07zN7jcaWU-qaKucoa2kaWjvtqmd9wmN1zdtVJMu_qQia6QykFw3AYE2ryCPJi_3GmEXJxwkqLsdppSqFcuQFyenEBpTN2yL4bm5YmdhpnUuI_MJaLK_PdmC80l2S0QpknkKVT2CbfFeX9JcSD-e94pnTRsIximI6rGymjLdgrF_CD6yZc1wMUGIyklQlLMBJDjYKD1Rq4Il_QfQqacl4AvQIR5zMyvA3SVCV2-sXisWBXFeVfH2VUYM8jwmXCw6es-IY9BayVoZKLfAXHpR7EwUAuVzCAbBj2aqKglIxB0Abi-1mnuDt5IjcD13ys6J_hudA7oB78Ft_OJRo4a-Jo8PhLJyrZKkD-LRduv4tvkWcp2JUvgqW0y-zt8GBPmboYNHhHQrrKxtN5Iasyy5gifezJ0PNb3ObsWfxijyvV08RH3k8WVGqQ4du10lk3RMH128IhmA8dqZeDxqWkp5jYNsA-ll8MMFg-njXvtXcJkPL2O7FIkUAkbx-KtpYFUpe8mvdNKSuerCQZhEbpPM6hj7wvT-LshTAPiPfjYgUBT4wVFSnq91tNxGBd5W77H6KQtuFmZr345llgieD2hkfEakdcP7Yp_QjUcKwQdpnMMKq0FFloRAmTqbUXPTkeO-pRaT2Ddzdgc0YkH7_vuSD8I3eVMRcyi-y7KnEC3QTCLgDwiCtBXAFSffpCggG7PJkUSQ=w1003-h933-no)

### Features:
- [x] Token swap from BEP2 to ERC20 for Harmony.One (ONE).
- [x] Create a new BNB account.

### Repository
## ./bnbridge
Front end website allowing for BNB to ERC bridge support.

## ./cli
Binance CLI utility.

## ./sdk
API used to interact with the CLI utility, Binance javascript SDK and Web3.js to enable BNB to ERC bridge utility.

### Installation
    sudo apt-get install libudev-dev libusb-dev usbutils
    (for unix/linux) npm install --save node-pty-linux

    first, install bnbcli binaries following https://docs.binance.org/api-reference/cli.html#cli-installation
    and place the binaries (bnbcli/tbnbcli) in cli/node-binary directory.

    mkdir -p <root>/cli/node-binary;
    git clone https://github.com/binance-chain/node-binary.git
    cp */0.5.8.1/linux/*bnbcli <root>/cli/node-binary/.

    git clone the repo

    cd ./sdk
    npm install
    
    for AWS linux, if you see error `/usr/bin/ld: cannot find -lusb-1.0` during npm install in /sdk
    run `sudo yum install libusb1-devel`
    
    run ./sdk/(testnet/mainnet)_setup.sh
    this will internally ./sql/setup.sql to instantiate the DB.
    update ./config/index.js with
        - databse connection details.
        - Binance cli path.
        - Binance connection details for mainnet/testnet.
        - Ethereum connection details for mainnet/testnet.
    node ./api.bnbridge.exchange.js
    or
    pm2 start api.bnbridge.exchange.js

    cd ../bnbridge

    npm install
    vi ./src/config.js
    Modify config urls that the bnbridge.excahnge API is running at. (http://localhost:5000 by default)
