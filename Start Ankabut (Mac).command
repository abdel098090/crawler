#!/bin/bash
# Double-click this file to start Ankabut on a Mac.
# The first time, macOS may block it: right-click the file, choose Open, then Open again.
#
# What it does:
#   1. checks that Node.js is installed (and opens the download page if not),
#   2. the first time only, downloads the parts Ankabut needs (1 to 3 minutes),
#   3. starts Ankabut and opens it in your browser.
# To stop Ankabut, close this Terminal window.

cd "$(dirname "$0")" || exit 1
# Node from nodejs.org lives in /usr/local/bin, Node from Homebrew in /opt/homebrew/bin.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo ""
echo "  Ankabut 🕷  starting..."
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is not installed yet."
  echo "  Your browser will open nodejs.org. Download the LTS version, install it,"
  echo "  then double-click this file again."
  open "https://nodejs.org/en/download"
  read -r -p "  Press Enter to close this window."
  exit 1
fi

# Ankabut needs Node 20.19 or newer.
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=19)?0:1)'; then
  echo "  Your Node.js is too old ($(node -v)). Ankabut needs version 20.19 or newer."
  echo "  Your browser will open nodejs.org. Install the LTS version, then try again."
  open "https://nodejs.org/en/download"
  read -r -p "  Press Enter to close this window."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  First start: downloading what Ankabut needs. This takes 1 to 3 minutes..."
  if ! npm install; then
    echo ""
    echo "  The download failed. Check your internet connection and try again."
    read -r -p "  Press Enter to close this window."
    exit 1
  fi
fi

echo ""
echo "  Ankabut is opening in your browser."
echo "  Keep this window open while you use it. Close it to stop Ankabut."
echo ""
npm run dev -- --open
