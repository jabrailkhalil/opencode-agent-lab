#!/bin/bash
set -e
cd -- "$(dirname -- "$0")"
export PATH="$PWD/.runtime/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
node tools/stop.mjs
