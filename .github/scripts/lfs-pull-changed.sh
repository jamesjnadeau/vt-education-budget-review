#!/usr/bin/env bash
# Fetch the LFS artifacts this run needs, and record the changed ones for the
# validator.
#
# Full-corpus `git lfs pull` bills for every byte at HEAD on every run; at full
# coverage that exhausts the free bandwidth tier before the first merge of the
# month. Only artifacts that changed can have a new hash to verify, so those are
# the only large ones worth the bytes -- the per-SU budget PDFs. But the small
# AOE/reference source artifacts under intake/ are real-artifact test fixtures
# and build inputs; those are fetched every run so the tests actually run rather
# than tripping over an unfetched pointer. The monthly lfs-audit workflow
# re-verifies the whole store separately.
#
# This operates on git refs and paths only -- never on issue or PR body text --
# so there is nothing attacker-controlled to interpolate.
set -euo pipefail

EVENT="${EVENT:-}"
BASE_REF="${BASE_REF:-}"
BEFORE="${BEFORE:-}"

if [ "$EVENT" = "pull_request" ]; then
  # Checkout already fetched full history (fetch-depth: 0); this just makes sure
  # the base ref is present as a remote-tracking ref for the diff.
  git fetch --no-tags origin "$BASE_REF"
  RANGE="origin/${BASE_REF}...HEAD"
elif [ -n "$BEFORE" ] && [ "$BEFORE" != "0000000000000000000000000000000000000000" ]; then
  RANGE="${BEFORE}...HEAD"
else
  # First push to a branch, or a manual dispatch with no "before": fall back to
  # the parent commit. If even that is absent (root commit) there is nothing to
  # diff and CHANGED stays empty.
  RANGE="$(git rev-parse HEAD~1 2>/dev/null || echo HEAD)...HEAD"
fi

# Added/copied/modified/renamed intake artifacts on the LFS extension list from
# .gitattributes. --diff-filter=d drops deletions: nothing to fetch for a file
# that is gone. Newline-separated; budget filenames legitimately contain spaces,
# so this is never word-split.
CHANGED="$(git diff --name-only --diff-filter=d "$RANGE" -- 'intake/**' \
  | grep -iE '\.(pdf|xlsx|xls|doc|docx|zip)$' || true)"

# Source fixtures the real-artifact tests and the data build read. Always
# fetched, so those tests run instead of failing on a pointer. Every spreadsheet
# under intake/ is one of these: AOE delivers its extracts as small .xlsx files
# (hundreds of KB in total), while the large artifacts are the budget PDFs, which
# the glob leaves to the changed-set fetch below. Matching by extension rather
# than by directory means a new AOE source directory (aoe-adm-subgroups,
# aoe-edspend, ...) is covered the day its first test lands, instead of turning
# main red until someone remembers this list. Directory prefixes match
# everything beneath them, gitignore-style.
FIXTURES="intake/**/*.xlsx,intake/census,intake/sbe"
git lfs pull --include="$FIXTURES"

# A fixture still sitting as a pointer after the pull would surface later as an
# opaque "Doesn't look like an .xlsx file" from a test. Say what happened here.
while IFS= read -r f; do
  if head -c 40 "$f" | grep -q '^version https://git-lfs.github.com/spec/'; then
    echo "::error file=$f::LFS fixture is still a pointer after 'git lfs pull --include=$FIXTURES'"
    exit 1
  fi
done < <(git ls-files -- 'intake/**/*.xlsx')

if [ -n "$CHANGED" ]; then
  echo "Changed LFS artifacts:"
  echo "$CHANGED" | sed 's/^/  /'
  # Join newline-separated paths with commas WITHOUT word-splitting, so a
  # filename with spaces stays a single include pattern.
  git lfs pull --include="$(echo "$CHANGED" | paste -sd, -)"
else
  echo "No intake budget artifacts changed; only fixtures fetched."
fi

# Hand the changed set (not the always-on fixtures) to the validator, which
# turns "changed but still a pointer" into a hard error instead of a warning.
{
  echo "VALIDATE_CHANGED_ARTIFACTS<<EOF"
  echo "$CHANGED"
  echo "EOF"
} >> "$GITHUB_ENV"
