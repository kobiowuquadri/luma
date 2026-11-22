#!/usr/bin/env bash
# Runs every automated check in the repository. Exit code is non-zero if any fails.
#   bash scripts/check.sh
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
failed=()

step() {
  local name="$1"; shift
  echo
  echo "== $name"
  if ( "$@" ); then echo "-- $name: ok"; else echo "-- $name: FAILED"; failed+=("$name"); fi
}

step "API vet"            bash -c "cd '$root/api' && go vet ./..."
step "API tests"          bash -c "cd '$root/api' && go test ./..."
step "App type check"     bash -c "cd '$root/mobile' && npm run --silent typecheck"
step "App unit tests"     bash -c "cd '$root/mobile' && npm test --silent"
step "Prompt assets"      bash -c "cd '$root/mobile' && npm run --silent prompts:sync -- --check"
step "Colour contrast"    bash -c "cd '$root' && node design/check-contrast.mjs > /dev/null"
step "Website build"      bash -c "cd '$root/web' && npm run --silent build > /dev/null"

echo
if [ ${#failed[@]} -eq 0 ]; then
  echo "All checks passed."
else
  echo "Failed: ${failed[*]}"
  exit 1
fi
