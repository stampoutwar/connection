#!/bin/zsh
# Double-click me to start the exhibition.
# Starts the local server (if not already running) and opens the browser.
cd "$(dirname "$0")"
PORT=8642

if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Starting the exhibition server on http://localhost:$PORT ..."
  python3 serve.py &
  SERVER_PID=$!
  sleep 1
else
  echo "Server already running on http://localhost:$PORT"
fi

open "http://localhost:$PORT"

if [[ -n "$SERVER_PID" ]]; then
  echo ""
  echo "The exhibition is running. Keep this window open while you use it."
  echo "Press Ctrl+C (or close this window) to stop."
  wait $SERVER_PID
fi
