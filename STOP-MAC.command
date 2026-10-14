#!/bin/bash
set -e
cd -- "$(dirname -- "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
node tools/stop.mjs
