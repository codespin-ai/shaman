#!/bin/bash

# Exit on error
set -e

# Print commands for debugging
set -x

echo "=== Building Shaman App ==="

# Clean previous builds
echo "Cleaning previous builds..."
./clean.sh

# Install dependencies if node_modules doesn't exist or if --install flag is used
if [ ! -d "node_modules" ] || [[ "$*" == *--install* ]]; then
  echo "Installing root dependencies..."
  npm install

  echo "Installing shaman server dependencies..."
  cd packages/shaman
  npm install
  cd ../..

  echo "Installing UI dependencies..."
  cd packages/ui
  npm install
  cd ../..
fi

# Build shaman server project
echo "Building shaman server project..."
cd packages/shaman
npm run build
cd ../..

# Build UI project
echo "Building UI project..."
cd packages/ui
npm run build
cd ../..

# Run database migrations if --migrate flag is used
if [[ "$*" == *--migrate* ]]; then
  echo "Running database migrations..."
  npm run migrate:latest
fi

# Run database seeds if --seed flag is used
if [[ "$*" == *--seed* ]]; then
  echo "Running database seeds..."
  npm run seed:run
fi

echo "=== Build completed successfully ==="
echo "To start the application, run: ./start.sh"