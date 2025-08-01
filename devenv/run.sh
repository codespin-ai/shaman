#!/bin/bash
set -e
cd "$(dirname "$0")"

if (( $# < 1 ))
then
  echo "Usage: $0 up|down|verbose|logs [service_name]"
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

# Detect if we should use rootless Docker configuration
# Check if we're running on Linux and not in a container
if [[ "$OSTYPE" == "linux-gnu"* ]] && [ ! -f /.dockerenv ]; then
    # Check if Docker is running in rootless mode
    if docker info 2>/dev/null | grep -q "rootless"; then
        echo "Detected rootless Docker on Linux, using rootless configuration..."
        COMPOSE_FILE="docker-compose-rootless.yml"
    else
        echo "Using standard Docker configuration..."
        COMPOSE_FILE="docker-compose.yml"
    fi
else
    # macOS or running inside a container
    COMPOSE_FILE="docker-compose.yml"
fi

COMMAND=$1

case $COMMAND in
  verbose)
      docker compose -f "$COMPOSE_FILE" --verbose up 
  ;;
  up)
      docker compose -f "$COMPOSE_FILE" up -d
  ;;
  down)
      docker compose -f "$COMPOSE_FILE" down
  ;;
  logs)
      if [ -z "$2" ]; then
        echo "Error: service name is required for logs command."
        echo "Usage: $0 logs <service_name>"
        exit 1
      fi
      docker compose -f "$COMPOSE_FILE" logs -f "$2"
  ;;
  *)
    echo "Invalid command: $COMMAND"
    echo "Usage: $0 up|down|verbose|logs [service_name]"
    exit 1
  ;;
esac