#!/bin/bash
set -e
cd "$(dirname "$0")"

# Parse options
NO_ROOTLESS=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --no-rootless)
      NO_ROOTLESS=true
      shift
      ;;
    *)
      break
      ;;
  esac
done

if (( $# < 1 ))
then
  echo "Usage: $0 [--no-rootless] up|down|verbose|logs [service_name]"
  echo ""
  echo "Options:"
  echo "  --no-rootless    Force non-rootless mode on Linux"
  echo ""
  echo "Commands:"
  echo "  up               Start services in detached mode"
  echo "  down             Stop and remove services"
  echo "  verbose          Start services with verbose output"
  echo "  logs [service]   Follow logs for a specific service"
  exit 1
fi

# create pg data dir
if [ ! -d pgdata ]; then
  echo creating data dir...
  mkdir pgdata;
fi

COMMAND=$1

# Detect if we should use rootless mode
USE_ROOTLESS=false
if [[ "$OSTYPE" == "linux-gnu"* ]] && [[ "$NO_ROOTLESS" == "false" ]]; then
  USE_ROOTLESS=true
fi

if [[ "$USE_ROOTLESS" == "true" ]]; then
  echo "Running in rootless mode (Linux detected). Use --no-rootless to force standard mode."
  
  # copy /etc/passwd to a temp file readable by non-root
  ETC_PASSWD=`mktemp`
  cp /etc/passwd $ETC_PASSWD
  
  RUNAS_UID="$(id -u)"
  RUNAS_GID="$(id -g)"
  
  case $COMMAND in
    verbose)
      ETC_PASSWD=$ETC_PASSWD RUNAS_UID=$RUNAS_UID RUNAS_GID=$RUNAS_GID docker compose -f docker-compose-rootless.yml --verbose up 
      ;;
    up)
      ETC_PASSWD=$ETC_PASSWD RUNAS_UID=$RUNAS_UID RUNAS_GID=$RUNAS_GID docker compose -f docker-compose-rootless.yml up -d
      ;;
    down)
      ETC_PASSWD=$ETC_PASSWD RUNAS_UID=$RUNAS_UID RUNAS_GID=$RUNAS_GID docker compose -f docker-compose-rootless.yml down
      ;;
    logs)
      if [ -z "$2" ]; then
        echo "Error: service name is required for logs command."
        echo "Usage: $0 logs <service_name>"
        exit 1
      fi
      ETC_PASSWD=$ETC_PASSWD RUNAS_UID=$RUNAS_UID RUNAS_GID=$RUNAS_GID docker compose -f docker-compose-rootless.yml logs -f "$2"
      ;;
    *)
      echo "Invalid command: $COMMAND"
      echo "Usage: $0 [--no-rootless] up|down|verbose|logs [service_name]"
      exit 1
      ;;
  esac
else
  echo "Running in standard mode."
  
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
    logs)
      if [ -z "$2" ]; then
        echo "Error: service name is required for logs command."
        echo "Usage: $0 logs <service_name>"
        exit 1
      fi
      docker compose logs -f "$2"
      ;;
    *)
      echo "Invalid command: $COMMAND"
      echo "Usage: $0 [--no-rootless] up|down|verbose|logs [service_name]"
      exit 1
      ;;
  esac
fi