#!/bin/bash
set -e
cd -- "$(dirname -- "$0")"
export PATH="$PWD/.runtime/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Install Node.js 22.14+ or 24 LTS from https://nodejs.org/en/download, then run this file again."
  read -r -p "Press Enter to close. "
  exit 1
fi
node -e "const [a,b]=process.versions.node.split('.').map(Number);if(a<22||(a===22&&b<14))process.exit(1)"
npm ci
npm run check
npm test
npm run doctor -- --json
echo "Installation complete. Open START-MAC.command."
read -r -p "Press Enter to close. "
