#!/usr/bin/env bash
# -------------------------------------------------------------------
# build.sh – monorepo-aware build helper for Codespin Shaman
#
# Flags:
#   --install   Force npm install in every package even if node_modules exists
#   --migrate   Run DB migrations after build (delegates to root npm script)
#   --seed      Run DB seeders  after build (delegates to root npm script)
# -------------------------------------------------------------------
set -euo pipefail

echo "=== Building Codespin Shaman ==="

# 1 ▸ clean first
./clean.sh

# 2 ▸ install root deps (once)
if [[ ! -d node_modules || "$*" == *--install* ]]; then
  echo "Installing root dependencies…"
  npm install
fi

# 3 ▸ loop through every package in ./packages/
for pkg in packages/*; do
  [[ -d "$pkg" ]] || continue
  if [[ ! -d "$pkg/node_modules" || "$*" == *--install* ]]; then
    echo "Installing deps in $pkg…"
    (cd "$pkg" && npm install)
  fi
done

# 4 ▸ build each package that defines a build script
for pkg in packages/*; do
  [[ -f "$pkg/package.json" ]] || continue
  if jq -e '.scripts.build' "$pkg/package.json" >/dev/null 2>&1; then
    echo "Building $pkg…"
    (cd "$pkg" && npm run build)
  else
    echo "Skipping build for $pkg (no build script)"
  fi
done

# 5 ▸ optional migrations / seeds via root scripts
if [[ "$*" == *--migrate* ]]; then
  echo "Running database migrations…"
  npm run migrate:latest
fi

if [[ "$*" == *--seed* ]]; then
  echo "Running database seeds…"
  npm run seed:run
fi

echo "=== Build completed successfully ==="
echo "To start the application, run: ./start.sh"
