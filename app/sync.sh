#!/bin/zsh
# Mirror the app into the session scratchpad so the preview server
# (which cannot read ~/Downloads due to macOS privacy protection) can serve it.
# Source of truth stays in ~/Downloads/Connection/app — edit there, then run this.
set -e
SRC="/Users/linda/Downloads/Connection/app"
DEST="${1:-/private/tmp/claude-502/-Users-linda-Downloads-SOW/9fdc50de-ea81-4483-b20a-36ae3553cc7c/scratchpad/connection-site}"
mkdir -p "$DEST"
rsync -a --delete --copy-links --exclude sync.sh "$SRC/" "$DEST/"
echo "Synced to $DEST"
