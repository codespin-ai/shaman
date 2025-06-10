#!/bin/bash

# Change to the project directory
cd "$(dirname "$0")"

# Start the server in background
echo "Starting Shaman server..."
cd packages/shaman
npm run build
npm start &
SERVER_PID=$!

# Give the server some time to start
sleep 2

# Start the UI
echo "Starting Shaman UI..."
cd ../ui
npm run dev

# Clean up when the UI is stopped
trap "kill $SERVER_PID" EXIT