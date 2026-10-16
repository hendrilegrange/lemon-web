#!/usr/bin/env bash
# Prints the game's version, v1.0 and the number of the last pull request merged into this
# commit: 1.0.51 for "Merge pull request #51 from ...", or a squash merge's "Title (#51)".
# Needs enough history to reach that merge (deploy.yml checks out the last 100 commits).
set -euo pipefail
n=$(git log -100 --format=%s | grep -oE -m1 '^Merge pull request #[0-9]+|\(#[0-9]+\)$' | grep -oE '[0-9]+' || true)
echo "1.0${n:+.$n}"
