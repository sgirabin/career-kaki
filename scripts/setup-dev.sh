#!/usr/bin/env bash
set -euo pipefail

# Setup local Node dev environment using nvm and install dependencies for apps/web
# Usage: ./scripts/setup-dev.sh

echo "== CareerKaki Dev Setup =="

# Load nvm if present
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  source "$HOME/.nvm/nvm.sh"
fi

if ! command -v nvm >/dev/null 2>&1; then
  echo "nvm not found — installing nvm..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.6/install.sh | bash
  # shellcheck source=/dev/null
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

NODE_VERSION="24"

echo "Using Node $NODE_VERSION (installing if necessary)"
nvm install "$NODE_VERSION" >/dev/null
nvm use "$NODE_VERSION"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/apps/web"

echo "Installing frontend dependencies (apps/web)..."
# prefer ci when lockfile exists
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "Dev setup complete. Start the dev server with:"
echo "  cd apps/web && npm run dev"

exit 0
