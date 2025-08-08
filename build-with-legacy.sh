#!/usr/bin/env bash
# -------------------------------------------------------------------
# build-with-legacy.sh – Build with legacy peer deps
# -------------------------------------------------------------------
set -euo pipefail

echo "=== Building Codespin Shaman (with legacy peer deps) ==="

# Define the build order
PACKAGES=(
  "shaman-types"
  "shaman-logger"
  "shaman-core"
  "shaman-config"
  "shaman-llm-core"
  "shaman-db"
  "shaman-observability"
  "shaman-security"
  "shaman-external-registry"
  "shaman-git-resolver"
  "shaman-agents"
  "shaman-a2a-protocol"
  "shaman-jsonrpc"
  "shaman-a2a-transport"
  "shaman-a2a-client"
  "shaman-llm-vercel"
  "shaman-tool-router"
  "shaman-agent-executor"
  "shaman-a2a-server"
  "shaman-gql-server"
  "shaman-worker"
  "shaman-cli"
  "shaman-integration-tests"
)

# 1 ▸ clean first
./clean.sh

# 2 ▸ install root deps (once)
if [[ ! -d node_modules || "$*" == *--install* ]]; then
  echo "Installing root dependencies with legacy peer deps…"
  npm install --legacy-peer-deps
fi

# 3 ▸ loop through every package in build order
for pkg_name in "${PACKAGES[@]}"; do
  pkg="node/packages/$pkg_name"
  if [[ ! -d "$pkg" ]]; then
    echo "Package $pkg not found, skipping."
    continue
  fi
  if [[ ! -d "$pkg/node_modules" || "$*" == *--install* ]]; then
    echo "Installing deps in $pkg with legacy peer deps…"
    (cd "$pkg" && npm install --legacy-peer-deps)
  fi
done

# 4 ▸ build each package that defines a build script, in order
for pkg_name in "${PACKAGES[@]}"; do
  pkg="node/packages/$pkg_name"
  if [[ ! -f "$pkg/package.json" ]]; then
    continue
  fi
  # Use node to check for build script instead of jq
  if node -e "process.exit(require('./$pkg/package.json').scripts?.build ? 0 : 1)"; then
    echo "Building $pkg…"
    (cd "$pkg" && npm run build)
  else
    echo "Skipping build for $pkg (no build script)"
  fi
done

echo "=== Build completed successfully ==="