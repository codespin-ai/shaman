#!/bin/bash

# Exit on error
set -e

echo "Running linting across all packages..."

# Define packages in build order (from build.sh)
PACKAGES=(
  "shaman-types"
  "shaman-core"
  "shaman-config"
  "shaman-llm-core"
  "shaman-workflow-core"
  "shaman-persistence"
  "shaman-observability"
  "shaman-security"
  "shaman-external-registry"
  "shaman-git-resolver"
  "shaman-agents"
  "shaman-a2a-provider"
  "shaman-llm-vercel"
  "shaman-tool-router"
  "shaman-agent-executor"
  "shaman-workflow-bullmq"
  "shaman-workflow-temporal"
  "shaman-server"
  "shaman-worker"
  "shaman-cli"
)

# Track if any package fails
FAILED_PACKAGES=()

# Run lint for each package
for package in "${PACKAGES[@]}"; do
  PACKAGE_DIR="node/packages/${package}"
  
  if [ -d "$PACKAGE_DIR" ]; then
    echo ""
    echo "Linting @codespin/${package}..."
    
    # Check if lint script exists in package.json
    if (cd "$PACKAGE_DIR" && npm run lint --if-present); then
      echo "✓ @codespin/${package} lint passed"
    else
      echo "✗ @codespin/${package} lint failed"
      FAILED_PACKAGES+=("$package")
    fi
  else
    echo "Warning: Package directory $PACKAGE_DIR not found"
  fi
done

echo ""
echo "================================"

# Report results
if [ ${#FAILED_PACKAGES[@]} -eq 0 ]; then
  echo "✓ All packages passed linting!"
  exit 0
else
  echo "✗ Linting failed for the following packages:"
  for package in "${FAILED_PACKAGES[@]}"; do
    echo "  - @codespin/${package}"
  done
  exit 1
fi