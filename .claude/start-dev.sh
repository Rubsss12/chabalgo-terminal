#!/bin/bash
export PATH="/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.2.1/bin:/usr/local/bin:$PATH"
cd "/Users/hubi006/Claude Code/chabalgo-terminal"
exec /opt/homebrew/bin/node node_modules/.bin/next dev
