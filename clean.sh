#!/bin/bash

# Exit on error
set -e

# Print commands for debugging
set -x

echo "=== Cleaning Shaman App ==="

# Clean shaman server project
echo "Cleaning shaman server project..."
cd packages/shaman
rm -rf dist
cd ../..

# Clean UI project
echo "Cleaning UI project..."
cd packages/ui
rm -rf dist
cd ../..

echo "=== Clean completed successfully ===