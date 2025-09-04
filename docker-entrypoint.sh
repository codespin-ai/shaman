#!/bin/sh
set -e

echo "Starting Shaman application..."
echo "Environment: ${NODE_ENV:-development}"
echo "Port: ${PORT:-5002}"

# Run migrations if enabled
if [ "${SHAMAN_AUTO_MIGRATE}" = "true" ]; then
  echo "Running database migrations..."
  npm run migrate:shaman:latest || {
    echo "Warning: Migrations failed or database not available"
  }
fi

# Run seeds if enabled (only in development)
if [ "${SHAMAN_AUTO_SEED}" = "true" ] && [ "${NODE_ENV}" != "production" ]; then
  echo "Running database seeds..."
  npm run seed:shaman:run || {
    echo "Warning: Seeds failed or database not available"
  }
fi

# Start the application
exec "$@"