#!/bin/bash
set -e
cd "$(dirname "$0")"

if (( $# < 1 ))
then
  echo "Usage run.sh up/down"
  exit 1
fi

# create pg data dir
if [ ! -d pgdata ]; then
  echo creating data dir...
  mkdir pgdata;
fi

# create redis data dir
if [ ! -d redisdata ]; then
  echo creating redis data dir...
  mkdir redisdata;
fi

COMMAND=$1

case $COMMAND in
  verbose)
      docker compose --verbose up 
  ;;
  up)
      docker compose up -d
  ;;
  down)
      docker compose down
  ;;
esac