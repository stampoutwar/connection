#!/bin/zsh
# Mirror the app into the session scratchpad so the preview server
# (which cannot read the Documents folder due to macOS privacy protection)
# can serve it. Source of truth is this app/ folder — edit here, then run this.
# Pass a destination as $1 to override (e.g. a new session's scratchpad).
set -e
SRC="${0:A:h}"
DEST="${1:-/private/tmp/claude-502/-Users-linda-Documents-POST-PTTF-CONNECTION/902475f2-d649-4e47-aa04-67b0e89b92bd/scratchpad/connection-site}"
# The master dataset lives in ../connection.csv — pull the latest copy into
# the app so it's served alongside the JSON.
cp "$SRC/../connection.csv" "$SRC/data/connection.csv"
mkdir -p "$DEST"
rsync -a --delete --copy-links --exclude sync.sh "$SRC/" "$DEST/"
echo "Synced to $DEST"
