#!/bin/bash
# Start Ankabut on Linux: run  ./start-linux.sh  (or double-click it and choose "Run in Terminal").
# Checks Node.js, installs what is needed the first time, starts Ankabut and opens your browser.
# To stop Ankabut, press Ctrl+C or close the terminal.

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. See the Linux section of README.md (Node 20.19 or newer)."
  exit 1
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=19)?0:1)'; then
  echo "Your Node.js is too old ($(node -v)). Ankabut needs 20.19 or newer. See README.md."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "First start: downloading what Ankabut needs (1 to 3 minutes)..."
  npm install || { echo "The download failed. Check your internet connection and try again."; exit 1; }
fi
echo "Ankabut is opening in your browser. Press Ctrl+C here to stop it."
npm run dev -- --open
