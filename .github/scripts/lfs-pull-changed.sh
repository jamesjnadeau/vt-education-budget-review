#!/usr/bin/env bash
# Fetch only the intake LFS artifacts that changed in this event, and record
# their paths for the validator.
#
# Full-corpus `git lfs pull` bills for every byte at HEAD on every run; at full
# coverage that exhausts the free bandwidth tier before the first merge of the
# month. Only artifacts that changed can have a new hash to verify, so those are
# the only ones worth the bytes. The monthly lfs-audit workflow re-verifies the
# whole store separately.
#
# This operates on git refs and paths only -- never on issue or PR body text --
# so there is nothing attacker-controlled to interpolate.
set -euo pipefail

EVENT="${EVENT:-}"
BASE_REF="${BASE_REF:-}"
BEFORE="${BEFORE:-}"

if [ "$EVENT" = "pull_request" ]; then
  git fetch --no-tags --depth=0 origin "$BASE_REF"
  RANGE="origin/${BASE_REF}...HEAD"
elif [ -n "$BEFORE" ] && [ "$BEFORE" != "0000000000000000000000000000000000000000" ]; then
  RANGE="${BEFORE}...HEAD"
else
  # First push to a branch, or a manual dispatch with no "before": fall back to
  # the parent commit. If even that is absent (root commit) there is nothing to
  # diff, and CHANGED stays empty.
  RANGE="$(git rev-parse HEAD~1 2>/dev/null || echo HEAD)...HEAD"
fi

# Added/copied/modified/renamed intake artifacts on the LFS extension list from
# .gitattributes. --diff-filter=d drops deletions: there is nothing to fetch for
# a file that is gone.
CHANGED="$(git diff --name-only --diff-filter=d "$RANGE" -- 'intake/**' \
  | grep -iE '\.(pdf|xlsx|xls|doc|docx|zip)$' || true)"

if [ -n "$CHANGED" ]; then
  echo "Changed LFS artifacts:"
  echo "$CHANGED" | sed 's/^/  /'
  INCLUDES="$(echo "$CHANGED" | paste -sd, -)"
  git lfs pull --include="$INCLUDES"
else
  echo "No intake LFS artifacts changed; skipping fetch."
fi

# Hand the list to the validator, which turns "changed but still a pointer" into
# a hard error instead of a warning.
{
  echo "VALIDATE_CHANGED_ARTIFACTS<<EOF"
  echo "$CHANGED"
  echo "EOF"
} >> "$GITHUB_ENV"
