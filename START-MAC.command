#!/bin/bash
set -e
cd -- "$(dirname -- "$0")"
export PATH="$PWD/.runtime/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Install Node.js and run INSTALL-MAC.command first."
  read -r -p "Press Enter to close. "
  exit 1
fi
if [ ! -d node_modules ]; then npm ci; fi
npm run check
npm start -- --open
