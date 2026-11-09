#!/usr/bin/env bash
# Traz data/inbox da branch "inbox" sem tocar no índice do git.
set -euo pipefail
git fetch --quiet origin inbox
git archive FETCH_HEAD data/inbox | tar -x
