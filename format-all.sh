#!/usr/bin/env bash

set -euo pipefail

# Check for --check flag
CHECK_FLAG=""
if [[ "${1:-}" == "--check" ]]; then
  CHECK_FLAG="--check"
  echo "Checking formatting across all files..."
else
  echo "Formatting all files with prettier..."
fi

# Run prettier from the root directory
if [ -n "$CHECK_FLAG" ]; then
  npx prettier $CHECK_FLAG .
else
  npx prettier --write .
fi

echo "✅ Formatting complete!"