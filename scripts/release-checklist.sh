#!/usr/bin/env bash
set -euo pipefail

echo "Running lint..."
npm --prefix frontend run lint

echo "Running typecheck..."
npx --prefix frontend tsc --noEmit

echo "Running tests..."
npm --prefix frontend run test

echo "Running build..."
npm --prefix frontend run build

echo "Running API smoke test..."
npx tsx scripts/smoke-api.mjs

echo "Release checklist complete."
