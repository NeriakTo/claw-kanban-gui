#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

CONFIG_FILE="$HOME/.openclaw/openclaw.json"
PLUGIN_ID=$(node -e "process.stdout.write(require('./openclaw.plugin.json').id)")

# Save existing plugin config (apiKey etc.) before uninstall wipes it
SAVED_CONFIG=$(node -e "
  const c = require('$CONFIG_FILE');
  const cfg = c.plugins?.entries?.['$PLUGIN_ID']?.config;
  if (cfg) process.stdout.write(JSON.stringify(cfg));
" 2>/dev/null || true)

# Build and pack
echo "==> Building..."
npm run build

echo "==> Packing..."
TARBALL=$(npm pack --json 2>/dev/null | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))[0].filename)")

if [ ! -f "$TARBALL" ]; then
  echo "ERROR: tarball not found: $TARBALL"
  exit 1
fi

FULLPATH="$(pwd)/$TARBALL"

echo "==> Uninstalling $PLUGIN_ID..."
echo y | openclaw plugins uninstall "$PLUGIN_ID" 2>/dev/null || true

echo "==> Installing $FULLPATH..."
openclaw plugins install "$FULLPATH"

# Restore saved config (apiKey etc.)
if [ -n "$SAVED_CONFIG" ]; then
  echo "==> Restoring plugin config..."
  node -e "
    const fs = require('fs');
    const c = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
    c.plugins.entries['$PLUGIN_ID'].config = $SAVED_CONFIG;
    fs.writeFileSync('$CONFIG_FILE', JSON.stringify(c, null, 2) + '\n');
  "
  echo "    Config restored."
fi

echo "==> Cleaning up tarball..."
rm -f "$TARBALL"

echo "==> Done. Restart the gateway to load the new plugin."
