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

if [[ -z $BNB_ENCRYPTION_KEY ]]; then
  echo "Export BNB_ENCRYPTION_KEY to environment variable"
  exit
fi

if [[ -z $BNB_PRIVATE_KEY ]]; then
  echo "Export BNB_PRIVATE_KEY to environment variable"
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
var=$(ISTESTNET=0 BNB_PRIVATE_KEY=$BNB_PRIVATE_KEY BNB_ENCRYPTION_KEY=$BNB_ENCRYPTION_KEY CLIPASSWORD=$CLIPASSWORD node keygen.js)
bnbPubKey=$(echo $var | cut -d, -f1)
bnbAddress=$(echo $var | cut -d, -f2)
bnbEncrSeed=$(echo $var | cut -d, -f3)
bnbEncrKey=$(echo $var | cut -d, -f4)
echo "bnbEncrSeed = $bnbEncrSeed"
echo "bnbEncrClipassword = $bnbEncrClipassword"
echo "bnbEncrKey = $bnbEncrKey"
echo "bnbPubKey = $bnbPubKey"
echo "bnbAddress = $bnbAddress"

echo "erc20_address = " ${ERC20_ADDRESS}
echo "eth_account_address = ${ETH_ACCOUNT_ADDRESS}"
echo "eth_private_key = ${ETH_PRIVATE_KEY}"

set -o history

sudo -u $DBSUPERUSER psql $DBNAME -c "
  insert into eth_accounts (uuid, private_key, address) VALUES (
    'erc_account_uuid',
    '$ETH_PRIVATE_KEY',
    '$ETH_ACCOUNT_ADDRESS'
  );
"

# sudo -u $DBSUPERUSER psql $DBNAME -c "
#   insert into client_accounts_eth VALUES (
#     'erc_account_uuid',
#     '$ETH_ACCOUNT_ADDRESS',
#     'bnb_account_uuid_client',
#    timezone(\'utc\', now())
#   );
# "

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

# CLIENT_PRIVATE_KEY=
# CLIENT_KEY=hmy_client

# Gen encryption keys and encrypted password
# var=$(ISTESTNET=1 PRIVATE_KEY=$CLIENT_PRIVATE_KEY KEY=$CLIENT_KEY CLIPASSWORD=$CLIENT_CLIPASSWORD node keygen.js)
# clientBnbPubKey=$(echo $var | cut -d, -f1)
# clientBnbAddress=$(echo $var | cut -d, -f2)
# clientBnbEncrSeed=$(echo $var | cut -d, -f3)
# clientBnbEncrKey=$(echo $var | cut -d, -f4)
# echo "clientBnbEncrSeed = $clientBnbEncrSeed"
# echo "clientBnbEncrClipassword = $clientBnbEncrClipassword"
# echo "clientBnbEncrKey = $clientBnbEncrKey"
# echo "clientBnbPubKey = $clientBnbPubKey"
# echo "clientBnbAddress = $clientBnbAddress"

# sudo -u $DBSUPERUSER psql $DBNAME -c "
#   INSERT INTO client_bnb_accounts VALUES (
#     'bnb_account_uuid_client',
#     '$clientBnbPubKey',
#     '$clientBnbEncrSeed',
#     '$clientBnbAddress',
#     'client-bnbcli-keyname-optional',
#     '$clientBnbEncrKey',
#    timezone(\'utc\', now())
#   );
# "

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
    'erc_account_uuid', 'bnb_account_uuid',
    true, true, 'list_proposal_uuid',
    true, timezone('utc', now()), true, 0, 0, timezone('utc', now()), true, true
  );
"

# You should keep your own copy of the following secrets. unset to ensure safety.
# You might also need to clear bash history to avoid leaking secrets.

# Postgres
unset DBHOST
unset DBNAME
unset DBUSER
unset DBPASSWORD
unset DBPASSWORDESC

# Harmony.One token issue bnb account. Note that this data does not equal the actual encription or private key
# of ONE foundation bnb account. dummy data.
unset BNB_ENCRYPTION_KEY
unset BNB_PRIVATE_KEY

# Harmony.One ERC20 smart contract
unset ERC20_ADDRESS

# Ethereum account used to fund BEP2->ERC20 swap
unset ETH_ACCOUNT_ADDRESS
unset ETH_PRIVATE_KEY
