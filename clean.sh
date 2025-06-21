#!/usr/bin/env bash
# -------------------------------------------------------------------
# clean.sh – remove build artefacts across the monorepo
# -------------------------------------------------------------------
set -euo pipefail

echo "=== Cleaning Codespin Shaman ==="

# remove dist folders in every workspace that has any
for pkg in node/packages/*; do
  [[ -d "$pkg" ]] || continue
  if [[ -d "$pkg/dist" ]]; then
    echo "Cleaning $pkg/dist…"
    rm -rf "$pkg/dist"
  fi
done

echo "=== Clean completed successfully ==="
