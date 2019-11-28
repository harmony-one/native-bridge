#!/bin/bash

if test -f "env_var_setup.sh"; then
 echo "running env_var_setup.sh"
 source './env_var_setup.sh'
fi

if [[ -z $DBUSER ]]; then
  echo "Export DBUSER to environment variable"
  exit
fi

if [[ -z $DBPASSWORD ]]; then
  echo "Export DBPASSWORD to environment variable"
  exit
fi

if [[ -z $DBNAME ]]; then
  echo "Export DBNAME to environment variable"
  exit
fi

if [[ -z $ENCRYPTION_KEY ]]; then
  echo "Export ENCRYPTION_KEY to environment variable"
  exit
fi

set +o history

# linux only
# sudo adduser $DBUSER
# sudo -u postgres createuser --superuser $DBUSER
# sudo -u postgres psql -c "ALTER USER $DBUSER WITH PASSWORD '$DBPASSWORD';"
# psql -c "ALTER USER $DBUSER WITH PASSWORD $DBPASSWORD;"

# sudo -u $DBUSER dropdb $DBNAME
# sudo -u $DBUSER createdb -O $DBUSER $DBNAME
# Creating tables from setup.sql

# centos only:
# sudo cp ${PWD}/setup.sql /tmp/setup.sql
# sql_file=${PWD}/setup.sql # if centos, /tmp/setup.sql
# echo 'sudo -u $DBUSER psql "postgresql://$DBUSER:$DBPASSWORD@$DBHOST/$DBNAME" -f $sql_file'
# sudo -u $DBUSER psql "postgresql://$DBUSER:$DBPASSWORD@$DBHOST/$DBNAME" -f $sql_file

# Gen encryption keys and encrypted password
var=$(ISTESTNET=0 PRIVATE_KEY=$BNB_FOUNDATION_ACCT_PRIVATE_KEY ENCRYPTION_KEY=$BNB_FOUNDATION_ACCT_PRIVATE_KEY CLIPASSWORD=$CLIPASSWORD node keygen_bnb.js)
bnbPubKey=$(echo $var | cut -d, -f1)
bnbAddress=$(echo $var | cut -d, -f2)
bnbEncrSeed=$(echo $var | cut -d, -f3)
bnbEncrKey=$(echo $var | cut -d, -f4)
echo "bnbEncrSeed = $bnbEncrSeed"
echo "bnbEncrKey = $bnbEncrKey"
echo "bnbPubKey = $bnbPubKey"
echo "bnbAddress = $bnbAddress"

var=$(ISTESTNET=0 ADDRESS=$HMY_FOUNDATION_ACCT_ADDRESS PRIVATE_KEY=$HMY_FOUNDATION_ACCT_PRIVATE_KEY ENCRYPTION_KEY=$ENCRYPTION_KEY CLIPASSWORD=$CLIPASSWORD node keygen_general.js)
hmyAddress=$(echo $var | cut -d, -f1)
hmyEncrSeed=$(echo $var | cut -d, -f2)
hmyEncrKey=$(echo $var | cut -d, -f3)
echo "hmyEncrSeed = $hmyEncrSeed"
echo "hmyEncrKey = $hmyEncrKey"
echo "hmyAddress = $hmyAddress"

var=$(ISTESTNET=0 ADDRESS=$ETH_FOUNDATION_ACCT_ADDRESS PRIVATE_KEY=$ETH_FOUNDATION_ACCT_PRIVATE_KEY ENCRYPTION_KEY=$ENCRYPTION_KEY CLIPASSWORD=$CLIPASSWORD node keygen_general.js)
ethAddress=$(echo $var | cut -d, -f1)
ethEncrSeed=$(echo $var | cut -d, -f2)
ethEncrKey=$(echo $var | cut -d, -f3)
echo "ethEncrSeed = $ethEncrSeed"
echo "ethEncrKey = $ethEncrKey"
echo "ethAddress = $ethAddress"

echo "erc20_address = " ${ERC20_ADDRESS}

set -o history

sudo -u $DBSUPERUSER psql $DBNAME -c "
  insert into eth_accounts (uuid, private_key, address, encr_key) VALUES (
    'erc_account_uuid',
    '$ethEncrSeed',
    '$ethAddress',
    '$ethEncrKey'
  );
"

sudo -u $DBSUPERUSER psql $DBNAME -c "
  insert into hmy_accounts (uuid, private_key, address, encr_key) VALUES (
    'hmy_account_uuid',
    '$hmyEncrSeed',
    '$hmyAddress',
    '$hmyEncrKey'
  );
"

sudo -u $DBSUPERUSER psql $DBNAME -c "
  INSERT INTO bnb_accounts VALUES (
    'bnb_account_uuid',
    '$bnbPubKey',
    '$bnbEncrSeed',
    '$bnbAddress',
    'bnbcli-keyname-optional',
    '$bnbEncrKey',
   timezone('utc', now())
  );
"

token_uuid=Harmony_One

# {"mintable":true,"name":"Harmony.One","original_symbol":"ONE",
# "owner":"bnb1a03uvqmnqzl85csnxnsx2xy28m76gkkht46f2l","symbol":"ONE-5F9",
# "total_supply":"12600000000.00000000"}

sudo -u $DBSUPERUSER psql $DBNAME -c "
  insert into tokens (
    uuid,
    name,
    symbol,
    unique_symbol,
    total_supply,
    erc20_address,
    eth_account_uuid,
    bnb_account_uuid,
    hmy_account_uuid,
    processed,
    listing_proposed,
    listing_proposal_uuid,
    listed,
    created,
    mintable,
    minimum_swap_amount,
    fee_per_swap,
    process_date,
    bnb_to_eth_enabled,
    eth_to_bnb_enabled
  ) values (
    '$token_uuid', 'Harmony.One', 'ONE', 'ONE-5F9', 12600000000.00000000,
    '$ERC20_ADDRESS',
    'erc_account_uuid', 'bnb_account_uuid', 'hmy_account_uuid',
    true, true, 'list_proposal_uuid',
    true, timezone('utc', now()), true, 0, 0, timezone('utc', now()), true, true
  );
"
